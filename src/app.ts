export const appHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101418">
  <link rel="manifest" href="/manifest.webmanifest">
  <title>Voice Daily Digest</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: oklch(18% 0.012 235);
      color: oklch(95% 0.012 84);
      --surface: oklch(23% 0.016 235);
      --surface-strong: oklch(28% 0.018 235);
      --line: oklch(38% 0.018 235);
      --muted: oklch(78% 0.018 235);
      --accent: oklch(82% 0.12 78);
      --accent-strong: oklch(76% 0.14 58);
      --danger: oklch(63% 0.2 28);
      --danger-deep: oklch(48% 0.17 28);
      --ok: oklch(72% 0.13 156);
      --shadow: 0 24px 80px rgba(3, 8, 13, 0.34);
    }
    * { box-sizing: border-box; }
    html { width: 100%; overflow-x: hidden; }
    body {
      margin: 0;
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom));
      overflow-x: hidden;
    }
    main { width: min(480px, 100%); display: grid; gap: 18px; }
    .app-title { display: grid; gap: 6px; text-align: center; }
    .eyebrow { margin: 0; color: var(--accent); font-size: 12px; font-weight: 760; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(30px, 9vw, 42px); line-height: 1; letter-spacing: 0; }
    .subtitle { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.45; }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
      padding: clamp(18px, 5vw, 26px);
      display: grid;
      gap: 18px;
    }
    .pair-form { display: grid; gap: 14px; }
    label { display: grid; gap: 8px; font-size: 14px; color: var(--muted); }
    input {
      width: 100%;
      min-height: 50px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: oklch(18% 0.012 235);
      color: oklch(95% 0.012 84);
      padding: 12px 13px;
      font: inherit;
    }
    input:focus-visible, button:focus-visible { outline: 3px solid color-mix(in oklch, var(--accent), transparent 45%); outline-offset: 3px; }
    button {
      min-height: 50px;
      border: 0;
      border-radius: 7px;
      font: inherit;
      font-weight: 720;
      color: oklch(18% 0.012 235);
      background: var(--accent);
      cursor: pointer;
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out;
    }
    button:active { transform: translateY(1px) scale(0.99); }
    button.secondary { color: oklch(95% 0.012 84); background: var(--surface-strong); }
    button.ghost { min-height: 38px; color: var(--muted); background: transparent; font-size: 13px; font-weight: 650; }
    button:disabled { cursor: not-allowed; opacity: 0.45; transform: none; }
    audio { width: 100%; }
    .muted { color: var(--muted); font-size: 14px; line-height: 1.4; }
    .hidden { display: none; }
    .record-shell { min-height: min(640px, calc(100dvh - 150px)); align-content: space-between; }
    .device-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .device-row .muted { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recorder-stage { display: grid; justify-items: center; gap: 20px; padding: 18px 0 10px; }
    .status-pill {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 12px;
      color: var(--muted);
      background: oklch(20% 0.014 235);
      font-size: 14px;
      font-weight: 650;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--ok); }
    .timer {
      font-variant-numeric: tabular-nums;
      font-size: clamp(42px, 17vw, 72px);
      font-weight: 780;
      line-height: 1;
    }
    .record-button {
      width: clamp(148px, 48vw, 190px);
      aspect-ratio: 1;
      min-height: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: oklch(17% 0.012 235);
      background: radial-gradient(circle at 50% 38%, oklch(86% 0.13 80), var(--accent-strong));
      box-shadow: 0 18px 48px rgba(239, 168, 57, 0.24), inset 0 -10px 24px rgba(54, 37, 8, 0.18);
      touch-action: manipulation;
    }
    .record-inner { display: grid; justify-items: center; gap: 10px; }
    .record-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.92;
    }
    .record-label { font-size: 18px; }
    .record-panel[data-mode="recording"] .record-button {
      color: oklch(97% 0.012 36);
      background: radial-gradient(circle at 50% 38%, var(--danger), var(--danger-deep));
      box-shadow: 0 18px 52px rgba(200, 50, 32, 0.34), 0 0 0 12px rgba(200, 50, 32, 0.08);
      animation: pulse 1300ms ease-out infinite;
    }
    .record-panel[data-mode="recording"] .record-icon { border-radius: 10px; width: 38px; height: 38px; }
    .record-panel[data-mode="recording"] .status-dot { background: var(--danger); }
    .record-panel[data-mode="ready"] .status-dot { background: var(--accent); }
    .preview-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: oklch(20% 0.014 235);
      padding: 12px;
      display: grid;
      gap: 12px;
    }
    .preview-card.hidden { display: none; }
    .actions { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 10px; }
    #status { min-height: 24px; color: var(--muted); text-align: center; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 18px 52px rgba(200, 50, 32, 0.34), 0 0 0 10px rgba(200, 50, 32, 0.06); }
      50% { box-shadow: 0 18px 52px rgba(200, 50, 32, 0.38), 0 0 0 18px rgba(200, 50, 32, 0.02); }
    }
    @media (max-width: 380px) {
      body { padding-inline: 12px; }
      .panel { padding: 16px; }
      .actions { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main>
    <header class="app-title">
      <p class="eyebrow">Captura rapida</p>
      <h1>Voice Daily Digest</h1>
      <p class="subtitle">Grave uma ideia, envie, depois sincronize com o vault.</p>
    </header>
    <section id="pairPanel" class="panel">
      <form id="pairForm" class="pair-form">
        <label>
          Token de pareamento
          <input id="pairingToken" type="password" autocomplete="off" placeholder="PAIRING_TOKEN">
        </label>
        <label>
          Nome do dispositivo
          <input id="deviceName" autocomplete="off" placeholder="Celular principal">
        </label>
        <button id="pair" type="submit">Parear dispositivo</button>
      </form>
      <div class="muted">Use o token uma vez. Depois este browser assina os envios sozinho.</div>
    </section>
    <section id="recordPanel" class="panel record-panel record-shell hidden" data-mode="idle">
      <div class="device-row">
        <div class="muted" id="deviceStatus"></div>
        <button id="resetDevice" class="ghost">Desparear</button>
      </div>
      <div class="recorder-stage">
        <div class="status-pill"><span class="status-dot"></span><span id="statusPill">Pronto</span></div>
        <div id="timer" class="timer">00:00</div>
        <button id="record" class="record-button" aria-label="Gravar audio">
          <span class="record-inner">
            <span class="record-icon"></span>
            <span id="recordLabel" class="record-label">Gravar</span>
          </span>
        </button>
        <div id="status">Toque para comecar.</div>
      </div>
      <div id="previewCard" class="preview-card hidden">
        <audio id="preview" controls></audio>
        <div class="actions">
          <button id="upload" disabled>Enviar audio</button>
          <button id="discard" class="secondary" disabled>Descartar</button>
        </div>
      </div>
    </section>
  </main>
  <script>
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

    const pairPanel = document.querySelector("#pairPanel");
    const pairForm = document.querySelector("#pairForm");
    const recordPanel = document.querySelector("#recordPanel");
    const pairingTokenInput = document.querySelector("#pairingToken");
    const deviceNameInput = document.querySelector("#deviceName");
    const pairButton = document.querySelector("#pair");
    const resetDeviceButton = document.querySelector("#resetDevice");
    const deviceStatus = document.querySelector("#deviceStatus");
    const recordButton = document.querySelector("#record");
    const recordLabel = document.querySelector("#recordLabel");
    const uploadButton = document.querySelector("#upload");
    const discardButton = document.querySelector("#discard");
    const previewCard = document.querySelector("#previewCard");
    const preview = document.querySelector("#preview");
    const statusEl = document.querySelector("#status");
    const statusPill = document.querySelector("#statusPill");
    const timerEl = document.querySelector("#timer");

    let recorder;
    let chunks = [];
    let audioBlob;
    let previewUrl;
    let activeStream;
    let timerInterval;
    let recordingStartedAt;

    function getDevice() {
      const raw = localStorage.getItem("voiceDigestDevice");
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    function saveDevice(device) {
      localStorage.setItem("voiceDigestDevice", JSON.stringify(device));
      renderDeviceState();
    }

    function renderDeviceState() {
      const device = getDevice();
      pairPanel.classList.toggle("hidden", Boolean(device));
      recordPanel.classList.toggle("hidden", !device);
      if (device) {
        deviceStatus.textContent = "Pareado: " + (device.name || device.device_id.slice(0, 8));
      }
    }

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function setMode(mode, label, status) {
      recordPanel.dataset.mode = mode;
      statusPill.textContent = label;
      setStatus(status);
    }

    function formatDuration(ms) {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return minutes + ":" + seconds;
    }

    function startTimer() {
      recordingStartedAt = Date.now();
      timerEl.textContent = "00:00";
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timerEl.textContent = formatDuration(Date.now() - recordingStartedAt);
      }, 250);
    }

    function stopTimer() {
      clearInterval(timerInterval);
      timerInterval = undefined;
    }

    function resetCapture() {
      chunks = [];
      audioBlob = undefined;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = undefined;
      previewCard.classList.add("hidden");
      preview.removeAttribute("src");
      uploadButton.disabled = true;
      discardButton.disabled = true;
      recordButton.disabled = false;
      recordButton.setAttribute("aria-label", "Gravar audio");
      recordLabel.textContent = "Gravar";
      timerEl.textContent = "00:00";
      setMode("idle", "Pronto", "Toque para comecar.");
    }

    async function pairDevice() {
      const token = pairingTokenInput.value.trim();
      const name = deviceNameInput.value.trim() || navigator.userAgent.slice(0, 60);
      if (!token) return;

      pairButton.disabled = true;
      pairButton.textContent = "Pareando...";
      const response = await fetch("/api/pair", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });
      const result = await response.json().catch(() => ({}));
      pairButton.disabled = false;
      pairButton.textContent = "Parear dispositivo";

      if (!response.ok) {
        alert(result.error || "Falha no pareamento.");
        return;
      }

      saveDevice({
        device_id: result.device_id,
        device_secret: result.device_secret,
        name
      });
      pairingTokenInput.value = "";
    }

    async function signedFetch(path, options = {}) {
      const device = getDevice();
      if (!device) throw new Error("missing_device");

      const method = (options.method || "GET").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD" && options.body;
      const body = hasBody ? options.body : "";
      const bodyBuffer = typeof body === "string" ? new TextEncoder().encode(body) : await body.arrayBuffer();
      const bodyHash = await sha256Hex(bodyBuffer);
      const timestamp = new Date().toISOString();
      const nonce = crypto.randomUUID();
      const canonical = [method, path, timestamp, nonce, bodyHash].join("\\n");
      const signature = await hmacHex(device.device_secret, canonical);
      const headers = new Headers(options.headers || {});

      headers.set("X-Device-Id", device.device_id);
      headers.set("X-Timestamp", timestamp);
      headers.set("X-Nonce", nonce);
      headers.set("X-Body-SHA256", bodyHash);
      headers.set("X-Signature", signature);

      const requestOptions = { ...options, method, headers };
      if (hasBody) requestOptions.body = body;
      return fetch(path, requestOptions);
    }

    async function hmacHex(secret, message) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
      return toHex(signature);
    }

    async function sha256Hex(buffer) {
      return toHex(await crypto.subtle.digest("SHA-256", buffer));
    }

    function toHex(buffer) {
      return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }

    pairForm.addEventListener("submit", event => {
      event.preventDefault();
      pairDevice();
    });

    resetDeviceButton.addEventListener("click", () => {
      localStorage.removeItem("voiceDigestDevice");
      resetCapture();
      renderDeviceState();
    });

    async function startRecording() {
      resetCapture();
      if (!navigator.mediaDevices?.getUserMedia) {
        setMode("idle", "Microfone indisponivel", "Este navegador nao permite gravacao de audio.");
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setMode("idle", "Sem permissao", "Permita o microfone para gravar.");
        return;
      }

      activeStream = stream;
      const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined;
      recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = () => {
        stopTimer();
        activeStream?.getTracks().forEach(track => track.stop());
        activeStream = undefined;
        audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        previewUrl = URL.createObjectURL(audioBlob);
        preview.src = previewUrl;
        previewCard.classList.remove("hidden");
        uploadButton.disabled = false;
        discardButton.disabled = false;
        recordButton.disabled = false;
        recordButton.setAttribute("aria-label", "Gravar novo audio");
        recordLabel.textContent = "Novo";
        setMode("ready", "Audio pronto", "Revise ou envie.");
      };
      recorder.start();
      startTimer();
      recordButton.setAttribute("aria-label", "Parar gravacao");
      recordLabel.textContent = "Parar";
      setMode("recording", "Gravando", "Toque novamente para parar.");
    }

    function stopRecording() {
      if (recorder?.state === "recording") {
        recordButton.disabled = true;
        recorder.stop();
      }
    }

    recordButton.addEventListener("click", () => {
      if (recorder?.state === "recording") {
        stopRecording();
        return;
      }
      startRecording();
    });

    discardButton.addEventListener("click", () => {
      resetCapture();
      setStatus("Audio descartado.");
    });

    uploadButton.addEventListener("click", async () => {
      if (!audioBlob) return;
      uploadButton.disabled = true;
      discardButton.disabled = true;
      setStatus("Enviando...");
      const response = await signedFetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": audioBlob.type || "audio/webm"
        },
        body: audioBlob
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        uploadButton.disabled = false;
        discardButton.disabled = false;
        setStatus(result.error || "Falha no upload.");
        return;
      }
      resetCapture();
      setMode("idle", "Enviado", "Enviado: " + result.id);
    });

    renderDeviceState();
  </script>
</body>
</html>`;

export const manifestJson = JSON.stringify({
  name: "Voice Daily Digest",
  short_name: "Daily Voice",
  start_url: "/",
  display: "standalone",
  background_color: "#101418",
  theme_color: "#101418",
  icons: [
    {
      src: "/favicon.svg",
      sizes: "any",
      type: "image/svg+xml"
    }
  ]
});

export const serviceWorkerJs = `self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));`;

export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#101418"/>
<path d="M22 28a10 10 0 0 1 20 0v8a10 10 0 0 1-20 0z" fill="#f0c45c"/>
<path d="M16 34v2a16 16 0 0 0 32 0v-2" fill="none" stroke="#f4f1e8" stroke-width="5" stroke-linecap="round"/>
<path d="M32 52v-8" stroke="#f4f1e8" stroke-width="5" stroke-linecap="round"/>
</svg>`;
