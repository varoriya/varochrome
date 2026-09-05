import { listModels } from "../lib/api.js";
import { connectVaroriya, disconnectVaroriya } from "../lib/connect.js";
import { STORAGE, ACCOUNT_KEY_URL, API_REFERENCE_URL, LOGIN_URL } from "../lib/config.js";

const $ = (id) => document.getElementById(id);

$("getKey").href = ACCOUNT_KEY_URL;
$("docs").href = API_REFERENCE_URL;

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

$("start").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://de.aipass.net/chat" });
});

// ---- advanced: manual key ----
$("toggle").addEventListener("click", () => {
  const inp = $("apiKey");
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  $("toggle").textContent = show ? "ซ่อน" : "แสดง";
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
  const data = await chrome.storage.local.get([
    STORAGE.apiKey,
    STORAGE.accountName,
    "varo_pref_models"
  ]);
  if (data[STORAGE.apiKey]) {
    $("apiKey").value = data[STORAGE.apiKey];
    showConnected(data[STORAGE.accountName] || "(ใส่ Key เอง)");
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
