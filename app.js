const starterListings = [
  { id: "demo-1", kind: "looking", role: "มือกลอง / Pop-Rock", area: "อารีย์ · กรุงเทพฯ", date: "2026-10-24", rate: "2,500 บาท / คืน", details: "หามือกลองเล่นประจำร้าน เพลงไทยยุค 2000 ซ้อมก่อนงาน 1 ครั้ง", contact: "ทัก Facebook: Room 44", age: "12 นาทีที่แล้ว" },
  { id: "demo-2", kind: "available", role: "นักร้องหญิง · Soul / R&B", area: "สุขุมวิท · กรุงเทพฯ", date: "2026-10-24", rate: "เริ่ม 3,000 บาท", details: "มีประสบการณ์ร้านอาหารและงาน private มีคลิปผลงานส่งให้ดูได้", contact: "Line: mellowmay", age: "28 นาทีที่แล้ว" },
  { id: "demo-3", kind: "looking", role: "มือเบส · Indie Pop", area: "นนทบุรี", date: "2026-10-25", rate: "1,800 บาท + อาหาร", details: "วงมีงานอีเวนต์วันอาทิตย์ ขอคนตรงเวลาและมีอุปกรณ์ส่วนตัว", contact: "Inbox: Sunday Club", age: "1 ชั่วโมงที่แล้ว" },
  { id: "demo-4", kind: "available", role: "มือคีย์บอร์ด / เปียโน", area: "ลาดพร้าว · กรุงเทพฯ", date: "2026-10-25", rate: "คุยกันได้", details: "เล่น Pop, Jazz และเพลงงานแต่ง อ่าน lead sheet ได้", contact: "Line: keys.nut", age: "2 ชั่วโมงที่แล้ว" },
  { id: "demo-5", kind: "looking", role: "Trio แจ๊ส · งานโรงแรม", area: "ปทุมวัน · กรุงเทพฯ", date: "2026-10-26", rate: "6,000 บาท / วง", details: "หาวง trio เล่น 2 เซต เซตละ 45 นาที มีเครื่องเสียงให้", contact: "ทักเพจ: Blue Note Bar", age: "3 ชั่วโมงที่แล้ว" },
  { id: "demo-6", kind: "available", role: "มือกีตาร์ · Acoustic", area: "เชียงใหม่", date: "2026-10-26", rate: "2,000 บาทขึ้นไป", details: "รับงานร้านและ private event เล่นได้ทั้ง fingerstyle และร้องนำ", contact: "โทร 08x-xxx-xxxx", age: "เมื่อวาน" },
];

const storageKey = "queuewang-listings-v1";
const grid = document.querySelector("#listing-grid");
const count = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const dateFilter = document.querySelector("#date-filter");
const filterSummary = document.querySelector("#filter-summary");
const dialog = document.querySelector("#post-dialog");
const form = document.querySelector("#post-form");
const toast = document.querySelector("#toast");
let selectedKind = "all";
let toastTimer;

function loadListings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? [...saved, ...starterListings] : starterListings;
  } catch {
    return starterListings;
  }
}

let listings = loadListings();

function formatDate(value) {
  if (!value) return "วันที่ยังไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
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
    <div class="card-bottom"><span class="card-date">▦ ${formatDate(item.date)}</span><span class="card-rate">${escapeHtml(item.rate || "คุยกันได้")}</span></div>
    <div class="card-contact">ติดต่อ: <span>${safeContact}</span></div>
  </article>`;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("th-TH");
  const date = dateFilter.value;
  const filtered = listings.filter((item) => {
    const matchesKind = selectedKind === "all" || item.kind === selectedKind;
    const searchable = `${item.role} ${item.area} ${item.details}`.toLocaleLowerCase("th-TH");
    return matchesKind && (!query || searchable.includes(query)) && (!date || item.date === date);
  });
  grid.innerHTML = filtered.map(listingCard).join("");
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length > 0;
  count.textContent = String(filtered.length).padStart(2, "0");
  filterSummary.textContent = date ? `ประกาศวันที่ ${formatDate(date)}` : query ? `ผลการค้นหา “${searchInput.value.trim()}”` : selectedKind === "looking" ? "ประกาศหาคนร่วมงาน" : selectedKind === "available" ? "ประกาศคนว่างรับงาน" : "ประกาศทั้งหมด";
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
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
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
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const listing = {
    id: `local-${Date.now()}`,
    kind: values.get("kind"),
    role: values.get("role").trim(),
    area: values.get("area").trim(),
    date: values.get("date"),
    rate: values.get("rate").trim() || "คุยกันได้",
    details: values.get("details").trim(),
    contact: values.get("contact").trim(),
    age: "เมื่อสักครู่",
  };
  listings = [listing, ...listings];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    localStorage.setItem(storageKey, JSON.stringify([listing, ...saved]));
  } catch {
    showToast("บันทึกในเครื่องไม่สำเร็จ แต่ประกาศนี้ยังแสดงอยู่ชั่วคราว");
  }
  selectedKind = "all";
  searchInput.value = "";
  dateFilter.value = "";
  document.querySelector('[data-kind="all"]').click();
  form.reset();
  form.elements.date.min = new Date().toISOString().slice(0, 10);
  dialog.close();
  showToast("ลงประกาศแล้ว · แสดงเฉพาะในเบราว์เซอร์นี้");
  document.querySelector("#board").scrollIntoView({ behavior: "smooth" });
});

render();