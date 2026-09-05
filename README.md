# VaroChrome 2.0

<p align="center">
  <img src="screenshots/cover.png" alt="VaroChrome" width="600">
</p>

> Omni-Media Studio for Chromium Browsers
> **The Brain (LLM) × The Execution Engine (Varo)**

Transform any image or text from **ChatGPT, Gemini, Pinterest, AiPASS** or any website into stunning visuals, Thai voiceovers, videos with synced audio, and more — without leaving the page.

รองรับ: **Chrome, Microsoft Edge, Brave, Opera** (กลุ่ม Chromium ทั้งหมด)

---

## ✨ Features

| Feature | Trigger | Description |
|---|---|---|
| **🔗 ChatGPT Integration** | Image answer on chatgpt.com | Varo button embeds in action bar — one click to animate/edit |
| **🔗 Gemini Integration** | Image answer on gemini.google.com | Varo button in message actions — one click to send to Studio |
| **🔗 Pinterest Integration** | Pin detail page on pinterest.com | Varo button in action bar — one click to create video from any pin |
| **🔗 AiPASS Integration** | Image answer on aipass.net | Varo icon in answer toolbar — one click to animate to video |
| **⚡ Studio Panel** | Click Varo icon or right-click | Slide-in panel: pick model, adjust quality/aspect/duration, generate, see results inline |
| **🖼️ Right-Click Menu** | Right-click image or text | Send any image or selected text to Studio from any website |
| **📊 Side Panel** | Click extension icon | View VaroCoin balance, active jobs, 24h history, quick top-up |

## 🚀 Quick Start

### Install (sideload from GitHub)

1. Download the latest `.zip` from [Releases](https://github.com/varoriya/varochrome/releases)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** → select the unzipped folder

### Use

1. Connect your Varoriya account (one click) or paste your Generation API Key
2. Open **ChatGPT**, **Gemini**, **Pinterest**, **AiPASS**, or any website
3. Click the Varo button on any generated image, or right-click → "VaroChrome Panel"
4. Pick a model, adjust settings, click **Generate**

## 🧠 Models

### Image
| Model | Description | Ref |
|---|---|---|
| Seedream 5 Pro | Precise editing, supports Thai | ✅ |
| Nano Banana Pro | 1K–4K, accurate Thai text, Google search | ✅ |
| Grok | Versatile, sharp text in image | ✅ |
| GPT-Image | Great instruction following, Thai text | ✅ |
| Z-Image | Fast, cheap, photorealistic | ❌ |

### Video
| Model | Description | Ref |
|---|---|---|
| MiniMax H3 | Video+audio, ref image/video/audio, 4–15s | ✅ |
| Seedance 2.0 | Video+audio, ref image/video, 4–15s | ✅ |
| Grok Video | T2V/I2V with audio, v1.5 speaks Thai | ✅ |
| Flux 3 | Video+audio, keyframe/continue, 5–20s | ✅ |
| WAN 2.2 T2V | Cheap/fast, light filtering, no audio | ❌ |
| WAN 2.2 I2V | Requires source image, light filtering | ✅ |

### Audio
| Model | Description |
|---|---|
| Seed Audio Multilingual | 17 languages incl. Thai, speech/music/SFX |
| Seed Audio Standard | English + Chinese only (no Thai) |

## 🏗️ Architecture

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

## 🔌 API Endpoints

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

Auth: `Authorization: Bearer varo_gk_...` · Source: `X-Varo-Source: varo-ext`

## 🔒 Privacy

- **Zero-Log policy** — no prompts, images, or usage logs are retained
- All data stays local until you explicitly generate
- Generated media auto-deletes after 24 hours
- See [PRIVACY.md](./PRIVACY.md) for full policy

## 📁 File Structure

```
VaroForAiPASS/
├─ manifest.json                 # MV3 manifest
├─ PRIVACY.md                    # Privacy policy
├─ background/service-worker.js  # Generation broker + poll + notifications
├─ content/
│  ├─ selectors.js               # DOM selectors (easy to update)
│  ├─ content.js                 # In-page UI: Studio panel, toolbar integration
│  ├─ studio.js                  # Shadow DOM slide-in panel
│  └─ content.css                # .varo-* namespaced styles
├─ sidepanel/                    # Side Panel: balance, jobs, history
├─ options/                      # One-click connect, API key, model prefs
├─ lib/
│  ├─ config.js                  # Constants + endpoints + fallback models
│  ├─ api.js                     # REST client (api.varoriya.com)
│  └─ connect.js                 # One-click account connection
├─ _locales/{en,th}/messages.json
├─ icons/                        # Brand icons (16/48/128 PNG + SVG)
├─ STORE_LISTING.md              # Copy-paste texts for Chrome Web Store
├─ build.ps1                     # Packaging script
└── README.md                    # This file
```

## 📚 Developer References

- Get API Key: <https://varoriya.com/en/account/key/>
- API Reference: <https://dev.varoriya.com/reference/>
- GitHub Repo: <https://github.com/varoriya/varochrome>
