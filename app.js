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
const photoInput = form.elements.photo;
const photoPreview = document.querySelector("#photo-preview");
const photoPreviewImage = document.querySelector("#photo-preview-image");
const submitButton = form.querySelector('button[type="submit"]');
const maxPhotoBytes = 3 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
let selectedKind = "all";
let toastTimer;
let databaseTimeSupported = true;
let databasePhotoSupported = true;

function loadListings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];
    const userListings = saved.filter((item) => {
      const id = String(item?.id || "");
      return !id.startsWith("demo-") && !id.startsWith("local-");
    });
    if (userListings.length !== saved.length) localStorage.setItem(storageKey, JSON.stringify(userListings));
    return userListings;
  } catch {
    return [];
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
    endTime: row.work_end_time ? row.work_end_time.slice(0, 5) : "",
    photoUrl: row.photo_url || "",
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
  const endpoint = `${databaseUrl}/rest/v1/gig_posts?select=id,kind,role,area,work_date,work_time,work_end_time,photo_url,rate,details,contact,created_at&order=created_at.desc`;
  let response = await fetch(endpoint, { headers });
  if (!response.ok) {
    const withoutPhotoEndpoint = `${databaseUrl}/rest/v1/gig_posts?select=id,kind,role,area,work_date,work_time,work_end_time,rate,details,contact,created_at&order=created_at.desc`;
    response = await fetch(withoutPhotoEndpoint, { headers });
    if (response.ok) {
      databasePhotoSupported = false;
      databaseStatus.textContent = "ฐานข้อมูลยังไม่อัปเดต · รัน schema.sql เพื่อใช้รูป";
      formNote.textContent = "ต้องอัปเดตฐานข้อมูลก่อนแนบรูป กรุณารัน supabase/schema.sql";
    } else {
      const legacyEndpoint = `${databaseUrl}/rest/v1/gig_posts?select=id,kind,role,area,work_date,rate,details,contact,created_at&order=created_at.desc`;
      response = await fetch(legacyEndpoint, { headers });
      if (!response.ok) throw new Error(`โหลดประกาศไม่สำเร็จ (${response.status})`);
      databaseTimeSupported = false;
      databasePhotoSupported = false;
      databaseStatus.textContent = "ฐานข้อมูลยังไม่อัปเดต · รัน schema.sql";
      formNote.textContent = "ต้องอัปเดตฐานข้อมูลก่อนลงประกาศที่ระบุเวลา/รูป กรุณารัน supabase/schema.sql";
    }
  }
  const rows = await response.json();
  const remoteListings = rows.map(mapDatabaseRow);
  const remoteIds = new Set(remoteListings.map((item) => item.id));
  const localOnlyListings = listings.filter((item) => !remoteIds.has(item.id));
  listings = [...remoteListings, ...localOnlyListings];
  if (databaseTimeSupported && databasePhotoSupported) databaseStatus.textContent = "เชื่อมฐานข้อมูลแล้ว · แชร์ประกาศร่วมกัน";
  render();
}

async function saveDatabaseListing(listing) {
  if (!databaseTimeSupported) throw new Error("ต้องรัน supabase/schema.sql ก่อนลงประกาศที่มีเวลา");
  if (!databasePhotoSupported && listing.photoUrl) throw new Error("ต้องรัน supabase/schema.sql ก่อนแนบรูป");
  const payload = {
    kind: listing.kind,
    role: listing.role,
    area: listing.area,
    work_date: listing.date,
    work_time: listing.time,
    work_end_time: listing.endTime,
    rate: listing.rate,
    details: listing.details,
    contact: listing.contact,
  };
  if (databasePhotoSupported) payload.photo_url = listing.photoUrl || null;
  const response = await fetch(`${databaseUrl}/rest/v1/gig_posts`, {
    method: "POST",
    headers: {
      apikey: databaseKey,
      Authorization: `Bearer ${databaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
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

async function uploadPhoto(file) {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
  if (!databaseReady) throw new Error("ต้องเชื่อม Supabase ก่อนอัปโหลดรูป");
  if (!databasePhotoSupported) throw new Error("ต้องรัน supabase/schema.sql ก่อนแนบรูป");
  if (!extension || !allowedPhotoTypes.has(file.type)) throw new Error("รองรับเฉพาะ JPEG, PNG หรือ WebP");
  if (file.size > maxPhotoBytes) throw new Error("รูปต้องมีขนาดไม่เกิน 3 MB");
  const path = `${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${databaseUrl}/storage/v1/object/gig-photos/${path}`, {
    method: "POST",
    headers: {
      apikey: databaseKey,
      Authorization: `Bearer ${databaseKey}`,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message || `HTTP ${response.status}`}`);
  }
  return `${databaseUrl}/storage/v1/object/public/gig-photos/${path}`;
}

function formatDate(value) {
  if (!value) return "วันที่ยังไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function bangkokDateValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTime(value) {
  return value ? `${value.slice(0, 5)} น.` : "เวลาไม่ระบุ";
}

function overlapsTimeRange(start, end, from, to) {
  if (!from && !to) return true;
  if (!start || !end) return false;
  const minutes = (value) => {
    const [hours, mins] = value.split(":").map(Number);
    return hours * 60 + mins;
  };
  const eventStart = minutes(start);
  const eventEnd = minutes(end);
  const eventIntervals = eventEnd > eventStart
    ? [[eventStart, eventEnd]]
    : [[eventStart, 1440], [0, eventEnd || 1440]];
  const rangeStart = from ? minutes(from) : 0;
  const rangeEnd = to ? minutes(to) + 1 : 1440;
  const rangeIntervals = from && to && rangeEnd <= rangeStart
    ? [[rangeStart, 1440], [0, rangeEnd]]
    : [[rangeStart, Math.min(rangeEnd, 1440)]];
  return eventIntervals.some(([eventFrom, eventTo]) =>
    rangeIntervals.some(([rangeFrom, rangeTo]) => eventFrom < rangeTo && eventTo > rangeFrom));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderContact(value) {
  const text = String(value || "");
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/i);
  if (urlMatch) {
    const rawUrl = urlMatch[0].replace(/[),.!?]+$/, "");
    const href = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
    try {
      const parsedUrl = new URL(href);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        const start = text.indexOf(rawUrl);
        const before = escapeHtml(text.slice(0, start));
        const after = escapeHtml(text.slice(start + rawUrl.length));
        return `${before}<a href="${escapeHtml(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawUrl)}</a>${after}`;
      }
    } catch {
      return escapeHtml(text);
    }
  }

  const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}\d/);
  if (phoneMatch) {
    const phoneText = phoneMatch[0].trim();
    const phoneNumber = phoneText.replace(/[^\d+]/g, "");
    const digitCount = phoneNumber.replace(/\D/g, "").length;
    if (digitCount >= 9 && digitCount <= 15) {
      const start = text.indexOf(phoneMatch[0]);
      const before = escapeHtml(text.slice(0, start));
      const after = escapeHtml(text.slice(start + phoneMatch[0].length));
      return `${before}<a href="tel:${phoneNumber}">${escapeHtml(phoneText)}</a>${after}`;
    }
  }

  return escapeHtml(text);
}

function listingCard(item, index) {
  const isLooking = item.kind === "looking";
  const label = isLooking ? "กำลังหาคนร่วมงาน" : "ว่างรับงาน";
  const contactContent = renderContact(item.contact);
  return `<article class="listing-card" style="animation-delay:${Math.min(index, 8) * 35}ms">
    ${item.photoUrl ? `<img class="listing-photo" src="${escapeHtml(item.photoUrl)}" alt="รูปประกอบ ${escapeHtml(item.role)}" loading="lazy" />` : ""}
    <div><div class="card-topline"><span class="tag ${isLooking ? "tag-looking" : "tag-available"}"><span class="tag-symbol">${isLooking ? "↗" : "♪"}</span>${label}</span><span class="card-age">${escapeHtml(item.age || "เมื่อสักครู่")}</span></div>
      <h3>${escapeHtml(item.role)}</h3><p class="card-detail">${escapeHtml(item.area)}${item.details ? ` · ${escapeHtml(item.details)}` : ""}</p></div>
    <div class="card-bottom"><span class="card-date">▦ ${formatDate(item.date)} · ${formatTime(item.time)}${item.endTime ? `–${formatTime(item.endTime)}` : ""}</span><span class="card-rate">${escapeHtml(item.rate || "คุยกันได้")}</span></div>
    <div class="card-contact">ติดต่อ: <span>${contactContent}</span></div>
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
    return matchesKind && (!query || searchable.includes(query)) && (!date || item.date === date) && overlapsTimeRange(item.time, item.endTime, timeFrom, timeTo);
  });
  grid.innerHTML = filtered.map(listingCard).join("");
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length > 0;
  count.textContent = String(filtered.length).padStart(2, "0");
  document.querySelector("#total-count").textContent = String(listings.length).padStart(2, "0");
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

let photoPreviewUrl = "";
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  formError.hidden = true;
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = "";
  if (!file) {
    photoPreview.hidden = true;
    return;
  }
  if (!allowedPhotoTypes.has(file.type) || file.size > maxPhotoBytes) {
    formError.textContent = file.size > maxPhotoBytes ? "รูปต้องมีขนาดไม่เกิน 3 MB" : "รองรับเฉพาะ JPEG, PNG หรือ WebP";
    formError.hidden = false;
    photoInput.value = "";
    photoPreview.hidden = true;
    return;
  }
  photoPreviewUrl = URL.createObjectURL(file);
  photoPreviewImage.src = photoPreviewUrl;
  photoPreview.hidden = false;
});

document.querySelector("#remove-photo").addEventListener("click", () => {
  photoInput.value = "";
  photoPreview.hidden = true;
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = "";
});

form.elements.date.min = bangkokDateValue();
form.elements.time.value = "19:00";
form.elements.endTime.value = "22:00";
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
    endTime: values.get("endTime"),
    rate: values.get("rate").trim() || "คุยกันได้",
    details: values.get("details").trim(),
    contact: values.get("contact").trim(),
    age: "เมื่อสักครู่",
  };
  const photoFile = values.get("photo");
  submitButton.disabled = true;
  submitButton.textContent = databaseReady ? "กำลังบันทึก..." : "กำลังลงประกาศ...";
  try {
    let savedListing = listing;
    if (databaseReady) {
      if (photoFile instanceof File && photoFile.size > 0) listing.photoUrl = await uploadPhoto(photoFile);
      savedListing = await saveDatabaseListing(listing);
    } else if (photoFile instanceof File && photoFile.size > 0) {
      throw new Error("ต้องเชื่อม Supabase Storage ก่อนจึงอัปโหลดรูปได้");
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
    form.elements.date.min = bangkokDateValue();
    form.elements.time.value = "19:00";
    form.elements.endTime.value = "22:00";
    photoInput.value = "";
    photoPreview.hidden = true;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = "";
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