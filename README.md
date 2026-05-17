# Voice Daily Digest

PWA + Cloudflare Worker + local sync for voice captures into the Obsidian vault.

Vault root:

```text
C:\repositories\secondbrain
```

Production URL:

```text
https://voice-daily-digest.gcrndev.workers.dev
```

## Development

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

Local pairing token lives in `.dev.vars`.

## Deploy

```powershell
npm run typecheck
npm run deploy
```

Cloudflare resources:

- R2 bucket: `voice-daily-digest`
- KV namespace binding: `DEVICE_REGISTRY`

## Local Sync

Create `voice-sync.env` from `voice-sync.env.example`, then run:

```powershell
python scripts/sync_voice_captures.py
```

Downloaded audio lands in:

```text
C:\repositories\secondbrain\Meta\audio-captures\YYYY\MM\
```
