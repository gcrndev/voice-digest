#!/usr/bin/env python3
"""Sync and locally transcribe Voice Daily Digest audio captures."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
import pathlib
import sys
import uuid
import urllib.error
import urllib.request


ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "voice-sync.env"
MANIFEST_PATH = ROOT / "sync-manifest.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync pending voice captures into the local vault.")
    parser.add_argument("--config", default=str(CONFIG_PATH), help="Path to env-style config file.")
    parser.add_argument("--dry-run", action="store_true", help="List pending captures without downloading.")
    parser.add_argument("--transcribe", action="store_true", help="Transcribe synced captures and create inbox notes.")
    parser.add_argument("--all", action="store_true", help="Sync pending captures, then transcribe synced captures.")
    parser.add_argument("--audio", help="Transcribe one local audio file without calling the Worker.")
    args = parser.parse_args()

    config = load_config(pathlib.Path(args.config))
    base_url = require(config, "VOICE_DIGEST_BASE_URL").rstrip("/")
    device_id = require(config, "VOICE_DIGEST_DEVICE_ID")
    device_secret = require(config, "VOICE_DIGEST_DEVICE_SECRET")
    vault_root = pathlib.Path(require(config, "VOICE_DIGEST_VAULT_ROOT"))

    manifest = load_manifest()
    client = SignedClient(base_url, device_id, device_secret)
    if args.audio:
        return transcribe_local_audio(config, vault_root, pathlib.Path(args.audio), args.dry_run)

    if args.all:
        sync_result = sync_pending_captures(vault_root, manifest, client, args.dry_run)
        if sync_result != 0:
            return sync_result
        return transcribe_synced_captures(config, vault_root, manifest, client, args.dry_run)

    if args.transcribe:
        return transcribe_synced_captures(config, vault_root, manifest, client, args.dry_run)

    return sync_pending_captures(vault_root, manifest, client, args.dry_run)


def sync_pending_captures(
    vault_root: pathlib.Path,
    manifest: dict,
    client: "SignedClient",
    dry_run: bool,
) -> int:
    pending = client.json_request("GET", "/api/pending").get("items", [])
    if not pending:
        print("No pending captures.")
        return 0

    print(f"Pending captures: {len(pending)}")
    for item in pending:
        capture_id = item["id"]
        if capture_id in manifest.get("synced_ids", []):
            print(f"Skip already synced locally: {capture_id}")
            continue

        created_at = parse_iso(item["created_at"])
        relative_audio_path = audio_relative_path(created_at, capture_id)
        target_path = vault_root / relative_audio_path

        if dry_run:
            print(f"Would download {capture_id} -> {target_path}")
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        audio = client.bytes_request("GET", item["download_url"])
        target_path.write_bytes(audio)
        client.json_request("POST", f"/api/audio/{capture_id}/status", {"status": "synced"})

        manifest.setdefault("synced_ids", []).append(capture_id)
        manifest.setdefault("captures", {})[capture_id] = {
            "created_at": item["created_at"],
            "audio_file": str(relative_audio_path).replace("\\", "/"),
            "remote_status": "synced",
            "synced_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "size_bytes": len(audio),
        }
        save_manifest(manifest)
        print(f"Synced {capture_id} -> {target_path}")

    return 0


def transcribe_synced_captures(
    config: dict[str, str],
    vault_root: pathlib.Path,
    manifest: dict,
    client: "SignedClient",
    dry_run: bool,
) -> int:
    captures = manifest.get("captures", {})
    pending = [
        (capture_id, capture)
        for capture_id, capture in captures.items()
        if capture.get("remote_status") == "synced" and not capture.get("note_file")
    ]

    if not pending:
        print("No synced captures pending transcription.")
        return 0

    print(f"Synced captures pending transcription: {len(pending)}")
    transcriber = None if dry_run else FasterWhisperTranscriber(config)
    for capture_id, capture in pending:
        created_at = parse_iso(capture["created_at"])
        audio_path = vault_root / pathlib.Path(capture["audio_file"])
        relative_note_path = note_relative_path(created_at, capture_id)
        note_path = vault_root / relative_note_path

        if dry_run:
            print(f"Would transcribe {audio_path}")
            print(f"Would create note -> {note_path}")
            continue

        if not audio_path.exists():
            print(f"Skip missing audio: {audio_path}", file=sys.stderr)
            continue

        result = transcriber.transcribe(audio_path)
        write_capture_note(
            note_path=note_path,
            created_at=created_at,
            capture_id=capture_id,
            audio_path=pathlib.Path(capture["audio_file"]),
            transcript=result.text,
            engine=result.engine,
            confidence=result.confidence,
        )
        capture["note_file"] = str(relative_note_path).replace("\\", "/")
        capture["local_status"] = "transcribed"
        capture["transcribed_at"] = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
        capture["transcription_engine"] = result.engine
        capture["transcription_confidence"] = result.confidence
        save_manifest(manifest)
        print(f"Transcribed {capture_id} -> {note_path}")

    return 0


def transcribe_local_audio(
    config: dict[str, str],
    vault_root: pathlib.Path,
    audio_path: pathlib.Path,
    dry_run: bool,
) -> int:
    audio_path = audio_path.resolve()
    if not audio_path.exists():
        raise RuntimeError(f"Audio file not found: {audio_path}")

    capture_id = audio_path.stem
    created_at = created_at_from_capture_id(capture_id, audio_path)
    relative_audio_path = audio_path.relative_to(vault_root)
    relative_note_path = note_relative_path(created_at, capture_id)
    note_path = vault_root / relative_note_path

    if dry_run:
        print(f"Would transcribe {audio_path}")
        print(f"Would create note -> {note_path}")
        return 0

    result = FasterWhisperTranscriber(config).transcribe(audio_path)
    write_capture_note(
        note_path=note_path,
        created_at=created_at,
        capture_id=capture_id,
        audio_path=relative_audio_path,
        transcript=result.text,
        engine=result.engine,
        confidence=result.confidence,
    )
    print(f"Transcribed local audio -> {note_path}")
    return 0


class SignedClient:
    def __init__(self, base_url: str, device_id: str, device_secret: str) -> None:
        self.base_url = base_url
        self.device_id = device_id
        self.device_secret = device_secret.encode("utf-8")

    def json_request(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = b"" if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"content-type": "application/json"} if payload is not None else {}
        data = self.request(method, path, body, headers)
        return json.loads(data.decode("utf-8"))

    def bytes_request(self, method: str, path: str) -> bytes:
        return self.request(method, path, b"", {})

    def request(self, method: str, path: str, body: bytes, headers: dict[str, str]) -> bytes:
        body_hash = hashlib.sha256(body).hexdigest()
        timestamp = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
        nonce = str(uuid.uuid4())
        canonical = "\n".join([method.upper(), path, timestamp, nonce, body_hash])
        signature = hmac.new(self.device_secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()

        signed_headers = {
            **headers,
            "user-agent": "VoiceDailyDigestSync/0.1",
            "accept": "application/json, audio/webm, */*",
            "x-device-id": self.device_id,
            "x-timestamp": timestamp,
            "x-nonce": nonce,
            "x-body-sha256": body_hash,
            "x-signature": signature,
        }
        request = urllib.request.Request(
            self.base_url + path,
            data=body if method.upper() not in {"GET", "HEAD"} else None,
            headers=signed_headers,
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {error.code} {path}: {detail}") from error


class TranscriptionResult:
    def __init__(self, text: str, engine: str, confidence: str) -> None:
        self.text = text
        self.engine = engine
        self.confidence = confidence


class FasterWhisperTranscriber:
    def __init__(self, config: dict[str, str]) -> None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError(
                "Missing faster-whisper. Install it with: pip install faster-whisper"
            ) from exc

        self.model_name = config.get("VOICE_DIGEST_WHISPER_MODEL", "small")
        self.language = empty_to_none(config.get("VOICE_DIGEST_TRANSCRIPTION_LANGUAGE", "pt"))
        device = config.get("VOICE_DIGEST_WHISPER_DEVICE", "cpu")
        compute_type = config.get("VOICE_DIGEST_WHISPER_COMPUTE_TYPE", "int8")
        self.model = WhisperModel(self.model_name, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: pathlib.Path) -> TranscriptionResult:
        segments, _info = self.model.transcribe(str(audio_path), language=self.language)
        text = "\n".join(segment.text.strip() for segment in segments if segment.text.strip())
        confidence = "medium" if text else "low"
        return TranscriptionResult(
            text=text or "_No speech detected._",
            engine=f"faster-whisper:{self.model_name}",
            confidence=confidence,
        )


def load_config(path: pathlib.Path) -> dict[str, str]:
    config: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip().strip('"')
    return {**os.environ, **config}


def require(config: dict[str, str], key: str) -> str:
    value = config.get(key)
    if not value:
        raise RuntimeError(f"Missing config: {key}")
    return value


def empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"synced_ids": [], "captures": {}}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def created_at_from_capture_id(capture_id: str, audio_path: pathlib.Path) -> dt.datetime:
    prefix = capture_id.split("-", 1)[0]
    try:
        return dt.datetime.strptime(prefix, "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc)
    except ValueError:
        mtime = dt.datetime.fromtimestamp(audio_path.stat().st_mtime, tz=dt.timezone.utc)
        return mtime


def audio_relative_path(created_at: dt.datetime, capture_id: str) -> pathlib.Path:
    return pathlib.Path(
        "Meta",
        "audio-captures",
        f"{created_at.year:04d}",
        f"{created_at.month:02d}",
        f"{capture_id}.webm",
    )


def note_relative_path(created_at: dt.datetime, capture_id: str) -> pathlib.Path:
    timestamp = created_at.astimezone(dt.timezone.utc).strftime("%Y-%m-%d-%H%M")
    return pathlib.Path("00-Inbox", f"{timestamp}-voice-capture-{capture_id}.md")


def write_capture_note(
    note_path: pathlib.Path,
    created_at: dt.datetime,
    capture_id: str,
    audio_path: pathlib.Path,
    transcript: str,
    engine: str,
    confidence: str,
) -> None:
    if note_path.exists():
        return

    note_path.parent.mkdir(parents=True, exist_ok=True)
    created = created_at.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    audio_file = str(audio_path).replace("\\", "/")
    content = f"""---
type: voice-capture
status: pending-digestion
created: {created}
source: pwa
audio_file: {audio_file}
transcription_engine: {engine}
confidence: {confidence}
remote_id: {capture_id}
---

# Voice Capture - {created}

## Transcript

{transcript.strip()}

## Initial Understanding

_Pending agent digestion._

## Canonical Fact Candidates

_Pending agent digestion._
"""
    note_path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
