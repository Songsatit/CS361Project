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

const MOCK_USERS = window.MOCK_USERS;


function canAccessCurriculumManagement(user = state.user) {
  return ["instructor", "staff", "curriculum_admin"].includes(user?.role);
}

function canViewAuditLogs(user = state.user) {
  return ["staff", "curriculum_admin"].includes(user?.role);
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
    state.user = saved ? JSON.parse(saved) : null;
  } catch {
    state.user = null;
  }
}

function mockLogin(username, password) {
  const account = MOCK_USERS[username.trim().toLowerCase()];
  if (!account || account.password !== password) return false;
  state.user = { username: username.trim().toLowerCase(), role: account.role, roleLabel: account.roleLabel, name: account.name };
  localStorage.setItem("cs361-v3-user", JSON.stringify(state.user));
  return true;
}

function mockLogout() {
  state.user = null;
  localStorage.removeItem("cs361-v3-user");
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
  const request = fetch(`${API_BASE}/api/audit-logs?limit=50`)
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
    const response = await fetch(`${API_BASE}/api/curriculum-changes?curriculumId=${encodeURIComponent(curriculumId)}`);
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

      ${state.user.role === "curriculum_admin" ? `
        <section class="role-capability-card curriculum-edit-card">
          <h2>เสนอแก้ไขข้อมูลหลักสูตร</h2>
          <p>เลือกประเภทการแก้ไข ระบบจะบันทึกเป็นฉบับร่างและยังไม่กระทบข้อมูลหลักจนกว่าจะอนุมัติ</p>
          <form id="curriculumChangeForm" class="curriculum-change-form">
            <label>ประเภทการแก้ไข
              <select name="changeType" id="changeType">
                <option value="academic_year">เปลี่ยนปีหลักสูตร</option>
                <option value="course_replace">เปลี่ยนรายวิชา</option>
              </select>
            </label>
            <label data-change-field="academic_year">ปีหลักสูตรใหม่
              <input name="academicYear" type="number" min="2500" max="2600" value="${esc(program.academicYear ?? (program.curriculumId.match(/(25\\d{2})/) || ["", "2566"])[1])}">
            </label>
            <label data-change-field="course_replace" hidden>รหัส Curriculum Course เดิม
              <input name="curriculumCourseId" placeholder="เช่น BSC-CS-2566-CIS-CS361">
            </label>
            <label data-change-field="course_replace" hidden>รหัสวิชาใหม่
              <input name="newCourseCode" placeholder="เช่น CS 331">
            </label>
            <button class="workflow-action workflow-action--primary" type="submit">บันทึกฉบับร่าง</button>
          </form>
        </section>
      ` : ""}

      ${canAudit ? `
        <section class="audit-log-card curriculum-change-list">
          <div class="audit-log-head"><h2>รายการแก้ไขที่รอตรวจสอบ</h2><span>${pendingChanges.length} รายการ</span></div>
          ${pendingChanges.length ? `<div class="audit-log-table-wrap"><table class="audit-log-table">
            <thead><tr><th>หลักสูตร</th><th>การแก้ไข</th><th>สถานะ</th><th>การดำเนินการ</th></tr></thead>
            <tbody>${pendingChanges.map(change => `
              <tr><td>${esc(change.curriculum_id)}</td><td>${change.payload?.changeType === "course_replace" ? `เปลี่ยน ${esc(change.payload.curriculumCourseId)} เป็น ${esc(change.payload.newCourseCode)}` : `ปี พ.ศ. ${esc(change.payload?.academicYear)}`}</td><td>${esc(change.status)}</td><td>
                <button class="link-btn" data-change-action="approve" data-change-id="${esc(change.change_id)}">อนุมัติ</button><button class="link-btn" data-change-action="reject" data-change-id="${esc(change.change_id)}">ปฏิเสธ</button>
              </td></tr>`).join("")}</tbody>
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
                    <td>${esc(log.action)}</td>
                    <td>${esc(log.entity_id)}</td>
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
    if (!program.pathwayId) continue;
    const pathwayPlans = plans.filter(plan => plan.pathway_id === program.pathwayId);
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
          label: studyPlanLabel(plan.study_plan_id, plan.plan_name),
          plan: [...grouped.values()].sort(
            (a, b) => a.year - b.year || a.term - b.term
          )
        });
      }
    }

    if (loadedPlans.length) {
      const selected = loadedPlans.find(plan => /PROJECT$/i.test(plan.id)) ?? loadedPlans[0];
      program.studyPlans = loadedPlans;
      program.activeStudyPlanId = selected.id;
      program.plan = selected.plan;
    }
  }
}

function studyPlanLabel(planId, planName) {
  if (planName) {
    if (/สหกิจ|co-?operative/i.test(planName)) return "แผนสหกิจศึกษา";
    if (/โครงงาน|project/i.test(planName)) return "แผนโครงงานพิเศษ";
    if (/สายโท|minor/i.test(planName)) return "แผนเลือกสายโท";
  }
  if (/COOP$/i.test(planId)) return "แผนสหกิจศึกษา";
  if (/PROJECT$/i.test(planId)) return "แผนโครงงานพิเศษ";
  if (/MINOR|สายโท/i.test(planId)) return "แผนเลือกสายโท";
  return planId;
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
      `${API_BASE}/api/courses?limit=500`,
      { signal: controller.signal }
    );
    window.clearTimeout(timeout);

    if (!coursesResponse.ok) {
      throw new Error(`Course API returned ${coursesResponse.status}`);
    }
    state.apiStatus = "ok";

    const coursesPayload = await coursesResponse.json();
    const courses = coursesPayload?.data ?? [];

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
        curriculumCourseId: course.curriculum_course_id
      };
    }

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
      if (!hasLiveCourses) PROGRAMS.splice(index, 1);
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

const esc = s =>
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

const norm = s =>
  (s || "")
    .toString()
    .toLowerCase();

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
                      ${it.id ? `data-id="${it.id}"` : ""}
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
      data-id="${latest.id}"
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
            ${esc(latest.duration)}
          </span>

          <span>
            ${courseCode(latest.totalCredits + " นก.")}
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
                          data-go="${r[2]}"
                          data-id="${r[3]}"
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


/* =========================================================
   PROGRAM DETAIL
   ========================================================= */

function renderProgram() {

  const p =
    PROGRAMS.find(
      x => x.id === state.programId
    ) || PROGRAMS[0];


  const years = [
    ...new Set(
      p.plan.map(t => t.year)
    )
  ];


  if (!years.includes(state.year)) {
    state.year = years[0];
  }


  const terms =
    p.plan.filter(
      t => t.year === state.year
    );


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
  const planCourses = (p.plan ?? []).flatMap(term => term.courses ?? []);
  const planCredits = planCourses.reduce((total, code) => {
    if (code === "FREE3") return total + 3;
    return total + (COURSES[code]?.credits ?? 0);
  }, 0);


  /* -------------------------
     OVERVIEW
     ------------------------- */

  if (
    state.programTab === "overview"
  ) {

    content = `
      <div class="panel">

        <p class="program-summary">
          ${esc(p.summary)}
        </p>


        <div class="stat-row">

          <div class="stat-box">

            <div class="stat-num">
              ${p.totalCredits}
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

          ${p.structure
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
              p.totalCredits) *
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
        .join("")}

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
          <h2>${esc(studyPlanMajorLabel(p))} — ${esc(p.studyPlans?.find(plan => plan.id === activePlanId)?.label ?? "แผนหลัก")}</h2>
          <p>แผนการศึกษาจากหลักสูตรปรับปรุง พ.ศ. ${esc(p.revisionYear)}</p>
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
            <span><small>รายวิชา/ข้อกำหนด</small><strong>${planCourses.length} รายการ</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▦</span>
            <span><small>จำนวนปี</small><strong>${years.length} ปี</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▥</span>
            <span><small>จำนวนภาคการศึกษา</small><strong>${p.plan.length} ภาค</strong></span>
          </div>
          <div class="study-plan-stat">
            <span class="study-plan-stat-icon">▣</span>
            <span><small>จำนวนหน่วยกิตทั้งหมด</small><strong>${planCredits} หน่วยกิต</strong></span>
          </div>
        </div>

        <div class="year-tabs">

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

        </div>


        <div class="term-grid">

          ${terms
        .map(t => {

          let total = 0;

          t.courses.forEach(code => {

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


                return `
                          <button
                            class="term-course-row"
                            data-go="course"
                            data-id="${code}"
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

                  </div>

                </div>
              `;

        })
        .join("")}

        </div>

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
                data-id="${code}"
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
    ["home", "หน้าแรก"],
    ["programs", "หลักสูตร"],
    ["courses", "ค้นหารายวิชา"],
    ["faq", "คำถามที่พบบ่อย"]
  ];
  if (canAccessCurriculumManagement()) {
    nav.push(["workflow", "ตรวจสอบข้อมูลหลักสูตร", state.programId || PROGRAMS[0].id]);
  }
  if (canAccessStudentProfile()) {
    nav.push(["profile", "ข้อมูลส่วนตัว"]);
  }


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
            ${canAccessCurriculumManagement() ? `<button data-go="workflow" data-id="${esc(state.programId || PROGRAMS[0].id)}" role="menuitem">ตรวจสอบข้อมูลหลักสูตร</button>` : ""}
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
    workflow: renderWorkflowPage
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
  }
  if (state.view === "profile" && canAccessStudentProfile() && !state.studentProfile && !state.studentProfileLoading) {
    loadStudentProfile().then(() => {
      if (state.view === "profile") render();
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
  if (v === "profile" && !canAccessStudentProfile()) {
    state.view = state.user ? "home" : "login";
    render();
    return;
  }

  state.view = v;

  if (v === "program" || v === "workflow") {
    state.programId = id;
    if (v === "program") state.programTab = "overview";
  }

  if (v === "course") {
    state.courseCode = id;
  }

  if (v === "profile") {
    state.studentProfile = null;
    state.studentProfileAttempted = false;
    state.studentProfileError = "";
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
      year: state.year
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
        mockLogout();
        state.studentProfile = null;
        state.studentProfileAttempted = false;
        state.studentProfileError = "";
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

      if (MOCK_USERS[username.trim().toLowerCase()]?.password === password) {
        mockLogin(username, password);
        state.loginOpen = false;
        state.loginError = "";
        go("home");
        return;
      }

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
        localStorage.setItem("cs361-v3-user", JSON.stringify(state.user));
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: button.dataset.workflowAction,
              username: state.user.username,
              role: state.user.role
            })
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
  if (curriculumChangeForm) {
    curriculumChangeForm.onsubmit = async event => {
      event.preventDefault();
      const program = PROGRAMS.find(item => item.id === state.programId);
      const formData = new FormData(curriculumChangeForm);
      const changeType = String(formData.get("changeType"));
      const payload = changeType === "course_replace"
        ? { changeType, curriculumCourseId: String(formData.get("curriculumCourseId") ?? "").trim(), newCourseCode: String(formData.get("newCourseCode") ?? "").trim() }
        : { changeType, academicYear: Number(formData.get("academicYear")) };
      const response = await fetch(`${API_BASE}/api/curriculum-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumId: program?.curriculumId,
          operation: "update",
          changeType,
          payload,
          username: state.user.username,
          role: state.user.role
        })
      });
      const resultPayload = await response.json().catch(() => ({}));
      if (!response.ok) return alert(resultPayload.error ?? "บันทึกฉบับร่างไม่สำเร็จ");
      state.curriculumChangesLoaded = false;
      loadCurriculumChanges(program?.curriculumId).then(() => render());
    };
    const changeType = curriculumChangeForm.querySelector("[name=changeType]");
    const updateChangeFields = () => {
      curriculumChangeForm.querySelectorAll("[data-change-field]").forEach(field => {
        field.hidden = field.dataset.changeField !== changeType.value;
        field.querySelectorAll("input").forEach(input => { input.required = !field.hidden; });
      });
    };
    changeType.onchange = updateChangeFields;
    updateChangeFields();
  }

  document.querySelectorAll("[data-change-action]").forEach(button => {
    button.onclick = async () => {
      const response = await fetch(`${API_BASE}/api/curriculum-changes/${encodeURIComponent(button.dataset.changeId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: button.dataset.changeAction, username: state.user.username, role: state.user.role })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return alert(payload.error ?? "ดำเนินการกับรายการแก้ไขไม่สำเร็จ");
      state.curriculumChangesLoaded = false;
      const program = PROGRAMS.find(item => item.id === state.programId);
      loadCurriculumChanges(program?.curriculumId).then(() => render());
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
              data-id="${p.id}"
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
              data-id="${code}"
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
      "[data-year]"
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
  render();
  await loadApiData();
  render();
}

bootstrap();
