import { getBalance, listGenerations } from "../lib/api.js";
import { STORAGE, TOPUP_URL, ACCOUNT_KEY_URL, API_REFERENCE_URL } from "../lib/config.js";

const $ = (id) => document.getElementById(id);

$("topup").href = TOPUP_URL;
$("keylink").href = ACCOUNT_KEY_URL;
$("reflink").href = API_REFERENCE_URL;
$("options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
$("refresh").addEventListener("click", refreshAll);

function stateBadge(state) {
  const s = (state || "").toLowerCase();
  if (["done", "succeeded", "completed"].includes(s)) return `<span class="vp-badge done">เสร็จ</span>`;
  if (["failed", "error", "canceled"].includes(s)) return `<span class="vp-badge failed">ล้มเหลว</span>`;
  return `<span class="vp-badge processing">กำลังทำ</span>`;
}

async function renderBalance() {
  try {
    const { coins, breakdown } = await getBalance();
    $("balance").textContent = Number(coins).toLocaleString();
    if (breakdown && typeof breakdown === "object") {
      const parts = Object.entries(breakdown)
        .filter(([k, v]) => k !== "total" && Number(v) > 0)
        .map(([k, v]) => `<span>${k}: ${Number(v).toLocaleString()}</span>`);
      $("breakdown").innerHTML = parts.join("");
    }
  } catch (e) {
    $("balance").textContent = e.code === "MISSING_API_KEY" ? "ตั้งค่า Key" : "—";
  }
}

async function renderJobs() {
  const data = await chrome.storage.local.get(STORAGE.jobs);
  const jobs = (data[STORAGE.jobs] || []).filter((j) => !j.done);
  const el = $("jobs");
  if (!jobs.length) {
    el.innerHTML = `<div class="vp-empty">ยังไม่มีงาน</div>`;
    return;
  }
  el.innerHTML = jobs
    .map(
      (j) => `
      <div class="vp-job">
        <div class="vp-job-main">
          <div class="vp-job-kind">${j.kind || "job"}</div>
          <div class="vp-job-state">${j.id}</div>
        </div>
        ${stateBadge(j.state)}
      </div>`
    )
    .join("");
}

async function renderHistory() {
  const el = $("history");
  try {
    const gens = await listGenerations({ limit: 24 });
    if (!gens.length) {
      el.innerHTML = `<div class="vp-empty">ยังไม่มีสื่อในรอบ 24 ชม.</div>`;
      return;
    }
    el.innerHTML = gens
      .map((g) => {
        const url = g.result_url;
        const thumb =
          url && !g.expired
            ? `<img class="vp-thumb" src="${url}" alt="" onerror="this.style.visibility='hidden'"/>`
            : `<div class="vp-thumb"></div>`;
        const inner = `
          ${thumb}
          <div class="vp-job-main">
            <div class="vp-job-kind">${g.model || g.kind || ""}</div>
            <div class="vp-job-state">${g.coins ?? ""} coin · ${g.state || ""}</div>
          </div>`;
        return url && !g.expired
          ? `<div class="vp-hist"><a href="${url}" target="_blank">${inner}</a></div>`
          : `<div class="vp-hist">${inner}</div>`;
      })
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="vp-empty">${
      e.code === "MISSING_API_KEY" ? "ยังไม่ได้ตั้งค่า API Key" : "โหลดประวัติไม่สำเร็จ"
    }</div>`;
  }
}

function refreshAll() {
  renderBalance();
  renderJobs();
  renderHistory();
}

// Live updates when the service worker reports job progress.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "varo:job-update") {
    renderJobs();
    const st = (msg.job?.state || "").toLowerCase();
    if (["done", "succeeded", "completed"].includes(st)) {
      renderBalance();
      renderHistory();
    }
  }
});

refreshAll();
setInterval(renderBalance, 30000); // real-time-ish balance
