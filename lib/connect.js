// One-click "Connect Varoriya" — reuses the user's existing varoriya.com login.
// Flow (ทาง A): admin-ajax bridge (cookie auth, no nonce needed to ID the user)
// -> get a wp_rest nonce -> POST varoroute/v1/generate-key with that nonce
// -> store the minted varo_gk_ key. No copy/paste, no manual key entry.
//
// Must run from an extension page or the service worker (host_permissions for
// varoriya.com make these requests first-party, so cookies are sent).

import { EXT_SESSION_URL, WP_REST_BASE, STORAGE } from "./config.js";

export async function getExtSession() {
  const res = await fetch(EXT_SESSION_URL, { credentials: "include" });
  if (!res.ok) throw new Error(`session HTTP ${res.status}`);
  return res.json();
}

async function provisionGenKey(nonce) {
  const res = await fetch(`${WP_REST_BASE}/generate-key`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-WP-Nonce": nonce },
    body: JSON.stringify({ label: "Browser Extension", type: "gen" })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.api_key) {
    throw new Error(data.message || `generate-key HTTP ${res.status}`);
  }
  return data.api_key;
}

// Returns { loggedIn, connected, displayName? }.
// Linking the account is treated as explicit PDPA consent (timestamp stored).
export async function connectVaroriya() {
  const session = await getExtSession();
  if (!session.logged_in) return { loggedIn: false, connected: false };
  const key = await provisionGenKey(session.nonce);
  await chrome.storage.local.set({
    [STORAGE.apiKey]: key,
    [STORAGE.accountName]: session.display_name || "",
    [STORAGE.consent]: Date.now()
  });
  return { loggedIn: true, connected: true, displayName: session.display_name };
}

export async function disconnectVaroriya() {
  await chrome.storage.local.remove([STORAGE.apiKey, STORAGE.accountName]);
}
