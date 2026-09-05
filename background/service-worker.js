// Service worker — the "Execution Engine" broker.
// - Receives requests from the content script (page can't do cross-origin gen calls).
// - Runs generation + non-blocking job polling.
// - Fires desktop notifications when work finishes.
// - Provides right-click context menu fallbacks (work even if in-page buttons break).

import { generate, uploadImageUrl, pollJob, getBalance, getPricing } from "../lib/api.js";
import { connectVaroriya } from "../lib/connect.js";
import { STORAGE, WEB_BASE, REGISTRY_BASE, DEFAULT_MODELS } from "../lib/config.js";

// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

// ---------- Context menu: a single "Varo" entry that opens the Studio panel ----------
// (One item = no clutter / no overlap with the older VaroChrome extension. All the
// per-action tools live inside the panel once it's open.)

const MENU = [
  // Image right-click gets a "send this image" label; everything else just opens the panel.
  { id: "varo_open_image", title: "VaroChrome Panel", contexts: ["image"] },
  { id: "varo_open", title: "VaroChrome Panel", contexts: ["selection", "page"] }
];

// Web-coupled editors (surgical edit / registry) live on varoriya.com. Used by the
// panel's "more services" row via the varo:image-action message (not the menu).
const WEB_SERVICE = {
  varo_img_boxes: (u) => `${WEB_BASE}/service/boxes/?image=${u}`,
  varo_img_reface: (u) => `${WEB_BASE}/service/reface/?ref=${u}`,
  varo_img_retouch: (u) => `${WEB_BASE}/service/retouch/?ref=${u}`,
  varo_img_spyshot: (u) => `${WEB_BASE}/service/spyshot/?ref=${u}`,
  varo_img_vr360: (u) => `${WEB_BASE}/service/varo360/?ref=${u}`,
  varo_img_registry: (u) => `${REGISTRY_BASE}/service/certify/?image=${u}`
};

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU) {
      const opts = { id: item.id, contexts: item.contexts };
      if (item.type) opts.type = item.type;
      if (item.title) opts.title = item.title;
      chrome.contextMenus.create(opts, () => void chrome.runtime.lastError);
    }
  });

  // First-run: send the user to enable consent + paste an API key.
  const stored = await chrome.storage.local.get([STORAGE.consent, STORAGE.apiKey]);
  if (!stored[STORAGE.consent] || !stored[STORAGE.apiKey]) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!["varo_open", "varo_open_image"].includes(info.menuItemId) || !tab?.id) return;
  const payload = {
    type: "varo:open-studio",
    imageUrl: info.srcUrl || null,
    prompt: info.selectionText || ""
  };
  // Open the in-page panel; if the page has no content script, fall back to side panel.
  chrome.tabs.sendMessage(tab.id, payload).catch(() => {
    chrome.sidePanel?.open?.({ tabId: tab.id }).catch(() => {});
  });
});

// ---------- Message bridge from content script + side panel ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "varo:connect") {
    connectVaroriya()
      .then(sendResponse)
      .catch((e) => sendResponse({ loggedIn: false, connected: false, error: e.message }));
    return true; // async
  }
  if (msg?.type === "varo:generate") {
    runGeneration(msg.kind, msg.payload, _sender.tab?.id).then(sendResponse);
    return true; // async
  }
  if (msg?.type === "varo:balance") {
    getBalance()
      .then((b) => sendResponse({ ok: true, coins: b.coins, breakdown: b.breakdown }))
      .catch((e) => sendResponse({ ok: false, error: e.message, code: e.code }));
    return true; // async
  }
  if (msg?.type === "varo:pricing") {
    getPricing()
      .then((models) => sendResponse({ ok: true, models }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // async
  }
  if (msg?.type === "varo:image-action") {
    if (msg.action === "image") runImageFromUrl(msg.imageUrl).then(sendResponse);
    else if (msg.action === "video") runVideoFromUrl(msg.imageUrl).then(sendResponse);
    else {
      const build = WEB_SERVICE[`varo_img_${msg.action}`];
      if (build) chrome.tabs.create({ url: build(encodeURIComponent(msg.imageUrl)) });
      sendResponse({ ok: true, opened: true });
    }
    return true;
  }
  return false;
});

// ---------- Core flows ----------

async function runImageFromUrl(imageUrl) {
  try {
    const url = await uploadImageUrl(imageUrl);
    return runGeneration("image", {
      model: DEFAULT_MODELS.image[0].id,
      prompt: "edit this image",
      images: [url]
    });
  } catch (e) {
    notifyError(e);
    return { ok: false, error: e.message };
  }
}

async function runVideoFromUrl(imageUrl) {
  try {
    const url = await uploadImageUrl(imageUrl);
    return runGeneration("video", {
      model: DEFAULT_MODELS.video[0].id,
      prompt: "animate this image",
      images: [url]
    });
  } catch (e) {
    notifyError(e);
    return { ok: false, error: e.message };
  }
}

async function runGeneration(kind, payload, tabId) {
  try {
    // Studio may pass a raw image URL to use as reference — upload it first.
    if (payload && payload.imageUrl) {
      const url = await uploadImageUrl(payload.imageUrl);
      payload = { ...payload, images: [url] };
      delete payload.imageUrl;
    }
    // Boxes mask: upload the mask data URL too
    if (payload && payload.mask) {
      const maskUrl = await uploadImageUrl(payload.mask);
      payload.mask = maskUrl;
    }
    const job = await generate(kind, payload);
    notify(`เริ่มประมวลผล ${labelFor(kind)}`, "กำลังทำงาน… จะแจ้งเตือนเมื่อเสร็จ", job.id);
    trackJob({ id: job.id, kind, state: job.state || "processing", createdAt: Date.now() });

    // Non-blocking poll; the page/side panel stay responsive.
    pollJob(job.id, (j) => {
      trackJob({ id: job.id, kind, state: j.state, resultUrl: j.result_url, updatedAt: Date.now() });
      pushJobUpdate(tabId, j);
    }).then((final) => {
      const state = (final.state || "").toLowerCase();
      if (["done", "succeeded", "completed"].includes(state)) {
        notify(`${labelFor(kind)} เสร็จแล้ว ✅`, "คลิกเพื่อเปิดผลงาน", job.id, final.result_url);
      } else {
        notify(`${labelFor(kind)} ไม่สำเร็จ`, final.error || state, job.id);
      }
      trackJob({ id: job.id, kind, state, resultUrl: final.result_url, done: true });
      pushJobUpdate(tabId, final);
    });

    return { ok: true, jobId: job.id, coinsCharged: job.coins_charged, coinsRemaining: job.coins_remaining };
  } catch (e) {
    if (e.code === "MISSING_API_KEY") {
      chrome.runtime.openOptionsPage();
      notify("ยังไม่ได้เชื่อมบัญชี", "กด ‘เชื่อมบัญชี Varoriya’ ในหน้าตั้งค่าเพื่อเริ่มใช้งาน");
    } else {
      notifyError(e);
    }
    return { ok: false, error: e.message, code: e.code };
  }
}

// Job updates must reach the in-page Studio (a content script) via
// chrome.tabs.sendMessage; chrome.runtime.sendMessage only reaches extension
// pages like the side panel — so send to both.
function pushJobUpdate(tabId, job) {
  if (tabId) chrome.tabs.sendMessage(tabId, { type: "varo:job-update", job }).catch(() => {});
  chrome.runtime.sendMessage({ type: "varo:job-update", job }).catch(() => {});
}

// ---------- Recent jobs (side panel reads these) ----------

async function trackJob(update) {
  const data = await chrome.storage.local.get(STORAGE.jobs);
  const jobs = data[STORAGE.jobs] || [];
  const idx = jobs.findIndex((j) => j.id === update.id);
  if (idx >= 0) jobs[idx] = { ...jobs[idx], ...update };
  else jobs.unshift(update);
  await chrome.storage.local.set({ [STORAGE.jobs]: jobs.slice(0, 40) });
}

// ---------- Notifications ----------

const notifResult = new Map(); // notificationId -> resultUrl | jobId

function notify(title, message, jobId, resultUrl) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: "../icons/icon128.png",
      title,
      message: message || ""
    },
    (nid) => {
      if (resultUrl) notifResult.set(nid, resultUrl);
      else if (jobId) notifResult.set(nid, `https://dev.varoriya.com/jobs?id=${jobId}`);
    }
  );
}

function notifyError(e) {
  notify("เกิดข้อผิดพลาด", e?.message || "unknown error");
}

chrome.notifications.onClicked.addListener((nid) => {
  const url = notifResult.get(nid);
  if (url) chrome.tabs.create({ url });
});

function labelFor(kind) {
  return kind === "image" ? "ภาพ" : kind === "video" ? "วิดีโอ" : "เสียง";
}
