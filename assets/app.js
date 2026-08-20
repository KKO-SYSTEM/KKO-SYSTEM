/* =========================================================================
   RPHC Smart Management System — Prototype
   app.js : state, rendering, CRUD, dashboard, AI assistant (rule-based),
            audit log, role switching. Vanilla JS, no framework.
   Data persists in the browser (localStorage) — this is a DEMO/PROTOTYPE,
   not a shared production database.
   ========================================================================= */

const LS_KEY = "rphc_proto_db_v1";
const LS_ROLE = "rphc_proto_role_v1";
const LS_AUDIT = "rphc_proto_audit_v1";

let DB = {};
let AUDIT = [];
let ROLE = "admin";
let CURRENT = "dashboard";
let SEARCH = {};

/* ---------------------------- persistence ---------------------------- */
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    DB = raw ? JSON.parse(raw) : null;
  } catch (e) { DB = null; }
  if (!DB) resetSeed(false);

  try { ROLE = localStorage.getItem(LS_ROLE) || "admin"; } catch (e) { ROLE = "admin"; }
  try {
    const raw = localStorage.getItem(LS_AUDIT);
    AUDIT = raw ? JSON.parse(raw) : [];
  } catch (e) { AUDIT = []; }
}
function saveDB() { try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); } catch (e) {} }
function saveRole() { try { localStorage.setItem(LS_ROLE, ROLE); } catch (e) {} }
function saveAudit() { try { localStorage.setItem(LS_AUDIT, JSON.stringify(AUDIT)); } catch (e) {} }

function resetSeed(rerender) {
  DB = {};
  Object.keys(SEED).forEach((key) => {
    DB[key] = SEED[key].map((row) => Object.assign({ id: uid(key) }, row));
  });
  saveDB();
  logAudit("system", "รีเซ็ตข้อมูลตัวอย่าง", "ระบบ");
  if (rerender) render();
}

function logAudit(moduleKey, action, detail) {
  AUDIT.unshift({
    ts: new Date().toISOString(),
    role: ROLE,
    module: moduleKey,
    action, detail,
  });
  AUDIT = AUDIT.slice(0, 300);
  saveAudit();
}

/* ------------------------------- helpers ------------------------------- */
function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("th-TH", { year:"numeric", month:"short", day:"numeric" });
}
function fmtNum(n) {
  if (n === undefined || n === null || n === "") return "-";
  return Number(n).toLocaleString("th-TH");
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d - now) / (1000*60*60*24));
}
const GOOD = ["ปกติ","ดี","พร้อมใช้งาน","ปฏิบัติงาน","เสร็จสิ้น","หายแล้ว"];
const WARN = ["ลา","ซ่อมบำรุง","รอซ่อม","กำลังดำเนินการ","กำลังรักษา","ต้องติดตาม"];
const BAD  = ["ย้าย/ลาออก","ไม่พร้อมใช้งาน","ชำรุด","จำหน่ายแล้ว","ส่งต่อ","พ้นสภาพ","ยังไม่เริ่ม"];
function statusBadge(val) {
  let cls = "bg-slate-100 text-slate-700";
  if (GOOD.includes(val)) cls = "bg-emerald-100 text-emerald-700";
  else if (WARN.includes(val)) cls = "bg-amber-100 text-amber-700";
  else if (BAD.includes(val)) cls = "bg-rose-100 text-rose-700";
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${cls}">${esc(val)}</span>`;
}
function esc(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function canEdit() { return !READONLY_ROLES.includes(ROLE); }
function moduleAllowed(key) { return (ROLE_ACCESS[ROLE] || []).includes(key); }

/* --------------------------------- shell -------------------------------- */
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

function renderShell() {
  const app = document.getElementById("app-root");
  app.innerHTML = `
    <div class="min-h-screen flex bg-slate-50">
      <aside id="sidebar" class="fixed z-30 inset-y-0 left-0 w-72 bg-[#123b34] text-white flex flex-col transform -translate-x-full lg:translate-x-0 transition-transform duration-200">
        <div class="px-5 py-5 border-b border-white/10">
          <div class="text-lg font-bold leading-tight">RPHC Smart<br/>Management System</div>
          <div class="text-[11px] text-emerald-200 mt-1">ระบบบริหารจัดการ รพ.สต. (ต้นแบบ)</div>
        </div>
        <nav id="nav-list" class="flex-1 overflow-y-auto py-3 space-y-0.5 px-2"></nav>
        <div class="px-4 py-3 border-t border-white/10 text-[11px] text-emerald-200">
          Prototype • ข้อมูลตัวอย่างในเครื่องนี้เท่านั้น
        </div>
      </aside>
      <div id="overlay" class="fixed inset-0 bg-black/40 z-20 hidden lg:hidden"></div>

      <div class="flex-1 lg:ml-72 flex flex-col min-h-screen">
        <header class="sticky top-0 z-10 bg-white border-b px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
          <button id="btn-burger" class="lg:hidden p-2 rounded hover:bg-slate-100 shrink-0">☰</button>
          <div class="font-semibold text-slate-700 flex-1 min-w-0 truncate" id="page-title">Dashboard</div>
          <div class="flex items-center gap-2 shrink-0">
            <select id="role-select" class="text-xs sm:text-sm border rounded-lg px-2 py-1.5 bg-white w-32 sm:w-auto max-w-[9rem] sm:max-w-none truncate"></select>
          </div>
        </header>
        <main id="page-content" class="flex-1 p-4 lg:p-6"></main>
      </div>
    </div>
  `;

  const roleSel = document.getElementById("role-select");
  roleSel.innerHTML = ROLES.map(r => `<option value="${r.key}" ${r.key===ROLE?"selected":""}>${r.label}</option>`).join("");
  roleSel.addEventListener("change", (e) => {
    ROLE = e.target.value; saveRole();
    if (CURRENT !== "dashboard" && CURRENT !== "ai" && CURRENT !== "settings") {
      if (CURRENT === "audit" && !(ROLE==="admin"||ROLE==="exec")) CURRENT = "dashboard";
      else if (MODULES[CURRENT] && !moduleAllowed(CURRENT)) CURRENT = "dashboard";
    }
    render();
  });

  document.getElementById("btn-burger").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("-translate-x-full");
    document.getElementById("overlay").classList.remove("hidden");
  });
  document.getElementById("overlay").addEventListener("click", closeSidebarMobile);
}
function closeSidebarMobile() {
  document.getElementById("sidebar").classList.add("-translate-x-full");
  document.getElementById("overlay").classList.add("hidden");
}

function navItemsForRole() {
  const items = [{ key:"dashboard", label:"Dashboard", icon:"📊" }];
  Object.keys(MODULES).forEach((key) => {
    if (moduleAllowed(key)) items.push({ key, label: MODULES[key].label, icon: MODULES[key].icon });
  });
  items.push({ key:"ai", label:"ผู้ช่วย AI Assistant", icon:"🤖" });
  if (ROLE === "admin" || ROLE === "exec") items.push({ key:"audit", label:"Audit Log", icon:"🕒" });
  if (ROLE === "admin") items.push({ key:"settings", label:"ตั้งค่าระบบ", icon:"⚙️" });
  return items;
}

function renderNav() {
  const nav = document.getElementById("nav-list");
  nav.innerHTML = navItemsForRole().map(item => `
    <button data-nav="${item.key}" class="w-full flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition
      ${CURRENT===item.key ? "bg-white/15 font-semibold" : "hover:bg-white/10 text-emerald-50"}">
      <span>${item.icon}</span><span class="truncate">${item.label}</span>
    </button>`).join("");
  nav.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => { CURRENT = btn.getAttribute("data-nav"); closeSidebarMobile(); render(); });
  });
}

/* -------------------------------- render -------------------------------- */
function render() {
  renderNav();
  const title = CURRENT === "dashboard" ? "Dashboard ผู้บริหาร"
    : CURRENT === "ai" ? "ผู้ช่วย AI Assistant"
    : CURRENT === "audit" ? "Audit Log"
    : CURRENT === "settings" ? "ตั้งค่าระบบ"
    : (MODULES[CURRENT] ? MODULES[CURRENT].label : "Dashboard ผู้บริหาร");
  document.getElementById("page-title").textContent = title;

  const content = document.getElementById("page-content");
  if (CURRENT === "dashboard") content.innerHTML = "", renderDashboard(content);
  else if (CURRENT === "ai") content.innerHTML = "", renderAI(content);
  else if (CURRENT === "audit") content.innerHTML = "", renderAudit(content);
  else if (CURRENT === "settings") content.innerHTML = "", renderSettings(content);
  else if (MODULES[CURRENT] && moduleAllowed(CURRENT)) content.innerHTML = "", renderModule(content, CURRENT);
  else { CURRENT = "dashboard"; return render(); }
}

/* ------------------------------ dashboard ------------------------------- */
function renderDashboard(root) {
  const personnelActive = (DB.personnel||[]).filter(p=>p.status==="ปฏิบัติงาน").length;
  const lowStockDrugs = (DB.pharmacy||[]).filter(d => Number(d.qty) <= Number(d.reorderPoint)).length;
  const expiringVaccines = (DB.vaccine||[]).filter(v => { const d = daysUntil(v.expiry); return d !== null && d <= 60; }).length;
  const equipmentNeedsFix = (DB.equipment||[]).filter(e => e.condition==="ชำรุด"||e.condition==="รอซ่อม").length;

  root.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      ${statCard("🧑‍⚕️","บุคลากรปฏิบัติงาน", personnelActive, "คน", "emerald")}
      ${statCard("💊","ยาใกล้หมด/ต้องสั่งซื้อ", lowStockDrugs, "รายการ", "amber")}
      ${statCard("💉","วัคซีนใกล้หมดอายุ (60 วัน)", expiringVaccines, "รายการ", "rose")}
      ${statCard("🖥️","ครุภัณฑ์ต้องซ่อม/ชำรุด", equipmentNeedsFix, "รายการ", "sky")}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="lg:col-span-2 bg-white rounded-xl border p-4">
        <div class="font-semibold text-slate-700 mb-2">จำนวนผู้รับบริการรายเดือน</div>
        <canvas id="chartTrend" height="110"></canvas>
      </div>
      <div class="bg-white rounded-xl border p-4">
        <div class="font-semibold text-slate-700 mb-2">สถิติการให้บริการ</div>
        <canvas id="chartDonut" height="180"></canvas>
        <div class="text-center text-2xl font-bold text-slate-800 mt-2">${fmtNum(VISIT_TYPE.reduce((a,b)=>a+b.value,0))}</div>
        <div class="text-center text-xs text-slate-400">รวมทั้งหมด (ราย)</div>
      </div>
    </div>

    <div class="bg-white rounded-xl border p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-slate-700">กิจกรรมล่าสุดในระบบ</div>
        <button data-goto="audit" class="text-xs text-emerald-700 hover:underline">ดูทั้งหมด</button>
      </div>
      ${auditTableHTML(AUDIT.slice(0,5))}
    </div>
  `;
  root.querySelector("[data-goto='audit']")?.addEventListener("click", () => { CURRENT="audit"; render(); });

  new Chart(document.getElementById("chartTrend"), {
    type: "line",
    data: { labels: VISIT_TREND.map(x=>x.m), datasets: [{ label:"ผู้รับบริการ", data: VISIT_TREND.map(x=>x.v),
      borderColor:"#1F7A6C", backgroundColor:"rgba(31,122,108,0.12)", fill:true, tension:0.35, pointRadius:3 }] },
    options: { plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
  });
  new Chart(document.getElementById("chartDonut"), {
    type: "doughnut",
    data: { labels: VISIT_TYPE.map(x=>x.label), datasets:[{ data: VISIT_TYPE.map(x=>x.value), backgroundColor: VISIT_TYPE.map(x=>x.color) }] },
    options: { plugins:{ legend:{ position:"bottom", labels:{ boxWidth:10, font:{size:11} } } }, cutout:"65%" }
  });
}
function statCard(icon,label,value,unit,color) {
  const map = { emerald:"bg-emerald-50 text-emerald-700", amber:"bg-amber-50 text-amber-700", rose:"bg-rose-50 text-rose-700", sky:"bg-sky-50 text-sky-700" };
  return `<div class="bg-white rounded-xl border p-4">
    <div class="w-9 h-9 rounded-lg ${map[color]} flex items-center justify-center text-lg mb-2">${icon}</div>
    <div class="text-2xl font-bold text-slate-800">${fmtNum(value)}</div>
    <div class="text-xs text-slate-500 mt-0.5">${label} ${unit?`(${unit})`:""}</div>
  </div>`;
}

/* -------------------------------- module -------------------------------- */
function renderModule(root, key) {
  const cfg = MODULES[key];
  const rows = DB[key] || [];
  const q = (SEARCH[key] || "").toLowerCase();
  const filtered = q ? rows.filter(r => cfg.fields.some(f => String(r[f.key]||"").toLowerCase().includes(q))) : rows;

  root.innerHTML = `
    <div class="bg-white rounded-xl border">
      <div class="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b">
        <div class="flex items-center gap-2">
          <input id="search-box" type="text" placeholder="ค้นหา..." value="${esc(SEARCH[key]||"")}"
            class="border rounded-lg px-3 py-2 text-sm w-64 max-w-full" />
          <span class="text-xs text-slate-400">${filtered.length} / ${rows.length} รายการ</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button id="btn-export" class="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50">⬇ Export CSV</button>
          <button id="btn-print" class="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50">🖨 พิมพ์ / PDF</button>
          ${canEdit() ? `<button id="btn-add" class="text-sm px-3 py-2 rounded-lg bg-[#1F7A6C] text-white hover:bg-[#186257]">+ เพิ่มรายการ</button>` : ""}
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              ${cfg.fields.map(f=>`<th class="text-left px-4 py-2 font-medium whitespace-nowrap">${f.label}</th>`).join("")}
              ${canEdit() ? `<th class="px-4 py-2"></th>` : ""}
            </tr>
          </thead>
          <tbody id="table-body">
            ${filtered.length ? filtered.map(r => rowHTML(cfg, key, r)).join("") : `<tr><td colspan="${cfg.fields.length+1}" class="text-center text-slate-400 py-8">ไม่พบข้อมูล</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector("#search-box").addEventListener("input", (e) => { SEARCH[key] = e.target.value; renderModule(root, key); });
  root.querySelector("#btn-export")?.addEventListener("click", () => exportCSV(key));
  root.querySelector("#btn-print")?.addEventListener("click", () => printModule(key));
  root.querySelector("#btn-add")?.addEventListener("click", () => openForm(key, null));
  root.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openForm(key, b.getAttribute("data-edit"))));
  root.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => confirmDelete(key, b.getAttribute("data-del"))));
}

function rowHTML(cfg, key, r) {
  return `<tr class="border-t hover:bg-slate-50">
    ${cfg.fields.map(f => {
      let v = r[f.key];
      if (f.type === "date") v = fmtDate(v);
      else if (f.type === "number") v = fmtNum(v);
      else if (f.badge) v = statusBadge(v);
      else v = esc(v ?? "-");
      return `<td class="px-4 py-2.5 whitespace-nowrap">${v}</td>`;
    }).join("")}
    ${canEdit() ? `<td class="px-4 py-2.5 text-right whitespace-nowrap">
      <button data-edit="${r.id}" class="text-slate-400 hover:text-emerald-700 px-1" title="แก้ไข">✏️</button>
      <button data-del="${r.id}" class="text-slate-400 hover:text-rose-600 px-1" title="ลบ">🗑️</button>
    </td>` : ""}
  </tr>`;
}

/* --------------------------------- form ---------------------------------- */
function openForm(key, id) {
  const cfg = MODULES[key];
  const rows = DB[key] || [];
  const existing = id ? rows.find(r => r.id === id) : null;
  const modalRoot = document.getElementById("modal-root");
  modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" id="modal-backdrop">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="px-5 py-4 border-b flex items-center justify-between">
          <div class="font-semibold text-slate-700">${existing ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"} — ${cfg.label}</div>
          <button id="modal-close" class="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <form id="record-form" class="p-5 space-y-3">
          ${cfg.fields.map(f => fieldHTML(f, existing)).join("")}
          <div class="pt-2 flex gap-2 justify-end">
            <button type="button" id="btn-cancel" class="px-4 py-2 rounded-lg border text-sm">ยกเลิก</button>
            <button type="submit" class="px-4 py-2 rounded-lg bg-[#1F7A6C] text-white text-sm hover:bg-[#186257]">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  `;
  const close = () => { modalRoot.innerHTML = ""; };
  document.getElementById("modal-close").addEventListener("click", close);
  document.getElementById("btn-cancel").addEventListener("click", close);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") close(); });

  document.getElementById("record-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const record = existing ? Object.assign({}, existing) : { id: uid(key) };
    let ok = true;
    cfg.fields.forEach(f => {
      const val = fd.get(f.key);
      if (f.required && !val) ok = false;
      record[f.key] = f.type === "number" ? (val===""?"":Number(val)) : val;
    });
    if (!ok) { alertBanner("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"); return; }
    if (!DB[key]) DB[key] = [];
    if (existing) {
      const idx = DB[key].findIndex(r => r.id === existing.id);
      DB[key][idx] = record;
      logAudit(key, "แก้ไขรายการ", recordLabel(cfg, record));
    } else {
      DB[key].push(record);
      logAudit(key, "เพิ่มรายการ", recordLabel(cfg, record));
    }
    saveDB();
    close();
    render();
  });
}
function fieldHTML(f, existing) {
  const val = existing ? (existing[f.key] ?? "") : "";
  const req = f.required ? "required" : "";
  if (f.type === "select") {
    return `<div>
      <label class="block text-xs font-medium text-slate-500 mb-1">${f.label}${f.required?" *":""}</label>
      <select name="${f.key}" ${req} class="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="">-- เลือก --</option>
        ${f.options.map(o => `<option value="${esc(o)}" ${val===o?"selected":""}>${esc(o)}</option>`).join("")}
      </select>
    </div>`;
  }
  return `<div>
    <label class="block text-xs font-medium text-slate-500 mb-1">${f.label}${f.required?" *":""}</label>
    <input name="${f.key}" type="${f.type}" value="${esc(val)}" ${req} class="w-full border rounded-lg px-3 py-2 text-sm" />
  </div>`;
}
function recordLabel(cfg, record) {
  const first = cfg.fields.find(f => f.type==="text");
  return first ? String(record[first.key]||"") : record.id;
}

function confirmDelete(key, id) {
  const cfg = MODULES[key];
  const rec = (DB[key]||[]).find(r=>r.id===id);
  const modalRoot = document.getElementById("modal-root");
  modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" id="del-backdrop">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div class="font-semibold text-slate-700 mb-2">ยืนยันการลบรายการ</div>
        <div class="text-sm text-slate-500 mb-4">ต้องการลบ "${esc(recordLabel(cfg, rec||{}))}" ออกจาก${cfg.label}ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้</div>
        <div class="flex gap-2 justify-end">
          <button id="del-cancel" class="px-4 py-2 rounded-lg border text-sm">ยกเลิก</button>
          <button id="del-confirm" class="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700">ลบรายการ</button>
        </div>
      </div>
    </div>`;
  const close = () => { modalRoot.innerHTML = ""; };
  document.getElementById("del-cancel").addEventListener("click", close);
  document.getElementById("del-backdrop").addEventListener("click", (e)=>{ if(e.target.id==="del-backdrop") close(); });
  document.getElementById("del-confirm").addEventListener("click", () => {
    DB[key] = (DB[key]||[]).filter(r => r.id !== id);
    saveDB();
    logAudit(key, "ลบรายการ", recordLabel(cfg, rec||{}));
    close();
    render();
  });
}

function alertBanner(msg) {
  const b = el(`<div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">${esc(msg)}</div>`);
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 2500);
}

/* ------------------------------- export/print ----------------------------- */
function exportCSV(key) {
  const cfg = MODULES[key];
  const rows = DB[key] || [];
  const header = cfg.fields.map(f=>f.label).join(",");
  const lines = rows.map(r => cfg.fields.map(f => `"${String(r[f.key] ?? "").replace(/"/g,'""')}"`).join(","));
  const csv = "﻿" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${cfg.label}.csv`;
  a.click();
  logAudit(key, "Export CSV", `ส่งออกข้อมูล ${rows.length} รายการ`);
}
function printModule(key) {
  const cfg = MODULES[key];
  const rows = DB[key] || [];
  const w = window.open("", "_blank");
  const tbl = `
    <html><head><meta charset="utf-8"><title>${cfg.label}</title>
    <style>
      body{ font-family: 'Sarabun', sans-serif; padding:24px; color:#1e293b; }
      h1{ font-size:18px; margin-bottom:2px; } .sub{ color:#64748b; font-size:12px; margin-bottom:16px; }
      table{ width:100%; border-collapse:collapse; font-size:12px; }
      th,td{ border:1px solid #cbd5e1; padding:6px 8px; text-align:left; }
      th{ background:#f1f5f9; }
    </style></head><body>
    <h1>${cfg.label} — RPHC Smart Management System</h1>
    <div class="sub">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")} • จำนวน ${rows.length} รายการ (ข้อมูลตัวอย่างจากต้นแบบ)</div>
    <table><thead><tr>${cfg.fields.map(f=>`<th>${f.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${cfg.fields.map(f=>{
      let v = r[f.key]; if (f.type==="date") v = fmtDate(v); else if (f.type==="number") v = fmtNum(v);
      return `<td>${esc(v??"-")}</td>`; }).join("")}</tr>`).join("")}</tbody></table>
    </body></html>`;
  w.document.write(tbl);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  logAudit(key, "พิมพ์/PDF", `พิมพ์รายงาน ${rows.length} รายการ`);
}

/* --------------------------------- audit --------------------------------- */
function auditTableHTML(list) {
  if (!list.length) return `<div class="text-sm text-slate-400 py-6 text-center">ยังไม่มีกิจกรรม</div>`;
  return `<table class="w-full text-sm"><thead class="text-slate-400"><tr>
    <th class="text-left px-2 py-1 font-medium">เวลา</th><th class="text-left px-2 py-1 font-medium">บทบาท</th>
    <th class="text-left px-2 py-1 font-medium">ระบบ</th><th class="text-left px-2 py-1 font-medium">การกระทำ</th>
    <th class="text-left px-2 py-1 font-medium">รายละเอียด</th></tr></thead><tbody>
    ${list.map(a => `<tr class="border-t"><td class="px-2 py-1.5 text-slate-500 whitespace-nowrap">${new Date(a.ts).toLocaleString("th-TH")}</td>
      <td class="px-2 py-1.5">${roleLabel(a.role)}</td>
      <td class="px-2 py-1.5">${a.module==="system"?"ระบบ":a.module==="ai"?"ผู้ช่วย AI Assistant":(MODULES[a.module]?.label||a.module)}</td>
      <td class="px-2 py-1.5">${esc(a.action)}</td><td class="px-2 py-1.5 text-slate-500">${esc(a.detail||"")}</td></tr>`).join("")}
    </tbody></table>`;
}
function roleLabel(k) { return (ROLES.find(r=>r.key===k)||{}).label || k; }
function renderAudit(root) {
  root.innerHTML = `<div class="bg-white rounded-xl border p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="font-semibold text-slate-700">ประวัติการใช้งานระบบ (Audit Log) — ${AUDIT.length} รายการ</div>
    </div>
    <div class="overflow-x-auto">${auditTableHTML(AUDIT)}</div>
  </div>`;
}

/* -------------------------------- AI page --------------------------------- */
function renderAI(root) {
  root.innerHTML = `
    <div class="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
      ⚠️ นี่คือเครื่องมือช่วยร่างรายงาน "แบบกฎเกณฑ์ตายตัว" (rule-based) ที่ดึงตัวเลขจริงจากข้อมูลในระบบมาใส่แม่แบบรายงาน
      ยังไม่ใช่การเชื่อมต่อ AI/LLM จริง — สามารถเชื่อมต่อ API ผู้ช่วย AI จริงเพิ่มเติมได้ในระยะพัฒนาถัดไป
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <button data-ai="monthly" class="text-left bg-white border rounded-xl p-4 hover:border-emerald-400">
        <div class="text-2xl mb-1">📅</div><div class="font-medium text-slate-700 text-sm">สรุปรายงานประจำเดือน</div>
        <div class="text-xs text-slate-400 mt-1">รวมสถานะทุกระบบเป็นรายงานสรุป</div></button>
      <button data-ai="sar" class="text-left bg-white border rounded-xl p-4 hover:border-emerald-400">
        <div class="text-2xl mb-1">📝</div><div class="font-medium text-slate-700 text-sm">ร่างรายงาน SAR</div>
        <div class="text-xs text-slate-400 mt-1">ร่างรายงานประเมินตนเองจากคะแนน PCU</div></button>
      <button data-ai="meeting" class="text-left bg-white border rounded-xl p-4 hover:border-emerald-400">
        <div class="text-2xl mb-1">🗒️</div><div class="font-medium text-slate-700 text-sm">ร่างรายงานการประชุม อสม.</div>
        <div class="text-xs text-slate-400 mt-1">สรุปการเข้าร่วมประชุมของ อสม.</div></button>
    </div>
    <div class="bg-white rounded-xl border">
      <div class="px-4 py-3 border-b flex items-center justify-between">
        <div class="font-semibold text-slate-700 text-sm">ผลลัพธ์ร่างรายงาน</div>
        <button id="btn-dl-report" class="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50 hidden">⬇ ดาวน์โหลด .txt</button>
      </div>
      <textarea id="ai-output" readonly class="w-full h-80 p-4 text-sm font-mono resize-none focus:outline-none"
        placeholder="กดปุ่มด้านบนเพื่อสร้างร่างรายงาน..."></textarea>
    </div>`;
  root.querySelectorAll("[data-ai]").forEach(b => b.addEventListener("click", () => runAI(b.getAttribute("data-ai"))));
}
function runAI(kind) {
  const out = document.getElementById("ai-output");
  const dl = document.getElementById("btn-dl-report");
  let text = "";
  const today = new Date().toLocaleDateString("th-TH", { year:"numeric", month:"long", day:"numeric" });
  if (kind === "monthly") {
    const personnelActive = (DB.personnel||[]).filter(p=>p.status==="ปฏิบัติงาน").length;
    const lowStock = (DB.pharmacy||[]).filter(d => Number(d.qty) <= Number(d.reorderPoint));
    const expVac = (DB.vaccine||[]).filter(v => { const d = daysUntil(v.expiry); return d!==null && d<=60; });
    const epi = DB.epidemiology||[];
    const projects = DB.strategy||[];
    text = `สรุปรายงานประจำเดือน — RPHC Smart Management System\nวันที่จัดทำ: ${today}\n\n` +
      `1) บุคลากร: ปฏิบัติงานทั้งหมด ${personnelActive} คน จากทั้งหมด ${(DB.personnel||[]).length} คน\n\n` +
      `2) คลังยา: มียาต่ำกว่าจุดสั่งซื้อขั้นต่ำ ${lowStock.length} รายการ${lowStock.length? " ได้แก่ " + lowStock.map(d=>d.name).join(", "):""}\n\n` +
      `3) คลังวัคซีน: มีวัคซีนใกล้หมดอายุภายใน 60 วัน ${expVac.length} รายการ${expVac.length? " ได้แก่ " + expVac.map(v=>v.name).join(", "):""}\n\n` +
      `4) งานระบาดวิทยา: พบผู้ป่วยโรคติดต่อสะสม ${epi.length} ราย ในจำนวนนี้กำลังรักษา ${epi.filter(e=>e.status==="กำลังรักษา").length} ราย\n\n` +
      `5) แผนยุทธศาสตร์: มีโครงการทั้งหมด ${projects.length} โครงการ กำลังดำเนินการ ${projects.filter(p=>p.status==="กำลังดำเนินการ").length} โครงการ เสร็จสิ้นแล้ว ${projects.filter(p=>p.status==="เสร็จสิ้น").length} โครงการ\n\n` +
      `-- จัดทำโดยผู้ช่วยสรุปรายงาน (rule-based) จากข้อมูลในระบบ ณ เวลาที่สร้างรายงาน --`;
  } else if (kind === "sar") {
    const pcu = DB.pcu||[];
    const totalFull = pcu.reduce((a,b)=>a+Number(b.fullScore||0),0);
    const totalScore = pcu.reduce((a,b)=>a+Number(b.score||0),0);
    const pct = totalFull ? Math.round(totalScore/totalFull*100) : 0;
    text = `ร่างรายงานการประเมินตนเอง (SAR) — งานมาตรฐานหน่วยบริการ PCU\nวันที่จัดทำ: ${today}\n\n` +
      `ผลการประเมินตนเองรวมทุกหมวด: ${totalScore} / ${totalFull} คะแนน (${pct}%)\n\n` +
      pcu.map(p => `- หมวด ${p.category} : ${p.topic} — ได้ ${p.score}/${p.fullScore} คะแนน`).join("\n") +
      `\n\nข้อเสนอแนะเบื้องต้น: ควรให้ความสำคัญกับหมวดที่ได้คะแนนต่ำกว่า 80% ของคะแนนเต็มเป็นลำดับแรก\n\n` +
      `-- จัดทำโดยผู้ช่วยร่างรายงาน (rule-based) จากข้อมูลในระบบ --`;
  } else if (kind === "meeting") {
    const vhv = DB.meeting||[];
    const avgRate = vhv.length ? Math.round(vhv.reduce((a,b)=>a+(b.attended/(b.totalMeetings||1)),0)/vhv.length*100) : 0;
    text = `ร่างรายงานการประชุม อสม.\nวันที่จัดทำ: ${today}\n\n` +
      `จำนวน อสม. ทั้งหมด: ${vhv.length} คน\nอัตราการเข้าร่วมประชุมเฉลี่ย: ${avgRate}%\n\n` +
      vhv.map(v => `- ${v.name} (${v.village}) เข้าร่วม ${v.attended}/${v.totalMeetings} ครั้ง`).join("\n") +
      `\n\n-- จัดทำโดยผู้ช่วยร่างรายงาน (rule-based) จากข้อมูลในระบบ --`;
  }
  out.value = text;
  dl.classList.remove("hidden");
  dl.onclick = () => {
    const blob = new Blob([text], { type:"text/plain;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `รายงาน_${kind}.txt`; a.click();
  };
  const kindLabel = { monthly:"สรุปรายงานประจำเดือน", sar:"ร่างรายงาน SAR", meeting:"ร่างรายงานการประชุม อสม." }[kind] || kind;
  logAudit("ai", "สร้างร่างรายงาน AI", kindLabel);
}

/* ------------------------------- settings -------------------------------- */
function renderSettings(root) {
  root.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border p-5">
        <div class="font-semibold text-slate-700 mb-3">เกี่ยวกับต้นแบบนี้</div>
        <p class="text-sm text-slate-500 leading-relaxed">
          นี่คือ <b>ต้นแบบ (Prototype)</b> ของ RPHC Smart Management System ที่สร้างขึ้นเพื่อสาธิตภาพรวมของระบบครบทั้ง 10 ระบบงาน
          ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่างและถูกจัดเก็บไว้ใน<b>เบราว์เซอร์ของเครื่องนี้เท่านั้น</b> (localStorage)
          ยังไม่มีฐานข้อมูลกลาง ระบบยืนยันตัวตน (login) จริง หรือการเข้ารหัสข้อมูลระดับ production
          จึง<b>ยังไม่เหมาะสำหรับบันทึกข้อมูลจริงของผู้ป่วยหรือบุคลากร</b>
        </p>
      </div>
      <div class="bg-white rounded-xl border p-5">
        <div class="font-semibold text-slate-700 mb-3">จัดการข้อมูลตัวอย่าง</div>
        <p class="text-sm text-slate-500 mb-3">รีเซ็ตข้อมูลทั้งหมดกลับเป็นชุดข้อมูลตัวอย่างเริ่มต้น (ล้างการแก้ไขทั้งหมดในเครื่องนี้)</p>
        <button id="btn-reset" class="px-4 py-2 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50">↺ รีเซ็ตข้อมูลตัวอย่าง</button>
      </div>
    </div>`;
  root.querySelector("#btn-reset").addEventListener("click", () => {
    if (confirm("ยืนยันรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น?")) { resetSeed(true); }
  });
}

/* --------------------------------- init ----------------------------------- */
function init() {
  loadState();
  document.getElementById("app-root").insertAdjacentHTML("afterend", `<div id="modal-root"></div>`);
  renderShell();
  render();
}
document.addEventListener("DOMContentLoaded", init);
