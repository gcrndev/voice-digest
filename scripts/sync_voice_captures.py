#!/usr/bin/env python3
"""Download pending Voice Daily Digest audio captures from the Worker."""

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
    args = parser.parse_args()

    config = load_config(pathlib.Path(args.config))
    base_url = require(config, "VOICE_DIGEST_BASE_URL").rstrip("/")
    device_id = require(config, "VOICE_DIGEST_DEVICE_ID")
    device_secret = require(config, "VOICE_DIGEST_DEVICE_SECRET")
    vault_root = pathlib.Path(require(config, "VOICE_DIGEST_VAULT_ROOT"))

    manifest = load_manifest()
    client = SignedClient(base_url, device_id, device_secret)
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

        if args.dry_run:
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


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"synced_ids": [], "captures": {}}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def audio_relative_path(created_at: dt.datetime, capture_id: str) -> pathlib.Path:
    return pathlib.Path(
        "Meta",
        "audio-captures",
        f"{created_at.year:04d}",
        f"{created_at.month:02d}",
        f"{capture_id}.webm",
    )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
