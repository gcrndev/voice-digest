# Voice Daily Digest - Future Integration Plan

## Current MVP

- Mobile PWA records and uploads audio.
- Cloudflare Worker stores audio in R2 and tracks device auth in KV.
- Local PC sync downloads pending audio into the Obsidian vault.
- Local transcription uses `faster-whisper` on CPU.
- Transcribed `voice-capture` notes land in `00-Inbox`.
- The vault inbox workflow classifies voice captures like normal raw notes, integrates daily material into `07-Daily`, and archives processed captures.

## Next Integrations

### 1. Background Sync

- Add a Windows Task Scheduler job.
- Run sync and transcription on a fixed interval:

```powershell
python scripts/sync_voice_captures.py
python scripts/sync_voice_captures.py --transcribe
```

- Log output to local ignored files.

### 2. Vault Skill Hardening

- Add more examples to the inbox triage skill:
  - daily reflection
  - project idea
  - standalone task
  - person fact
  - unclear capture needing clarification
- Keep the rule: voice captures are classified by transcript, not daily by default.

### 3. Remote Status Lifecycle

- Keep Worker/R2 states limited to `uploaded` and `synced`.
- Track local-only states in `sync-manifest.json` and vault frontmatter:
  - `transcribed`
  - `pending-digestion`
  - `digested`
- Decide whether remote audio should be retained or deleted after a grace period.

### 4. Device Management

- Add a small admin script to list and revoke paired devices from KV.
- Keep pairing token for registration only.

### 5. Quality Improvements

- Benchmark `medium` against `large-v3-turbo` for Portuguese accuracy.
- Add confidence notes when transcript is short, unclear, or likely mistranscribed.
- Consider optional manual correction before inbox triage.

### 6. UX Improvements

- Show upload history in the PWA.
- Show clearer upload/sync status.
- Add a reinstall/reset pairing path that is hard to trigger accidentally.

## Non-Goals For Now

- Paid transcription APIs.
- WhatsApp or Telegram bot.
- Native mobile app.
- Obsidian plugin.
- Full automatic daily generation without user review.
