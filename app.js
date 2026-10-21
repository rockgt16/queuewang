const starterListings = [
  { id: "demo-1", kind: "looking", role: "มือกลอง / Pop-Rock", area: "อารีย์ · กรุงเทพฯ", date: "2026-10-24", time: "20:00", rate: "2,500 บาท / คืน", details: "หามือกลองเล่นประจำร้าน เพลงไทยยุค 2000 ซ้อมก่อนงาน 1 ครั้ง", contact: "ทัก Facebook: Room 44", age: "12 นาทีที่แล้ว" },
  { id: "demo-2", kind: "available", role: "นักร้องหญิง · Soul / R&B", area: "สุขุมวิท · กรุงเทพฯ", date: "2026-10-24", time: "19:30", rate: "เริ่ม 3,000 บาท", details: "มีประสบการณ์ร้านอาหารและงาน private มีคลิปผลงานส่งให้ดูได้", contact: "Line: mellowmay", age: "28 นาทีที่แล้ว" },
  { id: "demo-3", kind: "looking", role: "มือเบส · Indie Pop", area: "นนทบุรี", date: "2026-10-25", time: "18:00", rate: "1,800 บาท + อาหาร", details: "วงมีงานอีเวนต์วันอาทิตย์ ขอคนตรงเวลาและมีอุปกรณ์ส่วนตัว", contact: "Inbox: Sunday Club", age: "1 ชั่วโมงที่แล้ว" },
  { id: "demo-4", kind: "available", role: "มือคีย์บอร์ด / เปียโน", area: "ลาดพร้าว · กรุงเทพฯ", date: "2026-10-25", time: "17:00", rate: "คุยกันได้", details: "เล่น Pop, Jazz และเพลงงานแต่ง อ่าน lead sheet ได้", contact: "Line: keys.nut", age: "2 ชั่วโมงที่แล้ว" },
  { id: "demo-5", kind: "looking", role: "Trio แจ๊ส · งานโรงแรม", area: "ปทุมวัน · กรุงเทพฯ", date: "2026-10-26", time: "20:30", rate: "6,000 บาท / วง", details: "หาวง trio เล่น 2 เซต เซตละ 45 นาที มีเครื่องเสียงให้", contact: "ทักเพจ: Blue Note Bar", age: "3 ชั่วโมงที่แล้ว" },
  { id: "demo-6", kind: "available", role: "มือกีตาร์ · Acoustic", area: "เชียงใหม่", date: "2026-10-26", time: "16:00", rate: "2,000 บาทขึ้นไป", details: "รับงานร้านและ private event เล่นได้ทั้ง fingerstyle และร้องนำ", contact: "โทร 08x-xxx-xxxx", age: "เมื่อวาน" },
];

const storageKey = "queuewang-listings-v1";
const databaseConfig = window.QUEUEWANG_SUPABASE || {};
const databaseUrl = String(databaseConfig.url || "").replace(/\/$/, "");
const databaseKey = String(databaseConfig.anonKey || "");
const databaseReady = databaseUrl.startsWith("https://") && databaseKey.length > 0;
const grid = document.querySelector("#listing-grid");
const count = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const dateFilter = document.querySelector("#date-filter");
const timeFromFilter = document.querySelector("#time-from-filter");
const timeToFilter = document.querySelector("#time-to-filter");
const filterSummary = document.querySelector("#filter-summary");
const dialog = document.querySelector("#post-dialog");
const form = document.querySelector("#post-form");
const toast = document.querySelector("#toast");
const databaseStatus = document.querySelector("#database-status");
const formNote = document.querySelector("#form-note");
const formError = document.querySelector("#form-error");
const submitButton = form.querySelector('button[type="submit"]');
let selectedKind = "all";
let toastTimer;
let databaseTimeSupported = true;

function loadListings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? [...saved, ...starterListings] : starterListings;
  } catch {
    return starterListings;
  }
}

let listings = loadListings();

if (databaseReady) {
  databaseStatus.textContent = "กำลังเชื่อมต่อฐานข้อมูล...";
  formNote.textContent = "ประกาศจะเผยแพร่ให้ทุกคนเห็น และข้อมูลติดต่อจะเป็นสาธารณะ";
}

function mapDatabaseRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    role: row.role,
    area: row.area,
    date: row.work_date,
    time: row.work_time ? row.work_time.slice(0, 5) : "",
    rate: row.rate,
    details: row.details,
    contact: row.contact,
    age: relativeAge(row.created_at),
  };
}

function relativeAge(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

async function loadDatabaseListings() {
  const headers = { apikey: databaseKey, Authorization: `Bearer ${databaseKey}` };
  const endpoint = `${databaseUrl}/rest/v1/gig_posts?select=id,kind,role,area,work_date,work_time,rate,details,contact,created_at&order=created_at.desc`;
  let response = await fetch(endpoint, { headers });
  if (!response.ok) {
    const legacyEndpoint = `${databaseUrl}/rest/v1/gig_posts?select=id,kind,role,area,work_date,rate,details,contact,created_at&order=created_at.desc`;
    response = await fetch(legacyEndpoint, { headers });
    if (!response.ok) throw new Error(`โหลดประกาศไม่สำเร็จ (${response.status})`);
    databaseTimeSupported = false;
    databaseStatus.textContent = "ฐานข้อมูลยังไม่อัปเดต · รัน schema.sql เพื่อใช้เวลา";
    formNote.textContent = "ต้องอัปเดตฐานข้อมูลก่อนลงประกาศที่ระบุเวลา กรุณารัน supabase/schema.sql";
  }
  const rows = await response.json();
  const remoteListings = rows.map(mapDatabaseRow);
  const remoteIds = new Set(remoteListings.map((item) => item.id));
  const localOnlyListings = listings.filter((item) => !String(item.id).startsWith("demo-") && !remoteIds.has(item.id));
  listings = [...remoteListings, ...localOnlyListings, ...starterListings];
  if (databaseTimeSupported) databaseStatus.textContent = "เชื่อมฐานข้อมูลแล้ว · แชร์ประกาศร่วมกัน";
  render();
}

async function saveDatabaseListing(listing) {
  if (!databaseTimeSupported) throw new Error("ต้องรัน supabase/schema.sql ก่อนลงประกาศที่มีเวลา");
  const response = await fetch(`${databaseUrl}/rest/v1/gig_posts`, {
    method: "POST",
    headers: {
      apikey: databaseKey,
      Authorization: `Bearer ${databaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      kind: listing.kind,
      role: listing.role,
      area: listing.area,
      work_date: listing.date,
      work_time: listing.time,
      rate: listing.rate,
      details: listing.details,
      contact: listing.contact,
    }),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      detail = error.message || error.details || error.hint || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(`บันทึกไม่สำเร็จ: ${detail}`);
  }
  const [savedRow] = await response.json();
  return mapDatabaseRow(savedRow);
}

function formatDate(value) {
  if (!value) return "วันที่ยังไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  return value ? `${value.slice(0, 5)} น.` : "เวลาไม่ระบุ";
}

function matchesTimeRange(value, from, to) {
  if (!from && !to) return true;
  if (!value) return false;
  if (from && to && from > to) return value >= from || value <= to;
  return (!from || value >= from) && (!to || value <= to);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function listingCard(item, index) {
  const isLooking = item.kind === "looking";
  const label = isLooking ? "กำลังหาคนร่วมงาน" : "ว่างรับงาน";
  const safeContact = escapeHtml(item.contact);
  return `<article class="listing-card" style="animation-delay:${Math.min(index, 8) * 35}ms">
    <div><div class="card-topline"><span class="tag ${isLooking ? "tag-looking" : "tag-available"}"><span class="tag-symbol">${isLooking ? "↗" : "♪"}</span>${label}</span><span class="card-age">${escapeHtml(item.age || "เมื่อสักครู่")}</span></div>
      <h3>${escapeHtml(item.role)}</h3><p class="card-detail">${escapeHtml(item.area)}${item.details ? ` · ${escapeHtml(item.details)}` : ""}</p></div>
    <div class="card-bottom"><span class="card-date">▦ ${formatDate(item.date)} · ${formatTime(item.time)}</span><span class="card-rate">${escapeHtml(item.rate || "คุยกันได้")}</span></div>
    <div class="card-contact">ติดต่อ: <span>${safeContact}</span></div>
  </article>`;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("th-TH");
  const date = dateFilter.value;
  const timeFrom = timeFromFilter.value;
  const timeTo = timeToFilter.value;
  const filtered = listings.filter((item) => {
    const matchesKind = selectedKind === "all" || item.kind === selectedKind;
    const searchable = `${item.role} ${item.area} ${item.time || ""} ${item.details}`.toLocaleLowerCase("th-TH");
    return matchesKind && (!query || searchable.includes(query)) && (!date || item.date === date) && matchesTimeRange(item.time, timeFrom, timeTo);
  });
  grid.innerHTML = filtered.map(listingCard).join("");
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length > 0;
  count.textContent = String(filtered.length).padStart(2, "0");
  const timeSummary = timeFrom && timeTo ? `${timeFrom}–${timeTo} น.` : timeFrom ? `ตั้งแต่ ${timeFrom} น.` : timeTo ? `ถึง ${timeTo} น.` : "";
  filterSummary.textContent = date && timeSummary ? `ประกาศวันที่ ${formatDate(date)} · ${timeSummary}` : timeSummary ? `ประกาศ ${timeSummary}` : date ? `ประกาศวันที่ ${formatDate(date)}` : query ? `ผลการค้นหา “${searchInput.value.trim()}”` : selectedKind === "looking" ? "ประกาศหาคนร่วมงาน" : selectedKind === "available" ? "ประกาศคนว่างรับงาน" : "ประกาศทั้งหมด";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

document.querySelectorAll("[data-kind]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedKind = button.dataset.kind;
    document.querySelectorAll("[data-kind]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-selected", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    render();
  });
});

searchInput.addEventListener("input", render);
dateFilter.addEventListener("change", render);
timeFromFilter.addEventListener("change", render);
timeToFilter.addEventListener("change", render);
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
  timeFromFilter.value = "";
  timeToFilter.value = "";
  selectedKind = "all";
  document.querySelectorAll("[data-kind]").forEach((tab) => {
    const active = tab.dataset.kind === "all";
    tab.classList.toggle("is-selected", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  render();
});

document.querySelectorAll("[data-open-form]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
document.querySelectorAll("[data-close-form]").forEach((button) => button.addEventListener("click", () => dialog.close()));
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

form.elements.date.min = new Date().toISOString().slice(0, 10);
form.elements.time.value = "19:00";
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  formError.textContent = "";
  const values = new FormData(form);
  const listing = {
    id: `local-${Date.now()}`,
    kind: values.get("kind"),
    role: values.get("role").trim(),
    area: values.get("area").trim(),
    date: values.get("date"),
    time: values.get("time"),
    rate: values.get("rate").trim() || "คุยกันได้",
    details: values.get("details").trim(),
    contact: values.get("contact").trim(),
    age: "เมื่อสักครู่",
  };
  submitButton.disabled = true;
  submitButton.textContent = databaseReady ? "กำลังบันทึก..." : "กำลังลงประกาศ...";
  try {
    let savedListing = listing;
    if (databaseReady) {
      savedListing = await saveDatabaseListing(listing);
    } else {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      localStorage.setItem(storageKey, JSON.stringify([listing, ...saved]));
    }
    listings = [savedListing, ...listings];
    selectedKind = "all";
    searchInput.value = "";
    dateFilter.value = "";
    timeFromFilter.value = "";
    timeToFilter.value = "";
    document.querySelector('[data-kind="all"]').click();
    form.reset();
    form.elements.date.min = new Date().toISOString().slice(0, 10);
    form.elements.time.value = "19:00";
    dialog.close();
    showToast(databaseReady ? "ลงประกาศแล้ว · แชร์ให้ทุกคนเห็น" : "ลงประกาศแล้ว · บันทึกไว้ในเบราว์เซอร์นี้");
    document.querySelector("#board").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
    showToast(`${error.message} · ตรวจการตั้งค่า Supabase แล้วลองใหม่`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'ลงประกาศ <span>↗</span>';
  }
});

render();
if (databaseReady) {
  loadDatabaseListings().catch((error) => {
    databaseStatus.textContent = "เชื่อมฐานข้อมูลไม่สำเร็จ";
    showToast(`${error.message} · ตรวจ URL, anon key และ SQL policy`);
  });
}