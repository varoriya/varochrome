# VaroChrome 2.0

> Omni-Media Studio for Chromium Browsers
> **The Brain (AiPASS) × The Execution Engine (Varo)**

Transform any text prompt or image from AiPASS chat into stunning visuals, Thai voiceovers,
videos with synced audio, and more — without leaving the page.

รองรับ: **Chrome, Microsoft Edge, Brave, Opera** (กลุ่ม Chromium ทั้งหมด)

---

## Features

| Feature | Trigger | Description |
|---|---|---|
| **Studio Panel** | Click Varo icon or right-click | Slide-in panel: pick model, adjust quality/aspect/duration, generate, see results inline |
| **AiPASS Integration** | Image answer in AiPASS | Varo icon embeds in answer toolbar — one click to animate to video |
| **Right-Click Menu** | Right-click image or text | Send any image or selected text to Studio from any website |
| **Side Panel** | Click extension icon | View VaroCoin balance, active jobs, 24h history, quick top-up |
| **Context Menu** | Right-click (fallback) | Works 100% independently even if in-page buttons break |

## Quick Start

1. Install from [Chrome Web Store](https://chromewebstore.google.com/) (or load unpacked for development)
2. Connect your Varoriya account (one click) or paste your Generation API Key
3. Open `https://de.aipass.net/chat` or any website
4. Right-click an image → "Varo — ส่งภาพไปแผงสร้างสื่อ"
5. Pick a model, adjust settings, click **Generate**

## Architecture

```
content.js (isolated world)
   │  chrome.runtime.sendMessage
   ▼
service-worker.js  ──►  lib/api.js  ──►  https://api.varoriya.com
   │                                     POST /v1/generate/{image|video|audio}
   │  poll (non-blocking)                GET  /v1/jobs/{id}
   ▼                                     POST /v1/path/presign
chrome.notifications  ◄── งานเสร็จ        GET  /v1/me , /v1/me/generations
```

- **Non-blocking:** All work goes through the service worker — the page stays responsive
- **Cross-origin:** Only extension pages/SW have `host_permissions` — content scripts message the SW

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /v1/generate/image` | Text→Image / Image→Image |
| `POST /v1/generate/video` | Text→Video / Image→Video |
| `POST /v1/generate/audio` | Text→Voice (Seed Audio, Thai support) |
| `GET  /v1/jobs/{id}` | Async job status |
| `POST /v1/path/presign` | Presign + PUT image to DO Space |
| `GET  /v1/me` | VaroCoin balance + breakdown |
| `GET  /v1/me/generations` | Media library (24h retention) |
| `GET  /v1/models` | Model list (fallback to bundled defaults) |

Auth: `Authorization: Bearer varo_gk_...` · Source: `X-Varo-Source: varo-ext:aipass`

## Privacy

- **Zero-Log policy** — no prompts, images, or usage logs are retained
- All data stays local until you explicitly generate
- Generated media auto-deletes after 24 hours
- See [PRIVACY.md](./PRIVACY.md) for full policy

## File Structure

```
VaroForAiPASS/
├─ manifest.json                 # MV3 manifest
├─ PRIVACY.md                    # Privacy policy (required for Store)
├─ background/service-worker.js  # Generation broker + poll + notifications
├─ content/
│  ├─ selectors.js               # DOM selectors (easy to update)
│  ├─ content.js                 # In-page UI: Studio panel, AiPASS toolbar
│  ├─ studio.js                  # Shadow DOM slide-in panel
│  └─ content.css                # .varo-* namespaced styles
├─ sidepanel/                    # Side Panel: balance, jobs, history
├─ options/                      # One-click connect, API key, model prefs
├─ lib/
│  ├─ config.js                  # Constants + endpoints + fallback models
│  ├─ api.js                     # REST client (api.varoriya.com)
│  └─ connect.js                 # One-click account connection
├─ _locales/{en,th}/messages.json
├─ icons/                        # Brand icons (16/32/48/128 PNG + SVG)
├─ screenshots/                  # Store listing screenshots
├─ STORE_LISTING.md              # Copy-paste texts for Chrome Web Store
├─ build.ps1                     # Packaging script
└─ generate-icons.ps1            # Icon generation from SVG
```

## Developer References

- Get API Key: <https://varoriya.com/en/account/key/>
- API Reference: <https://dev.varoriya.com/reference/>
- Chrome Web Store Dashboard: <https://chrome.google.com/webstore/devconsole/>
