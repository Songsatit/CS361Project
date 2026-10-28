/* =========================================================
   CURRICULUM COMPASS
   Real curriculum data - Thammasat University

   Sources:
   - B.Sc. Computer Science, Curriculum 2023
   - B.Sc. Computer Networks and Cybersecurity, Curriculum 2025
   ========================================================= */


/* =========================================================
   COURSE DATA
   ========================================================= */

const COURSES = window.MOCK_COURSES;

const PROGRAMS = window.MOCK_PROGRAMS;

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url ?? "";
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  const isApiRequest = url.startsWith(API_BASE);
  const hasToken = typeof state !== "undefined" && state.token && isApiRequest && !url.endsWith("/api/auth/login");
  if (hasToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }
  const response = await nativeFetch(input, { ...init, headers });
  if (response.status === 401 && url.startsWith(API_BASE) && !url.endsWith("/api/auth/login")) {
    clearAuthSession();
    if (state.view !== "login") go("login");
  }
  return response;
};


function canAccessCurriculumManagement(user = state.user) {
  return ["instructor", "staff", "curriculum_admin"].includes(user?.role);
}

function canManageCurricula(user = state.user) {
  return ["staff", "curriculum_admin"].includes(user?.role);
}

function canReviewCurriculumRequests(user = state.user) {
  return user?.role === "staff";
}

function canViewAuditLogs(user = state.user) {
  return user?.role === "staff";
}

function canAccessStudentProfile(user = state.user) {
  return user?.role === "student";
}

async function loadStudentProfile() {
  if (!canAccessStudentProfile() || !state.user?.username) return null;
  if (state.studentProfile) return state.studentProfile;
  if (state.studentProfileAttempted) return null;
  state.studentProfileAttempted = true;
  state.studentProfileLoading = true;
  state.studentProfileError = "";
  try {
    // Use the verified TU Authentication response. The separate Student Info
    // API is not enabled for the current Application-Key and must not block UI.
    state.studentProfile = {
      studentId: state.user.username,
      displayNameTh: state.user.displayNameTh ?? "",
      displayNameEn: state.user.displayNameEn ?? "",
      statusName: state.user.tuStatus ?? "",
      statusId: state.user.statusId ?? null,
      faculty: state.user.faculty ?? "",
      department: state.user.department ?? "",
      email: state.user.email ?? "",
    };
    return state.studentProfile;
  } catch (error) {
    state.studentProfileError = error.message || "โหลดข้อมูลส่วนตัวไม่สำเร็จ";
    return null;
  } finally {
    state.studentProfileLoading = false;
  }
}

function restoreMockUser() {
  try {
    const saved = localStorage.getItem("cs361-v3-user");
    state.token = localStorage.getItem("cs361-v3-token");
    state.user = saved ? JSON.parse(saved) : null;
    if (!state.token) state.user = null;
    if (state.user && ["admin", "curriculumadmin"].includes(state.user.role)) {
      state.user.role = "curriculum_admin";
      state.user.roleLabel = "ผู้ดูแลข้อมูลหลักสูตร";
    }
  } catch {
    state.user = null;
  }
}

function clearAuthSession() {
  state.user = null;
  state.token = null;
  localStorage.removeItem("cs361-v3-user");
  localStorage.removeItem("cs361-v3-token");
}

function tokenExpired(token = state.token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function logout() {
  clearAuthSession();
}

function draftApiHeaders() {
  if (state.token && tokenExpired()) clearAuthSession();
  return {
    "Content-Type": "application/json",
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
}

async function loadDraftChangeRequests() {
  if (!state.user || state.draftRequestsLoaded) return state.draftRequests;
  try {
    const response = await fetch(`${API_BASE}/api/change-requests`, {
      headers: draftApiHeaders()
    });
    if (!response.ok) throw new Error(`Draft API returned ${response.status}`);
    const payload = await response.json();
    state.draftRequests = payload?.data ?? [];
  } catch (error) {
    console.warn("Draft change request API unavailable.", error);
    state.draftRequests = [];
  } finally {
    state.draftRequestsLoaded = true;
  }
  return state.draftRequests;
}

async function loadManagementCurricula() {
  if (!canManageCurricula() || state.managementCurriculaLoaded) return state.managementCurricula;
  try {
    const response = await fetch(`${API_BASE}/api/curricula?includeInactive=1`, {
      headers: draftApiHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `Curriculum API returned ${response.status}`);
    state.managementCurricula = payload?.data ?? [];
  } catch (error) {
    console.warn("Management curriculum list API unavailable.", error);
    state.managementCurricula = [];
  } finally {
    state.managementCurriculaLoaded = true;
  }
  return state.managementCurricula;
}

async function loadChangeRequestDetail(requestId) {
  state.changeRequestLoading = true;
  state.changeRequestError = "";
  try {
    const response = await fetch(`${API_BASE}/api/change-requests/${encodeURIComponent(requestId)}`, {
      headers: draftApiHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "โหลดรายละเอียดคำขอไม่สำเร็จ");
    state.selectedChangeRequest = payload.data ?? null;
  } catch (error) {
    state.changeRequestError = error.message || "โหลดรายละเอียดคำขอไม่สำเร็จ";
  } finally {
    state.changeRequestLoading = false;
  }
  render();
}

function applyDraftRequestToEditor(detail) {
  if (!detail || !state.planEdit?.terms) return;
  const items = detail.items ?? [];
  const changes = [];
  const findTerm = (year, term) => state.planEdit.terms.find(item => item.year === Number(year) && item.term === Number(term));
  for (const item of items) {
    const action = String(item.action ?? "").toUpperCase();
    const oldValue = item.old_value ?? {};
    const newValue = item.new_value ?? {};
    const code = courseKey(item.course_code ?? newValue.courseCode ?? "");
    if (!code) continue;
    if (action === "ADD_COURSE") {
      const term = findTerm(item.study_year ?? newValue.year, item.term ?? newValue.term);
      if (term && !term.courses.includes(code)) term.courses.push(code);
      changes.push({ action: "add", code, year: Number(item.study_year ?? newValue.year), term: Number(item.term ?? newValue.term) });
    } else if (action === "REMOVE_COURSE") {
      const year = oldValue.year ?? item.study_year;
      const termNumber = oldValue.term ?? item.term;
      const target = findTerm(year, termNumber);
      if (target) target.courses = target.courses.filter(value => value !== code);
      changes.push({ action: "remove", code, year: Number(year), term: Number(termNumber) });
    } else if (action === "MOVE_COURSE") {
      const fromYear = oldValue.year ?? item.study_year;
      const fromTerm = oldValue.term ?? item.term;
      const toYear = newValue.year;
      const toTerm = newValue.term;
      const source = findTerm(fromYear, fromTerm);
      const target = findTerm(toYear, toTerm);
      if (source) source.courses = source.courses.filter(value => value !== code);
      if (target && !target.courses.includes(code)) target.courses.push(code);
      changes.push({ action: "move", code, fromYear: Number(fromYear), fromTerm: Number(fromTerm), toYear: Number(toYear), toTerm: Number(toTerm) });
    }
  }
  state.planEdit.changes = changes;
  state.pendingDraftToEdit = null;
}

function changeRequestStatusLabel(status) {
  return {
    draft: "ฉบับร่าง",
    pending: "รอตรวจสอบ",
    approved: "อนุมัติแล้ว",
    rejected: "ถูกปฏิเสธ"
  }[status] ?? status ?? "ไม่ทราบสถานะ";
}

function changeRequestStatusClass(status) {
  return `change-request-status change-request-status--${status || "unknown"}`;
}

function auditActionLabel(action) {
  return {
    change_request_created: "สร้างคำขอ",
    change_request_submitted: "ส่งคำขอขออนุมัติ",
    change_request_approved: "อนุมัติคำขอ",
    change_request_rejected: "ปฏิเสธคำขอ",
    change_request_rejectd: "ปฏิเสธคำขอ",
    change_items_saved: "บันทึกรายการแก้ไข"
  }[action] ?? action;
}

function auditEntityLabel(log) {
  let value = log.new_value;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (log.entity_type === "change_request") {
    const title = value?.title ?? value?.newValue?.title;
    return title ? `คำขอ #${log.entity_id} · ${title}` : `คำขอแก้ไข #${log.entity_id}`;
  }
  return log.entity_id ?? "-";
}

function changeRequestItemLabel(item) {
  const actionLabels = {
    ADD_COURSE: "เพิ่มรายวิชา",
    REMOVE_COURSE: "ลบรายวิชา",
    MOVE_COURSE: "ย้ายรายวิชา",
    EDIT_FIELD: "แก้รายละเอียดรายวิชา",
    ADD_PREREQ: "เพิ่มวิชาบังคับก่อน",
    REMOVE_PREREQ: "ลบวิชาบังคับก่อน",
    CREATE_CURRICULUM: "สร้างหลักสูตร",
    CREATE_COURSE: "สร้างรายวิชาใหม่"
  };
  const code = item.course_code || item.courseCode || item.new_value?.courseCode || "";
  const course = code ? COURSES[courseKey(code)] : null;
  const name = course?.name ? ` — ${course.name}` : "";
  return `${actionLabels[item.action] ?? item.action ?? "แก้ไขข้อมูล"}${code ? ` · ${code}${name}` : ""}`;
}

function changeRequestLocation(value) {
  if (!value || typeof value !== "object") return "";
  const year = value.year ?? value.studyYear;
  const term = value.term ?? value.semester;
  if (!year && !term) return "";
  const termLabel = String(term) === "S" || String(term) === "3" ? "ซัมเมอร์" : `ภาค ${term}`;
  return `ชั้นปีที่ ${year ?? "-"} · ${termLabel}`;
}

function changeRequestReadableDiff(item) {
  const oldValue = item.old_value ?? item.oldValue;
  const newValue = item.new_value ?? item.newValue;
  const code = item.course_code || item.courseCode || newValue?.courseCode || "";
  const course = code ? COURSES[courseKey(code)] : null;
  const courseTitle = code
    ? `<div class="request-course-heading"><strong>${esc(code)}</strong><span>${esc(course?.name ?? "รายวิชา")}</span>${course?.nameEn ? `<small>${esc(course.nameEn)}</small>` : ""}</div>`
    : "";
  const action = String(item.action ?? "").toUpperCase();
  if (action === "CREATE_CURRICULUM") {
    return `<div class="request-readable-change"><div class="request-field-line"><span>การดำเนินการ</span><strong>สร้างหลักสูตรใหม่</strong></div><div class="request-field-line"><span>รหัสหลักสูตร</span><strong>${esc(newValue?.curriculumId ?? "-")}</strong></div><div class="request-field-line"><span>ปีหลักสูตร</span><strong>พ.ศ. ${esc(newValue?.academicYear ?? "-")}</strong></div><div class="request-field-line"><span>ชื่อหลักสูตร</span><strong>${esc(newValue?.title ?? "-")}</strong></div></div>`;
  }
  if (action === "ADD_COURSE") {
    return `<div class="request-readable-change">${courseTitle}<div class="request-field-line"><span>เพิ่มใน</span><strong>${esc(changeRequestLocation(newValue) || "ยังไม่ระบุภาคเรียน")}</strong></div><div class="request-field-line"><span>หน่วยกิต</span><strong>${esc(course?.credits ?? "-")} หน่วยกิต</strong></div></div>`;
  }
  if (action === "REMOVE_COURSE") {
    return `<div class="request-readable-change request-readable-change--remove">${courseTitle}<div class="request-field-line"><span>นำออกจาก</span><strong>${esc(changeRequestLocation(oldValue) || "หลักสูตร")}</strong></div></div>`;
  }
  if (action === "MOVE_COURSE") {
    return `<div class="request-readable-change request-readable-change--move">${courseTitle}<div class="request-move-line"><span>${esc(changeRequestLocation(oldValue) || "ตำแหน่งเดิม")}</span><b>→</b><span>${esc(changeRequestLocation(newValue) || "ตำแหน่งใหม่")}</span></div></div>`;
  }
  if (action === "EDIT_FIELD") {
    const fields = ["code", "name", "nameEn", "credits", "category"].filter(field => oldValue?.[field] !== newValue?.[field]);
    return `<div class="request-readable-change">${courseTitle}${fields.length ? fields.map(field => `<div class="request-field-line"><span>${esc({ code: "รหัสวิชา", name: "ชื่อภาษาไทย", nameEn: "ชื่อภาษาอังกฤษ", credits: "หน่วยกิต", category: "กลุ่มวิชา" }[field] ?? field)}</span><strong><del>${esc(oldValue?.[field] ?? "-")}</del> → ${esc(newValue?.[field] ?? "-")}</strong></div>`).join("") : `<span>มีการแก้รายละเอียดรายวิชา</span>`}</div>`;
  }
  if (["ADD_PREREQ", "REMOVE_PREREQ"].includes(action)) {
    const prereq = newValue?.prerequisiteCode ?? newValue?.prereqCode ?? newValue?.code ?? "-";
    return `<div class="request-readable-change">${courseTitle}<div class="request-field-line"><span>วิชาบังคับก่อน</span><strong>${action === "ADD_PREREQ" ? "เพิ่ม" : "ลบ"} ${esc(prereq)}</strong></div></div>`;
  }
  return `<div class="request-readable-change"><span>มีการเปลี่ยนแปลงข้อมูลรายการนี้</span></div>`;
}

function changeRequestItemGroup(item) {
  const value = item.new_value ?? item.newValue ?? item.old_value ?? item.oldValue ?? {};
  const year = item.study_year ?? item.studyYear ?? value.year;
  const term = item.term ?? item.semester ?? value.term;
  if (!year && !term) return "ข้อมูลหลักสูตร";
  return `ชั้นปีที่ ${year ?? "-"} · ${String(term) === "S" || String(term) === "3" ? "ซัมเมอร์" : `ภาค ${term}`}`;
}

function renderChangeRequestDetail(request) {
  if (!request) return `<p class="audit-empty">เลือกคำขอเพื่อดูรายละเอียดก่อน–หลัง</p>`;
  const detail = request.request ?? request;
  const items = request.items ?? [];
  const isRequestOwner = detail.created_by === state.user?.username;
  const canDecide = canReviewCurriculumRequests()
    && detail.status === "pending"
    && !isRequestOwner;
  const canEditDraft = detail.status === "draft"
    && detail.created_by === state.user?.username;
  const groupedItems = items.reduce((groups, item) => {
    const key = changeRequestItemGroup(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
  return `
    <section class="change-request-detail audit-log-card">
      <div class="audit-log-head"><div><span class="workflow-kicker">REQUEST #${esc(detail.id)}</span><h2>${esc(detail.title ?? "คำขอแก้ไขหลักสูตร")}</h2></div><span class="${changeRequestStatusClass(detail.status)}">${esc(changeRequestStatusLabel(detail.status))}</span></div>
      <div class="change-request-meta"><span>ผู้ส่ง: ${esc(detail.created_by ?? "-")}</span><span>สร้างเมื่อ: ${esc(detail.created_at ?? "-")}</span><span>รายการ: ${items.length}</span></div>
      ${detail.note ? `<p class="change-request-note">${esc(detail.note)}</p>` : ""}
      <div class="change-request-items">${items.length ? [...groupedItems.entries()].map(([group, groupItems], groupIndex) => `<details class="change-request-group" ${groupIndex === 0 ? "open" : ""}><summary><strong>${esc(group)}</strong><span>${groupItems.length} รายการ</span></summary><div class="change-request-group-items">${groupItems.map((item, index) => `<article class="change-request-item"><strong>${index + 1}. ${esc(changeRequestItemLabel(item))}</strong>${changeRequestReadableDiff(item)}</article>`).join("")}</div></details>`).join("") : `<p class="audit-empty">คำขอนี้ยังไม่มีรายการเปลี่ยนแปลง</p>`}</div>
      ${detail.review_note ? `<div class="change-request-review-note"><strong>หมายเหตุผู้ตรวจ</strong><p>${esc(detail.review_note)}</p></div>` : ""}
      ${canEditDraft || canDecide || (isRequestOwner && detail.status === "pending") ? `<div class="change-request-decision">${canEditDraft ? `<button type="button" class="workflow-action workflow-action--muted" data-request-edit="${esc(detail.id)}">แก้ไขฉบับร่าง</button><button type="button" class="workflow-action workflow-action--primary" data-request-submit="${esc(detail.id)}">ส่งขออนุมัติ</button>` : ""}${canDecide ? `<button type="button" class="workflow-action workflow-action--primary" data-request-decision="approve" data-request-id="${esc(detail.id)}">อนุมัติคำขอ</button><button type="button" class="workflow-action workflow-action--danger" data-request-decision="reject" data-request-id="${esc(detail.id)}">ปฏิเสธคำขอ</button>` : ""}${isRequestOwner && detail.status === "pending" ? `<p class="change-request-owner-notice">คำขอนี้ส่งโดยคุณ ให้ผู้ตรวจอีกคนพิจารณา</p>` : ""}</div>` : ""}
    </section>
  `;
}

function renderChangeRequestsPage(review = false) {
  if (!canManageCurricula()) return renderHome();
  const username = state.user?.username;
  const all = (state.draftRequests ?? []).filter(item => review
    ? item.created_by !== username
    : item.created_by === username
  );
  const reviewTab = state.reviewTab ?? "pending";
  const requests = review
    ? all.filter(item => item.status === "pending")
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    : all;
  const filtered = !review && state.changeRequestFilter !== "all"
    ? requests.filter(item => item.status === state.changeRequestFilter)
    : requests;
  const counts = ["draft", "pending", "approved", "rejected"]
    .map(status => `${changeRequestStatusLabel(status)} ${all.filter(item => item.status === status).length}`)
    .join(" · ");
  const curriculumOptions = [...new Map(PROGRAMS
    .filter(program => program.curriculumId)
    .map(program => [program.curriculumId, program]))
    .values()];
  const historyCurriculumId = state.curriculumHistoryCurriculumId ?? curriculumOptions[0]?.curriculumId ?? "";
  const historyChanges = state.curriculumChanges ?? [];
  const historyPanel = review && reviewTab === "history" ? `
    <section class="audit-log-card curriculum-change-list">
      <div class="audit-log-head"><h2>ประวัติเวอร์ชันหลักสูตร</h2><span>${historyChanges.length} รายการ</span></div>
      <label class="history-curriculum-picker">เลือกหลักสูตร
        <select data-review-curriculum>
          ${curriculumOptions.map(program => `<option value="${esc(program.curriculumId)}" ${program.curriculumId === historyCurriculumId ? "selected" : ""}>${esc(program.code)} · พ.ศ. ${esc(program.revisionYear ?? "-")}</option>`).join("")}
        </select>
      </label>
      ${historyChanges.length ? `<div class="audit-log-table-wrap"><table class="audit-log-table"><thead><tr><th>รายการ</th><th>สถานะ</th><th>ผู้ส่ง</th><th>เวลา</th></tr></thead><tbody>${historyChanges.map(change => `<tr><td><strong>${esc(change.change_type ?? change.title ?? "การเปลี่ยนแปลงหลักสูตร")}</strong><small>${esc(change.curriculum_id ?? historyCurriculumId)}</small></td><td>${esc(change.status ?? "-")}</td><td>${esc(change.requested_by ?? change.created_by ?? "-")}</td><td>${esc(change.created_at ?? change.updated_at ?? "-")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="audit-empty">ยังไม่มีประวัติเวอร์ชันของหลักสูตรนี้</p>`}
    </section>
  ` : "";
  return `
    <div class="page change-requests-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: review ? "ตรวจคำขอ" : "คำขอของฉัน" }])}
      <div class="management-page-head"><div><span class="workflow-kicker">CURRICULUM WORKFLOW</span><h1 class="page-title">${review ? "ตรวจคำขอหลักสูตร" : "คำขอของฉัน"}</h1><p class="page-sub">ติดตามว่าคำขออยู่ขั้นตอนไหน และดูรายละเอียดก่อน–หลังได้จากหน้านี้</p></div></div>
      <section class="change-request-summary audit-log-card"><strong>ภาพรวมคำขอ</strong><span>${esc(counts)}</span></section>
      ${review ? `<div class="change-request-tabs review-request-tabs"><button type="button" class="${reviewTab === "pending" ? "is-active" : ""}" data-review-tab="pending">คำขอรอตรวจ (${all.filter(item => item.status === "pending").length})</button><button type="button" class="${reviewTab === "history" ? "is-active" : ""}" data-review-tab="history">ประวัติเวอร์ชัน</button></div>` : `<div class="change-request-tabs">${[["all", "ทั้งหมด"], ["draft", "ฉบับร่าง"], ["pending", "รอตรวจสอบ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ถูกปฏิเสธ"]].map(([value, label]) => `<button type="button" class="${state.changeRequestFilter === value ? "is-active" : ""}" data-request-filter="${value}">${label} (${value === "all" ? all.length : all.filter(item => item.status === value).length})</button>`).join("")}</div>`}
      ${historyPanel}
      ${!review || reviewTab === "pending" ? `<div class="change-request-layout"><section class="change-request-list">${filtered.length ? filtered.map(item => `<button type="button" class="change-request-row ${state.selectedChangeRequest?.request?.id === item.id || state.selectedChangeRequest?.id === item.id ? "is-selected" : ""}" data-request-detail="${esc(item.id)}"><span><strong>#${esc(item.id)} · ${esc(item.title ?? "คำขอแก้ไขหลักสูตร")}</strong><small>${esc(item.created_by ?? "-")} · ${esc(item.created_at ?? "-")} · ${esc(item.item_count ?? 0)} รายการ</small></span><span class="${changeRequestStatusClass(item.status)}">${esc(changeRequestStatusLabel(item.status))}</span></button>`).join("") : `<p class="audit-empty">${review ? "ยังไม่มีคำขอจากผู้ใช้อื่นที่รอตรวจ" : "ยังไม่มีคำขอในสถานะนี้"}</p>`}</section><section class="change-request-detail-column">${state.changeRequestLoading ? `<div class="management-placeholder"><p>กำลังโหลดรายละเอียด...</p></div>` : state.changeRequestError ? `<div class="management-placeholder"><p class="error-text">${esc(state.changeRequestError)}</p></div>` : renderChangeRequestDetail(state.selectedChangeRequest)}</section></div>` : ""}
    </div>
  `;
}

async function loadCurriculumWorkflow(curriculumId) {
  if (!curriculumId) return null;
  if (workflowRequests.has(curriculumId)) return workflowRequests.get(curriculumId);
  const request = fetch(`${API_BASE}/api/curricula/${encodeURIComponent(curriculumId)}/workflow`)
    .then(async response => {
      if (!response.ok) throw new Error(`Workflow API returned ${response.status}`);
      const payload = await response.json();
      const workflow = payload?.data ?? { curriculum_id: curriculumId, status: "draft" };
      workflowCache.set(curriculumId, workflow);
      return workflow;
    })
    .catch(error => {
      console.warn(`Workflow unavailable for ${curriculumId}.`, error);
      const fallback = { curriculum_id: curriculumId, status: "draft" };
      workflowCache.set(curriculumId, fallback);
      return fallback;
    });
  workflowRequests.set(curriculumId, request);
  return request;
}

async function loadAuditLogs() {
  if (auditLogRequests.has("recent")) return auditLogRequests.get("recent");
  const request = fetch(`${API_BASE}/api/audit-logs?limit=50`, { headers: draftApiHeaders() })
    .then(async response => {
      if (!response.ok) throw new Error(`Audit API returned ${response.status}`);
      const payload = await response.json();
      const logs = payload?.data ?? [];
      auditLogCache.set("recent", logs);
      return logs;
    })
    .catch(error => {
      console.warn("Audit Log unavailable.", error);
      auditLogCache.set("recent", []);
      return [];
    });
  auditLogRequests.set("recent", request);
  return request;
}

async function loadCurriculumChanges(curriculumId) {
  if (!curriculumId || state.curriculumChangesLoaded) return state.curriculumChanges;
  try {
    const response = await fetch(`${API_BASE}/api/curriculum-changes?curriculumId=${encodeURIComponent(curriculumId)}`, { headers: draftApiHeaders() });
    if (!response.ok) throw new Error(`Curriculum changes API returned ${response.status}`);
    const payload = await response.json();
    state.curriculumChanges = payload?.data ?? [];
  } catch (error) {
    console.warn("Curriculum changes unavailable.", error);
    state.curriculumChanges = [];
  } finally {
    state.curriculumChangesLoaded = true;
  }
  return state.curriculumChanges;
}

async function loadCurriculumCourses(program) {
  if (!program?.curriculumId) return [];
  const key = `${program.curriculumId}:${program.pathwayId ?? ""}`;
  if (state.curriculumCoursesLoaded && state.curriculumCoursesKey === key) {
    return state.curriculumCourses;
  }
  try {
    const pathway = program.pathwayId
      ? `&pathwayId=${encodeURIComponent(program.pathwayId)}`
      : "";
    const response = await fetch(
      `${API_BASE}/api/courses?curriculumId=${encodeURIComponent(program.curriculumId)}${pathway}&limit=500`
    );
    if (!response.ok) throw new Error(`Course API returned ${response.status}`);
    const payload = await response.json();
    state.curriculumCourses = payload?.data ?? [];
  } catch (error) {
    console.warn("Unable to load curriculum courses for editing.", error);
    state.curriculumCourses = [];
  }
  state.curriculumCoursesLoaded = true;
  state.curriculumCoursesKey = key;
  return state.curriculumCourses;
}

const workflowStatusLabels = {
  draft: "ฉบับร่าง",
  review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ถูกตีกลับ"
};

function renderWorkflowPanel(program) {
  if (!canAccessCurriculumManagement()) return "";
  const workflow = workflowCache.get(program.curriculumId) ?? { status: "draft" };
  const canManage = ["instructor", "staff", "curriculum_admin"].includes(state.user?.role);
  const status = workflow.status ?? "draft";
  const actionButtons = `
    <button class="workflow-action ${canManage ? "workflow-action--primary" : ""}"
      data-go="workflow" data-id="${esc(program.id)}">
      ${canManage ? "ตรวจสอบข้อมูลหลักสูตร" : "ดูสถานะข้อมูลหลักสูตร"}
    </button>
  `;

  return `
    <section class="workflow-panel" aria-label="สถานะการตรวจสอบหลักสูตร">
      <div>
        <span class="workflow-kicker">การตรวจสอบข้อมูลหลักสูตร</span>
        <strong>สถานะหลักสูตร: ${esc(workflowStatusLabels[status] ?? status)}</strong>
        <small>${workflow.updated_by ? `แก้ไขล่าสุดโดย ${esc(workflow.updated_by)}` : "ยังไม่มีการส่งตรวจสอบ"}</small>
      </div>
      ${actionButtons}
    </section>
  `;
}

function renderWorkflowPage() {
  if (!canAccessCurriculumManagement()) return renderHome();
  const program = PROGRAMS.find(item => item.id === state.programId) || PROGRAMS[0];
  const workflow = workflowCache.get(program.curriculumId) ?? { status: "draft" };
  const status = workflow.status ?? "draft";
  const canAudit = canViewAuditLogs();
  const roleTitle = state.user.role === "curriculum_admin"
    ? "สิทธิ์ผู้ดูแลข้อมูลหลักสูตร"
    : canAudit
      ? "สิทธิ์เจ้าหน้าที่"
      : "สิทธิ์อาจารย์ผู้สอน";
  const auditLogs = auditLogCache.get("recent") ?? [];
  const pendingChanges = state.curriculumChanges.filter(item => item.status === "pending");
  const pendingDrafts = state.draftRequests.filter(item => item.status === "pending");
  const currentCourses = state.curriculumCourses.filter(course =>
    !program.pathwayId || course.pathway_id === program.pathwayId
  );
  const currentCourseOptions = currentCourses.map(course => `
    <option value="${esc(course.curriculum_course_id)}">
      ${esc(course.course_code)} — ${esc(course.title_th)}
    </option>
  `).join("");
  const availableCourseOptions = Object.entries(COURSES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, course]) => `
      <option value="${esc(code)}">${esc(course.name ?? code)} (${esc(code)})</option>
    `).join("");
  const changeDescription = change => {
    const payload = change.payload ?? {};
    const oldCourse = payload.oldCourse;
    const newCourse = payload.newCourse;
    if (payload.changeType === "course_replace") {
      return `<strong>เปลี่ยนรายวิชา</strong><small>เดิม: ${esc(oldCourse?.course_code ?? payload.curriculumCourseId)} — ${esc(oldCourse?.title_th ?? "ไม่พบข้อมูล")}</small><small>ใหม่: ${esc(newCourse?.course_code ?? payload.newCourseCode)} — ${esc(newCourse?.title_th ?? "ไม่พบข้อมูล")}</small>`;
    }
    if (payload.changeType === "course_add") {
      return `<strong>เพิ่มรายวิชา</strong><small>เพิ่ม: ${esc(newCourse?.course_code ?? payload.newCourseCode)} — ${esc(newCourse?.title_th ?? "ไม่พบข้อมูล")}</small>`;
    }
    if (payload.changeType === "course_remove") {
      return `<strong>เอารายวิชาออก</strong><small>เดิม: ${esc(oldCourse?.course_code ?? payload.curriculumCourseId)} — ${esc(oldCourse?.title_th ?? "ไม่พบข้อมูล")}</small>`;
    }
    return `<strong>เปลี่ยนปีหลักสูตร</strong><small>ปีใหม่: พ.ศ. ${esc(payload.academicYear)}</small>`;
  };

  return `
    <div class="page workflow-page">
      ${crumbs([
        { label: "หน้าแรก", view: "home" },
        { label: "หลักสูตรทั้งหมด", view: "programs" },
        { label: program.code, view: "program" },
        { label: "ตรวจสอบข้อมูลหลักสูตร" }
      ])}

      <div class="workflow-page-head">
        <div>
          <span class="workflow-kicker">การตรวจสอบข้อมูลหลักสูตร</span>
          <h1 class="page-title">ตรวจสอบหลักสูตร</h1>
          <p class="page-sub">${esc(program.code)} · ${esc(program.nameEn)}</p>
        </div>
        <button class="workflow-back" data-go="program" data-id="${esc(program.id)}">กลับไปหน้าหลักสูตร</button>
      </div>

      <section class="workflow-detail-card">
        <div class="workflow-current-status">
          <span>สถานะปัจจุบัน</span>
          <strong>${esc(workflowStatusLabels[status] ?? status)}</strong>
          <small>${workflow.updated_by ? `แก้ไขล่าสุดโดย ${esc(workflow.updated_by)}` : "ยังไม่มีการส่งตรวจสอบ"}</small>
        </div>
        <p class="workflow-readonly">
          ${canAudit
            ? "เจ้าหน้าที่มีสิทธิ์ตรวจสอบประวัติการเปลี่ยนแปลงข้อมูล"
            : "อาจารย์มีสิทธิ์ตรวจสอบความถูกต้องของข้อมูลหลักสูตร"}
        </p>
      </section>

      <section class="workflow-steps">
        ${["draft", "review", "approved"].map(step => `
          <div class="workflow-step ${step === status ? "workflow-step--active" : ""} ${status === "rejected" && step === "review" ? "workflow-step--rejected" : ""}">
            <span>${step === "draft" ? "1" : step === "review" ? "2" : "3"}</span>
            <strong>${esc(workflowStatusLabels[step])}</strong>
          </div>
        `).join("")}
      </section>

      ${canAudit ? `
        <section class="audit-log-card curriculum-change-list">
          <div class="audit-log-head"><h2>รายการแก้ไขที่รอตรวจสอบ</h2><span>${pendingChanges.length + pendingDrafts.length} รายการ</span></div>
          ${pendingChanges.length || pendingDrafts.length ? `<div class="audit-log-table-wrap"><table class="audit-log-table">
            <thead><tr><th>หลักสูตร</th><th>การแก้ไข</th><th>สถานะ</th><th>การดำเนินการ</th></tr></thead>
            <tbody>${pendingChanges.map(change => `
              <tr><td>${esc(change.curriculum_id)}</td><td class="change-diff-cell">${changeDescription(change)}</td><td>${esc(change.status)}</td><td>
                ${change.requested_by === state.user?.username ? `<span class="change-request-owner-notice">คำขอนี้ส่งโดยคุณ ให้ผู้ตรวจอีกคนพิจารณา</span>` : `<button class="link-btn" data-change-action="approve" data-change-id="${esc(change.change_id)}">อนุมัติ</button><button class="link-btn" data-change-action="reject" data-change-id="${esc(change.change_id)}">ปฏิเสธ</button>`}
              </td></tr>`).join("")}${pendingDrafts.map(draft => `
              <tr><td>${esc(draft.curriculum_id ?? draft.source_curriculum_id ?? "หลักสูตรใหม่")}</td><td class="change-diff-cell"><strong>${esc(draft.title)}</strong><small>${esc(draft.note ?? "ฉบับร่างจากระบบใหม่")}</small></td><td>${esc(draft.status)}</td><td>รอตรวจสอบ</td></tr>`).join("")}</tbody>
          </table></div>` : `<p class="audit-empty">ยังไม่มีรายการแก้ไขที่รอตรวจสอบ</p>`}
        </section>
      ` : ""}

      <section class="role-capability-card">
        <h2>${roleTitle}</h2>
        <ul>
          <li>ดูหลักสูตร แผนการเรียน รายวิชา และเงื่อนไขการสำเร็จการศึกษา</li>
          <li>ตรวจสอบสถานะของหลักสูตรและข้อมูลที่เผยแพร่</li>
          ${canAudit ? "<li>ดูประวัติการเปลี่ยนแปลงข้อมูลจาก Audit Log</li>" : "<li>ตรวจสอบความถูกต้องของข้อมูลก่อนแจ้งเจ้าหน้าที่ฝ่ายวิชาการ</li>"}
        </ul>
      </section>

      ${canAudit ? `
        <section class="audit-log-card">
          <div class="audit-log-head">
            <h2>ประวัติการเปลี่ยนแปลง</h2>
            <span>${auditLogs.length} รายการ</span>
          </div>
          ${auditLogs.length ? `
            <div class="audit-log-table-wrap">
              <table class="audit-log-table">
                <thead><tr><th>ผู้ใช้งาน</th><th>การกระทำ</th><th>ข้อมูล</th><th>เวลา</th></tr></thead>
                <tbody>${auditLogs.map(log => `
                  <tr>
                    <td>${esc(log.actor_username)}<small>${esc(log.actor_role)}</small></td>
                    <td>${esc(auditActionLabel(log.action))}</td>
                    <td>${esc(auditEntityLabel(log))}</td>
                    <td>${esc(new Date(log.created_at).toLocaleString("th-TH"))}</td>
                  </tr>
                `).join("")}</tbody>
              </table>
            </div>
          ` : `<p class="audit-empty">ยังไม่มีประวัติการเปลี่ยนแปลง</p>`}
        </section>
      ` : ""}
    </div>
  `;
}

function renderStudentProfile() {
  if (!canAccessStudentProfile()) return renderHome();
  const profile = state.studentProfile;
  return `
    <div class="page profile-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "ข้อมูลส่วนตัว" }])}
      <div class="profile-page-head">
        <span class="workflow-kicker">ข้อมูลจาก TU Authentication API</span>
        <h1 class="page-title">ข้อมูลส่วนตัว</h1>
        <p class="page-sub">ข้อมูลพื้นฐานจากบัญชีมหาวิทยาลัยธรรมศาสตร์ที่ใช้เข้าสู่ระบบ</p>
      </div>
      ${state.studentProfileLoading ? `<section class="profile-card"><p>กำลังโหลดข้อมูล...</p></section>` : ""}
      ${state.studentProfileError ? `<section class="profile-card"><p class="login-error">${esc(state.studentProfileError)}</p></section>` : ""}
      ${profile ? `
        <section class="profile-card">
          <div class="profile-identity">
            <div class="profile-avatar">${icon("user", 28)}</div>
            <div><h2>${esc(profile.displayNameTh || "ไม่ระบุชื่อ")}</h2><p>${esc(profile.displayNameEn || "")}</p></div>
          </div>
          <div class="profile-grid">
            ${[
              ["รหัสนักศึกษา", profile.studentId],
              ["สถานะ", profile.statusName],
              ["ระดับการศึกษา", profile.levelName],
              ["คณะ", profile.faculty],
              ["สาขา", profile.department],
              ["อีเมล", profile.email]
            ].map(([label, value]) => `<div class="profile-field"><span>${label}</span><strong>${esc(value || "ไม่ระบุ")}</strong></div>`).join("")}
          </div>
        </section>
      ` : ""}
    </div>
  `;
}

const graduationSourceLabels = {
  ok: "ข้อมูลนำเข้าล่าสุดพร้อมตรวจสอบ",
  stale: "ข้อมูลเก่าเกินกำหนด ต้องยืนยันข้อมูลล่าสุด",
  import_failed: "การนำเข้าล่าสุดล้มเหลว",
  import_partial: "การนำเข้ามีข้อมูลที่ระบุเจ้าของไม่ได้",
  student_rows_rejected: "ข้อมูลของนักศึกษารายนี้บางรายการถูกปฏิเสธ",
  no_source: "ยังไม่มีข้อมูลผลการเรียนจากแหล่งข้อมูล",
};

const graduationVerdictLabels = {
  met: "ผ่านเงื่อนไขที่ระบบตรวจได้ครบ",
  not_met: "ยังไม่ผ่านอย่างน้อยหนึ่งเงื่อนไข",
  inconclusive: "ยังสรุปผลไม่ได้",
  no_data: "ยังไม่มีข้อมูลผลการเรียน",
};

const graduationConditionLabels = {
  passed: "ผ่าน",
  not_passed: "ยังไม่ผ่าน",
  incomplete: "ข้อมูลไม่ครบ",
};

function graduationDetailsText(condition) {
  const details = condition?.details ?? {};
  const parts = [];
  if (details.earnedCredits != null) parts.push(`สะสม ${details.earnedCredits} จาก ${details.required} หน่วยกิต`);
  if (details.gpa != null) parts.push(`GPA ${details.gpa} (ต้องได้ ${details.required})`);
  if (details.average != null) parts.push(`ค่าเฉลี่ย ${details.average} (ต้องได้ ${details.required})`);
  if (details.missing?.length) parts.push(`ยังไม่มีผล: ${details.missing.join(", ")}`);
  if (details.belowMinimum?.length) parts.push(`เกรดต่ำกว่าเกณฑ์: ${details.belowMinimum.join(", ")}`);
  const reasonLabels = {
    no_rule: "ระบบยังไม่มีกฎคำนวณสำหรับเงื่อนไขนี้",
    no_data: "ไม่พบผลการเรียน",
    no_graded_data: "ไม่มีผลเกรดที่ใช้คำนวณ GPA",
    missing_courses: "ยังไม่มีผลครบทุกวิชาที่ระบุ",
    non_comparable_grade: "เกรดแบบผ่าน/ไม่ผ่านยังเทียบกับเกรดขั้นต่ำไม่ได้",
    unsupported_rule: "ระบบยังไม่รองรับการคำนวณเงื่อนไขนี้",
    data_stale: "ข้อมูลเก่าเกินกำหนด",
    data_import_failed: "การนำเข้าข้อมูลล้มเหลว",
    data_import_partial: "ข้อมูลนำเข้าไม่ครบ",
    data_student_rows_rejected: "มีข้อมูลของนักศึกษารายนี้ถูกปฏิเสธ",
    data_no_source: "ยังไม่มีข้อมูลจากแหล่งข้อมูล",
  };
  if (reasonLabels[condition?.reason]) parts.push(reasonLabels[condition.reason]);
  if (condition?.reason === "below_minimum" && !parts.length) parts.push("ผลยังไม่ถึงเกณฑ์ที่กำหนด");
  return parts.join(" · ");
}

function renderGraduationResult(result, audienceLabel) {
  if (!result) return `<p class="audit-empty">ยังไม่มีผลตรวจสอบ</p>`;
  const dataModeDemo = result.dataMode === "demo";
  const source = result.dataSource ?? {};
  const sourceLabel = graduationSourceLabels[source.status] ?? "ไม่ทราบสถานะข้อมูล";
  const verdict = graduationVerdictLabels[result.verdict] ?? "ยังสรุปผลไม่ได้";
  const gradeRows = result.records ?? [];
  const planRows = result.plan ?? [];
  const gradeLabel = { A: "A", "B+": "B+", B: "B", "C+": "C+", C: "C", "D+": "D+", D: "D", F: "F", S: "S", P: "P", U: "U", W: "W", I: "I" };
  const planStatus = {
    completed: "เรียนแล้ว",
    failed_or_incomplete: "ตก/ยังไม่สมบูรณ์",
    not_taken: "ยังไม่เรียน",
  };
  return `
    <section class="graduation-result-card">
      <div class="graduation-result-head">
        <div><span class="workflow-kicker">${esc(audienceLabel)}</span><h2>${esc(result.curriculum?.curriculumId ?? "ไม่พบหลักสูตร")}</h2></div>
        <strong class="graduation-verdict graduation-verdict--${esc(result.verdict ?? "inconclusive")}">${esc(verdict)}</strong>
      </div>
      ${result.student?.studyYear ? `<p class="graduation-student-meta">ชั้นปีที่ ${esc(result.student.studyYear)}${result.student.displayName ? ` · ${esc(result.student.displayName)}` : ""}</p>` : ""}
      ${dataModeDemo ? `<p class="graduation-demo-banner">ข้อมูลจำลองสำหรับทดสอบเท่านั้น — ไม่ใช่ข้อมูลจริงจากสำนักทะเบียน</p>` : ""}
      <div class="graduation-source-status"><strong>${esc(sourceLabel)}</strong><span>ข้อมูล ณ ${esc(source.asOf ? new Date(source.asOf).toLocaleString("th-TH") : "ไม่มีข้อมูลเวลา")}</span>${source.lastImport?.sourceBatchId ? `<small>Batch: ${esc(source.lastImport.sourceBatchId)}</small>` : ""}</div>
      ${result.totals ? `<div class="graduation-totals"><span>หน่วยกิตที่ได้รับ <strong>${esc(result.totals.earnedCredits)}</strong></span><span>GPA <strong>${esc(result.totals.gpa ?? "ยังคำนวณไม่ได้")}</strong></span></div>` : ""}
      ${result.conditions?.length ? `<div class="graduation-condition-list">${result.conditions.map(condition => `<article class="graduation-condition graduation-condition--${esc(condition.status)}"><div><strong>${esc(graduationConditionLabels[condition.status] ?? "ข้อมูลไม่ครบ")}</strong><span>${esc(condition.text)}</span></div>${graduationDetailsText(condition) ? `<small>${esc(graduationDetailsText(condition))}</small>` : ""}</article>`).join("")}</div>` : `<p class="audit-empty">ไม่พบเงื่อนไขหรือข้อมูลสำหรับตรวจสอบ</p>`}
      ${gradeRows.length ? `<section class="graduation-history"><h3>วิชาที่เคยเรียนและผลการเรียน</h3><div class="graduation-table-wrap"><table><thead><tr><th>วิชา</th><th>ชื่อวิชา</th><th>ปี/ภาค</th><th>หน่วยกิต</th><th>เกรด</th></tr></thead><tbody>${gradeRows.map(row => `<tr><td>${esc(row.courseCode)}</td><td>${esc(row.courseNameTh ?? row.courseNameEn ?? "ไม่พบชื่อวิชา")}</td><td>${esc(row.academicYear)} / ${esc(row.semester === 3 ? "Summer" : row.semester)}</td><td>${esc(row.credits)}</td><td><strong>${esc(gradeLabel[row.grade] ?? row.grade ?? "-")}</strong></td></tr>`).join("")}</tbody></table></div></section>` : ""}
      ${planRows.length ? `<section class="graduation-plan-progress"><h3>ความก้าวหน้าตามแผน 4 ปี</h3><div class="graduation-table-wrap"><table><thead><tr><th>ปี/ภาค</th><th>วิชา</th><th>หน่วยกิต</th><th>สถานะ</th><th>เกรด</th></tr></thead><tbody>${planRows.map(row => `<tr><td>ปี ${esc(row.studyYear)} / ${esc(row.semester === 3 ? "Summer" : row.semester)}</td><td>${esc(row.courseCode ?? "-")} ${esc(row.courseNameTh ?? "")}</td><td>${esc(row.credits ?? "-")}</td><td>${esc(planStatus[row.status] ?? row.status)}</td><td>${esc(row.grade ?? "-")}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
    </section>
  `;
}

function renderGraduationPage() {
  const role = state.user?.role;
  if (!state.user || !["student", "instructor", "staff"].includes(role)) return renderHome();
  const studentView = role === "student";
  const canSeeBatches = role === "staff";
  return `
    <div class="page graduation-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "ตรวจสอบการสำเร็จการศึกษา" }])}
      <div class="graduation-page-head"><span class="workflow-kicker">V4 · GRADUATION VERIFICATION</span><h1 class="page-title">ตรวจสอบการสำเร็จการศึกษา</h1><p class="page-sub">ระบบแสดงผลตามข้อมูลที่นำเข้า และจะแจ้งเมื่อข้อมูลหรือเงื่อนไขไม่เพียงพอ</p></div>
      ${state.graduationError ? `<section class="graduation-error">${esc(state.graduationError)}</section>` : ""}
      ${state.graduationLoading ? `<section class="profile-card">กำลังโหลดข้อมูลผลการเรียน...</section>` : ""}
      ${studentView ? renderGraduationResult(state.graduationResult, "ผลตรวจสอบของนักศึกษา") : `
        <section class="graduation-student-list"><h2>นักศึกษาที่ได้รับมอบหมาย</h2><p>แสดงเฉพาะนักศึกษาที่อยู่ในขอบเขตสิทธิ์ของบัญชีนี้</p>
          ${state.graduationStudents.length ? `<div class="graduation-student-buttons">${state.graduationStudents.map(student => `<button type="button" class="workflow-action ${student.studentId === state.graduationSelectedStudentId ? "workflow-action--primary" : "workflow-action--muted"}" data-graduation-student="${esc(student.studentId)}"><strong>${esc(student.displayName ?? student.studentId)}</strong> · ${student.studyYear ? `ปี ${esc(student.studyYear)} · ` : ""}${student.hasData ? "มีข้อมูลผลการเรียน" : "ยังไม่มีข้อมูล"}</button>`).join("")}</div>` : `<p class="audit-empty">ยังไม่มีนักศึกษาที่ได้รับมอบหมายให้ตรวจสอบ</p>`}
          ${role === "staff" ? `<form class="graduation-assignment-form" data-graduation-assign-form><h3>เพิ่มนักศึกษาเข้ารายการตรวจ</h3><div><input name="studentId" required placeholder="รหัสนักศึกษา Demo เช่น DEMO0001"><input name="displayName" placeholder="ชื่อที่แสดง"><select name="studentYear" required><option value="">ชั้นปี</option><option value="1">ปี 1</option><option value="2">ปี 2</option><option value="3">ปี 3</option><option value="4">ปี 4</option></select><button type="submit" class="workflow-action workflow-action--primary">เพิ่มรายการ</button></div></form>` : ""}
        </section>
        ${state.graduationResult ? renderGraduationResult(state.graduationResult, `ผลตรวจสอบ ${state.graduationSelectedStudentId}`) : ""}
        ${canSeeBatches ? `<section class="graduation-import-history"><h2>ประวัติการนำเข้า</h2>${state.graduationBatches.length ? `<div class="graduation-table-wrap"><table><thead><tr><th>Batch</th><th>โหมด</th><th>สถานะ</th><th>จำนวนแถว</th><th>นำเข้าเมื่อ</th></tr></thead><tbody>${state.graduationBatches.map(batch => `<tr><td>${esc(batch.source_batch_id ?? batch.batch_id)}</td><td>${batch.data_mode === "demo" ? "ข้อมูลจำลอง" : "ข้อมูลจริง"}</td><td>${esc(batch.status)}</td><td>${esc(batch.row_total)}</td><td>${esc(batch.finished_at ? new Date(batch.finished_at).toLocaleString("th-TH") : "-")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="audit-empty">ยังไม่มีประวัติการนำเข้า</p>`}</section>` : ""}
      `}
    </div>
  `;
}

async function loadGraduationPage() {
  if (state.graduationLoading || state.graduationLoaded) return;
  const role = state.user?.role;
  if (!["student", "instructor", "staff"].includes(role)) return;
  state.graduationLoading = true;
  state.graduationError = "";
  try {
    if (role === "student") {
      const response = await fetch(`${API_BASE}/api/graduation/me`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "โหลดผลตรวจสอบไม่สำเร็จ");
      state.graduationResult = payload.data;
    } else {
      const response = await fetch(`${API_BASE}/api/graduation/students`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "โหลดรายชื่อนักศึกษาไม่สำเร็จ");
      state.graduationStudents = payload.data ?? [];
      if (role === "staff") {
        const batchesResponse = await fetch(`${API_BASE}/api/graduation/import-batches`);
        const batchesPayload = await batchesResponse.json().catch(() => ({}));
        if (batchesResponse.ok) state.graduationBatches = batchesPayload.data ?? [];
      }
      const selectedId = state.graduationSelectedStudentId || state.graduationStudents[0]?.studentId;
      if (selectedId && state.graduationStudents.some(student => student.studentId === selectedId)) {
        state.graduationSelectedStudentId = selectedId;
        const resultResponse = await fetch(`${API_BASE}/api/graduation/students/${encodeURIComponent(selectedId)}`);
        const resultPayload = await resultResponse.json().catch(() => ({}));
        if (!resultResponse.ok) throw new Error(resultPayload.error ?? "โหลดผลตรวจสอบไม่สำเร็จ");
        state.graduationResult = resultPayload.data;
      }
    }
    state.graduationLoaded = true;
  } catch (error) {
    state.graduationError = error.message || "โหลดข้อมูลการตรวจสอบไม่สำเร็จ";
  } finally {
    state.graduationLoading = false;
  }
}

function courseKey(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

function courseCodeFromApi(value) {
  return courseKey(value?.course_code ?? value?.code ?? value?.courseCode);
}

async function loadCatalogResource(resource, code) {
  const url = new URL(COURSE_CATALOG_API);
  url.searchParams.set("resource", resource);
  url.searchParams.set("course_code", code);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${resource} API returned ${response.status}`);
  const payload = await response.json();
  return payload?.data ?? null;
}

async function loadCourseDetail(code) {
  const key = courseKey(code);
  if (!key || courseDetailRequests.has(key)) {
    return courseDetailRequests.get(key);
  }

  const request = Promise.all([
    fetch(`${API_BASE}/api/courses/${encodeURIComponent(key)}`),
    fetch(`${API_BASE}/api/courses/${encodeURIComponent(key)}/prerequisites`),
    loadCatalogResource("tqf3_course_info", key).catch(() => null),
    loadCatalogResource("course_plo_mappings", key).catch(() => null)
  ])
    .then(async ([detailResponse, prerequisiteResponse, tqf3, ploMappings]) => {
      if (!detailResponse.ok) throw new Error(`Course detail API returned ${detailResponse.status}`);
      const detailPayload = await detailResponse.json();
      const prerequisitePayload = prerequisiteResponse.ok
        ? await prerequisiteResponse.json()
        : { data: { prerequisites: [] } };
      const data = detailPayload?.data ?? {};
      const detail = data.detail ?? {};
      const raw = typeof detail.raw_json === "string"
        ? JSON.parse(detail.raw_json)
        : (detail.raw_json ?? {});
      const prerequisites = (prerequisitePayload?.data?.prerequisites ?? [])
        .filter(item => item.depth == null || item.depth === 1);
      const prerequisiteCodes = prerequisites
        .map(courseCodeFromApi)
        .filter(Boolean);
      const dependentCodes = (data.dependents ?? [])
        .map(courseCodeFromApi)
        .filter(Boolean);
      const existing = COURSES[key] ?? {};

      COURSES[key] = {
        ...existing,
        name: data.title_th ?? existing.name ?? key,
        nameEn: data.title_en ?? existing.nameEn ?? "",
        credits: data.credits_total ?? existing.credits ?? 0,
        desc: detail.description_th ?? raw.description_th ?? raw.description ?? existing.desc ?? "",
        term: raw.term ?? raw.offering ?? existing.term ?? "ตามแผนการศึกษา",
        prereq: prerequisiteCodes.length ? prerequisiteCodes : (existing.prereq ?? []),
        unlocks: dependentCodes.length ? dependentCodes : (existing.unlocks ?? []),
        apiCourseId: data.course_id ?? existing.apiCourseId,
        apiDetail: detail,
        tqf3,
        ploMappings
      };
    })
    .catch(error => {
      console.warn(`Course detail unavailable for ${key}; using bundled fallback.`, error);
    });

  courseDetailRequests.set(key, request);
  return request;
}

async function loadStudyPlans() {
  const response = await fetch(
    `${API_BASE}/api/study-plans?active=true`
  );
  if (!response.ok) throw new Error(`Study plan API returned ${response.status}`);
  const payload = await response.json();
  const plans = payload?.data ?? [];

  for (const program of PROGRAMS) {
    const pathwayPlans = plans.filter(plan =>
      plan.curriculum_id === program.curriculumId && (!program.pathwayId || plan.pathway_id === program.pathwayId)
    );
    if (!pathwayPlans.length) continue;

    const loadedPlans = [];
    for (const plan of pathwayPlans) {
      const detailResponse = await fetch(
        `${API_BASE}/api/study-plans/${encodeURIComponent(plan.study_plan_id)}`
      );
      if (!detailResponse.ok) continue;
      const detailPayload = await detailResponse.json();
      const items = detailPayload?.data?.items ?? [];
      const grouped = new Map();

      for (const item of items) {
        const code = courseKey(item.course_code);
        const requirementText = String(item.requirement_text ?? "").trim();
        const displayCode = code || (requirementText ? `__REQ__${requirementText}` : "");
        if (!displayCode) continue;
        const key = `${item.study_year}-${item.semester}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            year: Number(item.study_year),
            term: Number(item.semester),
            courses: []
          });
        }
        grouped.get(key).courses.push(displayCode);
      }

      if (grouped.size) {
        loadedPlans.push({
          id: plan.study_plan_id,
          label: studyPlanLabel(plan.study_plan_id, plan.plan_name_th ?? plan.plan_name, plan.plan_name_en),
          plan: [...grouped.values()].sort(
            (a, b) => a.year - b.year || a.term - b.term
          )
        });
      }
    }

    if (loadedPlans.length) {
      if (program.curriculumId === "BSC-CNC-2568" && loadedPlans.length === 2) {
        loadedPlans.forEach((loadedPlan, index) => {
          if (loadedPlan.label.includes(" · ")) return;
          const planText = `${loadedPlan.id} ${loadedPlan.label}`;
          loadedPlan.label = /3\s*[._-]?\s*5|สามปีครึ่ง/i.test(planText)
            ? "แผน 3.5 ปี"
            : /4\s*ปี|(^|[-_])4($|[-_])/i.test(planText)
              ? "แผน 4 ปี"
              : index === 0 ? "แผน 3.5 ปี" : "แผน 4 ปี";
        });
      }
      const selected = loadedPlans.find(plan => /PROJECT$/i.test(plan.id)) ?? loadedPlans[0];
      program.studyPlans = loadedPlans;
      program.activeStudyPlanId = selected.id;
      program.plan = selected.plan;
    }
  }
}

function studyPlanLabel(planId, planName, planNameEn = "") {
  if (planName && planNameEn) return `${planName} · ${planNameEn}`;
  const planText = `${planId ?? ""} ${planName ?? ""}`;
  if (/3\s*[.]?\s*5\s*ปี|3\s*ปีครึ่ง|สามปีครึ่ง/i.test(planText)) return "แผน 3.5 ปี";
  if (/4\s*ปี|สี่ปี/i.test(planText)) return "แผน 4 ปี";
  if (planName) {
    if (/สหกิจ|co-?operative/i.test(planName)) return "แผนสหกิจศึกษา";
    if (/โครงงาน|project/i.test(planName)) return "แผนโครงงานพิเศษ";
    if (/สายโท|minor/i.test(planName)) return "แผนเลือกสายโท";
  }
  if (/COOP$/i.test(planId)) return "แผนสหกิจศึกษา";
  if (/PROJECT$/i.test(planId)) return "แผนโครงงานพิเศษ";
  if (/MINOR|สายโท/i.test(planId)) return "แผนเลือกสายโท";
  return [planName, planNameEn].filter(Boolean).join(" · ") || planId;
}

function studyPlanMajorLabel(program) {
  if (program.pathwayId?.endsWith("-ACS")) return "วิชาเอกคอมพิวเตอร์ประยุกต์";
  if (program.pathwayId?.endsWith("-CIS")) return "วิชาเอกคอมพิวเตอร์และวิทยาการสารสนเทศ";
  return program.code;
}

async function loadApiData() {
  state.apiStatus = "loading";
  state.apiError = "";
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    const coursesResponse = await fetch(
      `${API_BASE}/api/courses?limit=500${canManageCurricula() ? "&includeUnplaced=1" : ""}`,
      { signal: controller.signal, headers: canManageCurricula() ? draftApiHeaders() : undefined }
    );
    window.clearTimeout(timeout);

    if (!coursesResponse.ok) {
      throw new Error(`Course API returned ${coursesResponse.status}`);
    }
    state.apiStatus = "ok";

    const coursesPayload = await coursesResponse.json();
    const courses = coursesPayload?.data ?? [];
    const liveCurriculumIds = new Set();

    try {
      const curriculaResponse = await fetch(`${API_BASE}/api/curricula`);
      if (curriculaResponse.ok) {
        const curriculaPayload = await curriculaResponse.json();
        for (const curriculum of curriculaPayload?.data ?? []) {
          liveCurriculumIds.add(curriculum.curriculum_id);
          if (PROGRAMS.some(program => program.curriculumId === curriculum.curriculum_id)) continue;
          PROGRAMS.push({
            id: `api-${curriculum.curriculum_id}`,
            curriculumId: curriculum.curriculum_id,
            code: curriculum.title_th || curriculum.curriculum_id,
            nameEn: curriculum.title_en || "",
            revisionYear: Number(curriculum.academic_year),
            totalCredits: Number(curriculum.total_credits) || 0,
            plan: [],
            studyPlans: []
          });
        }
      } else {
        console.warn(`Curriculum list API returned ${curriculaResponse.status}; using bundled curriculum list.`);
      }
    } catch (error) {
      console.warn("Curriculum list API unavailable; using bundled curriculum list.", error);
    }

    for (const course of courses) {
      const code = String(course.course_code ?? "").replace(/\s+/g, "");
      if (!code) continue;

      COURSES[code] = {
        ...(COURSES[code] ?? {}),
        name: course.title_th ?? COURSES[code]?.name ?? code,
        nameEn: course.title_en ?? COURSES[code]?.nameEn ?? "",
        credits: course.credits_total ?? COURSES[code]?.credits ?? 0,
        category:
          course.classification?.course_type?.label_th ??
          COURSES[code]?.category ??
          "วิชาเฉพาะ",
        prereq: COURSES[code]?.prereq ?? [],
        apiCourseId: course.course_id,
        curriculumCourseId: course.curriculum_course_id,
        createdCourse: course.curriculum_id == null
      };
    }

    // API-created curricula may not have bundled metadata. Derive the card
    // summary from the live course placements so it never renders undefined.
    PROGRAMS.forEach(program => {
      const liveCourses = courses.filter(course =>
        course.curriculum_id === program.curriculumId || course.pathway_id === program.pathwayId
      );
      if (program.totalCredits == null) {
        const uniqueCourses = new Map(liveCourses.map(course => [course.course_id ?? course.course_code, course]));
        program.totalCredits = [...uniqueCourses.values()].reduce((sum, course) => sum + Number(course.credits_total ?? 0), 0);
      }
      if (!program.duration) program.duration = "หลักสูตร";
    });

    // Keep the course cards in sync with the backend instead of showing
    // prerequisite labels from the bundled fallback data.
    const courseCodes = [...new Set(courses
      .map(course => String(course.course_code ?? "").replace(/\s+/g, ""))
      .filter(Boolean))];

    // The bundled files are only an offline fallback. Once the API responds,
    // remove fallback courses and programs that are not in the live catalog so
    // the UI cannot show stale/mock records alongside real data.
    const apiCourseCodeSet = new Set(courseCodes);
    Object.keys(COURSES).forEach(code => {
      if (!apiCourseCodeSet.has(code)) delete COURSES[code];
    });
    for (let index = PROGRAMS.length - 1; index >= 0; index -= 1) {
      const program = PROGRAMS[index];
      const hasLiveCourses = courses.some(course =>
        course.curriculum_id === program.curriculumId ||
        course.pathway_id === program.pathwayId
      );
      if (!hasLiveCourses && !liveCurriculumIds.has(program.curriculumId)) PROGRAMS.splice(index, 1);
    }
    PROGRAMS.forEach(program => {
      if (!Array.isArray(program.plan)) return;
      program.plan = program.plan
        .map(term => ({
          ...term,
          courses: term.courses.filter(code =>
            code.startsWith("FREE") || apiCourseCodeSet.has(code)
          )
        }))
        .filter(term => term.courses.length);
    });

    for (let index = 0; index < courseCodes.length; index += 8) {
      const batch = courseCodes.slice(index, index + 8);
      await Promise.all(batch.map(async code => {
        try {
          const response = await fetch(
            `${API_BASE}/api/courses/${encodeURIComponent(code)}/prerequisites`
          );
          if (!response.ok) return;
          const payload = await response.json();
          const prerequisites = (payload?.data?.prerequisites ?? [])
            .filter(item => item.depth == null || item.depth === 1);
          COURSES[code].prereq = prerequisites
            .map(courseCodeFromApi)
            .filter(Boolean);
        } catch (error) {
          console.warn(`Prerequisite API unavailable for ${code}.`, error);
        }
      }));
    }

    const curriculumIds = [...new Set(
      PROGRAMS.map(program => program.curriculumId).filter(Boolean)
    )];
    await Promise.all(curriculumIds.map(async curriculumId => {
      const conditionsResponse = await fetch(
        `${API_BASE}/api/curricula/${encodeURIComponent(curriculumId)}/graduation-conditions`
      );
      if (!conditionsResponse.ok) return;
      const conditionsPayload = await conditionsResponse.json();
      const conditions = (conditionsPayload?.data ?? [])
        .map(condition => condition.condition_text)
        .filter(Boolean);
      if (!conditions.length) return;
      PROGRAMS
        .filter(program => program.curriculumId === curriculumId)
        .forEach(program => {
          program.conditions = conditions;
        });
    }));

    await loadStudyPlans();
  } catch (error) {
    state.apiStatus = "unavailable";
    state.apiError = error?.name === "AbortError"
      ? "API ใช้เวลาตอบกลับนานเกินไป"
      : (error?.message || "ไม่สามารถเชื่อมต่อ API ได้");
    console.warn("Backend API unavailable; using bundled fallback data.", error);
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

const icon = (name, size = 18, cls = "") =>
  `<i data-lucide="${name}" width="${size}" height="${size}" class="${cls}"></i>`;

const escapeHtml = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

// Keep the existing short name while making the single HTML escaping helper explicit.
const esc = escapeHtml;

const norm = s =>
  (s || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "");

function findUnlocks(code) {
  return Object.entries(COURSES)
    .filter(([, c]) => c.prereq.includes(code))
    .map(([k]) => k);
}

function programsContaining(code) {
  return PROGRAMS.filter(
    p => p.plan.some(t => t.courses.includes(code))
  );
}

function seal(year) {
  return `
    <div class="seal">
      <span class="seal-ring"></span>
      <span class="seal-year">${year}</span>
      <span class="seal-label">ปรับปรุง</span>
    </div>
  `;
}

function chip(text, tone = "ink") {
  return `
    <span class="chip chip-${tone}">
      ${esc(text)}
    </span>
  `;
}

function apiValueMarkup(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.length
      ? `<ul class="api-value-list">${value.map(item => `<li>${apiValueMarkup(item)}</li>`).join("")}</ul>`
      : "—";
  }
  if (typeof value === "object") {
    return `<div class="api-value-object">${Object.entries(value)
      .map(([key, item]) => `
        <div class="api-value-row">
          <div class="api-value-key">${esc(key.replaceAll("_", " "))}</div>
          <div class="api-value-content">${apiValueMarkup(item)}</div>
        </div>
      `)
      .join("")}</div>`;
  }
  return esc(String(value));
}

function apiDataPanel(title, value) {
  if (value == null || (Array.isArray(value) && !value.length)) return "";
  return `
    <details class="panel api-collapsible" style="margin-top:20px">
      <summary class="api-collapsible-summary">
        <span>${esc(title)}</span>
        <span class="api-collapsible-hint">กดเพื่อดูข้อมูล</span>
      </summary>
      <div class="api-value-content">${apiValueMarkup(value)}</div>
    </details>
  `;
}

function courseCode(code) {
  return `
    <span class="course-code">
      ${esc(code)}
    </span>
  `;
}

function crumbs(items) {
  return `
    <div class="crumbs">
      ${items
      .map(
        (it, i) => `
            <span class="crumb-item">
              ${i
            ? icon("chevron-right", 13, "crumb-sep")
            : ""
          }

              ${it.view
            ? `
                    <button
                      class="crumb-link"
                      data-go="${it.view}"
                      ${it.id ? `data-id="${esc(it.id)}"` : ""}
                    >
                      ${esc(it.label)}
                    </button>
                  `
            : `
                    <span class="crumb-current">
                      ${esc(it.label)}
                    </span>
                  `
          }
            </span>
          `
      )
      .join("")}
    </div>
  `;
}


/* =========================================================
   PROGRAM CARD
   ========================================================= */

function programCard(p) {
  const versions = programVersions(p);
  const latest = versions[versions.length - 1] ?? p;

  return `
    <button
      class="program-card"
      data-go="program"
      data-id="${esc(latest.id)}"
    >

      ${seal(latest.revisionYear)}

      <div class="program-card-body">

        <div class="program-card-faculty">
          ${esc(p.faculty)}
        </div>

        <h3>
          ${esc(latest.code)}
        </h3>

        <div class="program-card-en">
          ${esc(latest.nameEn)}
        </div>

        <div class="program-card-stats">

          <span>
            ${icon("graduation-cap", 14)}
            ${esc(latest.duration ?? "หลักสูตร")}
          </span>

          <span>
            ${courseCode(`${Number(latest.totalCredits) > 0 ? latest.totalCredits : "—"} นก.`)}
          </span>

          ${versions.length > 1 ? `
            <span class="program-card-years">พ.ศ. ${versions.map(version => version.revisionYear).join(" / ")}</span>
          ` : ""}

        </div>

      </div>

      ${icon("chevron-right", 18, "program-card-chevron")}

    </button>
  `;
}

function programFamilyKey(program) {
  if (program.pathwayId?.endsWith("-ACS")) return "acs";
  if (program.pathwayId?.endsWith("-CIS")) return "cis";
  return program.id;
}

function programVersions(program) {
  return PROGRAMS
    .filter(item => programFamilyKey(item) === programFamilyKey(program))
    .sort((a, b) => a.revisionYear - b.revisionYear);
}

function programFamilies() {
  const groups = new Map();
  PROGRAMS.forEach(program => {
    const key = programFamilyKey(program);
    if (!groups.has(key)) groups.set(key, program);
  });
  return [...groups.values()];
}


/* =========================================================
   HOME
   ========================================================= */

function renderHome() {

  const q = state.homeQuery.trim();

  let results = [];

  if (q) {

    const x = norm(q);

    PROGRAMS.forEach(p => {

      if (
        norm(
          p.code +
          p.nameEn +
          p.faculty
        ).includes(x)
      ) {
        results.push([
          "หลักสูตร",
          p.code,
          "program",
          p.id
        ]);
      }

    });

    Object.entries(COURSES).forEach(
      ([code, c]) => {

        if (
          norm(
            code +
            c.name +
            c.nameEn
          ).includes(x)
        ) {

          results.push([
            "รายวิชา",
            `${code} · ${c.name}`,
            "course",
            code
          ]);

        }

      }
    );

    FAQS.forEach(f => {

      if (
        norm(
          f.q +
          f.a
        ).includes(x)
      ) {

        results.push([
          "คำถาม",
          f.q,
          "faq",
          ""
        ]);

      }

    });

    results = results.slice(0, 6);
  }


  return `
    <div>

      <section class="hero">

        <div class="hero-inner">

          <div class="hero-eyebrow">
            ${icon("compass", 15)}
            ศูนย์ข้อมูลหลักสูตรกลาง
          </div>

          <h1 class="hero-title">
            รู้เส้นทางวิชา<br>
            ก่อนก้าวเดินแต่ละเทอม
          </h1>

          <p class="hero-sub">
            ค้นหลักสูตร แผนการเรียน รายวิชา
            วิชาบังคับก่อน และเงื่อนไขการสำเร็จการศึกษา
            ในที่เดียว — เข้าถึงได้ทันทีโดยไม่ต้องเข้าสู่ระบบ
          </p>

          <div class="hero-search">

            ${icon(
    "search",
    18,
    "hero-search-icon"
  )}

            <input
              id="homeSearch"
              value="${esc(state.homeQuery)}"
              placeholder="ค้นหาหลักสูตร รายวิชา หรือคำถาม เช่น “CS251” หรือ “CNCTU”"
              autocomplete="off"
            >

            <div
              id="homeSearchResults"
              class="home-search-results"
              style="display:none;"
              ></div>

          </div>

          ${results.length
      ? `
                <div class="hero-results">

                  ${results
        .map(
          r => `
                        <button
                          class="hero-result-row"
                          data-go="${esc(r[2])}"
                          data-id="${esc(r[3])}"
                        >

                          <span class="hero-result-type">
                            ${r[0]}
                          </span>

                          <span class="hero-result-label">
                            ${esc(r[1])}
                          </span>

                          ${icon(
            "chevron-right",
            15
          )}

                        </button>
                      `
        )
        .join("")}

                </div>
              `
      : ""
    }

        </div>

      </section>


      <section class="section">

        <div class="section-head">

          <h2>
            หลักสูตรที่เปิดสอน
          </h2>

          <button
            class="link-btn"
            data-go="programs"
          >
            ดูทั้งหมด
            ${icon("arrow-right", 14)}
          </button>

        </div>

        <div class="program-grid">

          ${programFamilies()
      .map(programCard)
      .join("")}

        </div>

      </section>


      <section class="section quick-links">

        <button
          class="quick-card"
          data-go="courses"
        >

          ${icon("book-open", 22)}

          <div>

            <div class="quick-card-title">
              ค้นหารายวิชา
            </div>

            <div class="quick-card-sub">
              ค้นหาด้วยรหัสวิชา ชื่อวิชา
              หรือหลักสูตร
            </div>

          </div>

          ${icon("chevron-right", 18)}

        </button>


        <button
          class="quick-card"
          data-go="faq"
        >

          ${icon("circle-help", 22)}

          <div>

            <div class="quick-card-title">
              คำถามที่พบบ่อย
            </div>

            <div class="quick-card-sub">
              รวมคำตอบเรื่องหลักสูตร
              การลงทะเบียน และการสำเร็จการศึกษา
            </div>

          </div>

          ${icon("chevron-right", 18)}

        </button>

      </section>

    </div>
  `;
}


/* =========================================================
   PROGRAM LIST
   ========================================================= */

function renderPrograms() {

  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "หลักสูตรทั้งหมด"
    }
  ])}

      <h1 class="page-title">
        หลักสูตรที่เปิดสอน
      </h1>

      <p class="page-sub">
        ข้อมูลจากเอกสารหลักสูตรของมหาวิทยาลัยธรรมศาสตร์
      </p>

      <div class="program-grid program-grid--wide">

        ${programFamilies()
      .map(programCard)
      .join("")}

      </div>

    </div>
  `;
}

function renderCurriculumManagement() {
  if (!canManageCurricula()) return renderHome();
  const coreCurriculumIds = new Set(["BSC-CS-2566", "BSC-CNC-2568"]);
  const requests = state.draftRequests ?? [];
  const apiPrograms = (state.managementCurricula ?? [])
    .filter(curriculum => !PROGRAMS.some(program => program.curriculumId === curriculum.curriculum_id))
    .map(curriculum => {
      return {
      id: `api-${curriculum.curriculum_id}`,
      curriculumId: curriculum.curriculum_id,
      code: curriculum.title_th || curriculum.curriculum_id,
      nameEn: curriculum.title_en || "",
      revisionYear: Number(curriculum.academic_year),
      totalCredits: Number(curriculum.total_credits) || 0,
      plan: [],
      studyPlans: []
    };
    });
  const managementPrograms = [...PROGRAMS, ...apiPrograms];
  const curriculumStatus = new Map((state.managementCurricula ?? [])
    .map(item => [item.curriculum_id, Number(item.active) !== 0]));
  const warningFor = program => requests.filter(request =>
    request.curriculum_id === program.curriculumId && ["draft", "pending"].includes(request.status)
  );
  return `
    <div class="page curriculum-management-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "จัดการหลักสูตร" }])}
      <div class="management-page-head">
        <div>
          <span class="workflow-kicker">CURRICULUM MANAGEMENT</span>
          <h1 class="page-title">จัดการหลักสูตร</h1>
          <p class="page-sub">เลือกหลักสูตรเพื่อแก้ไข หรือสร้างหลักสูตรฉบับใหม่</p>
        </div>
        <button class="workflow-action workflow-action--primary management-create-button" type="button" data-go="curriculum-editor" data-id="new">+ สร้างหลักสูตรใหม่</button>
      </div>
      <section class="management-program-list">
        ${managementPrograms.map(program => {
          const courses = new Set((program.plan ?? []).flatMap(term => term.courses ?? []).filter(code => !code.startsWith("__REQ__")));
          const warnings = warningFor(program);
          const isActive = curriculumStatus.has(program.curriculumId)
            ? curriculumStatus.get(program.curriculumId)
            : true;
          const isCore = coreCurriculumIds.has(program.curriculumId);
          const visibilityAction = isActive ? "hide" : "show";
          const visibilityLabel = isActive ? "ซ่อนหลักสูตร" : "แสดงหลักสูตร";
          const extraDeleteButton = !isActive && !isCore
            ? `<button class="workflow-action workflow-action--danger" type="button" data-curriculum-visibility="delete" data-curriculum-id="${esc(program.curriculumId)}">ลบถาวร</button>`
            : "";
          return `
            <article class="management-program-card">
              <div class="management-program-main">
                <span class="management-program-year">พ.ศ. ${esc(program.revisionYear)}</span>
                <h2>${esc(program.code)}</h2>
                <p>${esc(program.nameEn)}</p>
                <div class="management-program-meta"><span>${esc(program.curriculumId)}</span><span>วิชา ${courses.size} รายการ</span><span>${isActive ? "เผยแพร่" : "ซ่อนอยู่"}</span></div>
                ${warnings.length ? `<p class="management-warning">มี ${warnings.length} รายการอยู่ในสถานะ ${warnings.some(item => item.status === "pending") ? "รอตรวจสอบ" : "ฉบับร่าง"}</p>` : ""}
              </div>
              <div class="management-program-actions"><button class="workflow-action workflow-action--primary" type="button" data-go="curriculum-editor" data-id="${esc(program.id)}">แก้ไข</button><button class="workflow-action ${isActive ? "workflow-action--danger" : "workflow-action--primary"}" type="button" data-curriculum-visibility="${visibilityAction}" data-curriculum-id="${esc(program.curriculumId)}">${visibilityLabel}</button>${extraDeleteButton}</div>
            </article>
          `;
        }).join("")}
      </section>
    </div>
  `;
}

function renderManagementPlaceholder(title, message) {
  if (!canManageCurricula()) return renderHome();
  return `
    <div class="page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: title }])}
      <section class="management-placeholder">
        <span class="workflow-kicker">CURRICULUM MANAGEMENT</span>
        <h1 class="page-title">${esc(title)}</h1>
        <p>${esc(message)}</p>
      </section>
    </div>
  `;
}

function editorCurrentProgram() {
  return state.editorProgram || PROGRAMS.find(program => program.id === state.programId) || null;
}

function initializeEditorState(id) {
  state.editorMode = id === "new" ? "new" : "edit";
  const source = id === "new"
    ? { id: "new", code: "", nameTh: "", nameEn: "", revisionYear: "", curriculumId: null, plan: [] }
    : PROGRAMS.find(program => program.id === id);
  if (!source) return false;
  state.editorProgram = { ...source, plan: state.editorMode === "new" ? [] : [...(source.plan ?? [])] };
  state.programId = source.id;
  state.year = 1;
  state.editorLoading = false;
  state.editorError = "";
  state.editorProgramLoaded = false;
  state.editorPlanId = state.editorMode === "new" ? null : (source.activeStudyPlanId ?? source.studyPlans?.[0]?.id ?? null);
  state.planEdit = {
    active: true,
    programId: source.id,
    planId: state.editorMode === "new" ? null : (source.activeStudyPlanId ?? `${source.id}-default`),
    terms: state.editorMode === "new" ? clonePlanForEditing({ plan: [] }) : clonePlanForEditing(source),
    changes: [],
    newCourses: {}
  };
  return true;
}

function restoreEditorRoute(pageState = {}) {
  if (pageState.view !== "curriculum-editor") return;
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem("cs361-editor-route") || "null");
  } catch {
    saved = null;
  }
  const id = pageState.editorId ?? saved?.id;
  if (id) initializeEditorState(id);
}

function editorAvailableCourseEntries(program) {
  if (state.curriculumCoursesLoaded && state.curriculumCourses.length) {
    const pathwayCourses = state.curriculumCourses.filter(course => !program?.pathwayId || course.pathway_id === program.pathwayId);
    return pathwayCourses.map(course => {
      const code = courseKey(course.course_code ?? course.course_id);
      return [code, COURSES[code] ?? {
        name: course.title_th ?? code,
        nameEn: course.title_en ?? "",
        credits: Number(course.credits_total ?? course.credits ?? 0),
        category: course.course_group ?? "วิชาเฉพาะ"
      }];
    }).filter(([code]) => code);
  }
  return Object.entries(COURSES);
}

async function loadEditorActivePlan(program) {
  if (!program?.curriculumId || state.editorLoading) return;
  state.editorLoading = true;
  state.editorError = "";
  try {
    const pathwayQuery = program.pathwayId ? `&pathwayId=${encodeURIComponent(program.pathwayId)}` : "";
    const [plansResponse, coursesResponse] = await Promise.all([
      fetch(`${API_BASE}/api/study-plans?curriculumId=${encodeURIComponent(program.curriculumId)}${pathwayQuery}&active=true`),
      fetch(`${API_BASE}/api/courses?curriculumId=${encodeURIComponent(program.curriculumId)}${pathwayQuery}&limit=500`)
    ]);
    if (!plansResponse.ok) throw new Error(`โหลดแผนย่อยไม่สำเร็จ (${plansResponse.status})`);
    const plansPayload = await plansResponse.json();
    const plans = plansPayload?.data ?? [];
    if (!plans.length) {
      if (program.plan?.length) {
        state.editorPlanId = program.activeStudyPlanId ?? `${program.id}-default`;
        state.editorProgram = program;
        return;
      }
      throw new Error("ไม่พบแผนการเรียนย่อยของหลักสูตรนี้");
    }
    const selectedPlanId = state.editorPlanId || program.activeStudyPlanId || plans[0].study_plan_id;
    const selectedPlan = plans.find(plan => plan.study_plan_id === selectedPlanId) || plans[0];
    state.editorPlanId = selectedPlan.study_plan_id;
    program.studyPlans = plans.map(plan => ({
      id: plan.study_plan_id,
      label: studyPlanLabel(plan.study_plan_id, plan.plan_name_th ?? plan.plan_name, plan.plan_name_en),
      plan: []
    }));
    const detailResponse = await fetch(`${API_BASE}/api/study-plans/${encodeURIComponent(selectedPlan.study_plan_id)}`);
    if (!detailResponse.ok) throw new Error(`โหลดรายวิชาในแผนย่อยไม่สำเร็จ (${detailResponse.status})`);
    const detailPayload = await detailResponse.json();
    const items = detailPayload?.data?.items ?? [];
    if (coursesResponse.ok) {
      const coursesPayload = await coursesResponse.json();
      state.curriculumCourses = coursesPayload?.data ?? [];
      state.curriculumCoursesLoaded = true;
      state.curriculumCoursesKey = `${program.curriculumId}:${program.pathwayId ?? ""}`;
      state.curriculumCourses.forEach(course => {
        const code = courseKey(course.course_code ?? course.course_id);
        if (!code) return;
        COURSES[code] = {
          ...(COURSES[code] ?? {}),
          name: course.title_th ?? COURSES[code]?.name ?? code,
          nameEn: course.title_en ?? COURSES[code]?.nameEn ?? "",
          credits: Number(course.credits_total ?? COURSES[code]?.credits ?? 0),
          category: course.course_group ?? COURSES[code]?.category ?? "วิชาเฉพาะ"
        };
      });
    }
    const grouped = new Map();
    items.forEach(item => {
      const year = Number(item.study_year);
      const term = Number(item.semester);
      if (!year || !term) return;
      const key = `${year}-${term}`;
      if (!grouped.has(key)) grouped.set(key, { year, term, courses: [] });
      const code = courseKey(item.course_code ?? item.course_id);
      if (!code) return;
      grouped.get(key).courses.push(code);
      COURSES[code] = {
        ...(COURSES[code] ?? {}),
        name: item.title_th ?? COURSES[code]?.name ?? code,
        nameEn: item.title_en ?? COURSES[code]?.nameEn ?? "",
        credits: Number(item.credits ?? item.credits_total ?? COURSES[code]?.credits ?? 0),
        category: item.course_group ?? COURSES[code]?.category ?? "วิชาเฉพาะ"
      };
    });
    if (grouped.size) program.plan = [...grouped.values()].sort((a, b) => a.year - b.year || a.term - b.term);
    program.activeStudyPlanId = selectedPlan.study_plan_id;
    state.editorProgram = program;
  } catch (error) {
    state.editorError = error.message || "โหลดแผนหลักสูตรไม่สำเร็จ";
  } finally {
    state.editorLoading = false;
  }
}

function editorCourseCount(program) {
  return (state.planEdit?.terms ?? program?.plan ?? []).reduce((count, term) => count + (term.courses ?? []).length, 0);
}

function renderEditorCurriculumHeader(program) {
  return `<section class="program-header editor-curriculum-header">${seal(program.revisionYear)}<div><div class="program-header-faculty">${esc(program.faculty ?? "คณะวิทยาศาสตร์และเทคโนโลยี")}</div><h1 class="page-title">${esc(program.code)}</h1><div class="program-header-en">${esc(program.nameEn)}</div><small class="editor-pathway-label">หลักสูตรย่อย: ${esc(studyPlanMajorLabel(program))}${program.pathwayId ? ` · ${esc(program.pathwayId)}` : ""}</small></div></section>`;
}

function renderEditorDrawer() {
  const drawer = state.editorDrawer;
  if (!drawer) return "";
  const course = COURSES[drawer.code] ?? { name: drawer.code, nameEn: "", credits: 0, category: "วิชาเฉพาะ", prereq: [] };
  const nextCourses = Object.entries(COURSES).filter(([, item]) => (item.prereq ?? []).includes(drawer.code)).map(([code]) => code);
  const prereqHtml = (course.prereq ?? []).length
    ? course.prereq.map(prereq => `<span class="editor-chip">${esc(prereq)} <button type="button" data-editor-remove-prereq="${esc(prereq)}" aria-label="ลบวิชาบังคับก่อน ${esc(prereq)}">×</button></span>`).join("")
    : `<span class="editor-drawer-hint">ยังไม่มีข้อมูลวิชาบังคับก่อน</span>`;
  const nextHtml = nextCourses.length
    ? nextCourses.map(code => `<button type="button" class="editor-related-course" data-editor-related-course="${esc(code)}">${esc(code)} — ${esc(COURSES[code]?.name ?? code)}</button>`).join("")
    : `<span class="editor-drawer-hint">ยังไม่มีรายวิชาต่อเนื่อง</span>`;
  return `<aside class="editor-drawer" aria-label="แก้รายละเอียดวิชา"><div class="editor-drawer-head"><div><span class="workflow-kicker">COURSE DETAIL</span><h2>แก้รายละเอียดวิชา</h2></div><button type="button" class="editor-drawer-close" data-editor-drawer-close>×</button></div><form data-editor-course-form><label>รหัสวิชา<input name="code" value="${esc(drawer.code)}" required></label><label>ชื่อภาษาไทย<input name="name" value="${esc(course.name ?? "")}" required></label><label>ชื่อภาษาอังกฤษ<input name="nameEn" value="${esc(course.nameEn ?? "")}"></label><label>หน่วยกิต<input name="credits" type="number" min="0" value="${esc(course.credits ?? 0)}" required></label><label>กลุ่มวิชา<select name="category"><option ${course.category === "วิชาเฉพาะ" ? "selected" : ""}>วิชาเฉพาะ</option><option ${course.category === "วิชาศึกษาทั่วไป" ? "selected" : ""}>วิชาศึกษาทั่วไป</option><option ${course.category === "วิชาเลือกเสรี" ? "selected" : ""}>วิชาเลือกเสรี</option><option ${course.category === "วิชาสหกิจศึกษา" ? "selected" : ""}>วิชาสหกิจศึกษา</option></select></label><div class="editor-drawer-section"><h3>วิชาบังคับก่อน</h3><div class="editor-chip-list">${prereqHtml}</div><button type="button" class="workflow-action workflow-action--muted" data-editor-add-prereq>+ เพิ่มวิชาบังคับก่อน</button></div><div class="editor-drawer-section"><h3>วิชาที่เรียนต่อได้</h3><div class="editor-related-list">${nextHtml}</div></div><div class="editor-drawer-actions"><button type="button" class="workflow-action workflow-action--muted" data-editor-drawer-close>ยกเลิก</button><button type="submit" class="workflow-action workflow-action--primary">ตกลง</button></div></form></aside>`;
}

function renderEditorCopyModal() {
  const copy = state.editorCopy;
  if (!copy) return "";
  const source = PROGRAMS.find(program => program.id === copy.sourceId) || PROGRAMS[0];
  const sourceQuery = norm(copy.sourceQuery ?? "");
  const sourceOptions = PROGRAMS.filter(program => norm(`${program.code} ${program.nameEn} ${program.curriculumId} ${program.pathwayId ?? ""}`).includes(sourceQuery));
  const sourcePlans = source?.studyPlans ?? [];
  const selectedSourcePlan = sourcePlans.find(plan => plan.id === (copy.sourcePlanId || source.activeStudyPlanId)) || sourcePlans[0];
  const sourcePlanId = selectedSourcePlan?.id || source?.activeStudyPlanId;
  let previewTerms = selectedSourcePlan?.plan ?? source?.plan ?? [];
  if (copy.level === "year") previewTerms = previewTerms.filter(term => term.year === Number(copy.year));
  if (copy.level === "term") previewTerms = previewTerms.filter(term => term.year === Number(copy.year) && term.term === Number(copy.term));
  const preview = previewTerms.flatMap(term => term.courses ?? []);
  const planOptions = sourcePlans.length ? `<div class="editor-copy-plan-list"><strong>แผนย่อยต้นทาง</strong>${sourcePlans.map(plan => `<button type="button" class="editor-source-option ${plan.id === sourcePlanId ? "editor-source-option--active" : ""}" data-editor-copy-plan-choice="${esc(plan.id)}"><strong>${esc(plan.label)}</strong><small>${esc(plan.id)}</small></button>`).join("")}</div>` : `<p class="editor-drawer-hint">หลักสูตรนี้มีแผนหลักเดียว</p>`;
  return `<div class="editor-modal-backdrop" data-editor-copy-close><section class="editor-copy-modal" role="dialog" aria-modal="true" data-editor-copy-dialog><div class="editor-drawer-head"><div><span class="workflow-kicker">COPY FROM ACTIVE VERSION</span><h2>คัดลอกจากหลักสูตรอื่น</h2><p class="editor-drawer-hint">เลือกหลักสูตรย่อยและแผนย่อยต้นทาง แล้วตรวจตัวอย่างก่อนยืนยัน</p></div><button type="button" class="editor-drawer-close" data-editor-copy-close>×</button></div><label>ค้นหาหลักสูตรต้นทาง<input type="search" data-editor-copy-source-search value="${esc(copy.sourceQuery ?? "")}" placeholder="ค้นหาชื่อ รหัส หรือสาขา"></label><div class="editor-source-list">${sourceOptions.length ? sourceOptions.map(program => `<button type="button" class="editor-source-option ${program.id === copy.sourceId ? "editor-source-option--active" : ""}" data-editor-copy-source-choice="${esc(program.id)}"><strong>${esc(program.code)}</strong><span>พ.ศ. ${esc(program.revisionYear)} · ${esc(studyPlanMajorLabel(program))}</span><small>${esc(program.curriculumId)}${program.pathwayId ? ` · ${esc(program.pathwayId)}` : ""}</small></button>`).join("") : `<span class="editor-drawer-hint">ไม่พบหลักสูตรต้นทาง</span>`}</div>${planOptions}${copy.level !== "curriculum" ? `<div class="editor-copy-scope"><span>ขอบเขต: ${copy.level === "year" ? `ปี ${copy.year}` : `ปี ${copy.year} ภาค ${copy.term}`}</span></div>` : ""}<div class="editor-copy-preview"><strong>ตัวอย่าง ${preview.length} รายวิชา</strong>${preview.map(code => `<span>${esc(code)} — ${esc(COURSES[code]?.name ?? code)}</span>`).join("")}</div><label>ถ้าปลายทางมีวิชาอยู่แล้ว<select data-editor-copy-mode><option value="append">เพิ่มต่อท้าย (ข้ามที่ซ้ำ)</option><option value="replace">แทนที่ทั้งหมด</option></select></label><div class="editor-drawer-actions"><button type="button" class="workflow-action workflow-action--muted" data-editor-copy-close>ยกเลิก</button><button type="button" class="workflow-action workflow-action--primary" data-editor-copy-confirm ${preview.length ? "" : "disabled"}>ยืนยันคัดลอก</button></div></section></div>`;
}

function renderEditorTermCard(program, term) {
  const courses = term.courses ?? [];
  const total = courses.reduce((sum, code) => sum + (code === "FREE3" ? 3 : (COURSES[code]?.credits ?? 0)), 0);
  const searchReady = state.editorMode === "new" || state.editorProgramLoaded;
  const searchValue = state.editorSearch?.year === term.year && state.editorSearch?.term === term.term ? state.editorSearch.value : "";
  return `
    <article class="term-card editor-term-card">
      <div class="term-card-head">
        <span>${term.term === 3 ? "ภาคฤดูร้อน" : `ภาคการศึกษาที่ ${term.term}`}</span>
        <span class="term-card-credits">${total ? `${total} นก.` : "ยังไม่มีวิชา"}</span>
        <button class="term-copy-button" type="button" data-editor-copy-level="term" data-year="${term.year}" data-term="${term.term}">คัดลอกภาคนี้จาก...</button>
      </div>
      <div class="term-course-list">
        ${courses.length ? courses.map(code => {
          const course = COURSES[code] ?? { name: "รายวิชาตามเอกสารหลักสูตร", credits: 0 };
          const change = editorChangeFor(program, code, term.year, term.term);
          const removed = change?.action === "remove";
          const moved = change?.action === "move";
          const added = change?.action === "add";
          const copiedFrom = change?.copiedFrom;
          return `<div class="term-course-row editor-course-row ${removed ? "plan-course--removed" : ""} ${moved ? "plan-course--moved" : ""} ${added ? "plan-course--added" : ""}">
            <button class="editor-course-main" type="button" data-editor-course="${esc(code)}">${courseCode(code)}<span class="term-course-name">${esc(course.name)}</span><span class="term-course-cr">${course.credits ?? 0} นก.</span>${added ? `<em class="plan-change-badge plan-change-badge--added">ใหม่</em>` : ""}${moved ? `<em class="plan-change-badge plan-change-badge--moved">ย้ายจากปี ${change.fromYear} ภาค ${change.fromTerm}</em>` : ""}${copiedFrom ? `<em class="plan-change-badge plan-change-badge--moved">คัดลอกจาก ${esc(copiedFrom)}</em>` : ""}</button>
            <details class="editor-course-menu"><summary aria-label="เมนูวิชา">⋮</summary><div class="editor-course-menu-popover">${removed ? `<button type="button" data-plan-undo-delete data-code="${esc(code)}" data-year="${term.year}" data-term="${term.term}">ยกเลิกการลบ</button>` : `<button type="button" data-editor-course-detail="${esc(code)}">แก้รายละเอียด</button><label>ย้ายไป<select data-plan-move-target="${esc(code)}" data-year="${term.year}" data-term="${term.term}"><option value="">เลือกปี/ภาค</option>${[1, 2, 3, 4].flatMap(year => [1, 2, 3].map(targetTerm => `<option value="${year}-${targetTerm}">ปี ${year} ภาค ${targetTerm === 3 ? "ซัมเมอร์" : targetTerm}</option>`)).join("")}</select></label><button type="button" data-plan-delete data-code="${esc(code)}" data-year="${term.year}" data-term="${term.term}">ลบ</button>`}</div></details>
          </div>`;
        }).join("") : `<div class="editor-empty-term">ยังไม่มีวิชา</div>`}
        ${state.planEdit.changes.filter(change => change.action === "move" && change.fromYear === term.year && change.fromTerm === term.term).map(change => `<div class="term-course-row plan-course--moved-away"><span class="course-code">${esc(change.code)}</span><span class="term-course-name">ย้ายไปปี ${change.toYear} ภาค ${change.toTerm}</span><span class="term-course-cr">เดิม</span></div>`).join("")}
      </div>
      <div class="editor-add-course"><input type="text" data-plan-search data-year="${term.year}" data-term="${term.term}" value="${esc(searchValue)}" placeholder="${searchReady ? "ค้นหารหัสหรือชื่อวิชา" : "กำลังโหลดรายการวิชา..."}"><div class="plan-search-results" data-plan-results="${term.year}-${term.term}"></div><button class="plan-add-button" type="button" data-plan-add data-year="${term.year}" data-term="${term.term}">+ เพิ่มวิชาจาก Catalog</button></div>
    </article>
  `;
}

function renderCurriculumEditor() {
  if (!canManageCurricula()) return renderHome();
  const program = editorCurrentProgram();
  const isNew = state.editorMode === "new";
  if (!program) return renderManagementPlaceholder("ตัวแก้ไขหลักสูตร", "ไม่พบหลักสูตรที่เลือก");
  const editing = Boolean(state.planEdit?.active);
  const terms = state.planEdit?.terms ?? [];
  const years = [1, 2, 3, 4];
  const visibleTerms = terms.filter(term => term.year === state.year);
  const statsCredits = terms.reduce((sum, term) => sum + term.courses.reduce((subtotal, code) => subtotal + (COURSES[code]?.credits ?? 0), 0), 0);
  return `
    <div class="page curriculum-editor-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "จัดการหลักสูตร", view: "curriculum-management" }, { label: "ตัวแก้ไขหลักสูตร" }])}
      ${renderEditorCurriculumHeader(program)}
      <div class="editor-topbar">
        <div><span class="workflow-kicker">CURRICULUM EDITOR</span><h1 class="page-title">${isNew ? "สร้างหลักสูตรใหม่" : "แก้ไขหลักสูตร"}</h1><p class="page-sub">${isNew ? "สร้างฉบับร่างใหม่โดยยังไม่กระทบข้อมูลจริง" : `${esc(program.nameEn ?? program.code)} · ${esc(program.curriculumId)}`}</p></div>
        <div class="editor-topbar-actions"><button class="workflow-action workflow-action--muted" type="button" data-go="curriculum-management">กลับไปจัดการหลักสูตร</button><button class="workflow-action workflow-action--muted" type="button" data-editor-copy-level="curriculum">คัดลอกจากหลักสูตรอื่น</button></div>
      </div>
      <section class="editor-header-card">
        ${isNew ? `<label>รหัสหลักสูตร<input data-editor-field="curriculumId" placeholder="เช่น BSC-CS-2569" value="${esc(program.curriculumId ?? "")}"></label><label>ปีหลักสูตร<input data-editor-field="academicYear" type="number" value="${esc(program.revisionYear ?? "")}"></label><label>ชื่อหลักสูตรภาษาไทย<input data-editor-field="titleTh" placeholder="เช่น วท.บ. วิทยาการคอมพิวเตอร์" value="${esc(program.nameTh ?? program.code ?? "")}"></label><label>ชื่อหลักสูตรภาษาอังกฤษ<input data-editor-field="titleEn" placeholder="เช่น Computer Science" value="${esc(program.nameEn ?? "")}"></label>` : `<div><small>หลักสูตร</small><strong>${esc(program.code)}</strong></div><div><small>รหัส</small><strong>${esc(program.curriculumId)}</strong></div><div><small>ปีหลักสูตร</small><strong>พ.ศ. ${esc(program.revisionYear)}</strong></div><label><small>แผนย่อยที่กำลังแก้ไข</small><select data-editor-plan-select>${(program.studyPlans ?? []).map(plan => `<option value="${esc(plan.id)}" ${plan.id === state.editorPlanId ? "selected" : ""}>${esc(plan.label)}</option>`).join("")}</select></label>`}
      </section>
      ${state.editorLoading ? `<section class="editor-state-card">กำลังโหลดแผนการเรียน...</section>` : ""}
      ${state.editorError ? `<section class="editor-state-card editor-state-card--error">${esc(state.editorError)} <button type="button" data-editor-retry>ลองใหม่</button></section>` : ""}
      <div class="study-plan-stats editor-stats"><div class="study-plan-stat"><span class="study-plan-stat-icon">▤</span><span><small>รายวิชา/ข้อกำหนด</small><strong>${editorCourseCount(program)} รายการ</strong></span></div><div class="study-plan-stat"><span class="study-plan-stat-icon">▦</span><span><small>จำนวนปี</small><strong>4 ปี</strong></span></div><div class="study-plan-stat"><span class="study-plan-stat-icon">▥</span><span><small>จำนวนภาคการศึกษา</small><strong>12 ภาค</strong></span></div><div class="study-plan-stat"><span class="study-plan-stat-icon">▣</span><span><small>หน่วยกิตทั้งหมด</small><strong>${statsCredits} หน่วยกิต</strong></span></div></div>
      <div class="editor-year-tabs">${years.map(year => `<button class="year-tab ${state.year === year ? "year-tab--active" : ""}" data-year="${year}">ชั้นปีที่ ${year}<span class="editor-year-copy" data-editor-copy-level="year" data-year="${year}">คัดลอกปีนี้จาก...</span></button>`).join("")}</div>
      <div class="editor-term-grid">${visibleTerms.map(term => renderEditorTermCard(program, term)).join("")}</div>
      ${state.planEdit?.changes?.length ? `<div class="editor-sticky-bar"><strong>มีการเปลี่ยนแปลง ${state.planEdit.changes.length} รายการ</strong><button type="button" class="workflow-action workflow-action--muted" data-plan-summary>ดูสรุปการเปลี่ยนแปลง</button><button type="button" class="workflow-action workflow-action--muted" data-plan-save>บันทึกฉบับร่าง</button><button type="button" class="workflow-action workflow-action--primary" data-plan-submit>ส่งขออนุมัติ</button><button type="button" class="workflow-action workflow-action--danger" data-editor-cancel>ยกเลิก</button></div>` : ""}
      ${renderEditorDrawer()}
      ${renderEditorCopyModal()}
    </div>
  `;
}

function renderCourseEditor() {
  if (!canManageCurricula()) return renderHome();
  const code = state.courseEditorCourseId;
  const course = COURSES[code];
  const program = editorCurrentProgram() || PROGRAMS[0];
  if (!code) {
    const query = norm(state.courseEditorQuery ?? "");
    const entries = Object.entries(COURSES).filter(([itemCode, item]) => norm(`${itemCode} ${item.name} ${item.nameEn ?? ""}`).includes(query)).slice(0, 30);
    return `<div class="page course-editor-page">${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "แก้ไขรายวิชา" }])}<div class="editor-topbar"><div><span class="workflow-kicker">COURSE MANAGEMENT</span><h1 class="page-title">แก้ไขรายวิชา</h1><p class="page-sub">แก้เฉพาะข้อมูลรายวิชา ไม่กระทบแผนการเรียนทั้งหลักสูตร</p></div><div class="editor-topbar-actions"><button type="button" class="workflow-action workflow-action--primary" data-create-course-standalone>+ สร้างรายวิชาใหม่</button><button type="button" class="workflow-action workflow-action--muted" data-go="curriculum-management">กลับไปจัดการหลักสูตร</button></div></div><section class="course-picker-card"><label>ค้นหารายวิชา<input type="search" data-course-editor-search value="${esc(state.courseEditorQuery ?? "")}" placeholder="พิมพ์รหัสหรือชื่อวิชา"></label><div class="course-picker-list">${entries.length ? entries.map(([itemCode, item]) => `<div class="course-picker-row"><button type="button" class="course-picker-row-main" data-course-editor-open="${esc(itemCode)}"><span><strong>${esc(itemCode)}</strong><span>${esc(item.name ?? "-")}</span><small>${esc(item.nameEn ?? "")} · ${esc(item.credits ?? 0)} หน่วยกิต</small></span><span>แก้ไข</span></button>${item.createdCourse ? `<button type="button" class="workflow-action workflow-action--danger" data-course-delete="${esc(itemCode)}">ลบวิชา</button>` : ""}</div>`).join("") : `<p class="audit-empty">ไม่พบรายวิชา</p>`}</div></section></div>`;
  }
  if (!course || !program) return renderManagementPlaceholder("แก้ไขรายวิชา", "ไม่พบรายวิชาที่เลือก");
  const nextCourses = Object.entries(COURSES).filter(([, item]) => (item.prereq ?? []).includes(code)).map(([nextCode]) => nextCode);
  const prereq = course.prereq ?? [];
  return `
    <div class="page course-editor-page">
      ${crumbs([{ label: "หน้าแรก", view: "home" }, { label: "จัดการหลักสูตร", view: "curriculum-management" }, { label: "ตัวแก้ไขหลักสูตร", view: "curriculum-editor", id: program.id }, { label: "แก้ไขรายวิชา" }])}
      ${renderEditorCurriculumHeader(program)}
      <div class="editor-topbar">
        <div><span class="workflow-kicker">COURSE EDITOR</span><h1 class="page-title">แก้เฉพาะวิชา</h1><p class="page-sub">${esc(code)} · ${esc(course.name ?? "")} · แก้ในฉบับร่างของ ${esc(program.curriculumId)}</p></div>
        <div class="editor-topbar-actions"><button type="button" class="workflow-action workflow-action--muted" data-course-editor-back>${state.courseEditorStandalone ? "กลับไปค้นหารายวิชา" : "กลับไปตัวแก้ไขหลักสูตร"}</button></div>
      </div>
      <section class="course-editor-layout">
        <form class="course-editor-form" data-course-editor-form>
          <div class="course-editor-form-head"><div><span class="workflow-kicker">EDIT ONE COURSE</span><h2>รายละเอียดรายวิชา</h2></div><span class="course-editor-draft-note">ยังไม่บันทึกลงข้อมูลจริง</span></div>
          <label>รหัสวิชา<input name="code" value="${esc(code)}" required></label>
          <label>ชื่อภาษาไทย<input name="name" value="${esc(course.name ?? "")}" required></label>
          <label>ชื่อภาษาอังกฤษ<input name="nameEn" value="${esc(course.nameEn ?? "")}"></label>
          <label>หน่วยกิต<input name="credits" type="number" min="0" value="${esc(course.credits ?? 0)}" required></label>
          <label>กลุ่มวิชา<select name="category"><option ${course.category === "วิชาเฉพาะ" ? "selected" : ""}>วิชาเฉพาะ</option><option ${course.category === "วิชาศึกษาทั่วไป" ? "selected" : ""}>วิชาศึกษาทั่วไป</option><option ${course.category === "วิชาเลือกเสรี" ? "selected" : ""}>วิชาเลือกเสรี</option><option ${course.category === "วิชาสหกิจศึกษา" ? "selected" : ""}>วิชาสหกิจศึกษา</option></select></label>
          <section class="course-editor-section"><h3>วิชาบังคับก่อน</h3><div class="editor-chip-list">${prereq.length ? prereq.map(item => `<span class="editor-chip">${esc(item)} <button type="button" data-course-editor-remove-prereq="${esc(item)}">×</button></span>`).join("") : `<span class="editor-drawer-hint">ยังไม่มีข้อมูล</span>`}</div><button type="button" class="workflow-action workflow-action--muted" data-course-editor-add-prereq>+ เพิ่มวิชาบังคับก่อน</button></section>
          <section class="course-editor-section"><h3>วิชาที่เรียนต่อได้</h3><div class="editor-related-list">${nextCourses.length ? nextCourses.map(item => `<button type="button" class="editor-related-course" data-course-editor-related="${esc(item)}">${esc(item)} — ${esc(COURSES[item]?.name ?? item)}</button>`).join("") : `<span class="editor-drawer-hint">ยังไม่มีรายวิชาต่อเนื่อง</span>`}</div></section>
          <div class="editor-drawer-actions">${state.courseEditorStandalone ? "" : `<button type="button" class="workflow-action workflow-action--danger" data-course-editor-delete>ลบวิชานี้</button>`}<button type="button" class="workflow-action workflow-action--muted" data-course-editor-back>ยกเลิก</button><button type="submit" class="workflow-action workflow-action--primary">${state.courseEditorStandalone ? "ส่งขออนุมัติการแก้ไขวิชา" : "บันทึกการแก้ไขวิชา"}</button></div>
        </form>
      </section>
    </div>
  `;
}


/* =========================================================
   PROGRAM DETAIL
   ========================================================= */

function isPlanEditing(program) {
  return Boolean(state.planEdit?.active && state.planEdit.programId === program.id);
}

function clonePlanForEditing(program) {
  const terms = (program.plan ?? []).map(term => ({
    year: Number(term.year),
    term: Number(term.term),
    courses: [...(term.courses ?? [])]
  }));
  for (let year = 1; year <= 4; year += 1) {
    for (let term = 1; term <= 3; term += 1) {
      if (!terms.some(item => item.year === year && item.term === term)) {
        terms.push({ year, term, courses: [] });
      }
    }
  }
  return terms.sort((a, b) => a.year - b.year || a.term - b.term);
}

function startPlanEditing(program) {
  state.planEdit = {
    active: true,
    programId: program.id,
    planId: program.activeStudyPlanId ?? `${program.id}-default`,
    terms: clonePlanForEditing(program),
    changes: [],
    newCourses: {}
  };
  state.programTab = "plan";
  render();
}

function editorChangeFor(program, code, year, term) {
  if (!isPlanEditing(program)) return null;
  return state.planEdit.changes.find(change =>
    change.code === code &&
    ((change.action === "remove" && change.year === year && change.term === term) ||
      (change.action === "add" && change.year === year && change.term === term) ||
      (change.action === "move" && change.toYear === year && change.toTerm === term) ||
      (change.action === "edit" && change.year === year && change.term === term) ||
      (change.action === "prereq" && change.year === year && change.term === term))
  );
}

function editorChangeCount(program) {
  return isPlanEditing(program) ? state.planEdit.changes.length : 0;
}

function editorTotalCredits(plan) {
  return plan.reduce((total, term) => total + term.courses.reduce((subtotal, code) => {
    return subtotal + (COURSES[code]?.credits ?? (code === "FREE3" ? 3 : 0));
  }, 0), 0);
}

function draftCourseCode(code) {
  const value = String(code ?? "");
  return value.startsWith("__REQ__") ? null : value;
}

function apiTerm(value) {
  return Number(value) === 3 ? "S" : String(value ?? "");
}

function editorChangeItems(program) {
  const createdCourseItems = Object.entries(state.planEdit.newCourses ?? {}).map(([code, course]) => ({
    action: "CREATE_COURSE",
    courseCode: code,
    newValue: course
  }));
  const items = state.planEdit.changes.map(change => {
    const courseCodeValue = draftCourseCode(change.code);
    if (change.action === "move") {
      return { action: "MOVE_COURSE", courseCode: courseCodeValue, studyYear: change.fromYear, term: apiTerm(change.fromTerm), oldValue: { year: change.fromYear, term: apiTerm(change.fromTerm) }, newValue: { year: change.toYear, term: apiTerm(change.toTerm), requirementText: courseCodeValue ? null : String(change.code).replace(/^__REQ__/, "") } };
    }
    if (change.action === "remove") {
      return { action: "REMOVE_COURSE", courseCode: courseCodeValue, studyYear: change.year, term: apiTerm(change.term), oldValue: { year: change.year, term: apiTerm(change.term), requirementText: courseCodeValue ? null : String(change.code).replace(/^__REQ__/, "") } };
    }
    if (change.action === "edit") {
      return { action: "EDIT_FIELD", courseCode: courseCodeValue, studyYear: change.year, term: apiTerm(change.term), oldValue: change.oldValue, newValue: change.newValue };
    }
    if (change.action === "prereq") {
      return { action: change.newValue?.removePrerequisite ? "REMOVE_PREREQ" : "ADD_PREREQ", courseCode: courseCodeValue, studyYear: change.year, term: apiTerm(change.term), newValue: change.newValue };
    }
    return { action: "ADD_COURSE", courseCode: courseCodeValue, studyYear: change.year, term: apiTerm(change.term), newValue: { year: change.year, term: apiTerm(change.term), planId: state.editorPlanId, requirementText: courseCodeValue ? null : String(change.code).replace(/^__REQ__/, "") } };
  });
  if (state.editorMode === "new") {
    items.unshift({
      action: "CREATE_CURRICULUM",
      newValue: {
        curriculumId: program.curriculumId,
        academicYear: Number(program.revisionYear),
        title: program.code,
        titleTh: program.nameTh ?? program.code,
        titleEn: program.nameEn ?? ""
      }
    });
  }
  return [...createdCourseItems, ...items];
}

async function savePlanDraft(program, submit = false) {
  if (!isPlanEditing(program) || !state.planEdit.changes.length) return;
  const longCourse = state.planEdit.changes.find(change => {
    const code = draftCourseCode(change.code);
    return code && code.length > 30;
  });
  if (longCourse) throw new Error(`รหัสวิชายาวเกิน 30 ตัวอักษร: ${longCourse.code}`);
  if (state.editorMode === "new") {
    const curriculumId = document.querySelector('[data-editor-field="curriculumId"]')?.value.trim();
    const academicYear = Number(document.querySelector('[data-editor-field="academicYear"]')?.value);
    const titleTh = document.querySelector('[data-editor-field="titleTh"]')?.value.trim();
    const titleEn = document.querySelector('[data-editor-field="titleEn"]')?.value.trim();
    if (!curriculumId || !/^BSC-[A-Z0-9-]+$/i.test(curriculumId) || !Number.isInteger(academicYear) || !titleTh || !titleEn) {
      throw new Error("กรุณากรอกรหัสหลักสูตร ปีหลักสูตร และชื่อหลักสูตรทั้งภาษาไทย/อังกฤษให้ครบ");
    }
    program.curriculumId = curriculumId;
    program.revisionYear = academicYear;
    program.code = titleTh;
    program.nameTh = titleTh;
    program.nameEn = titleEn;
  }
  let requestId = state.editingDraftRequestId;
  if (!requestId) {
    const createResponse = await fetch(`${API_BASE}/api/change-requests`, {
      method: "POST",
      headers: draftApiHeaders(),
      body: JSON.stringify({ curriculumId: state.editorMode === "new" ? null : program.curriculumId, type: state.editorMode === "new" ? "add_curriculum" : "edit_structure", sourceCurriculumId: null, title: state.editorMode === "new" ? `สร้างหลักสูตร ${program.curriculumId}` : `แก้ไขแผนการเรียน ${program.code}`, note: `แก้ไข ${state.planEdit.changes.length} รายการ` })
    });
    const created = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok || !created.data?.id) throw new Error(created.error ?? "สร้างฉบับร่างไม่สำเร็จ");
    requestId = created.data.id;
  }
  const itemsResponse = await fetch(`${API_BASE}/api/change-requests/${requestId}/items`, {
    method: "PUT",
    headers: draftApiHeaders(),
    body: JSON.stringify({ items: editorChangeItems(program) })
  });
  const saved = await itemsResponse.json().catch(() => ({}));
  if (!itemsResponse.ok) throw new Error(saved.error ?? "บันทึกรายการแก้ไขไม่สำเร็จ");
  if (submit) {
    const submitResponse = await fetch(`${API_BASE}/api/change-requests/${requestId}/submit`, { method: "POST", headers: draftApiHeaders(), body: "{}" });
    const submitted = await submitResponse.json().catch(() => ({}));
    if (!submitResponse.ok) throw new Error(submitted.error ?? "ส่งขออนุมัติไม่สำเร็จ");
  }
  state.draftRequestsLoaded = false;
  await loadDraftChangeRequests();
  state.planEdit = null;
  state.editingDraftRequestId = null;
  alert(submit ? "ส่งขออนุมัติแล้ว" : "บันทึกฉบับร่างแล้ว");
  render();
}

function renderProgram() {

  const p =
    PROGRAMS.find(
      x => x.id === state.programId
    ) || PROGRAMS[0];

  const editing = false;
  const visiblePlan = p.plan ?? [];


  const years = [
    ...new Set(
      visiblePlan.map(t => t.year)
    )
  ];


  if (!years.includes(state.year)) {
    state.year = years[0];
  }


  const terms = visiblePlan.filter(t => t.year === state.year);
  const termSlots = editing
    ? [1, 2, 3].map(term => terms.find(item => item.term === term) ?? { year: state.year, term, courses: [] })
    : terms;
  const curriculumStructure = Array.isArray(p.structure) ? p.structure : [];
  const totalCredits = Number(p.totalCredits) || visiblePlan.reduce((sum, term) =>
    sum + (term.courses ?? []).reduce((termSum, code) => termSum + (COURSES[code]?.credits ?? (code === "FREE3" ? 3 : 0)), 0), 0);


  let content = "";

  const studyPlanChoices = (p.studyPlans?.length
    ? p.studyPlans
    : [{ id: `${p.id}-default`, label: "แผนหลัก", plan: p.plan }]
  ).map(plan => ({
    id: plan.id,
    label: `${studyPlanMajorLabel(p)} — ${plan.label}`,
    programId: p.id
  }));

  const versions = programVersions(p);
  const curriculumYears = versions.map(version => version.revisionYear);

  const activePlanId = p.activeStudyPlanId || `${p.id}-default`;
  const planCourses = visiblePlan.flatMap(term => term.courses ?? []);
  const planCredits = visiblePlan.reduce((total, term) => total + term.courses.reduce((subtotal, code) => {
    if (editing && editorChangeFor(p, code, term.year, term.term)?.action === "remove") return subtotal;
    if (code === "FREE3") return subtotal + 3;
    return subtotal + (COURSES[code]?.credits ?? 0);
  }, 0), 0);
  const basePlanCredits = editorTotalCredits(p.plan ?? []);
  const creditDelta = editing ? planCredits - basePlanCredits : 0;
  const activeCourseCount = visiblePlan.reduce((count, term) => count + term.courses.filter(code => !editing || editorChangeFor(p, code, term.year, term.term)?.action !== "remove").length, 0);
  const baseCourseCount = (p.plan ?? []).reduce((count, term) => count + (term.courses ?? []).length, 0);
  const courseDelta = editing ? activeCourseCount - baseCourseCount : 0;
  const creditDeltaLabel = editing && creditDelta !== 0
    ? ` <small class="plan-stat-delta">(${creditDelta > 0 ? "+" : ""}${creditDelta})</small>`
    : "";
  const courseDeltaLabel = editing && courseDelta !== 0
    ? ` <small class="plan-stat-delta">(${courseDelta > 0 ? "+" : ""}${courseDelta})</small>`
    : "";


  /* -------------------------
     OVERVIEW
     ------------------------- */

  if (
    state.programTab === "overview"
  ) {

    content = `
      <div class="panel">

        <p class="program-summary">
          ${esc(p.summary || "ข้อมูลหลักสูตรและแผนการเรียน")}
        </p>


        <div class="stat-row">

          <div class="stat-box">

            <div class="stat-num">
              ${totalCredits || "—"}
            </div>

            <div class="stat-label">
              หน่วยกิตรวม
            </div>

          </div>


          <div class="stat-box">

            <div class="stat-num">
              4
            </div>

            <div class="stat-label">
              ปีการศึกษา
            </div>

          </div>


          <div class="stat-box">

            <div class="stat-num">
              ${years.length}
            </div>

            <div class="stat-label">
              ชั้นปีในแผน
            </div>

          </div>

        </div>


        <h3 class="panel-subhead">
          โครงสร้างหน่วยกิต
        </h3>


        <div class="structure">

          ${curriculumStructure.length
        ? curriculumStructure
        .map(
          s => `
                <div class="structure-row">

                  <div class="structure-label">
                    ${esc(s.label)}
                  </div>

                  <div class="structure-track">

                    <div
                      class="structure-fill"
                      style="width:${(s.credits /
              (totalCredits || 1)) *
            100
            }%"
                    ></div>

                  </div>

                  <div class="structure-value">
                    ${s.credits} นก.
                  </div>

                </div>
              `
        )
        .join("")
        : `<p class="audit-empty">ดูรายวิชาของหลักสูตรนี้ได้ที่แท็บ “แผนการเรียน”</p>`}

        </div>

      </div>
    `;
  }


  /* -------------------------
     STUDY PLAN
     ------------------------- */

  else if (
    state.programTab === "plan"
  ) {

    content = `
      <div class="panel">

        <div class="study-plan-heading">
          <div class="study-plan-heading-row">
            <div>
              <h2>${esc(studyPlanMajorLabel(p))} — ${esc(p.studyPlans?.find(plan => plan.id === activePlanId)?.label ?? "แผนหลัก")}</h2>
              <p>แผนการศึกษาจากหลักสูตรปรับปรุง พ.ศ. ${esc(p.revisionYear)}</p>
            </div>
          </div>
        </div>

        <div class="study-plan-picker" aria-label="เลือกแผนการเรียนและปีหลักสูตร">
          <div class="study-plan-picker-field">
            <span class="curriculum-selector-icon">▣</span>
            <label for="studyPlanSelect">
              แผนการเรียนที่เลือก
              <select id="studyPlanSelect" class="curriculum-select" data-study-plan-select>
                ${studyPlanChoices.map(choice => `
                  <option value="${esc(choice.id)}" ${choice.id === activePlanId ? "selected" : ""}>
                    ${esc(choice.label)}
                  </option>
                `).join("")}
              </select>
            </label>
          </div>
          <div class="study-plan-picker-field">
            <span class="curriculum-selector-icon">◷</span>
            <label for="curriculumYearSelect">
              ปีหลักสูตร
              <select id="curriculumYearSelect" class="curriculum-select" data-curriculum-year>
                ${curriculumYears.map(year => `
                  <option value="${year}" ${year === p.revisionYear ? "selected" : ""}>${year}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </div>

        <div class="study-plan-stats">
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▤</span>
            <span><small>รายวิชา/ข้อกำหนด</small><strong>${activeCourseCount} รายการ${courseDeltaLabel}</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▦</span>
            <span><small>จำนวนปี</small><strong>${years.length} ปี</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▥</span>
            <span><small>จำนวนภาคการศึกษา</small><strong>${visiblePlan.length} ภาค</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▣</span>
            <span><small>จำนวนหน่วยกิตทั้งหมด</small><strong>${planCredits} หน่วยกิต${creditDeltaLabel}</strong></span>
          </div>
        </div>

        ${years.length ? `<div class="year-tabs">

          ${years
        .map(
          y => `
                <button
                  class="year-tab ${state.year === y
              ? "year-tab--active"
              : ""
            }"
                  data-year="${y}"
                >
                  ชั้นปีที่ ${y}
                </button>
              `
        )
        .join("")}

        </div>` : ""}


        ${termSlots.length ? `<div class="term-grid">

          ${termSlots
        .map(t => {

          let total = 0;

          t.courses.forEach(code => {

            const courseChange = editorChangeFor(p, code, t.year, t.term);
            if (courseChange?.action === "remove") return;

            if (
              COURSES[code]
            ) {
              total +=
                COURSES[code].credits;
            }

          });


          return `
                <div class="term-card">

                  <div class="term-card-head">

                    <span>
                      ${t.term === 3
              ? "ภาคฤดูร้อน"
              : `ภาคการศึกษาที่ ${t.term}`
            }
                    </span>

                    <span class="term-card-credits">
                      ${total ||
            "ตามรายวิชาเลือก"
            }
                      ${total
              ? " นก."
              : ""
            }
                    </span>

                  </div>


                  <div class="term-course-list">

                    ${t.courses
              .map(code => {
                const change = editorChangeFor(p, code, t.year, t.term);
                const removed = change?.action === "remove";
                const added = change?.action === "add";
                const moved = change?.action === "move";

                if (code.startsWith("__REQ__")) {
                  return `
                    <div class="term-course-row term-course-row--requirement">
                      <span class="course-code">เลือก</span>
                      <span class="term-course-name">${esc(code.slice("__REQ__".length))}</span>
                      <span class="term-course-cr">ข้อกำหนด</span>
                    </div>
                  `;
                }

                if (
                  code ===
                  "FREE3"
                ) {

                  return `
                            <div class="term-course-row">

                              <span class="course-code">
                                FREE
                              </span>

                              <span class="term-course-name">
                                วิชาเลือกเสรี
                              </span>

                              <span class="term-course-cr">
                                3 นก.
                              </span>

                            </div>
                          `;
                }


                const c =
                  COURSES[code];


                if (!c) {

                  return `
                            <div class="term-course-row">

                              ${courseCode(
                    code
                  )}

                              <span class="term-course-name">
                                รายวิชาตามเอกสารหลักสูตร
                              </span>

                              <span class="term-course-cr">
                                –
                              </span>

                            </div>
                          `;
                }


                if (editing) {
                  return `
                          <div class="term-course-row plan-edit-course-row ${removed ? "plan-course--removed" : ""} ${added ? "plan-course--added" : ""} ${moved ? "plan-course--moved" : ""}">
                            <button class="plan-course-main" type="button" data-course-detail="${esc(code)}">
                              ${courseCode(code)}
                              <span class="term-course-name">${esc(c.name)}</span>
                              <span class="term-course-cr">${c.credits} นก.</span>
                              ${added ? `<em class="plan-change-badge plan-change-badge--added">ใหม่</em>` : ""}
                              ${moved ? `<em class="plan-change-badge plan-change-badge--moved">ย้ายจากปี ${change.fromYear} ภาค ${change.fromTerm}</em>` : ""}
                              ${removed ? `<em class="plan-change-badge plan-change-badge--removed">ลบแล้ว</em>` : ""}
                            </button>
                            <div class="plan-course-actions">
                              ${removed ? `<button class="plan-icon-button" type="button" data-plan-undo-delete data-code="${esc(code)}" data-year="${t.year}" data-term="${t.term}">ยกเลิกการลบ</button>` : `<button class="plan-icon-button" type="button" data-plan-delete data-code="${esc(code)}" data-year="${t.year}" data-term="${t.term}">ลบ</button><select class="plan-move-select" data-plan-move-target="${esc(code)}" data-year="${t.year}" data-term="${t.term}"><option value="">ย้ายไป...</option>${[1, 2, 3].flatMap(targetTerm => [1, 2, 3, 4].map(targetYear => `<option value="${targetYear}-${targetTerm}">ปี ${targetYear} ภาค ${targetTerm === 3 ? "ซัมเมอร์" : targetTerm}</option>`)).join("")}</select>`}
                            </div>
                          </div>
                        `;
                }

                return `
                          <button
                            class="term-course-row"
                            data-go="course"
                            data-id="${esc(code)}"
                          >

                            ${courseCode(code)}

                            <span class="term-course-name">
                              ${esc(c.name)}
                            </span>

                            <span class="term-course-cr">
                              ${c.credits} นก.
                            </span>

                          </button>
                        `;

              })
              .join("")}

                    ${editing ? state.planEdit.changes.filter(change => change.action === "move" && change.fromYear === t.year && change.fromTerm === t.term).map(change => `<div class="term-course-row plan-course--moved-away"><span class="course-code">${esc(change.code)}</span><span class="term-course-name">ย้ายไปปี ${change.toYear} ภาค ${change.toTerm}</span><span class="term-course-cr">เดิม</span></div>`).join("") : ""}

                  </div>
                  ${editing ? `<div class="plan-add-course"><input type="search" placeholder="ค้นหารหัสหรือชื่อวิชา" data-plan-search data-year="${t.year}" data-term="${t.term}"><div class="plan-search-results" data-plan-results="${t.year}-${t.term}"></div><button type="button" class="plan-add-button" data-plan-add data-year="${t.year}" data-term="${t.term}">+ เพิ่มวิชา</button></div>` : ""}

                </div>
              `;

        })
        .join("")}

        </div>` : `<div class="audit-empty">ยังไม่มีรายวิชาในแผนการเรียนของหลักสูตรนี้</div>`}
        ${editing ? `<div class="plan-edit-summary-bar"><span>มีการเปลี่ยนแปลง ${editorChangeCount(p)} รายการ</span><button type="button" class="workflow-action workflow-action--muted" data-plan-summary>ดูสรุปการเปลี่ยนแปลง</button><button type="button" class="workflow-action workflow-action--muted" data-plan-save ${editorChangeCount(p) ? "" : "disabled"}>บันทึกฉบับร่าง</button><button type="button" class="workflow-action workflow-action--primary" data-plan-submit ${editorChangeCount(p) ? "" : "disabled"}>ส่งขออนุมัติ</button><button type="button" class="workflow-action workflow-action--danger" data-plan-cancel>ยกเลิก</button></div>` : ""}

      </div>
    `;
  }


  /* -------------------------
     GRADUATION
     ------------------------- */

  else {

    content = `
      <div class="panel">

        <div class="conditions-list">

          ${p.conditions
        .map(
          c => `
                <div class="condition-row">

                  <span class="condition-check">
                    ${icon("check", 13)}
                  </span>

                  <span>
                    ${esc(c)}
                  </span>

                </div>
              `
        )
        .join("")}

        </div>


        <div class="note-banner">

          ข้อมูลหลักสูตรและแผนการเรียนสำหรับการวางแผนการศึกษาของนักศึกษา

        </div>

      </div>
    `;
  }


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "หลักสูตรทั้งหมด",
      view: "programs"
    },
    {
      label: p.code
    }
  ])}


      <div class="program-header">

        ${seal(p.revisionYear)}

        <div>

          <div class="program-header-faculty">
            ${esc(p.faculty)}
          </div>

          <h1 class="page-title">
            ${esc(p.code)}
          </h1>

          <div class="program-header-en">
            ${esc(p.nameEn)}
          </div>

          <small class="program-pathway-label">
            หลักสูตรย่อย: ${esc(studyPlanMajorLabel(p))}${p.pathwayId ? ` · ${esc(p.pathwayId)}` : ""}
          </small>

        </div>


      </div>


      <div class="tabs">

        ${[
      ["overview", "ภาพรวม"],
      ["plan", "แผนการเรียน"],
      [
        "grad",
        "เงื่อนไขการสำเร็จการศึกษา"
      ]
    ]
      .map(
        ([id, label]) => `
              <button
                class="tab ${state.programTab === id
            ? "tab--active"
            : ""
          }"
                data-tab="${id}"
              >
                ${label}
              </button>
            `
      )
      .join("")}

      </div>


      ${renderWorkflowPanel(p)}

      ${content}

    </div>
  `;
}


/* =========================================================
   COURSE SEARCH
   ========================================================= */

function renderCourses() {

  const list =
    Object.entries(COURSES)
      .filter(([code, c]) => {

        if (
          state.noPrereqOnly &&
          c.prereq.length
        ) {
          return false;
        }


        if (
          state.programFilter !==
          "all"
        ) {

          const p =
            PROGRAMS.find(
              p =>
                p.id ===
                state.programFilter
            );


          if (
            p &&
            !p.plan.some(
              t =>
                t.courses.includes(
                  code
                )
            )
          ) {
            return false;
          }

        }


        return (
          !state.courseQuery.trim() ||
          norm(
            code +
            c.name +
            c.nameEn
          ).includes(
            norm(
              state.courseQuery
            )
          )
        );

      });


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "ค้นหารายวิชา"
    }
  ])}


      <h1 class="page-title">
        ค้นหารายวิชา
      </h1>


      <p class="page-sub">
        พบ ${list.length} รายวิชาจากข้อมูลหลักสูตร
      </p>


      <div class="filter-bar">

        <div class="hero-search hero-search--compact">

          ${icon(
    "search",
    16,
    "hero-search-icon"
  )}

          <input
            id="courseSearch"
            value="${esc(
    state.courseQuery
  )}"
            placeholder="ค้นหาด้วยรหัสวิชาหรือชื่อวิชา"
          >

        </div>


        <select
          id="programFilter"
          class="select"
        >

          <option value="all">
            ทุกหลักสูตร
          </option>

          ${PROGRAMS
      .map(
        p => `
                <option
                  value="${p.id}"
                  ${state.programFilter ===
            p.id
            ? "selected"
            : ""
          }
                >
                  ${esc(p.code)}
                </option>
              `
      )
      .join("")}

        </select>


        <label class="checkbox-pill">

          <input
            id="noPrereq"
            type="checkbox"
            ${state.noPrereqOnly
      ? "checked"
      : ""
    }
          >

          ${icon(
      "list-filter",
      14
    )}

          ไม่มีวิชาบังคับก่อน

        </label>

      </div>


      <div class="course-grid">

        ${list
      .map(
        ([code, c]) => `
              <button
                class="course-card"
                data-go="course"
                data-id="${esc(code)}"
              >

                <div class="course-card-top">

                  ${courseCode(code)}

                  ${chip(
          c.credits +
          " นก.",
          "brass"
        )}

                </div>


                <div class="course-card-name">
                  ${esc(c.name)}
                </div>


                <div class="course-card-en">
                  ${esc(c.nameEn)}
                </div>


                <div class="course-card-foot">

                  ${chip(c.category)}

                  <span
                    class="
                      course-card-prereq
                      ${c.prereq.length
            ? ""
            : "course-card-prereq--none"
          }
                    "
                  >
                    ${c.prereq.length
            ? "มีวิชาบังคับก่อน"
            : "ไม่มีวิชาบังคับก่อน"
          }
                  </span>

                </div>

              </button>
            `
      )
      .join("")}


        ${!list.length
      ? `
              <div class="empty-state">
                ไม่พบรายวิชาที่ตรงกับเงื่อนไขการค้นหา
              </div>
            `
      : ""
    }

      </div>

    </div>
  `;
}


/* =========================================================
   COURSE DETAIL
   ========================================================= */

function renderCourse() {

  const code =
    state.courseCode ||
    "CS101";

  const c =
    COURSES[code];


  if (!c) {

    return `
      <div class="page">

        ${crumbs([
      {
        label: "หน้าแรก",
        view: "home"
      },
      {
        label: "ค้นหารายวิชา",
        view: "courses"
      }
    ])}

        <div class="empty-state">
          ไม่พบข้อมูลรายวิชา ${esc(code)}
        </div>

      </div>
    `;
  }


  const ps =
    programsContaining(code);

  const sourceProgram = PROGRAMS.find(
    program => program.id === state.programId
  );

  const prereqs =
    c.prereq || [];

  const unlocks =
    c.unlocks ?? findUnlocks(code);


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
      sourceProgram
        ? {
            label: sourceProgram.code,
            view: "program",
            id: sourceProgram.id
          }
        : {
            label: "ค้นหารายวิชา",
            view: "courses"
          },
    {
      label: code
    }
  ])}


      <div class="course-detail-head">

        <div>

          ${courseCode(code)}

          <h1
            class="page-title"
            style="margin-top:8px"
          >
            ${esc(c.name)}
          </h1>

          <div class="program-header-en">
            ${esc(c.nameEn)}
          </div>

        </div>


        <div class="course-detail-meta">

          ${chip(
    c.credits +
    " หน่วยกิต",
    "brass"
  )}

          ${chip(c.category)}

        </div>

      </div>


      <p class="program-summary">
        ${esc(c.desc)}
      </p>


      <div class="meta-grid">

        <div class="meta-box">

          <div class="meta-label">
            เปิดสอน
          </div>

          <div class="meta-value">
            ${esc(c.term)}
          </div>

        </div>


        <div class="meta-box">

          <div class="meta-label">
            อยู่ในหลักสูตร
          </div>

          <div class="meta-value">

            ${ps.length
      ? ps
        .map(
          p =>
            `<div>${esc(
              p.code
            )}</div>`
        )
        .join("")
      : "—"
    }

          </div>

        </div>

      </div>

      ${apiDataPanel("ข้อมูลเพิ่มเติมจาก API: TQF3 (กดเพื่อดู)", c.tqf3)}
      ${apiDataPanel("ข้อมูลเพิ่มเติมจาก API: Course–PLO (กดเพื่อดู)", c.ploMappings)}


      <h3 class="panel-subhead">
        เส้นทางรายวิชา
      </h3>


      <div class="chain">


        <div class="chain-lane">

          <div class="chain-lane-label">
            ต้องผ่านมาก่อน
          </div>


          <div class="chain-nodes">

            ${prereqs.length
      ? prereqs
        .map(
          p =>
            COURSES[p]
              ? `
                            <div class="chain-node">

                              <div class="chain-node-code">
                                ${p}
                              </div>

                              <div class="chain-node-name">
                                ${esc(
                COURSES[p]
                  .name
              )}
                              </div>

                            </div>
                          `
              : `
                            <div class="chain-node chain-node--condition">
                              ${esc(p)}
                            </div>
                          `
        )
        .join("")
      : `
                  <div class="chain-node chain-node--empty">
                    ไม่มีวิชาบังคับก่อน
                  </div>
                `
    }

          </div>

        </div>


        <div class="chain-arrow">
          ${icon("arrow-right", 20)}
        </div>


        <div class="chain-lane chain-lane--current">

          <div class="chain-lane-label">
            รายวิชานี้
          </div>

          <div class="chain-node chain-node--current">

            <div class="chain-node-code">
              ${code}
            </div>

            <div class="chain-node-name">
              ${esc(c.name)}
            </div>

          </div>

        </div>


        <div class="chain-arrow">
          ${icon("arrow-right", 20)}
        </div>


        <div class="chain-lane">

          <div class="chain-lane-label">
            ปลดล็อกวิชาถัดไป
          </div>


          <div class="chain-nodes">

            ${unlocks.length
      ? unlocks
        .map(
          u => `
                        <div class="chain-node chain-node--future">

                          <div class="chain-node-code">
                            ${u}
                          </div>

                          <div class="chain-node-name">
                            ${esc(
            COURSES[u]
              .name
          )}
                          </div>

                        </div>
                      `
        )
        .join("")
      : `
                  <div class="chain-node chain-node--empty">
                    ยังไม่มีวิชาที่ต่อยอด
                  </div>
                `
    }

          </div>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   FAQ
   ========================================================= */

function renderFaq() {

  const grouped = {};


  FAQS
    .filter(
      f =>
        norm(
          f.q + f.a
        ).includes(
          norm(
            state.faqQuery
          )
        )
    )
    .forEach(f => {

      if (!grouped[f.category]) {
        grouped[f.category] = [];
      }

      grouped[f.category].push(f);

    });


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "คำถามที่พบบ่อย"
    }
  ])}


      <h1 class="page-title">
        คำถามที่พบบ่อย
      </h1>


      <p class="page-sub">
        รวมคำตอบเกี่ยวกับหลักสูตร
        การลงทะเบียน และการสำเร็จการศึกษา
      </p>


      <div
        class="hero-search hero-search--compact"
        style="margin-bottom:28px"
      >

        ${icon(
    "search",
    16,
    "hero-search-icon"
  )}

        <input
          id="faqSearch"
          value="${esc(
    state.faqQuery
  )}"
          placeholder="พิมพ์คำถาม เช่น “หน่วยกิต” หรือ “สำเร็จการศึกษา”"
        >

      </div>


      ${Object.keys(grouped).length

      ? Object.entries(grouped)
        .map(
          ([cat, items]) => `
                  <div class="faq-group">

                    <div class="faq-group-title">
                      ${esc(cat)}
                    </div>


                    ${items
              .map(
                (f, i) => {

                  const k =
                    cat + i;

                  const o =
                    state.openFaq ===
                    k;


                  return `
                            <div class="faq-item">

                              <button
                                class="faq-question"
                                data-faq="${esc(k)}"
                              >

                                <span>
                                  ${esc(f.q)}
                                </span>

                                ${icon(
                    "chevron-down",
                    16,
                    `faq-chevron ${o
                      ? "faq-chevron--open"
                      : ""
                    }`
                  )}

                              </button>


                              ${o
                      ? `
                                    <div class="faq-answer">
                                      ${esc(f.a)}
                                    </div>
                                  `
                      : ""
                    }

                            </div>
                          `;

                }
              )
              .join("")}

                  </div>
                `
        )
        .join("")

      : `
            <div class="empty-state">
              ไม่พบคำถามที่ตรงกับคำค้นหา
            </div>
          `
    }

    </div>
  `;
}


/* =========================================================
   SHELL
   ========================================================= */

function shell(content) {

  const active =
    id =>
      state.view === id ||
      (
        id === "programs" &&
        state.view === "program"
      ) ||
      (
        id === "courses" &&
        state.view === "course"
      ) ||
      (
        id === "workflow" &&
        state.view === "workflow"
      );


  const nav = [
    ["programs", "หลักสูตร"],
    ["courses", "ค้นหารายวิชา"]
  ];
  if (["student", "instructor", "staff"].includes(state.user?.role)) {
    nav.push(["graduation", "ตรวจสอบการจบ"]);
  }
  nav.push(["faq", "คำถามที่พบบ่อย"]);


  return `
    <header class="topbar">

      <button
        class="brand"
        data-go="home"
      >

        ${icon("compass", 22)}

        <span>
          เข็มทิศหลักสูตร
        </span>

      </button>


      <nav class="topnav">

        ${nav
      .map(
        ([id, label, navItemId]) => `
              <button
                class="topnav-item ${active(id)
            ? "topnav-item--active"
            : ""
          }"
                data-go="${id}" ${navItemId ? `data-id="${esc(navItemId)}"` : ""}
              >
                ${label}
              </button>
            `
      )
      .join("")}

      </nav>

      <div class="auth-area">
        ${state.user
      ? `<div class="account-menu-wrap">
          <button class="auth-user" data-auth-action="toggle-account" aria-expanded="${state.accountMenuOpen}" title="เมนูบัญชี">
            ${esc(state.user.roleLabel)}
            ${icon("chevron-down", 16)}
          </button>
          ${state.accountMenuOpen ? `<div class="account-menu" role="menu">
            ${canAccessStudentProfile() ? `<button data-go="profile" role="menuitem">ข้อมูลส่วนตัว</button>` : ""}
            <button data-go="programs" role="menuitem">หลักสูตร</button>
            <button data-go="courses" role="menuitem">ค้นหารายวิชา</button>
            ${canManageCurricula() ? `<button data-go="curriculum-management" role="menuitem">จัดการหลักสูตร</button><button data-go="course-editor" role="menuitem">แก้ไขรายวิชา</button><button data-go="my-change-requests" role="menuitem">คำขอของฉัน</button>` : ""}
            ${canReviewCurriculumRequests() ? `<button data-go="review-requests" role="menuitem">ตรวจคำขอ + ประวัติเวอร์ชัน</button>` : ""}
            ${canAccessCurriculumManagement() ? `<button data-go="workflow" data-id="${esc(state.programId || PROGRAMS[0].id)}" role="menuitem">ตรวจสอบข้อมูลหลักสูตร</button>` : ""}
            ${["student", "instructor", "staff"].includes(state.user.role) ? `<button data-go="graduation" role="menuitem">ตรวจสอบการจบ</button>` : ""}
            <button data-auth-action="logout" role="menuitem" class="account-menu-logout">ออกจากระบบ</button>
          </div>` : ""}
        </div>`
      : `<button class="auth-btn" data-go="login">เข้าสู่ระบบ</button>`}
      </div>


      <button
        class="menu-btn"
        id="menuBtn"
        aria-label="เมนู"
      >
        ${icon(
        state.navOpen
          ? "x"
          : "menu",
        20
      )}
      </button>


      ${state.navOpen
      ? `
            <div class="mobile-nav">

              ${nav
        .map(
          ([id, label, navItemId]) => `
                    <button
                      class="mobile-nav-item"
                      data-go="${id}"
                      ${navItemId ? `data-id="${esc(navItemId)}"` : ""}
                    >
                      ${label}
                    </button>
                  `
        )
        .join("")}

            </div>
          `
      : ""
    }

    </header>

    <main class="main">
      ${content}
    </main>

    ${state.apiStatus === "unavailable" ? `
      <div class="api-alert-backdrop" data-api-alert>
        <section class="api-alert" role="alertdialog" aria-modal="true" aria-labelledby="api-alert-title">
          <div class="api-alert-icon">${icon("triangle-alert", 28)}</div>
          <h2 id="api-alert-title">เชื่อมต่อระบบข้อมูลไม่ได้</h2>
          <p>ขณะนี้ REST API ไม่ตอบสนอง อาจเป็นเพราะ AWS Learner Lab ยังไม่ได้เปิดหรือ API หยุดทำงาน</p>
          <p class="api-alert-detail">${esc(state.apiError)}</p>
          <div class="api-alert-actions">
            <button class="api-alert-retry" data-api-action="retry">ลองเชื่อมต่ออีกครั้ง</button>
            <button class="api-alert-close" data-api-action="close">ดูข้อมูลสำรองต่อ</button>
          </div>
        </section>
      </div>
    ` : ""}


    <footer class="footer">

      <div>

        ${icon(
      "compass",
      16
    )}

        เข็มทิศหลักสูตร
        — ศูนย์ข้อมูลหลักสูตรกลาง

      </div>


      <div class="footer-note">

        ข้อมูลหลักสูตรเปิดให้เข้าถึงแบบสาธารณะ
        ส่วนข้อมูลส่วนตัวและการตรวจสอบตามสิทธิ์ต้องเข้าสู่ระบบ

      </div>

    </footer>
  `;
}


/* =========================================================
   RENDER
   ========================================================= */

function renderLogin() {
  return `
    <div class="page login-page">
      <div class="login-page-card">
        <div class="login-page-icon">${icon("shield-check", 28)}</div>
        <h1 class="page-title">เข้าสู่ระบบ</h1>
        <p class="page-sub">เข้าสู่ระบบด้วยบัญชี TU หรือบัญชีที่ระบบกำหนด</p>

        <form id="loginForm" class="login-page-form">
          <label>
            Username
            <input name="username" autocomplete="username" required placeholder="Username TU" />
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" required placeholder="รหัสผ่าน" />
          </label>
          ${state.loginError ? `<p class="login-error">${esc(state.loginError)}</p>` : ""}
          <button class="login-submit" type="submit">เข้าสู่ระบบ</button>
        </form>

        <button class="login-guest" data-go="home">เข้าใช้งานแบบ Guest โดยไม่ต้อง Login</button>
      </div>
    </div>
  `;
}

function render() {

  const pages = {
    home: renderHome,
    programs: renderPrograms,
    program: renderProgram,
    courses: renderCourses,
    course: renderCourse,
    faq: renderFaq,
    login: renderLogin,
    profile: renderStudentProfile,
    graduation: renderGraduationPage,
    workflow: renderWorkflowPage,
    "curriculum-management": renderCurriculumManagement,
    "curriculum-editor": renderCurriculumEditor,
    "course-editor": renderCourseEditor,
    "my-change-requests": () => renderChangeRequestsPage(false),
    "review-requests": () => canReviewCurriculumRequests()
      ? renderChangeRequestsPage(true)
      : renderHome()
  };


  const renderer =
    pages[state.view];


  const page =
    renderer
      ? renderer()
      : renderHome();


  document.getElementById(
    "app"
  ).innerHTML =
    shell(page);


  if (window.lucide) {
    lucide.createIcons();
  }


  bind();

  if (state.view === "curriculum-editor" && state.editorSearch) {
    const searchInput = document.querySelector(`[data-plan-search][data-year="${state.editorSearch.year}"][data-term="${state.editorSearch.term}"]`);
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  }

  if (state.view === "program" || state.view === "workflow") {
    const program = PROGRAMS.find(item => item.id === state.programId) || PROGRAMS[0];
    if (program?.curriculumId && !workflowCache.has(program.curriculumId)) {
      loadCurriculumWorkflow(program.curriculumId).then(() => {
        if ((state.view === "program" || state.view === "workflow") && state.programId === program.id) render();
      });
    }
    if (state.view === "workflow" && canViewAuditLogs() && !auditLogCache.has("recent")) {
      loadAuditLogs().then(() => {
        if (state.view === "workflow" && canViewAuditLogs()) render();
      });
    }
    if (state.view === "workflow" && !state.curriculumChangesLoaded) {
      loadCurriculumChanges(program.curriculumId).then(() => {
        if (state.view === "workflow") render();
      });
    }
    if (state.view === "workflow" && !state.draftRequestsLoaded) {
      loadDraftChangeRequests().then(() => {
        if (state.view === "workflow") render();
      });
    }
    if (state.view === "workflow" && !state.curriculumCoursesLoaded) {
      loadCurriculumCourses(program).then(() => {
        if (state.view === "workflow") render();
      });
    }
  }
  if (state.view === "profile" && canAccessStudentProfile() && !state.studentProfile && !state.studentProfileLoading) {
    loadStudentProfile().then(() => {
      if (state.view === "profile") render();
    });
  }
  if (state.view === "graduation" && !state.graduationLoaded && !state.graduationLoading) {
    loadGraduationPage().then(() => {
      if (state.view === "graduation") render();
    });
  }
  if (["curriculum-management", "my-change-requests", "review-requests"].includes(state.view) && !state.draftRequestsLoaded) {
    loadDraftChangeRequests().then(() => {
      if (["curriculum-management", "my-change-requests", "review-requests"].includes(state.view)) render();
    });
  }
  if (state.view === "review-requests" && state.reviewTab === "history" && !state.curriculumChangesLoaded) {
    const historyCurriculumId = state.curriculumHistoryCurriculumId ?? PROGRAMS.find(program => program.curriculumId)?.curriculumId;
    if (historyCurriculumId) {
      loadCurriculumChanges(historyCurriculumId).then(() => {
        if (state.view === "review-requests" && state.reviewTab === "history") render();
      });
    }
  }
  if (state.view === "curriculum-management" && canManageCurricula() && !state.managementCurriculaLoaded) {
    loadManagementCurricula().then(() => {
      if (state.view === "curriculum-management") render();
    });
  }
  if (state.view === "curriculum-editor" && state.editorMode === "edit" && state.editorProgram && !state.editorLoading && !state.editorProgramLoaded) {
    state.editorProgramLoaded = true;
    loadEditorActivePlan(state.editorProgram).then(() => {
      if (state.view === "curriculum-editor") {
        state.planEdit.terms = clonePlanForEditing(state.editorProgram);
        applyDraftRequestToEditor(state.pendingDraftToEdit);
        render();
      }
    });
  }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function go(v, id, addHistory = true) {
  if (v === "workflow" && !canAccessCurriculumManagement()) {
    state.loginError = "หน้านี้สำหรับอาจารย์และเจ้าหน้าที่เท่านั้น";
    state.view = state.user ? "home" : "login";
    render();
    return;
  }
  if (["curriculum-management", "curriculum-editor", "course-editor", "my-change-requests"].includes(v) && !canManageCurricula()) {
    state.loginError = "หน้านี้สำหรับผู้ดูแลข้อมูลหลักสูตรและเจ้าหน้าที่เท่านั้น";
    state.view = state.user ? "home" : "login";
    render();
    return;
  }
  if (v === "review-requests" && !canReviewCurriculumRequests()) {
    state.loginError = "หน้านี้สำหรับเจ้าหน้าที่เท่านั้น";
    state.view = state.user ? "home" : "login";
    render();
    return;
  }
  if (v === "curriculum-editor") {
    if (!initializeEditorState(id)) return;
    try {
      sessionStorage.setItem("cs361-editor-route", JSON.stringify({ id }));
    } catch {
      // Session storage may be unavailable for some file:// browser settings.
    }
  }
  if (v === "profile" && !canAccessStudentProfile()) {
    state.view = state.user ? "home" : "login";
    render();
    return;
  }
  if (v === "graduation" && !["student", "instructor", "staff"].includes(state.user?.role)) {
    state.view = state.user ? "home" : "login";
    render();
    return;
  }

  state.view = v;
  if (v === "graduation") {
    state.graduationResult = null;
    state.graduationStudents = [];
    state.graduationBatches = [];
    state.graduationLoaded = false;
    state.graduationError = "";
  }

  if (v === "program" || v === "workflow") {
    state.programId = id;
    if (v === "program") state.programTab = "overview";
  }

  if (v === "course") {
    state.courseCode = id;
  }

  if (v === "course-editor" && !id) {
    state.courseEditorStandalone = true;
    state.courseEditorCourseId = null;
    state.courseEditorQuery = "";
  }

  if (v === "profile") {
    state.studentProfile = null;
    state.studentProfileAttempted = false;
    state.studentProfileError = "";
  }

  if (["my-change-requests", "review-requests"].includes(v)) {
    state.selectedChangeRequest = null;
    state.changeRequestFilter = "all";
    state.changeRequestError = "";
    if (v === "review-requests") {
      state.reviewTab = "pending";
      state.curriculumHistoryCurriculumId = null;
      state.curriculumChangesLoaded = false;
    }
  }

  state.navOpen = false;
  state.accountMenuOpen = false;

  // เก็บหน้าปัจจุบันไว้ใน Browser History
  if (addHistory) {
    const pageState = {
      view: v,
      programId: state.programId,
      courseCode: state.courseCode,
      programTab: state.programTab,
      year: state.year,
      editorId: v === "curriculum-editor" ? id : null
    };

    history.pushState(
      pageState,
      "",
      window.location.pathname
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  render();

  if (v === "course") {
    loadCourseDetail(id).then(() => {
      if (state.view === "course" && courseKey(state.courseCode) === courseKey(id)) render();
    });
  }
}

function syncHistoryState() {
  const current = history.state ?? {};
  history.replaceState(
    {
      ...current,
      view: state.view,
      programId: state.programId,
      courseCode: state.courseCode,
      programTab: state.programTab,
      year: state.year
    },
    "",
    window.location.pathname
  );
}


/* =========================================================
   BIND EVENTS
   ========================================================= */

function bind() {

  document.querySelectorAll("[data-graduation-assign-form]").forEach(form => {
    form.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/graduation/assignments`, {
          method: "POST",
          headers: { ...draftApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: String(formData.get("studentId") ?? "").trim(),
            displayName: String(formData.get("displayName") ?? "").trim(),
            studentYear: Number(formData.get("studentYear")),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "เพิ่มนักศึกษาไม่สำเร็จ");
        state.graduationLoaded = false;
        state.graduationLoading = false;
        state.graduationError = "";
        await loadGraduationPage();
        render();
      } catch (error) {
        alert(error.message ?? "เพิ่มนักศึกษาไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-graduation-student]").forEach(button => {
    button.onclick = async () => {
      const studentId = button.dataset.graduationStudent;
      if (!studentId || !state.graduationStudents.some(student => student.studentId === studentId)) return;
      state.graduationSelectedStudentId = studentId;
      state.graduationLoading = true;
      state.graduationError = "";
      render();
      try {
        const response = await fetch(`${API_BASE}/api/graduation/students/${encodeURIComponent(studentId)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "โหลดผลตรวจสอบไม่สำเร็จ");
        state.graduationResult = payload.data;
      } catch (error) {
        state.graduationError = error.message ?? "โหลดผลตรวจสอบไม่สำเร็จ";
      } finally {
        state.graduationLoading = false;
        render();
      }
    };
  });

  document.querySelectorAll("[data-curriculum-visibility]").forEach(button => {
    button.onclick = async () => {
      const curriculumId = button.dataset.curriculumId;
      const show = button.dataset.curriculumVisibility === "show";
      const deleting = button.dataset.curriculumVisibility === "delete";
      const actionText = show ? "แสดง" : deleting ? "ลบ" : "ซ่อน";
      if (!curriculumId || !confirm(`${actionText}หลักสูตร ${curriculumId} ${show ? "ให้ผู้ใช้ทั่วไปเห็นอีกครั้ง" : deleting ? "ออกจากระบบหรือไม่ (ข้อมูลจะถูกเก็บไว้ตรวจสอบย้อนหลัง)" : "จากผู้ใช้ทั่วไปหรือไม่"}`)) return;
      button.disabled = true;
      try {
        const response = await fetch(
          deleting
            ? `${API_BASE}/api/curricula/${encodeURIComponent(curriculumId)}`
            : `${API_BASE}/api/curricula/${encodeURIComponent(curriculumId)}/visibility`,
          {
          method: deleting ? "DELETE" : "PATCH",
          headers: draftApiHeaders(),
          ...(deleting ? {} : { body: JSON.stringify({ active: show, operation: show ? "show" : "hide" }) })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? `${show ? "แสดง" : "ซ่อน"}หลักสูตรไม่สำเร็จ`);
        alert(show ? "แสดงหลักสูตรแล้ว" : deleting ? "ลบหลักสูตรออกแล้ว" : "ซ่อนหลักสูตรแล้ว");
        state.managementCurriculaLoaded = false;
        await loadManagementCurricula();
        render();
      } catch (error) {
        alert(error.message ?? `${actionText}หลักสูตรไม่สำเร็จ`);
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-request-filter]").forEach(button => {
    button.onclick = () => {
      state.changeRequestFilter = button.dataset.requestFilter || "all";
      state.selectedChangeRequest = null;
      render();
    };
  });

  document.querySelectorAll("[data-review-tab]").forEach(button => {
    button.onclick = () => {
      state.reviewTab = button.dataset.reviewTab || "pending";
      state.selectedChangeRequest = null;
      state.changeRequestError = "";
      if (state.reviewTab === "history") {
        state.curriculumHistoryCurriculumId = state.curriculumHistoryCurriculumId ?? PROGRAMS.find(program => program.curriculumId)?.curriculumId ?? "";
        state.curriculumChangesLoaded = false;
      }
      render();
    };
  });

  document.querySelectorAll("[data-review-curriculum]").forEach(select => {
    select.onchange = () => {
      state.curriculumHistoryCurriculumId = select.value;
      state.curriculumChangesLoaded = false;
      render();
    };
  });

  document.querySelectorAll("[data-request-detail]").forEach(button => {
    button.onclick = () => loadChangeRequestDetail(button.dataset.requestDetail);
  });

  document.querySelectorAll("[data-request-submit]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("ส่งฉบับร่างนี้ขออนุมัติหรือไม่")) return;
      button.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/change-requests/${encodeURIComponent(button.dataset.requestSubmit)}/submit`, {
          method: "POST",
          headers: draftApiHeaders(),
          body: "{}"
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "ส่งขออนุมัติไม่สำเร็จ");
        state.draftRequestsLoaded = false;
        state.selectedChangeRequest = null;
        await loadDraftChangeRequests();
        alert("ส่งขออนุมัติแล้ว");
        render();
      } catch (error) {
        alert(error.message ?? "ส่งขออนุมัติไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-request-edit]").forEach(button => {
    button.onclick = () => {
      const selected = state.selectedChangeRequest;
      const detail = selected?.request ?? selected;
      const program = PROGRAMS.find(item => item.curriculumId === detail?.curriculum_id);
      if (!program) {
        alert("ยังไม่พบหลักสูตรสำหรับเปิดแก้ฉบับร่างนี้");
        return;
      }
      state.pendingDraftToEdit = selected;
      state.editingDraftRequestId = detail.id;
      go("curriculum-editor", program.id);
    };
  });

  document.querySelectorAll("[data-request-decision]").forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.requestDecision;
      const requestId = button.dataset.requestId;
      const note = window.prompt(action === "approve" ? "หมายเหตุการอนุมัติ (ถ้ามี)" : "กรุณาระบุเหตุผลที่ปฏิเสธ");
      if (action === "reject" && !note?.trim()) return;
      button.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/change-requests/${encodeURIComponent(requestId)}/decision`, {
          method: "POST",
          headers: draftApiHeaders(),
          body: JSON.stringify({ action, note: note?.trim() ?? "" })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "ดำเนินการกับคำขอไม่สำเร็จ");
        state.draftRequestsLoaded = false;
        state.selectedChangeRequest = null;
        await loadDraftChangeRequests();
        render();
      } catch (error) {
        window.alert(error.message || "ดำเนินการกับคำขอไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-api-action]").forEach(button => {
    button.onclick = async () => {
      if (button.dataset.apiAction === "close") {
        state.apiStatus = "fallback";
        render();
        return;
      }
      if (button.dataset.apiAction === "retry") {
        state.apiStatus = "loading";
        render();
        await loadApiData();
        render();
      }
    };
  });

  document.querySelectorAll("[data-auth-action]").forEach(button => {
    button.onclick = event => {
      if (button.dataset.authAction === "close" && event.target.closest("[data-login-modal]") && event.target !== button) return;
      if (button.dataset.authAction === "open") {
        state.loginOpen = true;
        state.loginError = "";
      } else if (button.dataset.authAction === "close") {
        state.loginOpen = false;
        state.loginError = "";
      } else if (button.dataset.authAction === "logout") {
        logout();
        state.studentProfile = null;
        state.studentProfileAttempted = false;
        state.studentProfileError = "";
        state.graduationResult = null;
        state.graduationStudents = [];
        state.graduationBatches = [];
        state.graduationSelectedStudentId = "";
        state.graduationLoaded = false;
        state.graduationError = "";
        state.accountMenuOpen = false;
      } else if (button.dataset.authAction === "toggle-account") {
        state.accountMenuOpen = !state.accountMenuOpen;
      }
      render();
    };
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const username = String(formData.get("username") ?? "");
      const password = String(formData.get("password") ?? "");
      const button = loginForm.querySelector("button[type=submit]");

      button.disabled = true;
      state.loginError = "";
      try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.error ?? "Username หรือ Password ไม่ถูกต้อง");
        state.user = payload.user;
        state.token = payload.token ?? null;
        localStorage.setItem("cs361-v3-user", JSON.stringify(state.user));
        if (state.token) localStorage.setItem("cs361-v3-token", state.token);
        state.loginOpen = false;
        state.loginError = "";
        go("home");
      } catch (error) {
        state.loginError = error.message || "TU Login ไม่สำเร็จ";
        render();
      } finally {
        button.disabled = false;
      }
    };
  }

  document.querySelectorAll("[data-workflow-action]").forEach(button => {
    button.onclick = async () => {
      const program = PROGRAMS.find(item => item.id === state.programId);
      if (!program?.curriculumId || !state.user) return;
      button.disabled = true;
      try {
        const response = await fetch(
          `${API_BASE}/api/curricula/${encodeURIComponent(program.curriculumId)}/workflow`,
          {
            method: "POST",
            headers: draftApiHeaders(),
            body: JSON.stringify({ action: button.dataset.workflowAction })
          }
        );
        if (!response.ok) throw new Error(`Workflow update failed: ${response.status}`);
        const payload = await response.json();
        workflowCache.set(program.curriculumId, payload?.data ?? { status: "draft" });
        render();
      } catch (error) {
        console.error(error);
        button.disabled = false;
        alert("เปลี่ยนสถานะหลักสูตรไม่สำเร็จ");
      }
    };
  });

  const curriculumChangeForm = document.getElementById("curriculumChangeForm");
  const editModal = document.querySelector("[data-edit-modal]");
  document.querySelectorAll("[data-open-edit-modal]").forEach(button => {
    button.onclick = () => {
      if (!editModal) return;
      editModal.hidden = false;
      editModal.querySelector("[name=changeType]")?.focus();
    };
  });
  document.querySelectorAll("[data-close-edit-modal]").forEach(button => {
    button.onclick = () => {
      if (editModal) editModal.hidden = true;
    };
  });

  if (curriculumChangeForm) {
    curriculumChangeForm.onsubmit = async event => {
      event.preventDefault();
      const program = PROGRAMS.find(item => item.id === state.programId);
      const formData = new FormData(curriculumChangeForm);
      const operation = String(formData.get("operation") ?? "update");
      const changeType = String(formData.get("changeType"));
      const newCurriculumId = String(formData.get("newCurriculumId") ?? "").trim();
      const existingId = String(formData.get("curriculumCourseId") ?? "").trim();
      const existingCourse = state.curriculumCourses.find(course => course.curriculum_course_id === existingId);
      const newCourseCode = String(formData.get("newCourseCode") ?? "").trim();
      const courseGroup = String(formData.get("courseGroup") ?? "วิชาเฉพาะ");
      const isNewCurriculum = operation === "create";
      const type = isNewCurriculum
        ? "add_curriculum"
        : changeType === "academic_year" ? "edit_structure" : "edit_course";
      if (isNewCurriculum && !newCurriculumId) return alert("กรุณาระบุรหัสหลักสูตรใหม่");
      if (!isNewCurriculum && changeType !== "academic_year" && !existingId) return alert("กรุณาเลือกวิชาเดิม");
      if (["course_add", "course_replace"].includes(changeType) && !newCourseCode) return alert("กรุณาระบุวิชาใหม่");

      let item;
      if (isNewCurriculum) {
        item = {
          action: "CREATE_CURRICULUM",
          newValue: {
            curriculumId: newCurriculumId,
            academicYear: Number(formData.get("academicYear")),
            sourceCurriculumId: program?.curriculumId ?? null
          }
        };
      } else if (changeType === "academic_year") {
        item = {
          action: "EDIT_FIELD",
          newValue: { field: "academic_year", value: Number(formData.get("academicYear")) },
          oldValue: { field: "academic_year", value: program?.academicYear ?? null }
        };
      } else if (changeType === "course_add") {
        item = {
          action: "ADD_COURSE",
          courseCode: newCourseCode,
          newValue: { courseCode: newCourseCode, courseGroup, pathwayId: program?.pathwayId ?? null }
        };
      } else if (changeType === "course_remove") {
        item = {
          action: "REMOVE_COURSE",
          courseCode: existingCourse?.course_code ?? null,
          oldValue: existingCourse ?? { curriculumCourseId: existingId }
        };
      } else {
        item = {
          action: "EDIT_FIELD",
          courseCode: existingCourse?.course_code ?? null,
          oldValue: existingCourse ?? { curriculumCourseId: existingId },
          newValue: { courseCode: newCourseCode, courseGroup, pathwayId: program?.pathwayId ?? null }
        };
      }

      const submitButton = event.submitter?.value === "submit";
      try {
        const createResponse = await fetch(`${API_BASE}/api/change-requests`, {
          method: "POST",
          headers: draftApiHeaders(),
          body: JSON.stringify({
            curriculumId: isNewCurriculum ? null : program?.curriculumId,
            sourceCurriculumId: isNewCurriculum ? program?.curriculumId : null,
            type,
            title: isNewCurriculum ? `เพิ่มหลักสูตร ${newCurriculumId}` : `แก้ไขหลักสูตร ${program?.code ?? ""}`,
            note: `รายการแก้ไข: ${changeType}`
          })
        });
        const created = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok || !created.data?.id) throw new Error(created.error ?? "สร้างฉบับร่างไม่สำเร็จ");
        const requestId = created.data.id;
        const itemsResponse = await fetch(`${API_BASE}/api/change-requests/${encodeURIComponent(requestId)}/items`, {
          method: "PUT",
          headers: draftApiHeaders(),
          body: JSON.stringify({ items: [item] })
        });
        const saved = await itemsResponse.json().catch(() => ({}));
        if (!itemsResponse.ok) throw new Error(saved.error ?? "บันทึกรายการแก้ไขไม่สำเร็จ");
        if (submitButton) {
          const submitResponse = await fetch(`${API_BASE}/api/change-requests/${encodeURIComponent(requestId)}/submit`, {
            method: "POST",
            headers: draftApiHeaders(),
            body: "{}"
          });
          const submitted = await submitResponse.json().catch(() => ({}));
          if (!submitResponse.ok) throw new Error(submitted.error ?? "ส่งตรวจสอบไม่สำเร็จ");
        }
        if (editModal) editModal.hidden = true;
        state.draftRequestsLoaded = false;
        await loadDraftChangeRequests();
        render();
      } catch (error) {
        alert(error.message ?? "บันทึกฉบับร่างไม่สำเร็จ");
      }
    };
    const changeType = curriculumChangeForm.querySelector("[name=changeType]");
    const operation = curriculumChangeForm.querySelector("[name=operation]");
    const updateChangeFields = () => {
      const isCreate = operation?.value === "create";
      if (isCreate && changeType.value !== "academic_year") changeType.value = "academic_year";
      curriculumChangeForm.querySelectorAll("[data-change-field]").forEach(field => {
        const fieldType = field.dataset.changeField;
        const visible = (fieldType === "new_curriculum" && isCreate) ||
          (!isCreate && (fieldType === changeType.value ||
          (fieldType === "course_existing" && ["course_replace", "course_remove"].includes(changeType.value)) ||
          (fieldType === "course_new" && ["course_add", "course_replace"].includes(changeType.value))));
        field.hidden = !visible;
        field.querySelectorAll("input, select").forEach(input => { input.required = visible; });
      });
    };
    changeType.onchange = updateChangeFields;
    if (operation) operation.onchange = updateChangeFields;
    updateChangeFields();
  }

  document.querySelectorAll("[data-change-action]").forEach(button => {
    button.onclick = async () => {
      const response = await fetch(`${API_BASE}/api/curriculum-changes/${encodeURIComponent(button.dataset.changeId)}/decision`, {
        method: "POST",
        headers: draftApiHeaders(),
        body: JSON.stringify({ action: button.dataset.changeAction })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return alert(payload.error ?? "ดำเนินการกับรายการแก้ไขไม่สำเร็จ");
      state.curriculumChangesLoaded = false;
      const program = PROGRAMS.find(item => item.id === state.programId);
      loadCurriculumChanges(program?.curriculumId).then(() => render());
    };
  });

  document.querySelectorAll("[data-start-plan-edit]").forEach(button => {
    button.onclick = () => {
      const program = PROGRAMS.find(item => item.id === state.programId);
      if (program) startPlanEditing(program);
    };
  });

  document.querySelectorAll("[data-plan-delete]").forEach(button => {
    button.onclick = () => {
      const program = editorCurrentProgram();
      if (!program || !isPlanEditing(program)) return;
      const code = button.dataset.code;
      const year = Number(button.dataset.year);
      const term = Number(button.dataset.term);
      const addedIndex = state.planEdit.changes.findIndex(change => change.action === "add" && change.code === code && change.year === year && change.term === term);
      if (addedIndex >= 0) {
        const target = state.planEdit.terms.find(item => item.year === year && item.term === term);
        target.courses = target.courses.filter(item => item !== code);
        state.planEdit.changes.splice(addedIndex, 1);
      } else if (!state.planEdit.changes.some(change => change.action === "remove" && change.code === code && change.year === year && change.term === term)) {
        state.planEdit.changes.push({ action: "remove", code, year, term });
      }
      render();
    };
  });

  document.querySelectorAll("[data-plan-undo-delete]").forEach(button => {
    button.onclick = () => {
      const index = state.planEdit?.changes.findIndex(change => change.action === "remove" && change.code === button.dataset.code && change.year === Number(button.dataset.year) && change.term === Number(button.dataset.term));
      if (index >= 0) state.planEdit.changes.splice(index, 1);
      render();
    };
  });

  document.querySelectorAll("[data-plan-move-target]").forEach(select => {
    select.onchange = () => {
      if (!select.value) return;
      const program = editorCurrentProgram();
      if (!program || !isPlanEditing(program)) return;
      const [toYear, toTerm] = select.value.split("-").map(Number);
      const fromYear = Number(select.dataset.year);
      const fromTerm = Number(select.dataset.term);
      const source = state.planEdit.terms.find(item => item.year === fromYear && item.term === fromTerm);
      const target = state.planEdit.terms.find(item => item.year === toYear && item.term === toTerm);
      const code = select.dataset.planMoveTarget;
      if (!source || !target || (toYear === fromYear && toTerm === fromTerm)) return;
      if (target.courses.includes(code)) return alert("ภาคปลายทางมีวิชานี้อยู่แล้ว");
      source.courses = source.courses.filter(item => item !== code);
      target.courses.push(code);
      const addChange = state.planEdit.changes.find(change => change.action === "add" && change.code === code && change.year === fromYear && change.term === fromTerm);
      if (addChange) {
        addChange.year = toYear;
        addChange.term = toTerm;
      } else {
        state.planEdit.changes.push({ action: "move", code, fromYear, fromTerm, toYear, toTerm });
      }
      render();
    };
  });

  document.querySelectorAll("[data-plan-create-course]").forEach(button => {
    button.onclick = () => {
      const code = courseKey(window.prompt("รหัสวิชาใหม่ เช่น CS999") ?? "");
      if (!code) return;
      if (code.length > 30) return alert("รหัสวิชายาวเกิน 30 ตัวอักษร");
      const name = String(window.prompt("ชื่อวิชาภาษาไทย") ?? "").trim();
      if (!name) return;
      const nameEn = String(window.prompt("ชื่อวิชาภาษาอังกฤษ (ถ้ามี)") ?? "").trim();
      const credits = Number(window.prompt("หน่วยกิต", "3"));
      if (!Number.isFinite(credits) || credits < 0) return alert("หน่วยกิตไม่ถูกต้อง");
      const year = Number(button.dataset.year);
      const term = Number(button.dataset.term);
      const target = state.planEdit?.terms.find(item => item.year === year && item.term === term);
      if (!target) return;
      if (COURSES[code] || target.courses.includes(code)) return alert("รหัสวิชานี้มีอยู่แล้ว");
      const course = { code, name, nameEn, credits, category: "วิชาเฉพาะ" };
      COURSES[code] = course;
      state.planEdit.newCourses[code] = course;
      target.courses.push(code);
      state.planEdit.changes.push({ action: "add", code, year, term });
      render();
    };
  });

  document.querySelectorAll("[data-create-course-standalone]").forEach(button => {
    button.onclick = async () => {
      const code = courseKey(window.prompt("รหัสวิชาใหม่ เช่น CS999") ?? "");
      if (!code || code.length > 30) return alert("รหัสวิชาไม่ถูกต้องหรือยาวเกิน 30 ตัวอักษร");
      const name = String(window.prompt("ชื่อวิชาภาษาไทย") ?? "").trim();
      if (!name) return;
      const nameEn = String(window.prompt("ชื่อวิชาภาษาอังกฤษ (ถ้ามี)") ?? "").trim();
      const credits = Number(window.prompt("หน่วยกิต", "3"));
      if (!Number.isFinite(credits) || credits < 0) return alert("หน่วยกิตไม่ถูกต้อง");
      if (COURSES[code]) return alert("รหัสวิชานี้มีอยู่แล้ว");
      if (!confirm(`ส่งคำขอสร้างวิชา ${code} เพื่อให้ Staff อนุมัติหรือไม่`)) return;
      button.disabled = true;
      try {
        const createResponse = await fetch(`${API_BASE}/api/change-requests`, {
          method: "POST",
          headers: draftApiHeaders(),
          body: JSON.stringify({
            curriculumId: null,
            type: "edit_course",
            title: `สร้างรายวิชา ${code}`,
            note: "คำขอสร้างรายวิชาใหม่"
          })
        });
        const created = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok || !created.data?.id) throw new Error(created.error ?? "สร้างคำขอไม่สำเร็จ");
        const itemsResponse = await fetch(`${API_BASE}/api/change-requests/${created.data.id}/items`, {
          method: "PUT",
          headers: draftApiHeaders(),
          body: JSON.stringify({ items: [{ action: "CREATE_COURSE", courseCode: code, newValue: { code, name, nameEn, credits } }] })
        });
        const saved = await itemsResponse.json().catch(() => ({}));
        if (!itemsResponse.ok) throw new Error(saved.error ?? "บันทึกรายการสร้างวิชาไม่สำเร็จ");
        const submitResponse = await fetch(`${API_BASE}/api/change-requests/${created.data.id}/submit`, { method: "POST", headers: draftApiHeaders(), body: "{}" });
        const submitted = await submitResponse.json().catch(() => ({}));
        if (!submitResponse.ok) throw new Error(submitted.error ?? "ส่งคำขอไม่สำเร็จ");
        alert("ส่งคำขอสร้างวิชาแล้ว รอ Staff อนุมัติ");
        go("my-change-requests");
      } catch (error) {
        alert(error.message ?? "สร้างคำขอไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-plan-search]").forEach(input => {
    input.onkeydown = event => event.stopPropagation();
    input.onclick = event => event.stopPropagation();
    input.oninput = () => {
      state.editorSearch = { year: Number(input.dataset.year), term: Number(input.dataset.term), value: input.value };
      const query = norm(input.value);
      const results = document.querySelector(`[data-plan-results="${input.dataset.year}-${input.dataset.term}"]`);
      if (!results) return;
      const program = editorCurrentProgram();
      const usedCodes = new Set((state.planEdit?.terms ?? []).flatMap(term => term.courses ?? []));
      const matches = editorAvailableCourseEntries(program)
        .filter(([code]) => !usedCodes.has(code))
        .filter(([code, course]) => norm(`${code} ${course.name} ${course.nameEn ?? ""}`).includes(query))
        .slice(0, 8);
      results.innerHTML = matches.map(([code, course]) => `<button type="button" class="plan-search-result" data-plan-add-course="${esc(code)}" data-year="${input.dataset.year}" data-term="${input.dataset.term}">${esc(code)} — ${esc(course.name)}</button>`).join("");
      results.querySelectorAll("[data-plan-add-course]").forEach(button => {
        button.onclick = () => {
          const program = editorCurrentProgram();
          const year = Number(button.dataset.year);
          const term = Number(button.dataset.term);
          const target = state.planEdit?.terms.find(item => item.year === year && item.term === term);
          const code = button.dataset.planAddCourse;
          if (!program || !target || target.courses.includes(code)) return alert("ภาคนี้มีวิชานี้อยู่แล้ว");
          target.courses.push(code);
          state.planEdit.changes.push({ action: "add", code, year, term });
          state.editorSearch = null;
          render();
        };
      });
    };
  });

  document.querySelectorAll("[data-plan-add]").forEach(button => {
    button.onclick = () => {
      const input = button.parentElement?.querySelector("[data-plan-search]");
      input?.focus();
    };
  });

  document.querySelectorAll("[data-plan-summary]").forEach(button => {
    button.onclick = () => {
      const program = editorCurrentProgram();
      const lines = state.planEdit?.changes.map(change => change.action === "move"
        ? `ย้าย ${change.code}: ปี ${change.fromYear} ภาค ${change.fromTerm} → ปี ${change.toYear} ภาค ${change.toTerm}`
        : `${change.action === "add" ? "เพิ่ม" : "ลบ"} ${change.code}: ปี ${change.year} ภาค ${change.term}`).join("\n");
      if (program) alert(lines || "ยังไม่มีการเปลี่ยนแปลง");
    };
  });

  document.querySelectorAll("[data-plan-save], [data-plan-submit]").forEach(button => {
    button.onclick = async () => {
      const program = editorCurrentProgram();
      button.disabled = true;
      try {
        await savePlanDraft(program, button.hasAttribute("data-plan-submit"));
      } catch (error) {
        alert(error.message ?? "บันทึกไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-plan-cancel]").forEach(button => {
    button.onclick = () => {
      if (state.planEdit?.changes.length && !confirm("ยกเลิกการเปลี่ยนแปลงทั้งหมดหรือไม่")) return;
      state.planEdit = null;
      render();
    };
  });

  document.querySelectorAll("[data-editor-cancel]").forEach(button => {
    button.onclick = () => {
      if (state.planEdit?.changes.length && !confirm("ยกเลิกการเปลี่ยนแปลงทั้งหมดหรือไม่")) return;
      state.planEdit = null;
      state.editorProgram = null;
      go("curriculum-management");
    };
  });

  document.querySelectorAll("[data-editor-retry]").forEach(button => {
    button.onclick = () => {
      state.editorError = "";
      state.editorProgramLoaded = false;
      render();
    };
  });

  document.querySelectorAll("[data-editor-plan-select]").forEach(select => {
    select.onchange = () => {
      if (state.planEdit?.changes?.length && !confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก เปลี่ยนแผนย่อยและล้างการเปลี่ยนแปลงหรือไม่")) {
        render();
        return;
      }
      state.editorPlanId = select.value;
      state.planEdit.changes = [];
      state.editorLoading = false;
      state.editorError = "";
      state.editorProgramLoaded = false;
      render();
    };
  });

  document.querySelectorAll("[data-editor-course], [data-editor-course-detail]").forEach(button => {
    button.onclick = () => {
      state.courseEditorCourseId = button.dataset.editorCourse || button.dataset.editorCourseDetail;
      state.courseEditorStandalone = false;
      state.editorDrawer = null;
      state.view = "course-editor";
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-back]").forEach(button => {
    button.onclick = () => {
      if (state.courseEditorStandalone) {
        state.courseEditorCourseId = null;
        state.courseEditorQuery = "";
        render();
        return;
      }
      state.view = "curriculum-editor";
      state.courseEditorCourseId = null;
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-delete]").forEach(button => {
    button.onclick = () => {
      const code = state.courseEditorCourseId;
      const program = editorCurrentProgram();
      if (!code || !program || !state.planEdit?.terms) return;
      if (!confirm(`ต้องการลบ ${code} ออกจากแผนการเรียนนี้หรือไม่`)) return;
      const location = state.planEdit.terms.find(term => term.courses.includes(code));
      if (!location) return;
      const addedIndex = state.planEdit.changes.findIndex(change => change.action === "add" && change.code === code && change.year === location.year && change.term === location.term);
      location.courses = location.courses.filter(item => item !== code);
      if (addedIndex >= 0) {
        state.planEdit.changes.splice(addedIndex, 1);
      } else if (!state.planEdit.changes.some(change => change.action === "remove" && change.code === code && change.year === location.year && change.term === location.term)) {
        state.planEdit.changes.push({ action: "remove", code, year: location.year, term: location.term });
      }
      state.courseEditorCourseId = null;
      state.view = "curriculum-editor";
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-form]").forEach(form => {
    form.onsubmit = async event => {
      event.preventDefault();
      const oldCode = state.courseEditorCourseId;
      const data = new FormData(form);
      const newCode = courseKey(data.get("code"));
      const duplicate = Object.keys(COURSES).some(item => item === newCode && item !== oldCode);
      if (!newCode || duplicate) return alert(duplicate ? "รหัสวิชาซ้ำในระบบ" : "กรุณาระบุรหัสวิชา");
      const oldValue = { ...(COURSES[oldCode] ?? {}) };
      const newValue = { name: String(data.get("name") ?? "").trim(), nameEn: String(data.get("nameEn") ?? "").trim(), credits: Number(data.get("credits")), category: String(data.get("category") ?? "วิชาเฉพาะ"), prereq: COURSES[oldCode]?.prereq ?? [] };
      if (!newValue.name || !Number.isFinite(newValue.credits)) return alert("กรุณากรอกข้อมูลวิชาให้ครบ");
      if (state.courseEditorStandalone) {
        const program = editorCurrentProgram() || PROGRAMS[0];
        try {
          const createResponse = await fetch(`${API_BASE}/api/change-requests`, {
            method: "POST",
            headers: draftApiHeaders(),
            body: JSON.stringify({
              curriculumId: program.curriculumId,
              type: "edit_course",
              title: `แก้ไขรายวิชา ${oldCode}`,
              note: `แก้ไขข้อมูลรายวิชา ${oldCode}`
            })
          });
          const created = await createResponse.json().catch(() => ({}));
          if (!createResponse.ok || !created.data?.id) throw new Error(created.error ?? "สร้างคำขอแก้รายวิชาไม่สำเร็จ");
          const itemsResponse = await fetch(`${API_BASE}/api/change-requests/${created.data.id}/items`, {
            method: "PUT",
            headers: draftApiHeaders(),
            body: JSON.stringify({ items: [{ action: "EDIT_FIELD", courseCode: oldCode, oldValue, newValue }] })
          });
          const saved = await itemsResponse.json().catch(() => ({}));
          if (!itemsResponse.ok) throw new Error(saved.error ?? "บันทึกรายการแก้ไขไม่สำเร็จ");
          const submitResponse = await fetch(`${API_BASE}/api/change-requests/${created.data.id}/submit`, { method: "POST", headers: draftApiHeaders(), body: "{}" });
          const submitted = await submitResponse.json().catch(() => ({}));
          if (!submitResponse.ok) throw new Error(submitted.error ?? "ส่งคำขอแก้รายวิชาไม่สำเร็จ");
          state.draftRequestsLoaded = false;
          alert("ส่งคำขอแก้ไขรายวิชาแล้ว");
          go("my-change-requests");
        } catch (error) {
          alert(error.message ?? "ส่งคำขอแก้รายวิชาไม่สำเร็จ");
        }
        return;
      }
      COURSES[newCode] = { ...(COURSES[oldCode] ?? {}), ...newValue };
      if (newCode !== oldCode && state.planEdit?.terms) state.planEdit.terms.forEach(term => { term.courses = term.courses.map(item => item === oldCode ? newCode : item); });
      const location = state.planEdit?.terms.find(term => term.courses.includes(newCode));
      state.planEdit?.changes.push({ action: "edit", code: newCode, oldCode, year: location?.year, term: location?.term, oldValue, newValue });
      state.courseEditorCourseId = newCode;
      state.view = "curriculum-editor";
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-add-prereq]").forEach(button => {
    button.onclick = () => {
      const prerequisite = courseKey(prompt("ระบุรหัสวิชาบังคับก่อน") ?? "");
      const course = COURSES[state.courseEditorCourseId];
      if (!prerequisite || !course) return;
      if (!COURSES[prerequisite]) return alert("ไม่พบรหัสวิชานี้ในหลักสูตรย่อยที่กำลังแก้");
      if (prerequisite === state.courseEditorCourseId || (course.prereq ?? []).includes(prerequisite)) return alert("วิชาบังคับก่อนซ้ำหรือวนกลับมาที่ตัวเอง");
      course.prereq = [...(course.prereq ?? []), prerequisite];
      const location = state.planEdit?.terms.find(term => term.courses.includes(state.courseEditorCourseId));
      state.planEdit?.changes.push({ action: "prereq", code: state.courseEditorCourseId, year: location?.year, term: location?.term, newValue: { prerequisite } });
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-remove-prereq]").forEach(button => {
    button.onclick = () => {
      const course = COURSES[state.courseEditorCourseId];
      const prerequisite = button.dataset.courseEditorRemovePrereq;
      if (!course || !prerequisite) return;
      course.prereq = (course.prereq ?? []).filter(item => item !== prerequisite);
      const location = state.planEdit?.terms.find(term => term.courses.includes(state.courseEditorCourseId));
      state.planEdit?.changes.push({ action: "prereq", code: state.courseEditorCourseId, year: location?.year, term: location?.term, newValue: { removePrerequisite: prerequisite } });
      render();
    };
  });

  document.querySelectorAll("[data-course-editor-related]").forEach(button => {
    button.onclick = () => { state.courseEditorCourseId = button.dataset.courseEditorRelated; render(); };
  });

  document.querySelectorAll("[data-course-editor-search]").forEach(input => {
    input.oninput = () => {
      state.courseEditorQuery = input.value;
      render();
      const next = document.querySelector("[data-course-editor-search]");
      next?.focus();
      next?.setSelectionRange(input.value.length, input.value.length);
    };
  });

  document.querySelectorAll("[data-course-editor-open]").forEach(button => {
    button.onclick = () => {
      state.courseEditorCourseId = button.dataset.courseEditorOpen;
      state.courseEditorStandalone = true;
      render();
    };
  });

  document.querySelectorAll("[data-course-delete]").forEach(button => {
    button.onclick = async () => {
      const code = button.dataset.courseDelete;
      if (!confirm(`ลบวิชา ${code} ออกจาก Catalog หรือไม่`)) return;
      button.disabled = true;
      try {
        const response = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(code)}`, {
          method: "DELETE",
          headers: draftApiHeaders()
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "ลบวิชาไม่สำเร็จ");
        delete COURSES[code];
        alert("ลบวิชาแล้ว");
        await loadApiData();
        render();
      } catch (error) {
        alert(error.message ?? "ลบวิชาไม่สำเร็จ");
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-editor-drawer-close]").forEach(button => {
    button.onclick = () => { state.editorDrawer = null; render(); };
  });

  document.querySelectorAll("[data-editor-course-form]").forEach(form => {
    form.onsubmit = event => {
      event.preventDefault();
      const program = editorCurrentProgram();
      const oldCode = state.editorDrawer?.code;
      const data = new FormData(form);
      const newCode = String(data.get("code") ?? "").trim().replace(/\s+/g, "");
      const duplicate = Object.keys(COURSES).some(code => code === newCode && code !== oldCode);
      if (!newCode || duplicate) return alert(duplicate ? "รหัสวิชาซ้ำในระบบ" : "กรุณาระบุรหัสวิชา");
      const oldDetails = { ...(COURSES[oldCode] ?? {}) };
      const location = state.planEdit?.terms.find(term => term.courses.includes(oldCode));
      const details = { name: String(data.get("name") ?? "").trim(), nameEn: String(data.get("nameEn") ?? "").trim(), credits: Number(data.get("credits")), category: String(data.get("category") ?? "วิชาเฉพาะ"), prereq: COURSES[oldCode]?.prereq ?? [] };
      if (!details.name || !Number.isFinite(details.credits)) return alert("กรุณากรอกข้อมูลวิชาให้ครบ");
      COURSES[newCode] = { ...(COURSES[oldCode] ?? {}), ...details };
      if (newCode !== oldCode) {
        state.planEdit.terms.forEach(term => { term.courses = term.courses.map(code => code === oldCode ? newCode : code); });
      }
      state.planEdit.changes.push({ action: "edit", code: newCode, oldCode, year: location?.year, term: location?.term, oldValue: oldDetails, newValue: details });
      state.editorDrawer = null;
      if (program) render();
    };
  });

  document.querySelectorAll("[data-editor-add-prereq]").forEach(button => {
    button.onclick = () => {
      const code = prompt("ระบุรหัสวิชาบังคับก่อน");
      if (!code) return;
      const course = COURSES[state.editorDrawer?.code];
      if (!course) return;
      const prerequisite = code.trim().replace(/\s+/g, "");
      if (!COURSES[prerequisite]) return alert("ไม่พบรหัสวิชานี้ในรายการวิชา");
      if (prerequisite === state.editorDrawer.code || (course.prereq ?? []).includes(prerequisite)) return alert("วิชาบังคับก่อนซ้ำหรือวนกลับมาที่ตัวเอง");
      course.prereq = [...new Set([...(course.prereq ?? []), prerequisite])];
      const location = state.planEdit?.terms.find(term => term.courses.includes(state.editorDrawer.code));
      state.planEdit.changes.push({ action: "prereq", code: state.editorDrawer.code, year: location?.year, term: location?.term, newValue: { prerequisite } });
      render();
    };
  });

  document.querySelectorAll("[data-editor-remove-prereq]").forEach(button => {
    button.onclick = () => {
      const course = COURSES[state.editorDrawer?.code];
      const prerequisite = button.dataset.editorRemovePrereq;
      if (!course || !prerequisite) return;
      course.prereq = (course.prereq ?? []).filter(code => code !== prerequisite);
      const location = state.planEdit?.terms.find(term => term.courses.includes(state.editorDrawer.code));
      state.planEdit.changes.push({ action: "prereq", code: state.editorDrawer.code, year: location?.year, term: location?.term, newValue: { removePrerequisite: prerequisite } });
      render();
    };
  });

  document.querySelectorAll("[data-editor-related-course]").forEach(button => {
    button.onclick = () => {
      state.editorDrawer = { code: button.dataset.editorRelatedCourse };
      render();
    };
  });

  document.querySelectorAll("[data-editor-copy-level]").forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const firstSource = PROGRAMS[0];
      state.editorCopy = { level: button.dataset.editorCopyLevel, year: button.dataset.year, term: button.dataset.term, sourceId: firstSource?.id, sourcePlanId: firstSource?.activeStudyPlanId || firstSource?.studyPlans?.[0]?.id || null, sourceQuery: "" };
      render();
    };
  });

  document.querySelectorAll("[data-editor-copy-close]").forEach(button => {
    button.onclick = () => { state.editorCopy = null; render(); };
  });

  document.querySelectorAll("[data-editor-copy-dialog]").forEach(dialog => {
    dialog.onclick = event => event.stopPropagation();
  });

  document.querySelectorAll("[data-editor-copy-source-search]").forEach(input => {
    input.oninput = () => {
      state.editorCopy.sourceQuery = input.value;
      render();
      const nextInput = document.querySelector("[data-editor-copy-source-search]");
      nextInput?.focus();
      nextInput?.setSelectionRange(input.value.length, input.value.length);
    };
  });

  document.querySelectorAll("[data-editor-copy-source-choice]").forEach(button => {
    button.onclick = () => {
      const nextSource = PROGRAMS.find(program => program.id === button.dataset.editorCopySourceChoice);
      state.editorCopy.sourceId = button.dataset.editorCopySourceChoice;
      state.editorCopy.sourcePlanId = nextSource?.activeStudyPlanId || nextSource?.studyPlans?.[0]?.id || null;
      render();
    };
  });

  document.querySelectorAll("[data-editor-copy-plan-choice]").forEach(button => {
    button.onclick = () => {
      state.editorCopy.sourcePlanId = button.dataset.editorCopyPlanChoice;
      render();
    };
  });

  document.querySelectorAll("[data-editor-copy-confirm]").forEach(button => {
    button.onclick = async () => {
      const copy = state.editorCopy;
      const target = editorCurrentProgram();
      const source = PROGRAMS.find(program => program.id === copy?.sourceId);
      if (!copy || !target || !source) return;
      const sourcePlan = source.studyPlans?.find(plan => plan.id === (copy.sourcePlanId || source.activeStudyPlanId)) || source.studyPlans?.[0];
      const sourceTerms = sourcePlan?.plan ?? source.plan ?? [];
      let selected = sourceTerms;
      if (copy.level === "year") selected = selected.filter(term => term.year === Number(copy.year));
      if (copy.level === "term") selected = selected.filter(term => term.year === Number(copy.year) && term.term === Number(copy.term));
      const mode = document.querySelector("[data-editor-copy-mode]")?.value ?? "append";
      const targetTerms = copy.level === "curriculum"
        ? state.planEdit.terms
        : state.planEdit.terms.filter(term => copy.level === "year" ? term.year === Number(copy.year) : term.year === Number(copy.year) && term.term === Number(copy.term));
      if (mode === "replace") targetTerms.forEach(term => { term.courses = []; });
      selected.forEach(sourceTerm => {
        const targetTerm = state.planEdit.terms.find(term => term.year === sourceTerm.year && term.term === sourceTerm.term);
        if (!targetTerm) return;
        sourceTerm.courses.forEach(code => {
          if (!targetTerm.courses.includes(code)) {
            targetTerm.courses.push(code);
            state.planEdit.changes.push({ action: "add", code, year: targetTerm.year, term: targetTerm.term, copiedFrom: source.curriculumId });
          }
        });
      });
      state.editorCopy = null;
      render();
    };
  });


  /* -------------------------
     Navigation
     ------------------------- */

  document
    .querySelectorAll(
      "[data-go]"
    )
    .forEach(b => {

      b.onclick = () => {

        if (state.view === "curriculum-editor" && state.planEdit?.changes?.length && b.dataset.go !== "curriculum-editor") {
          if (!confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่")) return;
          state.planEdit = null;
          state.editorProgram = null;
        }

        go(
          b.dataset.go,
          b.dataset.id
        );

      };

    });


  /* -------------------------
     Mobile menu
     ------------------------- */

  const menu =
    document.getElementById(
      "menuBtn"
    );


  if (menu) {

    menu.onclick = () => {

      state.navOpen =
        !state.navOpen;

      render();

    };

  }


  /* -------------------------
     HOME SEARCH
     ------------------------- */

  const hs = document.getElementById("homeSearch");

  if (hs) {
    hs.oninput = e => {
      state.homeQuery = e.target.value;

      // ไม่ render ทั้งหน้า
      // เพื่อไม่ให้ input หลุด focus ตอนพิมพ์
      const query = state.homeQuery.trim().toLowerCase();

      // หา container ของผลค้นหา
      const resultsBox = document.getElementById("homeSearchResults");

      if (resultsBox) {
        if (!query) {
          resultsBox.innerHTML = "";
          resultsBox.style.display = "none";
          return;
        }

        let results = [];

        // -------------------------
        // SEARCH PROGRAMS
        // -------------------------
        PROGRAMS.forEach(p => {
          const text = (
            p.code +
            " " +
            p.nameEn +
            " " +
            p.faculty
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="program"
              data-id="${esc(p.id)}"
            >
              <span class="search-result-type">หลักสูตร</span>
              <span class="search-result-title">
                ${esc(p.code)}
              </span>
            </button>
          `);
          }
        });

        // -------------------------
        // SEARCH COURSES
        // -------------------------
        Object.entries(COURSES).forEach(([code, c]) => {
          const text = (
            code +
            " " +
            c.name +
            " " +
            c.nameEn
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="course"
              data-id="${esc(code)}"
            >
              <span class="search-result-type">รายวิชา</span>
              <span class="search-result-title">
                ${esc(code)} · ${esc(c.name)}
              </span>
            </button>
          `);
          }
        });

        // -------------------------
        // SEARCH FAQ
        // -------------------------
        FAQS.forEach(f => {
          const text = (
            f.q +
            " " +
            f.a
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="faq"
            >
              <span class="search-result-type">คำถาม</span>
              <span class="search-result-title">
                ${esc(f.q)}
              </span>
            </button>
          `);
          }
        });

        results = results.slice(0, 6);

        if (results.length) {
          resultsBox.innerHTML = results.join("");
          resultsBox.style.display = "block";

          // bind เฉพาะปุ่มผลค้นหา
          resultsBox
            .querySelectorAll("[data-go]")
            .forEach(btn => {
              btn.onclick = () => {
                go(
                  btn.dataset.go,
                  btn.dataset.id
                );
              };
            });
        } else {
          resultsBox.innerHTML = `
          <div class="search-no-result">
            ไม่พบข้อมูลที่ตรงกับคำค้นหา
          </div>
        `;
          resultsBox.style.display = "block";
        }
      }
    };
  }


  /* -------------------------
     COURSE SEARCH
     ------------------------- */

  const cs =
    document.getElementById(
      "courseSearch"
    );


  if (cs) {
    cs.oninput = e => {
      state.courseQuery = e.target.value;

      const query = norm(
        state.courseQuery
      );

      document
        .querySelectorAll(".course-card")
        .forEach(card => {
          const text =
            norm(card.textContent);

          card.style.display =
            !query || text.includes(query)
              ? ""
              : "none";
        });
    };
  }

  /* -------------------------
     PROGRAM FILTER
     ------------------------- */

  const pf =
    document.getElementById(
      "programFilter"
    );


  if (pf) {

    pf.onchange = e => {

      state.programFilter =
        e.target.value;

      render();

    };

  }


  /* -------------------------
     NO PREREQUISITE
     ------------------------- */

  const np =
    document.getElementById(
      "noPrereq"
    );


  if (np) {

    np.onchange = e => {

      state.noPrereqOnly =
        e.target.checked;

      render();

    };

  }


  /* -------------------------
     FAQ SEARCH
     ------------------------- */

  const fs =
    document.getElementById(
      "faqSearch"
    );


  if (fs) {

    fs.oninput = e => {

      state.faqQuery =
        e.target.value;



    };

  }


  /* -------------------------
     PROGRAM TABS
     ------------------------- */

  document
    .querySelectorAll(
      "[data-tab]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.programTab =
          b.dataset.tab;

        syncHistoryState();

        render();

      };

    });


  /* -------------------------
     YEAR TABS
     ------------------------- */

  document
    .querySelectorAll(
      ".year-tab[data-year], .plan-year-tab[data-year]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.year =
          Number(
            b.dataset.year
          );

        syncHistoryState();

        render();

      };

    });

  document
    .querySelectorAll("[data-study-plan]")
    .forEach(button => {
      button.onclick = () => {
        const program = PROGRAMS.find(item => item.id === state.programId);
        const selected = program?.studyPlans?.find(
          plan => plan.id === button.dataset.studyPlan
        );
        if (!program || !selected) return;
        program.activeStudyPlanId = selected.id;
        program.plan = selected.plan;
        syncHistoryState();
        render();
      };
    });


  /* -------------------------
     FAQ OPEN / CLOSE
     ------------------------- */

  document
    .querySelectorAll(
      "[data-faq]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.openFaq =
          state.openFaq ===
            b.dataset.faq
            ? null
            : b.dataset.faq;

        render();

      };

    });

  document.querySelectorAll("[data-study-plan-select]").forEach(select => {
    select.onchange = () => {
      const program = PROGRAMS.find(item => item.id === state.programId) || PROGRAMS[0];
      const choice = (program.studyPlans ?? []).find(plan => plan.id === select.value);

      if (!choice && select.value.endsWith("-default")) {
        state.programId = program.id;
        state.programTab = "plan";
        syncHistoryState();
        render();
        return;
      }

      if (!choice) return;
      state.programId = program.id;
      program.activeStudyPlanId = choice.id;
      program.plan = choice.plan;
      state.programTab = "plan";
      syncHistoryState();
      render();
    };
  });

  document.querySelectorAll("[data-curriculum-year]").forEach(select => {
    select.onchange = () => {
      const currentProgram = PROGRAMS.find(program => program.id === state.programId) || PROGRAMS[0];
      const nextProgram = programVersions(currentProgram).find(
        program => String(program.revisionYear) === select.value
      );
      if (!nextProgram) return;
      state.programId = nextProgram.id;
      state.programTab = "plan";
      syncHistoryState();
      render();
    };
  });

}


/* =========================================================
   START
   ========================================================= */

/* =========================================================
BROWSER BACK / FORWARD
========================================================= */

window.addEventListener("popstate", event => {
  const pageState = event.state;

  // ถ้าไม่มี history state ให้กลับหน้าแรก
  if (!pageState) {
    state.view = "home";
    state.programId = null;
    state.courseCode = null;
    state.programTab = "overview";
    state.year = 1;
  } else {
    state.view = pageState.view || "home";
    state.programId = pageState.programId || null;
    state.courseCode = pageState.courseCode || null;
    state.programTab =
      pageState.programTab || "overview";
    state.year = pageState.year || 1;
  }

  restoreEditorRoute(pageState || {});

  state.navOpen = false;

  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

async function bootstrap() {
  restoreMockUser();
  const pageState = history.state;
  if (pageState?.view) {
    state.view = pageState.view;
    state.programId = pageState.programId || null;
    state.courseCode = pageState.courseCode || null;
    state.programTab = pageState.programTab || "overview";
    state.year = pageState.year || 1;
  }
  restoreEditorRoute(pageState || {});
  render();
  await loadApiData();
  render();
}

bootstrap();
