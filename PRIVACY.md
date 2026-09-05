# Privacy Policy — VaroChrome 2.0

**Last updated:** 2026-09-03

VaroChrome 2.0 (the "Extension") is developed and operated by Varoriya ("we", "our", "us").  
This Privacy Policy explains what data the Extension collects, how it is used, and your rights.

---

## 1. Data We Collect

### 1.1 Information You Actively Submit

When you use the Extension to generate media (images, video, or audio), you submit:

- **Text prompts** you type or select (via the Studio panel, context menu, or AiPASS toolbar integration)
- **Images** you upload or select as reference (via drag-and-drop, file picker, or right-click)

These are sent to `api.varoriya.com` solely for the purpose of fulfilling your generation request.

### 1.2 API Key / Account Connection

- If you paste a **Generation API Key** (`varo_gk_…`) manually, it is stored locally in `chrome.storage.local` and sent only to `api.varoriya.com` as a Bearer token.
- If you use the **One-Click Connect** feature, the Extension makes a single authenticated request to `varoriya.com` to provision a key automatically. No password or session token is stored by the Extension — only the resulting API key.

### 1.3 Browsing Activity (Zero-Log)

- The Extension **does not** track your browsing history, clicks, or page visits beyond `de.aipass.net` and `aipass.net`.
- The content script injects UI elements on pages matching `<all_urls>` (required for the right-click context menu and Studio panel to work everywhere), but it **never** reads, stores, or transmits page content unless you explicitly interact with a Varo button or menu item.
- We maintain a **Zero-Log** policy: no logs of your prompts, images, or usage patterns are retained on our servers beyond the transient generation job (results auto-delete after 24 hours).

### 1.4 Chrome Storage

The Extension uses `chrome.storage.local` to store:

| Key | Content |
|---|---|
| `varo_api_key` | Your Generation API Key (encrypted at rest by Chrome) |
| `varo_account_name` | Your Varoriya display name (if connected) |
| `varo_consent` | Timestamp of your PDPA consent |
| `varo_models_cache` | Cached model list from `api.varoriya.com` |
| `varo_recent_jobs` | Recent job metadata (id, state, kind) — max 40 entries |
| `varo_pricing_cache` | Cached pricing data |
| `varo_pref_models` | Your preferred default models |

All data stays **on your device** and is never transmitted to third parties.

---

## 2. How We Use Data

- **Text prompts and images** are processed by the Varoriya Generation API (`api.varoriya.com`) to produce the requested image, video, or audio output.
- **Generated media** is stored temporarily on our CDN and **automatically deleted within 24 hours**.
- **API keys** are used solely to authenticate requests to `api.varoriya.com`.
- We do **not** use your data for training AI models, advertising, profiling, or any purpose other than executing your generation requests.

---

## 3. Data Sharing

We do **not** sell, rent, or share your personal data with third parties.  
The Extension communicates only with:

- `api.varoriya.com` — generation API
- `varoriya.com` — one-click account connection + web-coupled editors
- `registry.varoriya.com` — optional digital certification service
- `storage.googleapis.com` — some reference image hosting (AiPASS)

---

## 4. Data Retention

- **Generation results** are stored on our CDN for **24 hours**, then permanently deleted.
- **Job metadata** in `chrome.storage.local` is limited to 40 entries and can be cleared by the user at any time via the Extension's options page or Chrome's extension management.
- **No server-side logs** of prompts, images, or API usage are retained.

---

## 5. Your Rights (PDPA / GDPR)

If you are in Thailand (PDPA) or the EU (GDPR), you have the right to:

- **Access** — request what data we hold (we hold none beyond transient generation jobs)
- **Deletion** — request deletion of any data (auto-deleted after 24 hours)
- **Withdraw consent** — disconnect your account or remove the API key via the Extension's options page

To exercise these rights, contact: **privacy@varoriya.com**

---

## 6. Third-Party Services

- **Varoriya API** (`api.varoriya.com`) — our own service, subject to the same privacy commitments
- **AiPASS** (`de.aipass.net`) — the Extension integrates with AiPASS as an optional surface; we do not control AiPASS's data practices
- **Google Chrome Storage** — `chrome.storage.local` data is managed by Chrome's built-in encryption

---

## 7. Changes to This Policy

We may update this Privacy Policy. Changes will be posted here with an updated "Last updated" date.

---

## 8. Contact

**Varoriya**  
Email: **privacy@varoriya.com**  
Website: https://varoriya.com
