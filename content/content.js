// Varo for AiPASS — in-page UI (isolated world).
// Design principle: Unobtrusive & On-Demand. Nothing is shown until the user
// hovers an image, selects text, or a fresh LLM answer appears. All heavy work
// is delegated to the service worker (cross-origin gen calls happen there).

(function () {
  const S = window.__VARO_SELECTORS__ || {};
  const IS_AIPASS = /(^|\.)aipass\.net$/.test(location.hostname);
  const IS_CHATGPT = /(^|\.)chatgpt\.com$/.test(location.hostname);
  const IS_GEMINI = /(^|\.)gemini\.google\.com$/.test(location.hostname);
  const IS_PINTEREST = /(^|\.)pinterest\.com$/.test(location.hostname);

  // Returns false once the extension is reloaded/updated while this old content
  // script keeps running — guards every chrome.* call so we fail quietly.
  const extAlive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  // Load the Material Symbols font from the extension (getURL gives the correct
  // chrome-extension:// URL; a relative url() in the injected CSS would 404).
  (function injectFont() {
    if (!extAlive()) return;
    const url = chrome.runtime.getURL("fonts/MaterialSymbolsOutlined.woff2");
    const style = document.createElement("style");
    style.textContent = `@font-face{font-family:"Varo Material Symbols";font-style:normal;font-weight:100 700;src:url("${url}") format("woff2");}`;
    (document.head || document.documentElement).appendChild(style);
  })();

  const firstMatch = (list, root = document) => {
    for (const sel of list || []) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  };
  const matchesAny = (el, list) => (list || []).some((sel) => el.matches?.(sel));

  // ---------- small toast for non-blocking feedback ----------
  let toastEl;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "varo-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("varo-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("varo-show"), 3200);
  }

  function send(message) {
    if (!extAlive()) return Promise.resolve({ ok: false });
    try {
      return chrome.runtime.sendMessage(message).catch(() => ({ ok: false }));
    } catch {
      return Promise.resolve({ ok: false });
    }
  }

  async function generate(kind, prompt) {
    toast(`ส่งไปสร้าง${kind === "image" ? "ภาพ" : kind === "video" ? "วิดีโอ" : "เสียง"}แล้ว…`);
    const res = await send({ type: "varo:generate", kind, payload: { prompt } });
    if (res && res.ok === false && res.code === "MISSING_API_KEY") {
      toast("ยังไม่ได้ตั้งค่า API Key — เปิดหน้าตั้งค่าส่วนเสริม");
    }
  }

  async function imageAction(action, imageUrl) {
    toast("กำลังส่งรูปไป Varo…");
    await send({ type: "varo:image-action", action, imageUrl });
  }

  // Open the slide-in Studio (falls back to instant generate if it failed to load).
  function openStudio(opts) {
    if (window.VaroStudio) window.VaroStudio.open(opts);
    else generate(opts.kind === "voice" ? "audio" : opts.kind, opts.prompt || "");
  }

  // Text selection has NO floating bubble by design (kept unobtrusive) — use the
  // right-click Varo menu for selected text instead (service worker context menu).
  // Image hover overlay was removed too: on other sites use the right-click menu,
  // on AiPASS we embed into the answer toolbar (see section 3).

  // ================= 3) LLM answer actions (AiPASS & ChatGPT) =================
  // Embed a single Varo icon INTO the answer's native action toolbar so it sits
  // next to Copy/Like/Dislike. The bar is matched by S.answerActions and gated to
  // assistant bars (must contain a Copy/Like button so we skip unrelated rows).

  // The AiPASS action bar holds icon buttons with data-slot="button" (no
  // aria-label). Match those and require it sits inside a message row (.group).
  function isActionBar(bar) {
    return (
      bar.querySelectorAll(':scope > button[data-slot="button"]').length >= 2 &&
      !!bar.closest(".group")
    );
  }

  function embedInBar(bar) {
    if (!extAlive() || !isActionBar(bar)) return;
    // existence check (not a flag) so we re-add if React re-renders the bar
    if (bar.querySelector(":scope > .varo-embed-btn")) return;
    // Only embed on answers that contain an image (avoid clutter on text answers).
    const wrap = bar.parentElement;
    if (!wrap) return;
    const content = [...wrap.children].find((c) => c !== bar) || wrap;
    if (!content.querySelector("img")) return;
    const btn = document.createElement("button");
    btn.className = "varo-embed-btn";
    btn.type = "button";
    btn.title = "Varo: สร้างสื่อจากภาพนี้";
    btn.innerHTML = `<img src="${chrome.runtime.getURL("icons/varoicon128.png")}" alt="Varo"/>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const img = content.querySelector("img");
      const imageUrl = img ? img.currentSrc || img.src : null;
      // AiPASS answer image -> animate to video with MiniMax H3 by default.
      openStudio({ kind: "video", model: "h3", quality: "768P", aspect: "auto", prompt: "", imageUrl });
    });
    bar.appendChild(btn);
  }

  function scanAnswers() {
    if (!extAlive()) return;
    for (const sel of S.answerActions || []) {
      document.querySelectorAll(sel).forEach(embedInBar);
    }
  }

  // ================= ChatGPT-specific =================
  // On ChatGPT, the image container (div.group/imagegen-image) and the action bar
  // (div[aria-label="Response actions"]) are siblings inside the agent turn.
  // We find the turn container, then embed the Varo icon into the action bar.

  function embedChatGptBtn(turnEl) {
    if (!extAlive()) return;
    const bar = turnEl.querySelector('div[aria-label="Response actions"]');
    if (!bar) return;
    if (bar.querySelector(":scope > .varo-embed-btn")) return;
    // Only embed if this turn has an image
    const imgEl = turnEl.querySelector("div.group\\/imagegen-image img");
    if (!imgEl) return;

    const btn = document.createElement("button");
    btn.className = "varo-embed-btn chatgpt-style";
    btn.type = "button";
    btn.title = "Varo: สร้างสื่อจากภาพนี้";
    btn.innerHTML = `<img src="${chrome.runtime.getURL("icons/varoicon128.png")}" alt="Varo"/>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const imageUrl = imgEl.currentSrc || imgEl.src;
      openStudio({ kind: "video", model: "h3", quality: "768P", aspect: "auto", prompt: "", imageUrl });
    });
    bar.appendChild(btn);
  }

  function scanChatGptTurns() {
    if (!extAlive()) return;
    const turns = document.querySelectorAll('div[data-conversation-screenshot-content]');
    turns.forEach(embedChatGptBtn);
  }

  if (IS_AIPASS) {
    const root = firstMatch(S.chatRoot) || document.body;
    const mo = new MutationObserver(() => {
      if (!extAlive()) {
        mo.disconnect();
        return;
      }
      clearTimeout(mo._t);
      mo._t = setTimeout(scanAnswers, 400); // debounce streaming updates
    });
    mo.observe(root, { childList: true, subtree: true });
    scanAnswers();
  }

  if (IS_CHATGPT) {
    const root = document.body;
    const mo = new MutationObserver(() => {
      if (!extAlive()) {
        mo.disconnect();
        return;
      }
      clearTimeout(mo._t);
      mo._t = setTimeout(scanChatGptTurns, 400);
    });
    mo.observe(root, { childList: true, subtree: true });
    scanChatGptTurns();
  }

  // ================= Gemini-specific =================
  // On Gemini, generated images sit inside <generated-image> → <single-image> → img.
  // The action bar (thumb_up/down, refresh, share, more) is inside <message-actions>.
  // We find the response container, grab the image, and embed into the action bar.

  function embedGeminiBtn(responseContainer) {
    if (!extAlive()) return;
    const bar = responseContainer.querySelector('message-actions .buttons-container-v2');
    if (!bar) return;
    if (bar.querySelector(":scope > .varo-embed-btn")) return;
    // Only embed if this response has a generated image
    const imgEl = responseContainer.querySelector('generated-image single-image img.image');
    if (!imgEl) return;

    const btn = document.createElement("button");
    btn.className = "varo-embed-btn gemini-style";
    btn.type = "button";
    btn.title = "Varo: สร้างสื่อจากภาพนี้";
    btn.innerHTML = `<img src="${chrome.runtime.getURL("icons/varoicon128.png")}" alt="Varo"/>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const imageUrl = imgEl.currentSrc || imgEl.src;
      openStudio({ kind: "video", model: "h3", quality: "768P", aspect: "auto", prompt: "", imageUrl });
    });
    bar.appendChild(btn);
  }

  function scanGeminiResponses() {
    if (!extAlive()) return;
    const containers = document.querySelectorAll('div.response-container.response-container-with-gpi');
    containers.forEach(embedGeminiBtn);
  }

  if (IS_GEMINI) {
    const root = document.body;
    const mo = new MutationObserver(() => {
      if (!extAlive()) {
        mo.disconnect();
        return;
      }
      clearTimeout(mo._t);
      mo._t = setTimeout(scanGeminiResponses, 400);
    });
    mo.observe(root, { childList: true, subtree: true });
    scanGeminiResponses();
  }

  // ================= Pinterest-specific =================
  // Pinterest: ONLY closeup detail page (NO feed pins).
  // Action bar: div[data-test-id="closeup-action-items"][role="list"] with .oRZ5_s items
  // Image: img.iFOUS5 in closeup-image / closeup-body-image-container
  // Embed button at the END of closeup-action-items (next to "More actions").

  function scanPinterestPins() {
    if (!extAlive()) return;

    // ONLY closeup detail page — NO feed pins
    const actionItems = document.querySelector('div[data-test-id="closeup-action-items"][role="list"]');
    if (!actionItems) return;

    // Already embedded?
    if (actionItems.querySelector(':scope > .varo-embed-btn')) return;

    // Find the closeup image
    const img = document.querySelector('div[data-test-id="closeup-image"] img.iFOUS5') ||
                document.querySelector('div[data-test-id="closeup-body-image-container"] img.iFOUS5') ||
                document.querySelector('img.iFOUS5[elementtiming*="closeup-image"]');
    if (!img) return;

    // Pick highest quality from srcset
    let imageUrl = img.currentSrc || img.src;
    if (img.srcset) {
      const srcsetParts = img.srcset.split(',').map(s => s.trim());
      for (const part of srcsetParts.reverse()) {
        const [url] = part.split(/\s+/);
        if (!url) continue;
        if (url.includes('/originals/')) { imageUrl = url; break; }
        if (url.includes('/736x/')) { imageUrl = url; break; }
        if (url.includes('/474x/')) { imageUrl = url; break; }
      }
    }

    const btn = document.createElement('button');
    btn.className = 'varo-embed-btn pinterest-style';
    btn.type = 'button';
    btn.title = 'Varo: สร้างสื่อจากภาพนี้';
    btn.innerHTML = `<img src="${chrome.runtime.getURL('icons/varoicon128.png')}" alt="Varo"/>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStudio({ kind: 'video', model: 'h3', quality: '768P', aspect: 'auto', prompt: '', imageUrl });
    });

    // Append at the END of closeup-action-items (next to "More actions")
    actionItems.appendChild(btn);
  }

  if (IS_PINTEREST) {
    const root = document.body;
    const mo = new MutationObserver(() => {
      if (!extAlive()) {
        mo.disconnect();
        return;
      }
      clearTimeout(mo._t);
      mo._t = setTimeout(scanPinterestPins, 400);
    });
    mo.observe(root, { childList: true, subtree: true });
    scanPinterestPins();
  }

  // Surface job completion toasts pushed by the service worker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "varo:open-studio") {
      // An image sent from the right-click menu defaults to video; text/page opens image mode.
      const kind = msg.imageUrl ? "video" : "image";
      openStudio({ kind, imageUrl: msg.imageUrl || null, prompt: msg.prompt || "" });
      return;
    }
    if (msg?.type === "varo:job-update") {
      const st = (msg.job?.state || "").toLowerCase();
      if (["done", "succeeded", "completed"].includes(st)) toast("งานเสร็จแล้ว ✅ (ดูใน Side Panel)");
      else if (["failed", "error"].includes(st)) toast("งานไม่สำเร็จ ❌");
    }
  });
})();
