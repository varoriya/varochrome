// Varo Studio — in-page slide-in panel (right side). Uses Shadow DOM so the
// panel's CSS is fully isolated from de.aipass.net. Opens prefilled from the
// bubble / hover overlay / action bar, lets the user tweak prompt + model, then
// generates via the service worker and shows the result inline. Non-blocking:
// the chat stays usable while a job runs.
//
// window.VaroStudio.open({ kind, prompt, imageUrl }) — kind = image|video|audio

(function () {
  // Returns false once the extension is reloaded while this old content script is
  // still alive — guards chrome.* calls so the panel fails quietly (no throws).
  const extAlive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  // Verified against api.varoriya.com OpenAPI (2026-09-01). Each model carries
  // its own capabilities so the form only shows options that model supports.
  const MODELS = {
    image: [
      { id: "seedream5pro", label: "Seedream 5 Pro", desc: { th: "แก้แม่นยำ รองรับไทย", en: "Precise editing, supports Thai" }, ref: true,
        qualities: ["1K", "2K"], aspects: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"] },
      { id: "nanobananapro", label: "Nano Banana Pro", desc: { th: "1K–4K ข้อความไทยแม่น ค้น Google ได้", en: "1K–4K, accurate Thai text, Google search" }, ref: true,
        qualities: ["1K", "2K", "4K"], aspects: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"] },
      { id: "grok", label: "Grok", desc: { th: "หลายสไตล์ ข้อความในภาพคมชัด แก้ได้ 1 ภาพ", en: "Versatile, sharp text in image, 1-image edit" }, ref: true,
        aspects: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
      { id: "gptimage", label: "GPT-Image", desc: { th: "ทำตามคำสั่งดี ข้อความไทยในภาพ", en: "Great instruction following, Thai text in image" }, ref: true,
        qualities: ["low", "medium", "high"], dq: "medium", aspects: ["1:1", "2:3", "3:2"] },
      { id: "z-image", label: "Z-Image", desc: { th: "เร็ว ประหยัด ภาพเหมือนจริง", en: "Fast, cheap, photorealistic" }, ref: false,
        qualities: ["1K", "2K", "Sketch"], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"] }
    ],
    video: [
      { id: "h3", label: "MiniMax H3", desc: { th: "วิดีโอมีเสียง อ้างอิงภาพ/วิดีโอ/เสียง 4–15 วิ", en: "Video+audio, ref image/video/audio 4–15s" }, ref: true,
        qualities: ["768P", "2K"], aspects: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { id: "seedance2", label: "Seedance 2.0", desc: { th: "วิดีโอมีเสียง อ้างอิงภาพ/วิดีโอ 4–15 วิ", en: "Video+audio, ref image/video 4–15s" }, ref: true,
        qualities: ["480p", "720p"], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durations: [4, 5, 6, 8, 10, 12, 15] },
      { id: "grokvideo", label: "Grok Video", desc: { th: "T2V/I2V มีเสียง — v1.5 พูดไทยได้", en: "T2V/I2V with audio — v1.5 speaks Thai" }, ref: true,
        qualities: ["480p", "720p"], aspects: ["auto"], durations: [5, 10, 15] },
      { id: "flux3", label: "Flux 3", desc: { th: "วิดีโอมีเสียง keyframe/ต่อคลิป 5–20 วิ", en: "Video+audio, keyframe/continue 5–20s" }, ref: true,
        qualities: ["720p", "1080p"], aspects: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "2:1"], durations: [5, 10, 15, 20] },
      { id: "wanoptimizet2v", label: "WAN 2.2 · T2V", desc: { th: "ถูก/เร็ว ฟิลเตอร์เบา ไม่มีเสียง", en: "Cheap/fast, light filtering, no audio" }, ref: false,
        qualities: ["480p", "720p"], aspects: ["16:9", "9:16"] },
      { id: "wanoptimize", label: "WAN 2.2 · I2V", desc: { th: "ต้องมีภาพต้นแบบ ฟิลเตอร์เบา ไม่มีเสียง", en: "Requires source image, light filtering, no audio" }, ref: true,
        qualities: ["480p", "720p"], aspects: ["16:9", "9:16"] }
    ],
    audio: [
      { id: "seedaudio-multilingual", label: "Seed Audio Multilingual", desc: { th: "17 ภาษา รวมไทย เสียงพูด/ดนตรี/เสียงประกอบ (Seed Audio v1)", en: "17 languages incl. Thai, speech/music/SFX (Seed Audio v1)" }, ref: false },
      { id: "seedaudio", label: "Seed Audio Standard", desc: { th: "อังกฤษ + จีน เท่านั้น (Seed Audio v0 — ไม่มีภาษาไทย)", en: "English + Chinese only (Seed Audio v0 — no Thai)" }, ref: false }
    ]
  };

  // More Varo services — send the image to generate on varoriya.com (no REST yet).
  const WEB_EDITS = [
    { a: "boxes", icon: "▢", label: "Boxes" },
    { a: "reface", icon: "👤", label: "Reface" },
    { a: "retouch", icon: "🎨", label: "Retouch" },
    { a: "spyshot", icon: "🎭", label: "SpyShot" },
    { a: "vr360", icon: "🌐", label: "VR 360°" },
    { a: "registry", icon: "✓", label: "Registry" }
  ];

  // Starter prompt templates per kind × language — help newcomers get a good first result.
  // Language auto-detected from <html lang> → navigator.language → fallback "en".
  const TEMPLATES = {
    image: {
      th: [
        { label: "แก้ไข: เปลี่ยนชุดไทย", text: "แก้ไขภาพ เปลี่ยนให้สวมชุดไทยจักรีสีชมพู ผ้าซิ่นไหมเกล็ดหอย เกล้าผมสูง ประดับดอกไม้ไทย ภาพเหมือนจริง รายละเอียดผ้าและเครื่องประดับคมชัด" },
        { label: "แก้ไข: เปลี่ยนฉากปารีส", text: "แก้ไขภาพ เปลี่ยนฉากหลังเป็นกรุงปารีสฤดูหนาว มีหอไอเฟลอยู่ด้านหลัง ท้องฟ้ามืดครึ้ม หิมะตกโปรยปรายและปกคลุมพื้น ถนนเปียกสะท้อนแสงไฟเมือง" },
        { label: "แก้ไข: เปลี่ยนทรงผม", text: "แก้ไขภาพ เปลี่ยนทรงผมคนในภาพเป็นผมยาวสลวยเกล้าครึ่งท่อน มีปอยผมตกปรอยๆ ดูเป็นธรรมชาติ เส้นผมชัดมีวอลลุ่ม" },
        { label: "แก้ไข: เปลี่ยนท่าโพส", text: "แก้ไขภาพ เปลี่ยนท่าทางคนในภาพให้ยืนโพสท่านางแบบมืออาชีพ ในสตูดิโอพื้นหลังสีขาวสะอาดตา แสงซอฟต์บอกซ์สองข้าง" },
        { label: "สร้าง: หญิงริมหาด", text: "สร้างภาพหญิงสาววัยรุ่นเดินเล่นริมหาดทรายขาวยามพระอาทิตย์ตก ทะเลสีคราม คลื่นซัดฝั่งเบาๆ สวมเดรสสีขาวพลิ้วไสวตามลม แสงทองส่องกระทบผิว" }
      ],
      en: [
        { label: "Edit: Thai dress", text: "Change the person to wear a traditional pink Thai Chakkri dress with silk sarong, ornate gold jewelry, hair up in Thai bun with flowers. Photorealistic, sharp details of fabric and ornaments." },
        { label: "Edit: Paris scene", text: "Transform the background to Paris in winter with the Eiffel Tower behind. Overcast sky, snow falling and covering the ground, wet streets reflecting city lights." },
        { label: "Edit: Hairstyle", text: "Change the person's hairstyle to a long flowing half-updo with soft tendrils framing the face. Natural-looking, voluminous, detailed hair strands." },
        { label: "Edit: Model pose", text: "Transform the person's pose to a professional model stance in a clean white studio background with softbox lighting from both sides. Fashion photography style." },
        { label: "Create: Beach walk", text: "Create an image of a young woman walking on a white sandy beach at sunset, turquoise sea, gentle waves, wearing a flowing white dress that catches the breeze, golden hour light, photorealistic." }
      ]
    },
    video: {
      th: [
        { label: "พูดไทย", text: "ทำให้ภาพเคลื่อนไหว ตัวละครในภาพยิ้มแล้วหันมาทางกล้อง พูดภาษาไทยว่า \"สวัสดีค่ะ ยินดีต้อนรับสู่ Varoriya ค่ะ\" ปากขยับตรงตามเสียง แสงนุ่มนวล การเคลื่อนไหวเป็นธรรมชาติ" },
        { label: "โปรโมทสินค้า", text: "ทำให้ภาพเคลื่อนไหว สินค้าถูกยกขึ้นมาแสดง มุมกล้องซูมเข้าใกล้ ตัวละครพูดภาษาไทยโปรโมทสินค้าว่า \"รุ่นนี้มาใหม่ รับประกันคุณภาพ สนใจทักเลยค่ะ\" ปากขยับตรงตามเสียง ฉากหลังสตูดิโอ" },
        { label: "ซีนีม่า + เคลื่อนกล้อง", text: "ทำให้ภาพนี้เป็นซีนภาพยนตร์ กล้องค่อยๆ dolly zoom จากมุมกว้างสู่มุมใกล้ ช้าๆ เนียนๆ โทนสีอบอุ่นแบบซีเนมาติก เกรนฟิล์มละเอียด Depth of field ตื้น" },
        { label: "เต้นป๊อป", text: "ทำให้คนในภาพเต้นสไตล์ป๊อปแดนซ์ ท่าจังหวะสนุกสนาน เป็นธรรมชาติ ขยับตามจังหวะเพลง กล้องอยู่กับที่ เห็นเต็มตัว" }
      ],
      en: [
        { label: "Speak English", text: "Animate the image: The person smiles and turns toward the camera, speaking English \"Hello, welcome to Varoriya, I am ready to serve you.\" Lip-sync matched, studio lighting, natural motion." },
        { label: "Product promo", text: "Animate the image: The product is lifted and shown to camera with slow zoom in. The person speaks English promoting the product. Lip-sync accurate, professional presentation style, studio background." },
        { label: "Cinematic + cam move", text: "Transform this image into a cinematic scene. Slow dolly zoom from wide to close-up, smooth motion, warm cinematic color grading, subtle film grain, shallow depth of field." },
        { label: "Pop dance", text: "Animate the person to dance pop style, energetic and natural moves, following the beat, fixed camera angle, full body visible, smooth motion." }
      ]
    },
    audio: {
      th: [
        { label: "พากย์ไทย + เอฟเฟกต์", text: "[เสียงผู้หญิงอายุ 18 ปี กำลังวิ่งหอบเหนื่อยอย่างหนัก ท่ามกลางสมรภูมิรบ มีเสียงระเบิดดังตูมสนั่นจนพื้นดินสะเทือน ตามด้วยเสียงปืนกลยิงสาดเข้ามาอย่างต่อเนื่อง] พูดภาษาไทยว่า: \"รู้ไหมว่า Seed Audio 1.0 รองรับเสียงพูดภาษาไทยแล้วนะ! (เสียงระเบิดดังแทรก)\"" },
        { label: "เสียงบรรยาย", text: "เสียงหญิงสาว บรรยายโทนอบอุ่น จังหวะสม่ำเสมอ เหมาะกับสารคดี พูดภาษาไทยว่า \"ณ ผืนป่าอันเงียบสงบแห่งนี้ ชีวิตนับพันกำลังเริ่มต้นขึ้นอีกครั้ง\"" },
        { label: "ดนตรีประกอบ", text: "ดนตรีประกอบบรรยากาศสดใส จังหวะกลาง เหมาะเป็นพื้นหลังคลิป" }
      ],
      en: [
        { label: "English VO + SFX", text: "[sound of a young woman running and panting heavily, amidst a battlefield with huge explosions shaking the ground, continuous machine-gun fire] Speaking: \"Run! Get down now! Seed Audio 1.0 is here!\" (explosion interrupts)" },
        { label: "Narration", text: "Warm female narration voice, steady pace, suitable for documentary. Speaking: \"In this peaceful forest, thousands of lives are beginning anew.\"" },
        { label: "Background music", text: "Upbeat background music, medium tempo, suitable as video backing track." }
      ]
    }
  };

  // Detect UI language: <html lang> → navigator.language → fallback "en"
  function uiLang() {
    const htmlLang = document.documentElement.lang || "";
    if (/^th/i.test(htmlLang)) return "th";
    const navLang = (navigator.language || "").toLowerCase();
    if (navLang.startsWith("th")) return "th";
    return "en";
  }

  // UI strings for multi-language support (static labels)
  const UI_STRINGS = {
    "segImage":    { th: "ภาพ", en: "Image" },
    "segVideo":    { th: "วิดีโอ", en: "Video" },
    "segAudio":    { th: "เสียง", en: "Audio" },
    "refHint":     { th: "ใช้ภาพนี้เป็นต้นแบบ", en: "Use this image as reference" },
    "dropHint":    { th: "อัปโหลดภาพต้นแบบ (ลากวาง หรือคลิก)", en: "Upload reference image (drag & drop or click)" },
    "tplLabel":    { th: "ตัวอย่างพร้อมท์", en: "Sample Prompt" },
    "promptLabel": { th: "Prompt", en: "Prompt" },
    "promptPh":    { th: "พิมพ์คำอธิบายภาพ/ฉาก/สคริปต์…", en: "Describe the image/scene/script…" },
    "modelLabel":  { th: "โมเดล", en: "Model" },
    "qualityLabel":{ th: "ความละเอียด", en: "Quality" },
    "aspectLabel": { th: "อัตราส่วน", en: "Aspect Ratio" },
    "durationLabel":{ th: "ความยาว", en: "Duration" },
    "genBtn":      { th: "Generate", en: "Generate" },
    "editsHint":   { th: "บริการเพิ่มเติม — ส่งภาพไปเจนบนเว็บ Varoriya", en: "More services — generate on Varoriya website" },
    "historyLink": { th: "ดูประวัติการเจนทั้งหมด", en: "View full generation history" },
    "coinsTitle":  { th: "เหรียญคงเหลือ", en: "Coins remaining" }
  };

  // Dynamic (runtime) strings
  const T = {
    promptEmpty:  { th: "ใส่ prompt ก่อนจ้า", en: "Please enter a prompt" },
    noImage:      { th: "ต้องมีภาพต้นแบบ", en: "No reference image" },
    submitting:   { th: "กำลังส่งงาน…", en: "Submitting job…" },
    noApiKey:     { th: "ยังไม่ได้เชื่อมบัญชี — เปิดหน้าตั้งค่าเพื่อเชื่อม Varoriya", en: "Account not connected — open settings to connect Varoriya" },
    extReloaded:  { th: "ส่วนเสริมเพิ่งรีโหลด — โปรดรีเฟรชหน้าเว็บแล้วลองใหม่", en: "Extension just reloaded — please refresh the page" },
    jobFailed:    { th: "เริ่มงานไม่สำเร็จ: ", en: "Failed to start job: " },
    processing:   { th: "กำลังประมวลผล… (ทำงานเบื้องหลัง)", en: "Processing… (running in background)" },
    approx:       { th: "ใช้ประมาณ", en: "Approx." },
    perSec:       { th: "/วิ", en: "/sec" },
    insufficient: { th: "เหรียญคงเหลือไม่พอ", en: "Insufficient coins" },
    unknown:      { th: "ไม่ทราบสาเหตุ", en: "unknown" }
  };

  function tt(map) { return (map[state.lang] || map.en || ""); }

  const state = { kind: "image", imageUrl: null, jobId: null, pref: {}, coins: null, pricing: [], lang: uiLang() };
  let host, shadow, els = {};

  chrome.storage?.local.get(["varo_pref_models"], (d) => {
    if (d?.varo_pref_models) state.pref = d.varo_pref_models;
  });

  function fontUrl() {
    return chrome.runtime.getURL("fonts/MaterialSymbolsOutlined.woff2");
  }

  function build() {
    host = document.createElement("div");
    host.id = "varo-studio-host";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        @font-face{font-family:"Varo Material Symbols";font-style:normal;font-weight:100 700;src:url("${fontUrl()}") format("woff2");}
        :host{ all: initial; }
        *{ box-sizing:border-box; font-family:"Segoe UI","Sarabun",system-ui,sans-serif; }
        .sym{ font-family:"Varo Material Symbols"; font-size:18px; line-height:1; vertical-align:middle; }
        .panel{
          position:fixed; top:0; right:0; height:100vh; width:390px; max-width:94vw;
          background:#fff; color:#1f2430; z-index:2147483640;
          box-shadow:-8px 0 30px rgba(17,24,39,.18);
          transform:translateX(105%); transition:transform .28s cubic-bezier(.4,0,.2,1);
          display:flex; flex-direction:column; border-left:3px solid #ff6a00;
        }
        :host(.open) .panel{ transform:translateX(0); }
        header{ display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #eef1f6; }
        header img{ width:24px; height:24px; border-radius:6px; }
        header .t{ font-weight:700; }
        header .s{ font-size:11px; color:#8a8fa0; }
        header .close{ margin-left:auto; cursor:pointer; color:#8a8fa0; background:none; border:none; }
        header .close:hover{ color:#e85d00; }
        .coins, a.coins, a.coins:visited{ display:inline-flex; align-items:center; gap:4px; margin-left:auto; font-size:12px; font-weight:600; color:#e85d00; background:#fff3ea; border:1px solid #ffd9bd; border-radius:20px; padding:4px 10px; text-decoration:none; }\n        a.coins:hover{ background:#ffd9bd; }
        .coins .sym{ font-size:15px; }
        header .close{ margin-left:8px; }
        .body{ padding:14px 16px; overflow-y:auto; flex:1; }
        .seg{ display:flex; gap:6px; margin-bottom:12px; }
        .seg button{ flex:1; padding:8px; border:1px solid #e7eaf0; background:#fff; border-radius:9px; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:5px; color:#1f2430; }
        .seg button.on{ background:#fff3ea; border-color:#ff6a00; color:#e85d00; font-weight:600; }
        label.f{ display:block; font-size:12px; color:#5b6472; margin:12px 0 5px; }
        textarea{ width:100%; min-height:184px; line-height:1.4; padding:10px 12px; border:1px solid #e7eaf0; border-radius:9px; font-size:13px; resize:vertical; color:#1f2430; }
        select{ width:100%; padding:9px 10px; border:1px solid #e7eaf0; border-radius:9px; font-size:13px; background:#fff; color:#1f2430; }
        .hint{ font-size:11px; color:#8a8fa0; margin-top:5px; line-height:1.4; }
        textarea:focus, select:focus{ outline:none; border-color:#ff6a00; box-shadow:0 0 0 3px rgba(255,106,0,.12); }
        .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .ref{ display:flex; align-items:center; gap:10px; margin-top:10px; padding:8px; background:#f7f8fb; border-radius:9px; flex-direction: column;}
        .ref img{ width:100%; height:auto; object-fit:cover; border-radius:7px; }
        .ref .x{ margin-left:auto; cursor:pointer; color:#8a8fa0; background:none; border:none; }
        .drop{ margin-top: 10px;
    border: 1.5px dashed #d7dbe4;
    border-radius: 10px;
    padding: 12px;
    text-align: center;
    cursor: pointer;
    color: #8a8fa0;
    font-size: 12px;
    background: #fafbfd;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;}
        .drop:hover, .drop.over{ border-color:#ff6a00; color:#e85d00; background:#fff6ee; }
        .drop .sym{ font-size:20px; display:block; margin-bottom:2px; }
        .tpl{ margin-top:10px; }
        .tpl .row{ display:flex; flex-wrap:wrap; gap:6px; }
        .tpl button{ font-size:12px; padding:5px 10px; border:1px solid #e7eaf0; border-radius:14px; background:#fff; cursor:pointer; color:#5b6472; }
        .tpl button:hover{ border-color:#ff6a00; color:#e85d00; background:#fff6ee; }
        .tpl .head{ display:flex; align-items:center; gap:8px; margin-bottom:6px; }
        .tpl .head label.f{ margin:0; }
        .lang-pill{ display:inline-flex; border:1px solid #d7dbe4; border-radius:12px; overflow:hidden; font-size:11px; font-weight:600; line-height:1; }
        .lang-pill span{ padding:3px 8px; cursor:pointer; color:#8a8fa0; background:#fff; transition:all .15s; }
        .lang-pill span.on{ color:#fff; background:#ff6a00; border-color:#ff6a00; }
        header .lang-pill{ margin-left:6px; }
        .gen{ width:100%; margin-top:16px; padding:12px; border:none; border-radius:10px; background:#ff6a00; color:#fff; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
        .gen:hover{ background:#e85d00; }
        .gen:disabled{ opacity:.4; cursor:not-allowed; background:#b0b0b0; }
        .gen:disabled:hover{ background:#b0b0b0; }
        .topup-link{ display:inline-block; margin-top:4px; font-size:12px; color:#e85d00; text-decoration:underline; cursor:pointer; }
        .topup-link:hover{ color:#c0392b; }
        .estimate{ font-size:12px; color:#5b6472; margin-top:8px; text-align:center; }
        .estimate b{ color:#e85d00; }
        .estimate .warn{ color:#c0392b; font-weight:600; }
        .status{ font-size:12px; color:#5b6472; margin-top:12px; min-height:16px; text-align:center; }
        .status.err{ color:#c0392b; }
        .result{ margin-top:12px; }
        .result img, .result video{ width:100%; border-radius:10px; background:#f0f1f5; }
        .result audio{ width:100%; }
        .spin{ width:26px; height:26px; margin:14px auto; border:3px solid #f0e2d6; border-top-color:#ff6a00; border-radius:50%; animation:sp .8s linear infinite; }
        @keyframes sp{ to{ transform:rotate(360deg); } }
        .dl{ display:inline-flex; align-items:center; gap:5px; margin-top:10px; color:#e85d00; text-decoration:none; font-size:13px; font-weight:600; }
        .expire{ margin-top:8px; font-size:11px; color:#c0392b; line-height:1.4; display:flex; align-items:flex-start; gap:5px; }
        .expire .sym{ font-size:14px; }
        .history{ display:flex; align-items:center; gap:6px; margin-top:14px; padding-top:12px; border-top:1px solid #eef1f6; color:#5b6472; text-decoration:none; font-size:12px; }
        .history:hover{ color:#e85d00; }
        .edits{ margin-top:14px; border-top:1px solid #eef1f6; padding-top:12px; }
        .edits .h{ font-size:11px; color:#8a8fa0; margin-bottom:8px; }
        .edits .row{ display:flex; flex-wrap:wrap; gap:6px; }
        .edits button{ display:inline-flex; align-items:center; gap:4px; font-size:12px; padding:5px 9px; border:1px solid #e7eaf0; border-radius:8px; background:#fff; cursor:pointer; color:#5b6472; }
        .edits button:hover{ border-color:#ff6a00; color:#e85d00; }
        .boxes-area{ margin-top:10px; }
        .boxes-canvas-wrap{ position:relative; border:1px solid #e7eaf0; border-radius:9px; overflow:hidden; background:#f7f8fb; }
        .boxes-canvas-wrap canvas{ display:block; width:100%; height:auto; } /* cursor controlled by inline style for move/resize */
        .boxes-hint{ font-size:11px; color:#8a8fa0; margin-top:5px; line-height:1.4; }
      </style>
      <div class="panel">
        <header>
          <img src="${chrome.runtime.getURL("icons/varoicon128.png")}" alt="Varo"/>
          <div><div class="t">VaroChrome</div><div class="s">Omni-Media Studio</div></div>
          <div class="lang-pill" id="langPill"><span data-lang="th">TH</span><span data-lang="en">EN</span></div>
          <a class="coins" id="coins" href="https://varoriya.com/product/varocoin/" target="_blank" rel="noopener noreferrer" title="${UI_STRINGS.coinsTitle[uiLang()]}"><span class="sym">&#xe620;</span><span id="coinVal">—</span></a>
          <button class="close" id="close"><span class="sym">&#xe5cd;</span></button>
        </header>
        <div class="body">
          <div class="seg" id="seg">
            <button data-kind="image" data-i18n="segImage"><span class="sym">&#xe40a;</span> ภาพ</button>
            <button data-kind="video" data-i18n="segVideo"><span class="sym">&#xe404;</span> วิดีโอ</button>
            <button data-kind="audio" data-i18n="segAudio"><span class="sym">&#xe91f;</span> เสียง</button>
            <!-- ⏳ Boxes ปิดอยู่ รอพัฒนาให้เสถียรก่อนเปิด
            <button data-kind="boxes" id="boxesBtn" style="display:none"><span class="sym">&#xe3c2;</span> Boxes</button>
            -->
          </div>
          <div class="ref" id="ref" style="display:none">
            <img id="refImg" alt="ref"/>
            <span data-i18n="refHint" style="font-size:12px;color:#5b6472">ใช้ภาพนี้เป็นอ้างอิง</span>
            <button class="x" id="refX"><span class="sym">&#xe5cd;</span></button>
          </div>
          <div class="drop" id="drop">
            <span class="sym">&#xe09c;</span><span data-i18n="dropHint">อัปโหลดภาพอ้างอิง (ลากวาง หรือคลิก)</span>
          </div>
          <input type="file" id="file" accept="image/*" style="display:none"/>
          <!-- ⏳ Boxes area (ปิดอยู่)
          <div class="boxes-area" id="boxesArea" style="display:none">
              <div class="boxes-canvas-wrap"><canvas id="bxCanvas"></canvas></div>
              <div class="boxes-hint">ลากกลางกล่องเพื่อย้าย · ลากมุมเพื่อย่อขยาย</div>
            </div>
          -->
          <div class="tpl" id="tpl">
            <div class="head"><label class="f" data-i18n="tplLabel">ตัวอย่างพร้อมท์</label></div>
            <div class="row" id="tplRow"></div>
          </div>
          <label class="f" data-i18n="promptLabel">Prompt</label>
          <textarea id="prompt" data-i18n-ph="promptPh" placeholder="พิมพ์คำอธิบายภาพ/ฉาก/สคริปต์…"></textarea>
          <label class="f" data-i18n="modelLabel">โมเดล</label>
          <select id="model"></select>
          <div class="hint" id="modelHint"></div>
          <div class="grid2">
            <div id="qualityWrap"><label class="f" data-i18n="qualityLabel">ความละเอียด</label><select id="quality"></select></div>
            <div id="aspectWrap"><label class="f" data-i18n="aspectLabel">อัตราส่วน</label><select id="aspect"></select></div>
          </div>
          <div id="durationWrap"><label class="f" data-i18n="durationLabel">ความยาว</label><select id="duration"></select></div>
          <button class="gen" id="gen"><span class="sym">&#xea54;</span> <span data-i18n="genBtn">Generate</span></button>
          <div class="estimate" id="estimate"></div>
          <div class="status" id="status"></div>
          <div class="result" id="result"></div>
          <div class="edits" id="edits" style="display:none">
            <div class="h" data-i18n="editsHint">บริการเพิ่มเติม — ส่งภาพไปเจนบนเว็บ Varoriya</div>
            <div class="row" id="editRow"></div>
          </div>
          <a class="history" id="history" href="https://varoriya.com/api-usage/" target="_blank" rel="noopener noreferrer">
            <span class="sym">&#xe889;</span> <span data-i18n="historyLink">ดูประวัติการเจนที่ผ่านมา</span>
          </a>
        </div>
      </div>`;
    document.documentElement.appendChild(host);

    els = {
      close: shadow.getElementById("close"),
      coinVal: shadow.getElementById("coinVal"),
      seg: shadow.getElementById("seg"),
      ref: shadow.getElementById("ref"),
      refImg: shadow.getElementById("refImg"),
      refX: shadow.getElementById("refX"),
      drop: shadow.getElementById("drop"),
      file: shadow.getElementById("file"),
      tpl: shadow.getElementById("tpl"),
      tplRow: shadow.getElementById("tplRow"),
      langPill: shadow.getElementById("langPill"),
      prompt: shadow.getElementById("prompt"),
      model: shadow.getElementById("model"),
      modelHint: shadow.getElementById("modelHint"),
      quality: shadow.getElementById("quality"),
      qualityWrap: shadow.getElementById("qualityWrap"),
      aspect: shadow.getElementById("aspect"),
      aspectWrap: shadow.getElementById("aspectWrap"),
      duration: shadow.getElementById("duration"),
      durationWrap: shadow.getElementById("durationWrap"),
      gen: shadow.getElementById("gen"),
      status: shadow.getElementById("status"),
      estimate: shadow.getElementById("estimate"),
      result: shadow.getElementById("result"),
      edits: shadow.getElementById("edits"),
      editRow: shadow.getElementById("editRow"),
      bxCanvas: shadow.getElementById("bxCanvas"),
      boxesArea: shadow.getElementById("boxesArea")
    };

    els.close.addEventListener("click", close);
    els.refX.addEventListener("click", () => setRef(null));
    els.gen.addEventListener("click", generate);
    els.model.addEventListener("change", applyModelCaps);
    els.quality.addEventListener("change", computeEstimate);
    els.duration.addEventListener("change", computeEstimate);
    els.seg.addEventListener("click", (e) => {
      const k = e.target.closest("button")?.dataset.kind;
      if (k) setKind(k);
    });

    // Upload a reference image from the user's device (read as data URL so the
    // service worker can fetch() + presign-upload it just like a remote URL).
    els.drop.addEventListener("click", () => els.file.click());
    els.file.addEventListener("change", () => {
      const f = els.file.files?.[0];
      if (f) readFileAsRef(f);
      els.file.value = "";
    });
    ["dragover", "dragenter"].forEach((ev) =>
      els.drop.addEventListener(ev, (e) => {
        e.preventDefault();
        els.drop.classList.add("over");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      els.drop.addEventListener(ev, (e) => {
        e.preventDefault();
        els.drop.classList.remove("over");
      })
    );
    els.drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith("image/")) readFileAsRef(f);
    });

    // Starter templates -> fill the prompt box.
    els.tplRow.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn?.dataset.text) els.prompt.value = btn.dataset.text;
    });

    // Language pill toggle — also updates all UI text
    els.langPill.addEventListener("click", (e) => {
      const span = e.target.closest("span[data-lang]");
      if (!span) return;
      const lang = span.dataset.lang;
      if (lang === state.lang) return;
      state.lang = lang;
      // Update pill active state
      [...els.langPill.children].forEach((s) => s.classList.toggle("on", s.dataset.lang === lang));
      applyUILang();
      fillTemplates();
    });

    // build web-edit buttons once
    els.editRow.innerHTML = WEB_EDITS.map(
      (e) => `<button data-a="${e.a}">${e.icon} ${e.label}</button>`
    ).join("");
    els.editRow.addEventListener("click", (e) => {
      const a = e.target.closest("button")?.dataset.a;
      if (a && state.imageUrl && extAlive()) {
        chrome.runtime.sendMessage({ type: "varo:image-action", action: a, imageUrl: state.imageUrl });
      }
    });

    // live job updates from the service worker
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "varo:job-update" && msg.job?.id === state.jobId) onJob(msg.job);
    });
  }

  function modelsFor(kind) {
    return MODELS[kind] || MODELS.image;
  }
  function currentModel() {
    const list = modelsFor(state.kind);
    return list.find((m) => m.id === els.model.value) || list[0];
  }

  function fillModels() {
    const list = modelsFor(state.kind);
    const pref = state.pref[state.kind];
    els.model.innerHTML = list
      .map((m) => `<option value="${m.id}"${m.id === pref ? " selected" : ""}>${m.label}</option>`)
      .join("");
  }

  // Show/hide controls per kind + model — cut options a model doesn't support.
  function applyModelCaps() {
    const m = currentModel();
    const isAudio = state.kind === "audio";
    els.modelHint.textContent = (typeof m?.desc === "object" ? tt(m.desc) : m?.desc) || "";

    const refOk = !isAudio && !!state.imageUrl && !!m?.ref;
    if (refOk) els.refImg.src = state.imageUrl;
    els.ref.style.display = refOk ? "" : "none";
    // Upload zone: available for image/video (models that can take a reference).
    els.drop.style.display = !isAudio && !!m?.ref && !state.imageUrl ? "" : "none";
    // Web-edit deep links need a public URL — hide for locally uploaded (data:) images.
    const remoteImg = !!state.imageUrl && /^https?:/i.test(state.imageUrl);
    els.edits.style.display = !isAudio && remoteImg ? "" : "none";
    // ⏳ Boxes button — ปิดอยู่
    // const boxesBtn = shadow.getElementById("boxesBtn");
    // if (boxesBtn) boxesBtn.style.display = !isAudio && !!state.imageUrl ? "" : "none";

    if (m?.qualities?.length) {
      const cur = els.quality.value;
      els.quality.innerHTML = m.qualities.map((q) => `<option value="${q}">${q}</option>`).join("");
      els.quality.value = m.qualities.includes(cur) ? cur : m.dq || m.qualities[0];
      els.qualityWrap.style.display = "";
    } else {
      els.qualityWrap.style.display = "none";
    }

    if (m?.aspects?.length && !isAudio) {
      const cur = els.aspect.value;
      els.aspect.innerHTML = m.aspects.map((a) => `<option value="${a}">${a}</option>`).join("");
      els.aspect.value = m.aspects.includes(cur) ? cur : m.aspects[0];
      els.aspectWrap.style.display = "";
    } else {
      els.aspectWrap.style.display = "none";
    }

    if (m?.durations?.length) {
      const ds = m.durations.map(String);
      const cur = els.duration.value;
      els.duration.innerHTML = ds.map((d) => `<option value="${d}">${d}s</option>`).join("");
      els.duration.value = ds.includes(cur) ? cur : ds.includes("5") ? "5" : ds[0];
      els.durationWrap.style.display = "";
    } else {
      els.durationWrap.style.display = "none";
    }

    computeEstimate();
  }

  function setKind(kind) {
    state.kind = kind;
    [...els.seg.children].forEach((b) => b.classList.toggle("on", b.dataset.kind === kind));
    // ⏳ Boxes mode — ปิดอยู่ (รอพัฒนาให้เสถียรก่อนเปิด)
    // const isBoxes = kind === "boxes";
    // showBoxesMode(isBoxes);
    // if (isBoxes) { els.tpl.style.display = "none"; els.model.style.display = "none"; els.modelHint.style.display = "none"; els.qualityWrap.style.display = "none"; els.aspectWrap.style.display = "none"; els.durationWrap.style.display = "none"; els.drop.style.display = "none"; els.ref.style.display = "none"; els.edits.style.display = "none"; return; }
    fillModels();
    fillTemplates();
    applyModelCaps();
  }

  function setRef(url) {
    state.imageUrl = url;
    applyModelCaps();
  }

  function readFileAsRef(file) {
    const reader = new FileReader();
    reader.onload = () => setRef(reader.result);
    reader.readAsDataURL(file);
  }

  // ⏳ ---- Boxes Editor (วาดกล่อง, ย้าย, ปรับขนาด) — ปิดอยู่ รอให้เสถียรก่อนเปิด ----
  let bxState = { boxes: [], mode: "draw", sel: -1, img: null, drag: null, eventsBound: false };
  let bxCtx, bxOverlay;

  function initBoxes(imageUrl) {
    if (!els.bxCanvas) return;
    const canvas = els.bxCanvas;
    const ctx = canvas.getContext("2d");
    bxCtx = ctx;
    bxState = { boxes: [], mode: "draw", sel: -1, img: null, drag: null };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bxState.img = img;
      // Fit canvas to panel width, maintain aspect
      const wrap = canvas.parentElement;
      const maxW = wrap.clientWidth || 340;
      const scale = Math.min(maxW / img.width, 300 / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      bxState.scale = scale;
      // Auto-create a centered square box at 30% of canvas width
      const sz = Math.round(canvas.width * 0.3);
      const bx = Math.round((canvas.width - sz) / 2);
      const by = Math.round((canvas.height - sz) / 2);
      bxState.boxes = [{ x: bx, y: by, w: sz, h: sz }];
      bxState.sel = 0;
      drawBoxes();
    };
    img.src = imageUrl;
  }

  function drawBoxes() {
    const ctx = bxCtx;
    const img = bxState.img;
    if (!ctx || !img) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    // Draw boxes
    for (let i = 0; i < bxState.boxes.length; i++) {
      const b = bxState.boxes[i];
      const isSel = i === bxState.sel;
      ctx.strokeStyle = isSel ? "#ff6a00" : "#00e5ff";
      ctx.lineWidth = isSel ? 3 : 2;
      ctx.setLineDash(isSel ? [] : [6, 4]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Semi-transparent fill
      ctx.fillStyle = isSel ? "rgba(255,106,0,0.12)" : "rgba(0,229,255,0.08)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
      // Corner handles for selected box
      if (isSel) {
        ctx.fillStyle = "#ff6a00";
        const hs = 5;
        [
          [b.x - hs, b.y - hs],
          [b.x + b.w - hs, b.y - hs],
          [b.x - hs, b.y + b.h - hs],
          [b.x + b.w - hs, b.y + b.h - hs]
        ].forEach(([hx, hy]) => {
          ctx.fillRect(hx, hy, hs * 2, hs * 2);
        });
      }
    }
  }

  function getCanvasPos(e) {
    const rect = els.bxCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTestBox(px, py) {
    for (let i = bxState.boxes.length - 1; i >= 0; i--) {
      const b = bxState.boxes[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return i;
    }
    return -1;
  }

  // Helper: Detect which corner (if any) the point is over, for a given box
  function getHoveredCorner(b, px, py) {
    const hs = 6;
    // Check 4 corners (handles are drawn at b.x-hs etc, so hit within hs of corner point)
    if (Math.abs(px - b.x) <= hs && Math.abs(py - b.y) <= hs) return "tl";
    if (Math.abs(px - (b.x + b.w)) <= hs && Math.abs(py - b.y) <= hs) return "tr";
    if (Math.abs(px - b.x) <= hs && Math.abs(py - (b.y + b.h)) <= hs) return "bl";
    if (Math.abs(px - (b.x + b.w)) <= hs && Math.abs(py - (b.y + b.h)) <= hs) return "br";
    return null;
  }

  function setupBoxesEvents() {
    const canvas = els.bxCanvas;
    if (!canvas) return;
    // Reset flag on each boxes-mode enter so we can re-bind safely if needed
    bxState.eventsBound = false;
    if (bxState.eventsBound) return;
    bxState.eventsBound = true;

    // Compute desired cursor from canvas position
    function getCursorForPos(pos) {
      // Check selected box corner first (highest priority)
      if (bxState.sel >= 0 && bxState.sel < bxState.boxes.length) {
        const b = bxState.boxes[bxState.sel];
        const corner = getHoveredCorner(b, pos.x, pos.y);
        if (corner) return (corner === "tl" || corner === "br") ? "nwse-resize" : "nesw-resize";
        if (hitTestBox(pos.x, pos.y) === bxState.sel) return "move";
      }
      // Check any box for move cursor
      const hit = hitTestBox(pos.x, pos.y);
      if (hit >= 0) return "move";
      return "default";
    }

    // Unified mousemove: cursor when idle, drag updates when dragging
    function onMouseMove(e) {
      // Stop host page from intercepting
      e.stopImmediatePropagation();
      const pos = getCanvasPos(e);
      const d = bxState.drag;
      if (d) {
        if (d.type === "move") {
          const dx = pos.x - d.startX;
          const dy = pos.y - d.startY;
          const b = bxState.boxes[bxState.sel];
          if (b) {
            b.x = Math.max(0, Math.min(d.orig.x + dx, bxCtx.canvas.width - b.w));
            b.y = Math.max(0, Math.min(d.orig.y + dy, bxCtx.canvas.height - b.h));
            drawBoxes();
          }
        } else if (d.type === "resize") {
          const dx = pos.x - d.startX;
          const dy = pos.y - d.startY;
          const o = d.orig;
          const b = bxState.boxes[bxState.sel];
          if (!b) return;
          if (d.corner === "br") { b.w = Math.max(10, Math.min(o.w + dx, bxCtx.canvas.width - o.x)); b.h = Math.max(10, Math.min(o.h + dy, bxCtx.canvas.height - o.y)); }
          else if (d.corner === "tr") { b.w = Math.max(10, Math.min(o.w + dx, bxCtx.canvas.width - o.x)); const newY = Math.max(0, Math.min(o.y + dy, o.y + o.h - 10)); b.h = Math.max(10, o.h - (newY - o.y)); b.y = newY; }
          else if (d.corner === "bl") { const newX = Math.max(0, Math.min(o.x + dx, o.x + o.w - 10)); b.w = Math.max(10, o.w - (newX - o.x)); b.x = newX; b.h = Math.max(10, Math.min(o.h + dy, bxCtx.canvas.height - o.y)); }
          else if (d.corner === "tl") { const newX = Math.max(0, Math.min(o.x + dx, o.x + o.w - 10)); const newY = Math.max(0, Math.min(o.y + dy, o.y + o.h - 10)); b.w = Math.max(10, o.w - (newX - o.x)); b.h = Math.max(10, o.h - (newY - o.y)); b.x = newX; b.y = newY; }
          drawBoxes();
        }
      } else {
        canvas.style.cursor = getCursorForPos(pos);
      }
    }

    function onMouseDown(e) {
      // Stop host page from intercepting (prevents text selection, their click handlers, etc.)
      e.stopImmediatePropagation();
      e.preventDefault();
      const pos = getCanvasPos(e);
      // Check selected box corner first
      let started = false;
      if (bxState.sel >= 0 && bxState.sel < bxState.boxes.length) {
        const b = bxState.boxes[bxState.sel];
        const corner = getHoveredCorner(b, pos.x, pos.y);
        if (corner) {
          bxState.drag = { type: "resize", corner: corner, startX: pos.x, startY: pos.y, orig: { ...b } };
          canvas.style.cursor = (corner === "tl" || corner === "br") ? "nwse-resize" : "nesw-resize";
          started = true;
        }
      }
      if (!started) {
        const hit = hitTestBox(pos.x, pos.y);
        if (hit < 0) return;
        bxState.sel = hit;
        const b = bxState.boxes[hit];
        // Double-check corner on newly selected box
        const corner = getHoveredCorner(b, pos.x, pos.y);
        if (corner) {
          bxState.drag = { type: "resize", corner: corner, startX: pos.x, startY: pos.y, orig: { ...b } };
          canvas.style.cursor = (corner === "tl" || corner === "br") ? "nwse-resize" : "nesw-resize";
        } else {
          bxState.drag = { type: "move", startX: pos.x, startY: pos.y, orig: { ...b } };
          canvas.style.cursor = "move";
        }
      }
      drawBoxes();
      // Attach window-level listeners for the duration of the drag so it works even outside canvas
      function onWindowMouseMove(we) {
        // Map window mouse pos back to canvas space
        const rect = canvas.getBoundingClientRect();
        const pos2 = { x: we.clientX - rect.left, y: we.clientY - rect.top };
        // Synthesize a minimal event-like object for our handler
        onMouseMove({ stopImmediatePropagation: () => {}, clientX: we.clientX, clientY: we.clientY });
      }
      function onWindowMouseUp() {
        window.removeEventListener("mousemove", onWindowMouseMove, true);
        window.removeEventListener("mouseup", onWindowMouseUp, true);
        bxState.drag = null;
        drawBoxes();
        canvas.style.cursor = "default";
      }
      window.addEventListener("mousemove", onWindowMouseMove, true);
      window.addEventListener("mouseup", onWindowMouseUp, true);
    }

    function onMouseLeave() {
      if (!bxState.drag) {
        canvas.style.cursor = "default";
      }
    }

    // Bind with useCapture=true so we run BEFORE any page listeners and can stop propagation
    canvas.addEventListener("mousemove", onMouseMove, true);
    canvas.addEventListener("mousedown", onMouseDown, true);
    canvas.addEventListener("mouseleave", onMouseLeave, true);
  }

  function generateMaskDataUrl() {
    // Create a mask: white boxes on black background, same size as canvas
    const c = document.createElement("canvas");
    c.width = bxCtx.canvas.width;
    c.height = bxCtx.canvas.height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    for (const b of bxState.boxes) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    return c.toDataURL("image/png");
  }

  function showBoxesMode(show) {
    const area = shadow.getElementById("boxesArea");
    const btn = shadow.getElementById("boxesBtn");
    if (area) area.style.display = show ? "" : "none";
    if (btn) btn.style.display = show ? "" : "none";
    if (show && state.imageUrl) {
      // Defer init until canvas is rendered
      requestAnimationFrame(() => {
        initBoxes(state.imageUrl);
        setupBoxesEvents();
      });
    }
  }

  // --- Coins: balance + per-request cost estimate ---
  function setCoins(n) {
    state.coins = typeof n === "number" ? n : state.coins;
    if (els.coinVal) els.coinVal.textContent = state.coins == null ? "—" : state.coins.toLocaleString();
    computeEstimate();
  }

  function requestBalance() {
    if (!extAlive()) return;
    chrome.runtime.sendMessage({ type: "varo:balance" }).then((r) => {
      if (r?.ok && typeof r.coins === "number") setCoins(r.coins);
    }).catch(() => {});
  }

  function requestPricing() {
    if (!extAlive()) return;
    chrome.runtime.sendMessage({ type: "varo:pricing" }).then((r) => {
      if (r?.ok && Array.isArray(r.models)) {
        state.pricing = r.models;
        computeEstimate();
      }
    }).catch(() => {});
  }

  function computeEstimate() {
    if (!els.estimate) return;
    const m = currentModel();
    const p = state.pricing.find((x) => x.model === els.model.value);
    if (!p || !p.rates) {
      els.estimate.textContent = "";
      return;
    }
    const rates = p.rates;
    const q = m?.qualities?.length && els.quality.value ? els.quality.value : p.default_quality;
    let rate = rates[q];
    if (rate == null) rate = Object.values(rates)[0];
    if (rate == null) {
      els.estimate.textContent = "";
      return;
    }
    let coins = rate;
    if (p.unit === "second") {
      if (!m?.durations?.length) {
        // Length unknown at submit (e.g. audio) — show the per-second rate.
        els.estimate.innerHTML = `${tt(T.approx)} <b>${rate.toLocaleString()}</b> coins${tt(T.perSec)}`;
        return;
      }
      const dur = parseInt(els.duration.value, 10) || m.durations[0];
      coins = rate * dur;
    }
    const enough = state.coins == null || coins <= state.coins;
    // ไม่ disable ปุ่ม Generate — ให้ user กดได้เสมอ (ระบบจะตรวจคอยน์อีกครั้งตอน submit)
    // ถ้าคอยน์ไม่พอ แสดงคำเตือน + ลิงก์เติมคอยน์
    els.estimate.innerHTML =
      `${tt(T.approx)} <b>${coins.toLocaleString()}</b> coins` +
      (p.unit === "second" ? ` (${rate}${tt(T.perSec)})` : "") +
      (enough ? "" : ` — <span class="warn">${tt(T.insufficient)}</span>`) +
      (!enough ? ` <a class="topup-link" href="https://varoriya.com/product/varocoin/" target="_blank" rel="noopener noreferrer">${state.lang === "th" ? "เติมคอยน์" : "Top up"}</a>` : "");
  }

  // Apply UI language to all static labels (data-i18n attributes)
  function applyUILang() {
    // data-i18n → textContent
    shadow.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (UI_STRINGS[key]) el.textContent = tt(UI_STRINGS[key]);
    });
    // data-i18n-ph → placeholder
    shadow.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const key = el.getAttribute("data-i18n-ph");
      if (UI_STRINGS[key]) el.placeholder = tt(UI_STRINGS[key]);
    });
    // coins title
    const coinsEl = shadow.getElementById("coins");
    if (coinsEl) coinsEl.title = tt(UI_STRINGS.coinsTitle);
  }

  function fillTemplates() {
    const byLang = TEMPLATES[state.kind] || {};
    const list = byLang[state.lang] || byLang.en || [];
    els.tplRow.innerHTML = list
      .map((t) => `<button type="button" data-text="${t.text.replace(/"/g, "&quot;")}">${t.label}</button>`)
      .join("");
    els.tpl.style.display = list.length ? "" : "none";
    // Update pill active state
    if (els.langPill) {
      [...els.langPill.children].forEach((s) => s.classList.toggle("on", s.dataset.lang === state.lang));
    }
  }

  function resetResult() {
    els.result.innerHTML = "";
    els.status.textContent = "";
    els.status.classList.remove("err");
  }

  async function generate() {
    // ⏳ Boxes mode — ปิดอยู่ (รอพัฒนาให้เสถียรก่อนเปิด)
    // if (state.kind === "boxes") {
    //   const prompt = els.prompt.value.trim();
    //   if (!prompt) { els.status.textContent = "ใส่ prompt ก่อนนะครับ"; els.status.classList.add("err"); return; }
    //   if (bxState.boxes.length === 0) { els.status.textContent = "วาดกล่องบนภาพก่อนครับ"; els.status.classList.add("err"); return; }
    //   if (!state.imageUrl) { els.status.textContent = "ไม่มีภาพต้นแบบ"; els.status.classList.add("err"); return; }
    //   resetResult(); els.gen.disabled = true; els.result.innerHTML = `<div class="spin"></div>`; els.status.textContent = "กำลังส่งงาน…";
    //   const maskDataUrl = generateMaskDataUrl();
    //   const payload = { model: "seedream5pro", prompt, imageUrl: state.imageUrl, mask: maskDataUrl };
    //   const res = extAlive() ? await chrome.runtime.sendMessage({ type: "varo:generate", kind: "image", payload }).catch(() => ({ ok: false })) : { ok: false, error: "extension_reloaded" };
    //   if (!res || res.ok === false) { els.gen.disabled = false; els.result.innerHTML = ""; els.status.classList.add("err"); els.status.textContent = res?.code === "MISSING_API_KEY" ? "ยังไม่ได้เชื่อมบัญชี" : res?.error === "extension_reloaded" ? "ส่วนเสริมเพิ่งรีโหลด — โปรดรีเฟรชหน้าเว็บ" : "เริ่มงานไม่สำเร็จ: " + (res?.error || "unknown"); return; }
    //   state.jobId = res.jobId;
    //   if (typeof res.coinsRemaining === "number") setCoins(res.coinsRemaining);
    //   els.status.textContent = "กำลังประมวลผล… (ทำงานเบื้องหลัง)";
    //   return;
    // }

    const m = currentModel();
    const model = els.model.value;
    const prompt = els.prompt.value.trim();
    const useRef = !!state.imageUrl && !!m?.ref && state.kind !== "audio";
    if (!prompt && !useRef) {
      els.status.textContent = tt(T.promptEmpty);
      els.status.classList.add("err");
      return;
    }
    resetResult();
    els.gen.disabled = true;
    els.result.innerHTML = `<div class="spin"></div>`;
    els.status.textContent = tt(T.submitting);

    const payload = { model, prompt };
    if (useRef) payload.imageUrl = state.imageUrl;
    if (m?.qualities?.length) payload.quality = els.quality.value;
    if (m?.aspects?.length && els.aspect.value && els.aspect.value !== "auto") {
      payload.aspect_ratio = els.aspect.value;
    }
    if (m?.durations?.length) {
      payload.options = { duration: parseInt(els.duration.value, 10) || m.durations[0] };
    }

    const res = extAlive()
      ? await chrome.runtime
          .sendMessage({ type: "varo:generate", kind: state.kind, payload })
          .catch(() => ({ ok: false }))
      : { ok: false, error: "extension_reloaded" };

    if (!res || res.ok === false) {
      els.gen.disabled = false;
      els.result.innerHTML = "";
      els.status.classList.add("err");
      els.status.textContent =
        res?.code === "MISSING_API_KEY"
          ? tt(T.noApiKey)
          : res?.error === "extension_reloaded"
          ? tt(T.extReloaded)
          : tt(T.jobFailed) + (res?.error || tt(T.unknown));
      return;
    }
    state.jobId = res.jobId;
    if (typeof res.coinsRemaining === "number") setCoins(res.coinsRemaining);
    els.status.textContent = tt(T.processing);
  }

  function onJob(job) {
    const st = (job.state || "").toLowerCase();
    if (["done", "succeeded", "completed"].includes(st) && job.result_url) {
      els.gen.disabled = false;
      els.status.textContent = "✓";
      const url = job.result_url;
      let media;
      if (state.kind === "video") media = `<video src="${url}" controls playsinline></video>`;
      else if (state.kind === "audio") media = `<audio src="${url}" controls></audio>`;
      else media = `<img src="${url}" alt="result"/>`;
      const dlLabel = state.lang === "th" ? "ดาวน์โหลด" : "Download";
      const expireLabel = state.lang === "th" ? "ระบบจะลบไฟล์อัตโนมัติภายใน 24 ชั่วโมง โปรดดาวน์โหลดเก็บไว้" : "Files are automatically deleted within 24 hours. Please download and save them.";
      els.result.innerHTML = `${media}<a class="dl" href="${url}" download target="_blank"><span class="sym">&#xe2c4;</span> ${dlLabel}</a><div class="expire"><span class="sym">&#xe8b5;</span> ${expireLabel}</div>`;
    } else if (["failed", "error", "canceled", "timeout"].includes(st)) {
      els.gen.disabled = false;
      els.result.innerHTML = "";
      els.status.classList.add("err");
      els.status.textContent = (state.lang === "th" ? "งานไม่สำเร็จ: " : "Job failed: ") + (job.error || st);
    }
  }

  function open(opts = {}) {
    if (!host) build();
    // ⏳ Reset boxes state (ปิดอยู่)
    // bxState = { boxes: [], mode: "draw", sel: -1, img: null, drag: null };
    const kind = opts.kind === "voice" ? "audio" : opts.kind || "image";
    state.imageUrl = opts.imageUrl || null;
    setKind(kind); // fills models + applyModelCaps (reads state.imageUrl)
    // optional overrides (e.g. AiPASS embed -> video / h3 / auto / 768P)
    if (opts.model && [...els.model.options].some((o) => o.value === opts.model)) {
      els.model.value = opts.model;
      applyModelCaps();
    }
    if (opts.quality && [...els.quality.options].some((o) => o.value === opts.quality)) {
      els.quality.value = opts.quality;
    }
    if (opts.aspect && [...els.aspect.options].some((o) => o.value === opts.aspect)) {
      els.aspect.value = opts.aspect;
    }
    els.prompt.value = opts.prompt || "";
    state.jobId = null;
    resetResult();
    els.gen.disabled = false;
    applyUILang();
    requestBalance();
    requestPricing();
    requestAnimationFrame(() => host.classList.add("open"));
    els.prompt.focus();
  }

  function close() {
    if (host) host.classList.remove("open");
  }

  window.VaroStudio = { open, close };
})();
