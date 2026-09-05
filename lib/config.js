// Central configuration for Varo for AiPASS.
// Loaded by the service worker, side panel and options page (ES module context).

export const API_BASE = "https://api.varoriya.com";
export const WEB_BASE = "https://varoriya.com";
export const REGISTRY_BASE = "https://registry.varoriya.com";

// Where the user creates / copies their Generation API key (varo_gk_...).
export const ACCOUNT_KEY_URL = `${WEB_BASE}/en/account/key/`;
export const API_REFERENCE_URL = "https://dev.varoriya.com/reference/";
// Quick top-up via PromptPay QR.
export const TOPUP_URL = `${WEB_BASE}/en/account/topup/`;

// One-click "Connect Varoriya": admin-ajax hands the extension a wp_rest nonce
// (cookie-authenticated), which it uses to provision its own gen key via REST.
export const EXT_SESSION_URL = `${WEB_BASE}/wp-admin/admin-ajax.php?action=varo_ext_session`;
export const WP_REST_BASE = `${WEB_BASE}/wp-json/varoroute/v1`;
export const LOGIN_URL = `${WEB_BASE}/wp-login.php?redirect_to=${encodeURIComponent(WEB_BASE + "/account/")}`;

// storage.local keys.
export const STORAGE = {
  apiKey: "varo_api_key",
  accountName: "varo_account_name",
  consent: "varo_consent",
  models: "varo_models_cache",
  jobs: "varo_recent_jobs",
  selectors: "varo_selectors_cache",
  pricing: "varo_pricing_cache"
};

// Job polling — non-blocking, done in the service worker.
export const POLL_INTERVAL_MS = 2500;
export const POLL_MAX_ATTEMPTS = 180; // ~7.5 min ceiling for long video jobs.

// Curated default models (fallback if GET /v1/models is unreachable).
// The live list from the API always takes precedence when available.
export const DEFAULT_MODELS = {
  image: [
    { id: "seedream5pro", label: "Seedream 5 Pro" },
    { id: "nanobananapro", label: "Nano Banana Pro" },
    { id: "gptimage", label: "GPT-Image" },
    { id: "grok", label: "Grok" },
    { id: "z-image", label: "Z-Image (ถูกสุด)" }
  ],
  video: [
    { id: "h3", label: "MiniMax H3" },
    { id: "seedance2", label: "Seedance 2.0" },
    { id: "grokvideo", label: "Grok Video" },
    { id: "flux3", label: "Flux 3" },
    { id: "wanoptimizet2v", label: "WAN 2.2 (ข้อความ→วิดีโอ)" },
    { id: "wanoptimize", label: "WAN 2.2 (รูป→วิดีโอ)" }
  ],
  audio: [
    { id: "seedaudio", label: "Seed Audio (รองรับหลายภาษารวมเสียงพูดไทย)" }
  ]
};

// Endpoint that can serve fresh DOM selectors so the content script keeps
// working even if de.aipass.net changes its markup (no re-review needed).
// Optional: returns 404/empty today; the content script falls back to bundled defaults.
export const SELECTORS_ENDPOINT = `${API_BASE}/v1/ext/aipass-selectors`;

export const SOURCE_HEADER = "varo-ext:aipass";
