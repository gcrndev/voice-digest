# Voice Daily Digest

PWA + Cloudflare Worker + local sync for voice captures into the Obsidian vault.

Remote Worker states are intentionally limited to `uploaded` and `synced`.
Transcription and digestion status are local-only, tracked in `sync-manifest.json`
and vault note frontmatter.

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

## Cloudflare Git Deploy

Use Cloudflare Workers Builds to connect this GitHub repository directly to the Worker.
No GitHub Actions workflow is required.

Recommended Cloudflare build settings:

- Production branch: `main`
- Root directory: `/`
- Build command: `npm run typecheck`
- Deploy command: `npx wrangler deploy`

Worker runtime secrets such as `PAIRING_TOKEN` should stay in Cloudflare and local
`.dev.vars`; do not commit them.

Cloudflare resources:

- R2 bucket: `voice-daily-digest`
- KV namespace binding: `DEVICE_REGISTRY`

## Local Sync And Transcription

Create `voice-sync.env` from `voice-sync.env.example`, install the optional
transcription dependency, then run:

```powershell
pip install -r requirements-transcribe.txt
```

```powershell
python scripts/sync_voice_captures.py --all
```

The script creates a local ignored `sync-manifest.json` automatically to avoid
duplicating downloads across runs.

Downloaded audio lands in:

```text
C:\repositories\secondbrain\Meta\audio-captures\YYYY\MM\
```

With `--all`, pending audio is synced first and then synced captures are
transcribed into inbox notes.

## Separate Local Transcription

If audio was already synced and you only want to transcribe later, run:

```powershell
python scripts/sync_voice_captures.py --transcribe
```

Use this only when you want to run transcription separately from sync.

To sync without transcription, run:

```powershell
python scripts/sync_voice_captures.py
```

The transcription step only creates inbox notes after audio has been transcribed.

To transcribe one local audio file for testing or recovery:

```powershell
python scripts/sync_voice_captures.py --audio C:\path\to\capture.webm
```

## Future Integrations

See `FUTURE-INTEGRATION-PLAN.md`.

## Usage

See `USAGE.md` for the step-by-step workflow.
