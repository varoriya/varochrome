import { listModels } from "../lib/api.js";
import { connectVaroriya, disconnectVaroriya } from "../lib/connect.js";
import { STORAGE, ACCOUNT_KEY_URL, API_REFERENCE_URL, LOGIN_URL } from "../lib/config.js";

const $ = (id) => document.getElementById(id);

$("getKey").href = ACCOUNT_KEY_URL;
$("docs").href = API_REFERENCE_URL;

// ---- i18n strings for options page ----
const I18N = {
  th: {
    pageTitle: "ตั้งค่า — VaroChrome 2.0",
    tagline: "Generative AI Panel for Chromium Browsers",
    connectedTitle: "✓ เชื่อมบัญชีแล้ว",
    connectedDesc: "บัญชี: <b id='accountName'>—</b> — พร้อมสร้างภาพ / วิดีโอ / เสียงพากย์ไทยบน de.aipass.net, chatgpt.com, gemini.google.com, และ pinterest.com",
    startAipass: "เริ่มใช้งานบน de.aipass.net →",
    startChatgpt: "เริ่มใช้งานบน ChatGPT →",
    startGemini: "เริ่มใช้งานบน Gemini →",
    startPinterest: "เริ่มใช้งานบน Pinterest →",
    disconnect: "ยกเลิกการเชื่อม",
    connectTitle: "เชื่อมบัญชี Varoriya",
    connectDesc: "ถ้าคุณล็อกอิน <code>varoriya.com</code> อยู่แล้ว กดปุ่มเดียวจบ — ระบบจะสร้าง Key ให้อัตโนมัติ ไม่ต้องคัดลอก",
    connectBtn: "เชื่อมบัญชี Varoriya (คลิกเดียว)",
    connecting: "กำลังเชื่อม…",
    notLoggedIn: "ยังไม่ได้ล็อกอิน varoriya.com — กำลังเปิดหน้าเข้าสู่ระบบ…",
    connectedOk: "เชื่อมสำเร็จ ✓",
    connectFailed: "เชื่อมไม่สำเร็จ: ",
    consentNote: "การเชื่อมบัญชีถือว่าคุณยินยอมให้ส่ง <b>ข้อความ/รูปภาพที่คุณเลือก</b> ไปประมวลผลสร้างสื่อ แบบชั่วคราวตามนโยบาย Zero-Log (ไม่เก็บ log ข้อความ)",
    noKeyTitle: "ใช้ได้ทันที ไม่ต้องเชื่อมบัญชี",
    noKeyDesc: "⚡ Prompt (คัดลอกไปเกลา) และเมนูคลิกขวา ใช้ได้ทันทีบน ChatGPT, Gemini, Pinterest, AiPASS และทุกเว็บไซต์ — เชื่อมบัญชีเมื่อต้องการเจนภาพ/วิดีโอ/เสียงเท่านั้น",
    advTitle: "ตัวเลือกขั้นสูง — ใส่ API Key เอง",
    advDesc: "สำหรับผู้ที่มี Generation API Key อยู่แล้ว (ขึ้นต้น <code>varo_gk_</code>)",
    keyPh: "varo_gk_...",
    showBtn: "แสดง",
    hideBtn: "ซ่อน",
    saveBtn: "บันทึก",
    getKeyLink: "รับ / สร้าง API Key",
    docsLink: "เอกสาร API Reference",
    invalidKey: "รูปแบบ API Key ไม่ถูกต้อง (ต้องขึ้นต้น varo_gk_)",
    savedOk: "บันทึกแล้ว ✓",
    modelsTitle: "โมเดลเริ่มต้น",
    mImage: "ภาพ",
    mVideo: "วิดีโอ",
    mAudio: "เสียง",
    saveModelsBtn: "บันทึกโมเดล",
    disclaimer: "ส่วนเสริมนี้เป็นเครื่องมืออิสระที่พัฒนาโดย Varoriya เพื่ออำนวยความสะดวกในการใช้งาน <b>ไม่ใช่ระบบทางการของรัฐ</b> และไม่มีส่วนเกี่ยวข้องอย่างเป็นทางการกับผู้ให้บริการใดๆ รองรับเบราว์เซอร์กลุ่ม Chromium (Chrome, Edge, Brave, Opera)"
  },
  en: {
    pageTitle: "Settings — VaroChrome 2.0",
    tagline: "Omni-Media Studio for Chromium Browsers",
    connectedTitle: "✓ Account Connected",
    connectedDesc: "Account: <b id='accountName'>—</b> — Ready to generate images / videos / Thai voice on de.aipass.net, chatgpt.com, gemini.google.com, and pinterest.com",
    startAipass: "Start on AiPASS →",
    startChatgpt: "Start on ChatGPT →",
    startGemini: "Start on Gemini →",
    startPinterest: "Start on Pinterest →",
    disconnect: "Disconnect",
    connectTitle: "Connect Varoriya Account",
    connectDesc: "If you are already logged into <code>varoriya.com</code>, one click is all it takes — we'll provision a key automatically, no copy/paste needed.",
    connectBtn: "Connect Varoriya (One Click)",
    connecting: "Connecting…",
    notLoggedIn: "Not logged into varoriya.com — opening login page…",
    connectedOk: "Connected ✓",
    connectFailed: "Connection failed: ",
    consentNote: "Connecting your account means you agree to send <b>selected text/images</b> for temporary media generation under our Zero-Log policy (no chat logs stored).",
    noKeyTitle: "Use instantly — no account required",
    noKeyDesc: "⚡ Prompt (copy-to-clipboard) and right-click menu work instantly on ChatGPT, Gemini, Pinterest, AiPASS, and any website — connect an account only when you want to generate images/videos/audio.",
    advTitle: "Advanced — Manual API Key",
    advDesc: "For those who already have a Generation API Key (starts with <code>varo_gk_</code>)",
    keyPh: "varo_gk_...",
    showBtn: "Show",
    hideBtn: "Hide",
    saveBtn: "Save",
    getKeyLink: "Get / Create API Key",
    docsLink: "API Reference Docs",
    invalidKey: "Invalid API Key format (must start with varo_gk_)",
    savedOk: "Saved ✓",
    modelsTitle: "Default Models",
    mImage: "Image",
    mVideo: "Video",
    mAudio: "Audio",
    saveModelsBtn: "Save Models",
    disclaimer: "This is an independent tool developed by Varoriya for convenience. <b>Not an official government system</b> and not officially affiliated with any service provider. Works on Chromium browsers (Chrome, Edge, Brave, Opera)."
  }
};

// ---- language toggle ----
function applyLang(lang) {
  const t = I18N[lang] || I18N.th;
  document.title = t.pageTitle;
  document.documentElement.lang = lang;

  $("langTh").classList.toggle("active", lang === "th");
  $("langEn").classList.toggle("active", lang === "en");

  // data-i18n elements (ALL elements with data-i18n attribute get translated)
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      // Special case: labels wrap a <select> — need to preserve the select
      if (el.tagName === "LABEL" && el.querySelector("select")) {
        const select = el.querySelector("select");
        el.innerHTML = t[key];
        el.appendChild(select);
      } else {
        el.innerHTML = t[key];
      }
    }
  });

  // explicit button texts
  if ($("startAipass")) $("startAipass").textContent = t.startAipass;
  if ($("startChatgpt")) $("startChatgpt").textContent = t.startChatgpt;
  if ($("startGemini")) $("startGemini").textContent = t.startGemini;
  if ($("startPinterest")) $("startPinterest").textContent = t.startPinterest;
  if ($("disconnect")) $("disconnect").textContent = t.disconnect;
  if ($("connect")) $("connect").textContent = t.connectBtn;
  if ($("save")) $("save").textContent = t.saveBtn;
  if ($("saveModels")) $("saveModels").textContent = t.saveModelsBtn;

  // show/hide toggle text uses showBtn/hideBtn
  const keyInput = $("apiKey");
  const isShowing = keyInput && keyInput.type === "text";
  $("toggle").textContent = isShowing ? t.hideBtn : t.showBtn;

  // placeholder
  if (keyInput) keyInput.placeholder = t.keyPh;
}

async function setLang(lang) {
  await chrome.storage.local.set({ varo_ui_lang: lang });
  applyLang(lang);
}

$("langTh").addEventListener("click", () => setLang("th"));
$("langEn").addEventListener("click", () => setLang("en"));

// ---- connected / disconnected UI ----
function showConnected(name) {
  $("accountName").textContent = name || "บัญชี Varoriya";
  $("connectedCard").style.display = "";
  $("connectCard").style.display = "none";
}
function showDisconnected() {
  $("connectedCard").style.display = "none";
  $("connectCard").style.display = "";
}

// ---- one-click connect ----
$("connect").addEventListener("click", async () => {
  const btn = $("connect");
  btn.disabled = true;
  $("connectStatus").style.color = "";
  $("connectStatus").textContent = "กำลังเชื่อม…";
  try {
    const res = await connectVaroriya();
    if (!res.loggedIn) {
      $("connectStatus").style.color = "#c0392b";
      $("connectStatus").textContent = "ยังไม่ได้ล็อกอิน varoriya.com — กำลังเปิดหน้าเข้าสู่ระบบ…";
      chrome.tabs.create({ url: LOGIN_URL });
      return;
    }
    $("connectStatus").textContent = "เชื่อมสำเร็จ ✓";
    showConnected(res.displayName);
  } catch (e) {
    $("connectStatus").style.color = "#c0392b";
    $("connectStatus").textContent = "เชื่อมไม่สำเร็จ: " + e.message;
  } finally {
    btn.disabled = false;
  }
});

$("disconnect").addEventListener("click", async () => {
  await disconnectVaroriya();
  showDisconnected();
});

$("startAipass").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://de.aipass.net/chat" });
});
$("startChatgpt").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://chatgpt.com/" });
});
$("startGemini").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://gemini.google.com/" });
});
$("startPinterest").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.pinterest.com/varoriya/varoriya/" });
});

// ---- advanced: manual key ----
$("toggle").addEventListener("click", () => {
  const inp = $("apiKey");
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  // Update text based on current stored language
  chrome.storage.local.get(["varo_ui_lang"], (data) => {
    const lang = data.varo_ui_lang || (navigator.language?.startsWith("th") ? "th" : "en");
    $("toggle").textContent = lang === "th" ? (show ? "ซ่อน" : "แสดง") : (show ? "Hide" : "Show");
  });
});

$("save").addEventListener("click", async () => {
  const key = $("apiKey").value.trim();
  if (key && !key.startsWith("varo_gk_")) {
    $("saveStatus").style.color = "#c0392b";
    $("saveStatus").textContent = "รูปแบบ API Key ไม่ถูกต้อง (ต้องขึ้นต้น varo_gk_)";
    return;
  }
  await chrome.storage.local.set({ [STORAGE.apiKey]: key, [STORAGE.consent]: Date.now() });
  $("saveStatus").style.color = "";
  $("saveStatus").textContent = "บันทึกแล้ว ✓";
  showConnected("(ใส่ Key เอง)");
  setTimeout(() => ($("saveStatus").textContent = ""), 2500);
});

// ---- default models ----
function fillSelect(sel, models, current) {
  sel.innerHTML = models
    .map((m) => `<option value="${m.id}"${m.id === current ? " selected" : ""}>${m.label}</option>`)
    .join("");
}

$("saveModels").addEventListener("click", async () => {
  await chrome.storage.local.set({
    varo_pref_models: {
      image: $("mImage").value,
      video: $("mVideo").value,
      audio: $("mAudio").value
    }
  });
  $("modelStatus").textContent = "บันทึกแล้ว ✓";
  setTimeout(() => ($("modelStatus").textContent = ""), 2500);
});

// ---- init ----
async function load() {
  // Load saved language or detect
  const data = await chrome.storage.local.get([
    STORAGE.apiKey,
    STORAGE.accountName,
    "varo_pref_models",
    "varo_ui_lang"
  ]);

  // Apply language
  let lang = data.varo_ui_lang;
  if (!lang) {
    // Auto-detect like studio.js does
    const navLang = (navigator.language || "").toLowerCase();
    lang = navLang.startsWith("th") ? "th" : "en";
  }
  applyLang(lang);

  if (data[STORAGE.apiKey]) {
    $("apiKey").value = data[STORAGE.apiKey];
    showConnected(data[STORAGE.accountName] || (lang === "th" ? "(ใส่ Key เอง)" : "(Manual key)"));
  } else {
    showDisconnected();
  }

  const models = await listModels();
  const pref = data.varo_pref_models || {};
  fillSelect($("mImage"), models.image, pref.image);
  fillSelect($("mVideo"), models.video, pref.video);
  fillSelect($("mAudio"), models.audio, pref.audio);
}

load();
