# Voice Daily Digest - Usage

## 1. Record On Phone

Open the production PWA:

```text
https://voice-daily-digest.gcrndev.workers.dev
```

If the browser is not paired yet:

1. Open `.dev.vars` locally.
2. Copy `PAIRING_TOKEN`.
3. Paste it into the PWA pairing screen.
4. Pair once.

After pairing, record audio and tap upload.

## 2. Sync Audio To Vault

Run from this repo:

```powershell
cd C:\repositories\voice-daily-digest
python scripts\sync_voice_captures.py
```

This downloads pending remote audio into:

```text
C:\repositories\secondbrain\Meta\audio-captures\YYYY\MM\
```

Remote Worker/R2 status changes from `uploaded` to `synced`.

## 3. Transcribe Locally

Install transcription dependency once:

```powershell
cd C:\repositories\voice-daily-digest
pip install -r requirements-transcribe.txt
```

Transcribe synced captures:

```powershell
python scripts\sync_voice_captures.py --transcribe
```

This creates `voice-capture` notes in:

```text
C:\repositories\secondbrain\00-Inbox\
```

Transcription status is local only. It is tracked in `sync-manifest.json` and vault note frontmatter.

## 4. Organize Inbox In Vault

Open Codex in the vault:

```powershell
cd C:\repositories\secondbrain
```

Then say:

```text
organizar inbox
```

The inbox workflow will:

- read normal notes and voice captures
- classify voice captures by transcript
- integrate daily material into `07-Daily`
- route project/area/reference/person material like normal notes
- archive processed voice captures under `04-Archive/Voice Captures/YYYY/MM/`
- leave `00-Inbox` empty except `_index.md`

## 5. Useful Checks

Check pending remote uploads without downloading:

```powershell
python scripts\sync_voice_captures.py --dry-run
```

Check synced captures pending transcription:

```powershell
python scripts\sync_voice_captures.py --transcribe --dry-run
```

Transcribe one local audio file manually:

```powershell
python scripts\sync_voice_captures.py --audio C:\path\to\capture.webm
```

Validate code:

```powershell
npm run typecheck
python -m py_compile scripts\sync_voice_captures.py
```

## Current Local Config

Expected `voice-sync.env` keys:

```text
VOICE_DIGEST_BASE_URL=https://voice-daily-digest.gcrndev.workers.dev
VOICE_DIGEST_DEVICE_ID=<paired-device-id>
VOICE_DIGEST_DEVICE_SECRET=<paired-device-secret>
VOICE_DIGEST_VAULT_ROOT=C:\repositories\secondbrain
VOICE_DIGEST_WHISPER_MODEL=medium
VOICE_DIGEST_WHISPER_DEVICE=cpu
VOICE_DIGEST_WHISPER_COMPUTE_TYPE=int8
VOICE_DIGEST_TRANSCRIPTION_LANGUAGE=pt
```

Do not commit `voice-sync.env`, `.dev.vars`, `sync-manifest.json`, or local logs.
