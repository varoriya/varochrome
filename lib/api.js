// Thin REST client for the Varoriya generation API (api.varoriya.com).
// All calls authenticate with the user's Varo Generation API key (varo_gk_...).
// Runs in extension pages / the service worker, which hold host_permissions
// for api.varoriya.com, so cross-origin fetch is permitted here (not in the
// page content script — that one messages the service worker instead).

import {
  API_BASE,
  STORAGE,
  SOURCE_HEADER,
  DEFAULT_MODELS,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS
} from "./config.js";

export async function getApiKey() {
  const data = await chrome.storage.local.get(STORAGE.apiKey);
  return data[STORAGE.apiKey] || "";
}

function authHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    "X-Varo-Source": SOURCE_HEADER
  };
}

async function apiFetch(path, { method = "GET", body, key } = {}) {
  const apiKey = key || (await getApiKey());
  if (!apiKey) {
    const err = new Error("MISSING_API_KEY");
    err.code = "MISSING_API_KEY";
    throw err;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...authHeaders(apiKey),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- Account / wallet ----

export async function getMe() {
  return apiFetch("/v1/me");
}

export async function getBalance() {
  const me = await getMe();
  // /v1/me returns { coins, breakdown, ... } across API versions — be lenient.
  return {
    coins: me.coins ?? me.balance ?? me.breakdown?.total ?? 0,
    breakdown: me.breakdown || null,
    raw: me
  };
}

export async function listGenerations({ limit = 30, offset = 0 } = {}) {
  const data = await apiFetch(`/v1/me/generations?limit=${limit}&offset=${offset}`);
  return data.generations || [];
}

// ---- Pricing (public — no auth) ----

export async function getPricing() {
  try {
    const res = await fetch(`${API_BASE}/v1/pricing`, {
      headers: { "X-Varo-Source": SOURCE_HEADER }
    });
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      if (models.length) {
        await chrome.storage.local.set({ [STORAGE.pricing]: models });
        return models;
      }
    }
  } catch {
    // fall through to cache
  }
  const cached = await chrome.storage.local.get(STORAGE.pricing);
  return cached[STORAGE.pricing] || [];
}

// ---- Models ----

export async function listModels() {
  try {
    const data = await apiFetch("/v1/models");
    const models = data.models || data || [];
    if (Array.isArray(models) && models.length) {
      const grouped = { image: [], video: [], audio: [] };
      for (const m of models) {
        const kind = m.kind || m.type;
        const entry = { id: m.id || m.model || m.name, label: m.label || m.title || m.id };
        if (grouped[kind]) grouped[kind].push(entry);
      }
      // Keep any group the API didn't populate.
      for (const k of Object.keys(grouped)) {
        if (!grouped[k].length) grouped[k] = DEFAULT_MODELS[k];
      }
      await chrome.storage.local.set({ [STORAGE.models]: grouped });
      return grouped;
    }
  } catch {
    // fall through to cache / defaults
  }
  const cached = await chrome.storage.local.get(STORAGE.models);
  return cached[STORAGE.models] || DEFAULT_MODELS;
}

// ---- File upload (presigned PUT direct to storage) ----

export async function uploadImageUrl(imageUrl) {
  // Fetch the image bytes, then presign + PUT so it never routes through
  // the generation API host (scales better). Uses Varo Path (short-lived link)
  // which is enough for an immediate generation input.
  const resp = await fetch(imageUrl);
  const blob = await resp.blob();
  const mime = blob.type || "image/png";
  const presign = await apiFetch("/v1/path/presign", { method: "POST", body: { mime } });
  const putRes = await fetch(presign.upload_url, {
    method: presign.method || "PUT",
    headers: presign.headers || { "Content-Type": mime, "x-amz-acl": "public-read" },
    body: blob
  });
  if (!putRes.ok) throw new Error(`Upload failed: HTTP ${putRes.status}`);
  return presign.url;
}

// ---- Generation ----

export async function generate(kind, payload) {
  const path = `/v1/generate/${kind}`; // image | video | audio
  const job = await apiFetch(path, { method: "POST", body: payload });
  return normalizeJob(job); // { id, state, coins_charged, coins_remaining, ... }
}

export async function getJob(id) {
  return normalizeJob(await apiFetch(`/v1/jobs/${encodeURIComponent(id)}`));
}

// The API uses { job_id, status } — map to the { id, state } the rest of the
// extension expects, without losing any original fields (coins_*, result_url).
function normalizeJob(job) {
  if (!job || typeof job !== "object") return job;
  return { ...job, id: job.job_id ?? job.id, state: job.status ?? job.state };
}

// Non-blocking poll with an onUpdate callback. Resolves on terminal state.
export async function pollJob(id, onUpdate) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    let job;
    try {
      job = await getJob(id);
    } catch (e) {
      // transient error — keep trying a few times
      job = { state: "processing", error: e.message };
    }
    if (onUpdate) onUpdate(job);
    const state = (job.state || "").toLowerCase();
    if (["done", "succeeded", "completed", "failed", "error", "canceled"].includes(state)) {
      return job;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { id, state: "timeout" };
}
