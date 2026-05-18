# Voice Daily Digest - Uso

Este projeto serve para gravar audios no celular, enviar para um Cloudflare Worker e depois sincronizar/transcrever tudo para o vault Obsidian local.

## Fluxo diario

Se o projeto ja esta configurado e as dependencias ja foram instaladas, este e o fluxo normal:

1. Abra no celular:

```text
https://voice-daily-digest.gcrndev.workers.dev
```

2. Grave o audio e envie.

3. No computador, rode:

```powershell
cd C:\repositories\voice-daily-digest
python scripts\sync_voice_captures.py --all
```

Isso baixa os audios pendentes, transcreve e cria notas em:

```text
C:\repositories\secondbrain\00-Inbox\
```

4. Para organizar as notas, abra Codex no vault:

```powershell
cd C:\repositories\secondbrain
```

Depois peca:

```text
organizar inbox
```

## Setup inicial

Faca esta parte so uma vez, ou quando trocar de maquina/ambiente.

### 1. Preparar o projeto

No PowerShell:

```powershell
cd C:\repositories\voice-daily-digest
npm install
```

Crie os arquivos locais de configuracao, se ainda nao existirem:

```powershell
Copy-Item .dev.vars.example .dev.vars
Copy-Item voice-sync.env.example voice-sync.env
```

Edite:

- `.dev.vars`: define o `PAIRING_TOKEN` usado para parear o celular.
- `voice-sync.env`: define a URL do Worker, credenciais do dispositivo e caminho do vault.

Nao commite esses arquivos.

### 2. Instalar dependencias de transcricao

```powershell
pip install -r requirements-transcribe.txt
```

Nao precisa rodar isso no dia a dia se o ambiente Python continua o mesmo.

### 3. Rodar localmente para testar

```powershell
npm run dev
```

Abra a URL local mostrada pelo Wrangler.

Use o token de `.dev.vars` para parear o navegador. Depois disso, o navegador guarda o dispositivo no `localStorage`.

### 4. Parear o celular em producao

Abra:

```text
https://voice-daily-digest.gcrndev.workers.dev
```

Se ainda nao estiver pareado:

1. Copie o `PAIRING_TOKEN` de `.dev.vars`.
2. Cole na tela de pareamento.
3. Informe um nome para o dispositivo.
4. Clique em parear.

Depois:

1. Clique em gravar.
2. Fale a nota.
3. Clique em parar.
4. Ouca se quiser revisar.
5. Clique em enviar.

## O que o comando principal faz

Comando:

```powershell
python scripts\sync_voice_captures.py --all
```

Os audios sao baixados para:

```text
C:\repositories\secondbrain\Meta\audio-captures\YYYY\MM\
```

As notas transcritas sao criadas em:

```text
C:\repositories\secondbrain\00-Inbox\
```

O arquivo `sync-manifest.json` controla o que ja foi sincronizado e transcrito.

Depois, o fluxo `organizar inbox` le as notas em `00-Inbox`, classifica os voice captures pelo transcript e move o que foi processado para o lugar certo no vault.

## Comandos uteis

Sincronizar sem transcrever:

```powershell
python scripts\sync_voice_captures.py
```

Transcrever audios ja sincronizados:

```powershell
python scripts\sync_voice_captures.py --transcribe
```

Ver uploads pendentes sem baixar:

```powershell
python scripts\sync_voice_captures.py --dry-run
```

Simular sync + transcricao sem gravar arquivos:

```powershell
python scripts\sync_voice_captures.py --all --dry-run
```

Ver audios sincronizados pendentes de transcricao:

```powershell
python scripts\sync_voice_captures.py --transcribe --dry-run
```

Transcrever um arquivo local especifico:

```powershell
python scripts\sync_voice_captures.py --audio C:\path\to\capture.webm
```

Validar o projeto:

```powershell
npm run typecheck
python -m py_compile scripts\sync_voice_captures.py
```

## Deploy

Antes de publicar:

```powershell
npm run typecheck
```

Publicar no Cloudflare:

```powershell
npm run deploy
```

Recursos esperados no Cloudflare:

- Worker: `voice-daily-digest`
- R2 bucket: `voice-daily-digest`
- KV binding: `DEVICE_REGISTRY`
- Secret: `PAIRING_TOKEN`
