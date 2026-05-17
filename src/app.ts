export const appHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101418">
  <link rel="manifest" href="/manifest.webmanifest">
  <title>Voice Daily Digest</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101418; color: #f4f1e8; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(520px, 100%); display: grid; gap: 18px; }
    h1 { margin: 0; font-size: 32px; line-height: 1.05; letter-spacing: 0; }
    .panel { border: 1px solid #303842; border-radius: 8px; background: #171d23; padding: 16px; display: grid; gap: 14px; }
    label { display: grid; gap: 8px; font-size: 14px; color: #cfd6df; }
    input { width: 100%; border: 1px solid #3a4652; border-radius: 6px; background: #0f1419; color: #f4f1e8; padding: 12px; font: inherit; }
    .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    button { min-height: 48px; border: 0; border-radius: 6px; font: inherit; font-weight: 650; color: #101418; background: #f0c45c; }
    button.secondary { color: #f4f1e8; background: #26313c; }
    button:disabled { opacity: 0.45; }
    audio { width: 100%; }
    .muted { color: #b7c4cf; font-size: 14px; line-height: 1.4; }
    .hidden { display: none; }
    #status { min-height: 24px; color: #b7c4cf; }
  </style>
</head>
<body>
  <main>
    <h1>Voice Daily Digest</h1>
    <section id="pairPanel" class="panel">
      <label>
        Token de pareamento
        <input id="pairingToken" type="password" autocomplete="off" placeholder="PAIRING_TOKEN">
      </label>
      <label>
        Nome do dispositivo
        <input id="deviceName" autocomplete="off" placeholder="Celular principal">
      </label>
      <button id="pair">Parear dispositivo</button>
      <div class="muted">Use o token uma vez. Depois este browser assina os envios sozinho.</div>
    </section>
    <section id="recordPanel" class="panel hidden">
      <div class="muted" id="deviceStatus"></div>
      <div class="controls">
        <button id="record">Gravar</button>
        <button id="stop" class="secondary" disabled>Parar</button>
      </div>
      <audio id="preview" controls hidden></audio>
      <div class="controls">
        <button id="upload" disabled>Enviar</button>
        <button id="discard" class="secondary" disabled>Descartar</button>
      </div>
      <button id="resetDevice" class="secondary">Remover pareamento local</button>
      <div id="status">Pronto.</div>
    </section>
  </main>
  <script>
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

    const pairPanel = document.querySelector("#pairPanel");
    const recordPanel = document.querySelector("#recordPanel");
    const pairingTokenInput = document.querySelector("#pairingToken");
    const deviceNameInput = document.querySelector("#deviceName");
    const pairButton = document.querySelector("#pair");
    const resetDeviceButton = document.querySelector("#resetDevice");
    const deviceStatus = document.querySelector("#deviceStatus");
    const recordButton = document.querySelector("#record");
    const stopButton = document.querySelector("#stop");
    const uploadButton = document.querySelector("#upload");
    const discardButton = document.querySelector("#discard");
    const preview = document.querySelector("#preview");
    const statusEl = document.querySelector("#status");

    let recorder;
    let chunks = [];
    let audioBlob;

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

    function resetCapture() {
      chunks = [];
      audioBlob = undefined;
      preview.hidden = true;
      preview.removeAttribute("src");
      uploadButton.disabled = true;
      discardButton.disabled = true;
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

    pairButton.addEventListener("click", pairDevice);

    resetDeviceButton.addEventListener("click", () => {
      localStorage.removeItem("voiceDigestDevice");
      resetCapture();
      renderDeviceState();
    });

    recordButton.addEventListener("click", async () => {
      resetCapture();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = event => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        audioBlob = new Blob(chunks, { type: "audio/webm" });
        preview.src = URL.createObjectURL(audioBlob);
        preview.hidden = false;
        uploadButton.disabled = false;
        discardButton.disabled = false;
        recordButton.disabled = false;
        stopButton.disabled = true;
        setStatus("Audio pronto para envio.");
      };
      recorder.start();
      recordButton.disabled = true;
      stopButton.disabled = false;
      setStatus("Gravando...");
    });

    stopButton.addEventListener("click", () => recorder?.stop());

    discardButton.addEventListener("click", () => {
      resetCapture();
      setStatus("Audio descartado.");
    });

    uploadButton.addEventListener("click", async () => {
      if (!audioBlob) return;
      uploadButton.disabled = true;
      setStatus("Enviando...");
      const response = await signedFetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "audio/webm"
        },
        body: audioBlob
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        uploadButton.disabled = false;
        setStatus(result.error || "Falha no upload.");
        return;
      }
      resetCapture();
      setStatus("Enviado: " + result.id);
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
