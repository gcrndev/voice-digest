import { appHtml, faviconSvg, manifestJson, serviceWorkerJs } from "./app";

interface Env {
  VOICE_AUDIO: R2Bucket;
  DEVICE_REGISTRY: KVNamespace;
  PAIRING_TOKEN: string;
  MAX_UPLOAD_BYTES?: string;
}

type Status = "uploaded" | "synced";

interface RegisteredDevice {
  id: string;
  name: string;
  secret: string;
  created_at: string;
  last_seen_at?: string;
  revoked?: boolean;
}

const statuses: Status[] = ["uploaded", "synced"];
const signatureWindowMs = 5 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return html(appHtml);
    }

    if (url.pathname === "/manifest.webmanifest") {
      return json(JSON.parse(manifestJson));
    }

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") {
      return new Response(faviconSvg, {
        headers: { "content-type": "image/svg+xml; charset=utf-8" }
      });
    }

    if (url.pathname === "/sw.js") {
      return new Response(serviceWorkerJs, {
        headers: { "content-type": "text/javascript; charset=utf-8" }
      });
    }

    if (!url.pathname.startsWith("/api/")) {
      return json({ error: "not_found" }, 404);
    }

    if (url.pathname === "/api/pair" && request.method === "POST") {
      return pairDevice(request, env);
    }

    const auth = await verifyDeviceSignature(request, env);
    if (!auth.ok) {
      return json({ error: auth.error }, 401);
    }

    if (url.pathname === "/api/upload" && request.method === "POST") {
      return uploadAudio(request, env, auth.device.id);
    }

    if (url.pathname === "/api/pending" && request.method === "GET") {
      return listPending(request, env);
    }

    const audioMatch = url.pathname.match(/^\/api\/audio\/([^/]+)$/);
    if (audioMatch && request.method === "GET") {
      return downloadAudio(audioMatch[1], env);
    }

    const statusMatch = url.pathname.match(/^\/api\/audio\/([^/]+)\/status$/);
    if (statusMatch && request.method === "POST") {
      return updateStatus(statusMatch[1], request, env);
    }

    return json({ error: "not_found" }, 404);
  }
};

async function pairDevice(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get("authorization") || "";
  if (header !== `Bearer ${env.PAIRING_TOKEN}`) {
    return json({ error: "invalid_pairing_token" }, 401);
  }

  const payload = await request.json().catch(() => ({})) as { name?: string };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const secret = randomSecret();
  const device: RegisteredDevice = {
    id,
    secret,
    name: cleanDeviceName(payload.name),
    created_at: now
  };

  await env.DEVICE_REGISTRY.put(deviceKey(id), JSON.stringify(device));

  return json({
    ok: true,
    device_id: id,
    device_secret: secret,
    created_at: now
  });
}

async function uploadAudio(request: Request, env: Env, deviceId: string): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) {
    return json({ error: "content_type_must_be_audio" }, 400);
  }

  const size = Number(request.headers.get("content-length") || "0");
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || "25000000");
  if (size && size > maxBytes) {
    return json({ error: "file_too_large" }, 413);
  }

  const now = new Date();
  const id = `${compactIso(now)}-${crypto.randomUUID().slice(0, 8)}`;
  const key = objectKey("uploaded", now, id);
  const body = await request.arrayBuffer();

  if (body.byteLength > maxBytes) {
    return json({ error: "file_too_large" }, 413);
  }

  await env.VOICE_AUDIO.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      id,
      status: "uploaded",
      created_at: now.toISOString(),
      source: "pwa",
      device_id: deviceId,
      size_bytes: String(body.byteLength)
    }
  });

  return json({ ok: true, id, status: "uploaded" });
}

async function listPending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const listed = await env.VOICE_AUDIO.list({ prefix: "audio/uploaded/", limit });
  const items = listed.objects.map(object => ({
    id: object.customMetadata?.id || idFromKey(object.key),
    created_at: object.customMetadata?.created_at || object.uploaded.toISOString(),
    status: object.customMetadata?.status || "uploaded",
    size_bytes: Number(object.customMetadata?.size_bytes || object.size),
    content_type: object.httpMetadata?.contentType || "audio/webm",
    download_url: `/api/audio/${object.customMetadata?.id || idFromKey(object.key)}`
  }));

  return json({ items });
}

async function downloadAudio(id: string, env: Env): Promise<Response> {
  const found = await findObject(id, env);
  if (!found) {
    return json({ error: "not_found" }, 404);
  }

  const object = await env.VOICE_AUDIO.get(found.key);
  if (!object) {
    return json({ error: "not_found" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "audio/webm",
      "content-disposition": `attachment; filename="${id}.webm"`,
      "x-voice-digest-id": id,
      "x-voice-digest-status": found.status
    }
  });
}

async function updateStatus(id: string, request: Request, env: Env): Promise<Response> {
  const payload = await request.json().catch(() => ({})) as { status?: Status };
  if (!payload.status || !statuses.includes(payload.status)) {
    return json({ error: "invalid_status" }, 400);
  }

  const found = await findObject(id, env);
  if (!found) {
    return json({ error: "not_found" }, 404);
  }

  if (found.status === payload.status) {
    return json({ ok: true, id, status: payload.status });
  }

  const object = await env.VOICE_AUDIO.get(found.key);
  if (!object) {
    return json({ error: "not_found" }, 404);
  }

  const createdAt = object.customMetadata?.created_at || object.uploaded.toISOString();
  const targetKey = objectKey(payload.status, new Date(createdAt), id);

  await env.VOICE_AUDIO.put(targetKey, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: {
      ...object.customMetadata,
      id,
      status: payload.status,
      updated_at: new Date().toISOString()
    }
  });
  await env.VOICE_AUDIO.delete(found.key);

  return json({ ok: true, id, status: payload.status });
}

async function verifyDeviceSignature(
  request: Request,
  env: Env
): Promise<{ ok: true; device: RegisteredDevice } | { ok: false; error: string }> {
  const deviceId = request.headers.get("x-device-id") || "";
  const timestamp = request.headers.get("x-timestamp") || "";
  const nonce = request.headers.get("x-nonce") || "";
  const bodyHash = request.headers.get("x-body-sha256") || "";
  const signature = request.headers.get("x-signature") || "";

  if (!deviceId || !timestamp || !nonce || !bodyHash || !signature) {
    return { ok: false, error: "missing_device_signature" };
  }

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > signatureWindowMs) {
    return { ok: false, error: "stale_device_signature" };
  }

  const device = await getDevice(deviceId, env);
  if (!device || device.revoked) {
    return { ok: false, error: "unknown_device" };
  }

  const computedBodyHash = await sha256Hex(await request.clone().arrayBuffer());
  if (!constantTimeEqual(bodyHash, computedBodyHash)) {
    return { ok: false, error: "body_hash_mismatch" };
  }

  const url = new URL(request.url);
  const canonical = [request.method.toUpperCase(), url.pathname, timestamp, nonce, bodyHash].join("\n");
  const expected = await hmacHex(device.secret, canonical);
  if (!constantTimeEqual(signature, expected)) {
    return { ok: false, error: "invalid_device_signature" };
  }

  device.last_seen_at = new Date().toISOString();
  await env.DEVICE_REGISTRY.put(deviceKey(device.id), JSON.stringify(device));

  return { ok: true, device };
}

async function getDevice(id: string, env: Env): Promise<RegisteredDevice | null> {
  const value = await env.DEVICE_REGISTRY.get(deviceKey(id));
  if (!value) return null;
  return JSON.parse(value) as RegisteredDevice;
}

async function findObject(id: string, env: Env): Promise<{ key: string; status: Status } | null> {
  for (const status of statuses) {
    const listed = await env.VOICE_AUDIO.list({ prefix: `audio/${status}/`, limit: 1000 });
    const object = listed.objects.find(item => (item.customMetadata?.id || idFromKey(item.key)) === id);
    if (object) {
      return { key: object.key, status };
    }
  }
  return null;
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function cleanDeviceName(name?: string): string {
  const cleaned = (name || "Voice Daily Digest device").trim().slice(0, 80);
  return cleaned || "Voice Daily Digest device";
}

function deviceKey(id: string): string {
  return `device:${id}`;
}

async function hmacHex(secret: string, message: string): Promise<string> {
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

async function sha256Hex(body: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", body));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function objectKey(status: Status, date: Date, id: string): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `audio/${status}/${year}/${month}/${day}/${id}.webm`;
}

function compactIso(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function idFromKey(key: string): string {
  return key.split("/").pop()?.replace(/\.webm$/, "") || key;
}

function html(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
