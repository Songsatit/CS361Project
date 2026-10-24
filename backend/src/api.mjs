import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 2,
  queueLimit: 0,
});

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const queryRows = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

async function tuLogin(event) {
  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response(400, { error: 'Request body must be valid JSON' });
  }

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) {
    return response(400, { error: 'username and password are required' });
  }
  if (!process.env.TU_APPLICATION_KEY) {
    console.error('TU_APPLICATION_KEY is not configured');
    return response(503, { error: 'TU authentication is not configured' });
  }

  const authResponse = await fetch(
    process.env.TU_AUTH_URL ?? 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify2',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Application-Key': process.env.TU_APPLICATION_KEY,
      },
      body: JSON.stringify({ UserName: username, PassWord: password }),
    },
  );
  const payload = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || payload.status !== true) {
    return response(authResponse.status === 401 || authResponse.status === 403 ? authResponse.status : 401, {
      error: payload.message ?? 'TU authentication failed',
    });
  }

  return response(200, {
    user: {
      username: payload.username ?? username,
      displayNameTh: payload.displayname_th ?? '',
      displayNameEn: payload.displayname_en ?? '',
      email: payload.email ?? '',
      type: payload.type ?? 'student',
      role: payload.type === 'student' ? 'student' : 'staff',
      roleLabel: payload.type === 'student' ? 'นักศึกษา' : 'เจ้าหน้าที่',
      tuStatus: payload.tu_status ?? null,
      statusId: payload.statusid ?? null,
      department: payload.department ?? null,
      faculty: payload.faculty ?? null,
      organization: payload.organization ?? null,
    },
  });
}

async function getStudentProfile(event) {
  const query = event.queryStringParameters ?? Object.fromEntries(
    new URLSearchParams(event.rawQueryString ?? ''),
  );
  const studentId = String(query.id ?? '').trim();
  if (!studentId) return response(400, { error: 'student id is required' });
  if (!process.env.TU_APPLICATION_KEY) {
    console.error('TU_APPLICATION_KEY is not configured');
    return response(503, { error: 'TU profile API is not configured' });
  }

  const profileResponse = await fetch(
    `https://restapi.tu.ac.th/api/v2/profile/std/info/?id=${encodeURIComponent(studentId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Application-Key': process.env.TU_APPLICATION_KEY,
      },
    },
  );
  const payload = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok) {
    return response(profileResponse.status, { error: payload.message ?? 'Unable to load student profile' });
  }

  const profile = payload.data ?? payload;

  return response(200, {
    data: {
      studentId: profile.userName ?? profile.username ?? profile.studentid ?? studentId,
      displayNameTh: profile.displayname_th ?? '',
      displayNameEn: profile.displayname_en ?? '',
      statusId: profile.statusid ?? profile.statsid ?? null,
      statusName: profile.statusname ?? '',
      levelName: profile.level_name ?? '',
      faculty: profile.faculty ?? '',
      department: profile.department ?? '',
      email: profile.email ?? '',
    },
  });
}

export const authHandler = async (event) => {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    if (method === 'GET') return await getStudentProfile(event);
    return await tuLogin(event);
  } catch (error) {
    console.error('TU authentication request failed', error);
    return response(502, { error: 'Unable to reach TU Authentication API' });
  }
};

export async function writeAuditLog({
  username,
  role,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
}) {
  await pool.execute(
    `INSERT INTO audit_log
      (actor_username, actor_role, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      role,
      action,
      entityType,
      entityId,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
    ],
  );
}

function pathParameter(event, name) {
  return event.pathParameters?.[name] ?? event.pathParameters?.[name.toLowerCase()];
}

async function listCourses(event) {
  const query = event.queryStringParameters ?? {};
  const conditions = [];
  const params = [];

  if (query.curriculumId) {
    conditions.push('cc.curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.pathwayId) {
    conditions.push('cc.pathway_id = ?');
    params.push(query.pathwayId);
  }
  if (query.q) {
    conditions.push('(c.course_code LIKE ? OR c.course_code_th LIKE ? OR c.title_th LIKE ? OR c.title_en LIKE ?)');
    const term = `%${query.q}%`;
    params.push(term, term, term, term);
  }

  const limit = Math.max(1, Math.min(Number.parseInt(query.limit ?? '100', 10) || 100, 500));
  const offset = Math.max(0, Number.parseInt(query.offset ?? '0', 10) || 0);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const placements = await queryRows(
    `SELECT c.course_id, c.course_code, c.course_code_th, c.title_th, c.title_en,
            c.credits_total, c.status, c.active, cc.curriculum_course_id,
            cc.curriculum_id, cur.academic_year, cc.pathway_id, cc.course_group,
            cc.requirement_type
       FROM curriculum_course cc
       JOIN course c ON c.course_id = cc.course_id
       JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id
       ${where}
      ORDER BY c.course_code, cc.curriculum_id, cc.pathway_id
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  await addClassifications(placements);
  return response(200, { data: placements, pagination: { limit, offset, count: placements.length } });
}

async function addClassifications(placements) {
  if (!placements.length) return;
  const ids = [...new Set(placements.map((item) => item.curriculum_course_id))];
  const marks = ids.map(() => '?').join(',');
  const rows = await queryRows(
    `SELECT cl.curriculum_course_id, cl.course_type_code, cl.course_type_label_th,
            cl.other_detail, sc.subcategory_code, sc.label_th AS subcategory_label_th,
            sc.detail AS subcategory_detail
       FROM course_classification cl
       LEFT JOIN course_subcategory sc ON sc.curriculum_course_id = cl.curriculum_course_id
      WHERE cl.curriculum_course_id IN (${marks})
      ORDER BY sc.subcategory_code`,
    ids,
  );
  const byPlacement = new Map();
  for (const row of rows) {
    let classification = byPlacement.get(row.curriculum_course_id);
    if (!classification) {
      classification = {
        course_type: { code: row.course_type_code, label_th: row.course_type_label_th },
        other_detail: row.other_detail,
        subcategories: [],
      };
      byPlacement.set(row.curriculum_course_id, classification);
    }
    if (row.subcategory_code) {
      classification.subcategories.push({
        code: row.subcategory_code,
        label_th: row.subcategory_label_th,
        detail: row.subcategory_detail,
      });
    }
  }
  for (const placement of placements) {
    placement.classification = byPlacement.get(placement.curriculum_course_id) ?? null;
  }
}

async function getCourse(event) {
  const courseId = pathParameter(event, 'courseId') ?? pathParameter(event, 'courseCode');
  if (!courseId) return response(400, { error: 'courseId is required' });

  const courses = await queryRows(
    `SELECT c.course_id, c.course_code, c.course_code_th, c.title_th, c.title_en,
            c.credits_total, c.status, c.active, cc.curriculum_course_id,
            cc.curriculum_id, cur.academic_year, cc.pathway_id, cc.course_group,
            cc.requirement_type
       FROM course c
       LEFT JOIN curriculum_course cc ON cc.course_id = c.course_id
       LEFT JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id
      WHERE c.course_id = ?
         OR c.course_code = ?
         OR REPLACE(c.course_code, ' ', '') = REPLACE(?, ' ', '')
      ORDER BY cc.curriculum_id, cc.pathway_id`,
    [courseId, courseId, courseId],
  );
  if (!courses.length) return response(404, { error: 'Course not found' });

  await addClassifications(courses);
  const prerequisites = await getPrerequisiteChain(courses[0].course_id);
  const dependents = await getDependentCourses(courses[0].course_id);
  let detail = null;
  try {
    const details = await queryRows(
      `SELECT description_th, description_en, contact_hours_json, raw_json
         FROM course_detail
        WHERE course_id = ?`,
      [courses[0].course_id],
    );
    detail = details[0] ?? null;
  } catch (error) {
    // Keep the existing course endpoint usable until migration 002 is applied.
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return response(200, {
    data: { ...courses[0], placements: courses, prerequisites, dependents, detail },
  });
}

async function getPrerequisiteChain(courseId) {
  const visited = new Set([courseId]);
  let frontier = [{ courseId, depth: 0 }];
  const chain = [];

  while (frontier.length && frontier[0].depth < 20) {
    const sourceIds = frontier.map((item) => item.courseId);
    const nextRows = await queryRows(
      `SELECT p.course_id, p.prerequisite_course_id, required.course_code,
              required.course_code_th, required.title_th, required.title_en
         FROM prerequisite p
         JOIN course required ON required.course_id = p.prerequisite_course_id
        WHERE p.course_id IN (${sourceIds.map(() => '?').join(',')})
        ORDER BY required.course_code`,
      sourceIds,
    );
    const nextFrontier = [];
    for (const row of nextRows) {
      const depth = (frontier.find((item) => item.courseId === row.course_id)?.depth ?? 0) + 1;
      chain.push({ ...row, depth, completed: false });
      if (!visited.has(row.prerequisite_course_id)) {
        visited.add(row.prerequisite_course_id);
        nextFrontier.push({ courseId: row.prerequisite_course_id, depth });
      }
    }
    frontier = nextFrontier;
  }
  return chain;
}

async function getDependentCourses(courseId) {
  return queryRows(
    `SELECT dependent.course_id, dependent.course_code, dependent.course_code_th,
            dependent.title_th, dependent.title_en
       FROM prerequisite p
       JOIN course dependent ON dependent.course_id = p.course_id
      WHERE p.prerequisite_course_id = ?
      ORDER BY dependent.course_code`,
    [courseId],
  );
}

async function listPrerequisites(event) {
  const courseId = pathParameter(event, 'courseId') ?? pathParameter(event, 'courseCode');
  if (!courseId) return response(400, { error: 'courseId is required' });

  const matches = await queryRows(
    `SELECT course_id
       FROM course
      WHERE course_id = ?
         OR course_code = ?
         OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
      LIMIT 1`,
    [courseId, courseId, courseId],
  );
  if (!matches.length) return response(404, { error: 'Course not found' });
  const data = await getPrerequisiteChain(matches[0].course_id);
  return response(200, { data: { courseId: matches[0].course_id, prerequisites: data } });
}

async function listGraduationConditions(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const data = await queryRows(
    `SELECT condition_id, curriculum_id, display_order, condition_text
       FROM curriculum_graduation_condition
      WHERE curriculum_id = ?
      ORDER BY display_order, condition_id`,
    [curriculumId],
  );
  return response(200, { data });
}

async function listStudyPlans(event) {
  const query = event.queryStringParameters ?? {};
  const conditions = [];
  const params = [];
  if (query.curriculumId) {
    conditions.push('sp.curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.pathwayId) {
    conditions.push('sp.pathway_id = ?');
    params.push(query.pathwayId);
  }
  if (query.active !== undefined) {
    conditions.push('sp.active = ?');
    params.push(query.active === 'false' ? 0 : 1);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const data = await queryRows(
    `SELECT sp.study_plan_id, sp.curriculum_id, sp.pathway_id, sp.plan_name, sp.active
       FROM study_plan sp
       ${where}
      ORDER BY sp.curriculum_id, sp.pathway_id, sp.study_plan_id`,
    params,
  );
  return response(200, { data });
}

async function getStudyPlan(event) {
  const studyPlanId = event.queryStringParameters?.studyPlanId ?? pathParameter(event, 'studyPlanId');
  if (!studyPlanId) return response(400, { error: 'studyPlanId is required' });
  const plans = await queryRows(
    `SELECT study_plan_id, curriculum_id, pathway_id, plan_name, active
       FROM study_plan
      WHERE study_plan_id = ?`,
    [studyPlanId],
  );
  if (!plans.length) return response(404, { error: 'Study plan not found' });
  const query = event.queryStringParameters ?? {};
  const conditions = ['spi.study_plan_id = ?'];
  const params = [studyPlanId];
  if (query.studyYear) {
    conditions.push('spi.study_year = ?');
    params.push(Number.parseInt(query.studyYear, 10));
  }
  if (query.semester) {
    conditions.push('spi.semester = ?');
    params.push(Number.parseInt(query.semester, 10));
  }
  const items = await queryRows(
    `SELECT spi.study_year, spi.semester, spi.item_order, spi.course_id,
            c.course_code, c.title_th, c.title_en, spi.requirement_text, spi.credits
       FROM study_plan_item spi
       LEFT JOIN course c ON c.course_id = spi.course_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY spi.study_year, spi.semester, spi.item_order`,
    params,
  );
  return response(200, { data: { ...plans[0], items } });
}

async function listFaculties() {
  const data = await queryRows(
    `SELECT faculty_id, faculty_th, faculty_en
       FROM faculty
      ORDER BY faculty_th`,
  );
  return response(200, { data });
}

async function listDepartments(event) {
  const facultyId = event.queryStringParameters?.facultyId;
  const data = await queryRows(
    `SELECT department_code, faculty_id, department_name_th, department_name_en
       FROM department
       ${facultyId ? 'WHERE faculty_id = ?' : ''}
      ORDER BY department_name_th`,
    facultyId ? [facultyId] : [],
  );
  return response(200, { data });
}

async function listAuditLogs(event) {
  const query = event.queryStringParameters ?? {};
  const limit = Math.max(1, Math.min(Number.parseInt(query.limit ?? '100', 10) || 100, 500));
  const data = await queryRows(
    `SELECT audit_id, actor_username, actor_role, action,
            entity_type, entity_id, old_value, new_value, created_at
       FROM audit_log
      ORDER BY created_at DESC, audit_id DESC
      LIMIT ?`,
    [limit],
  );
  return response(200, { data });
}

function requestBody(event) {
  if (!event.body) return {};
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function actorFromRequest(event, body = {}) {
  const headers = event.headers ?? {};
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    username: String(body.username ?? normalized['x-user'] ?? 'demo-user').slice(0, 100),
    role: String(body.role ?? normalized['x-role'] ?? 'instructor').slice(0, 30),
  };
}

const draftEditorRoles = new Set(['staff', 'curriculum_admin']);
const changeItemActions = new Set([
  'ADD_COURSE',
  'REMOVE_COURSE',
  'MOVE_COURSE',
  'EDIT_FIELD',
  'ADD_PREREQ',
  'REMOVE_PREREQ',
  'CREATE_CURRICULUM',
]);

function canEditDraft(actor) {
  return draftEditorRoles.has(actor.role);
}

function parseJsonValue(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeChangeRequest(row) {
  if (!row) return null;
  return {
    ...row,
    base_version_id: row.base_version_id == null ? null : Number(row.base_version_id),
    payload: parseJsonValue(row.payload),
  };
}

function normalizeChangeItem(row) {
  if (!row) return null;
  return {
    ...row,
    old_value: parseJsonValue(row.old_value),
    new_value: parseJsonValue(row.new_value),
  };
}

async function createDraftChangeRequest(event) {
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can create drafts' });

  const type = String(body.type ?? '').trim();
  const curriculumId = String(body.curriculumId ?? '').trim() || null;
  const sourceCurriculumId = String(body.sourceCurriculumId ?? '').trim() || null;
  const title = String(body.title ?? '').trim();
  const note = String(body.note ?? '').trim() || null;
  const baseVersionId = body.baseVersionId == null || body.baseVersionId === ''
    ? null
    : Number(body.baseVersionId);
  if (!['add_curriculum', 'edit_structure', 'edit_course'].includes(type) || !title) {
    return response(400, { error: 'type and title are required' });
  }
  if (baseVersionId !== null && !Number.isInteger(baseVersionId)) {
    return response(400, { error: 'baseVersionId must be an integer' });
  }
  if (type !== 'add_curriculum' && !curriculumId) {
    return response(400, { error: 'curriculumId is required for this draft type' });
  }
  if (curriculumId) {
    const curriculum = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
    if (!curriculum.length) return response(404, { error: 'Curriculum not found' });
  }
  if (sourceCurriculumId) {
    const source = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [sourceCurriculumId]);
    if (!source.length) return response(404, { error: 'Source curriculum not found' });
  }
  if (baseVersionId !== null) {
    const version = await queryRows('SELECT id, curriculum_id FROM curriculum_versions WHERE id = ?', [baseVersionId]);
    if (!version.length) return response(404, { error: 'Base version not found' });
    if (curriculumId && version[0].curriculum_id !== curriculumId) {
      return response(400, { error: 'Base version does not belong to curriculum' });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO change_requests
      (curriculum_id, type, status, base_version_id, source_curriculum_id, title, note, created_by)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [curriculumId, type, baseVersionId, sourceCurriculumId, title, note, actor.username],
  );
  const rows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [result.insertId]);
  const data = normalizeChangeRequest(rows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_request_created',
    entityType: 'change_request',
    entityId: String(result.insertId),
    newValue: data,
  });
  return response(201, { data });
}

async function saveDraftChangeItems(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can edit drafts' });
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items) return response(400, { error: 'items must be an array' });

  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.status !== 'draft') return response(409, { error: 'Only draft requests can be edited' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the draft owner can edit this request' });

  const normalized = items.map((item, index) => ({
    action: String(item.action ?? '').trim().toUpperCase(),
    courseCode: String(item.courseCode ?? item.course_code ?? '').trim() || null,
    studyYear: item.studyYear ?? item.study_year ?? null,
    term: item.term ?? item.semester ?? null,
    oldValue: item.oldValue ?? item.old_value ?? null,
    newValue: item.newValue ?? item.new_value ?? null,
    sortOrder: Number.isInteger(Number(item.sortOrder ?? item.sort_order))
      ? Number(item.sortOrder ?? item.sort_order)
      : index,
  }));
  for (const item of normalized) {
    if (!changeItemActions.has(item.action)) return response(400, { error: `Unsupported item action: ${item.action}` });
    if (item.courseCode && item.courseCode.length > 30) return response(400, { error: 'courseCode is too long' });
    if (item.studyYear !== null && (!Number.isInteger(Number(item.studyYear)) || Number(item.studyYear) < 1)) {
      return response(400, { error: 'studyYear must be a positive integer' });
    }
    if (item.term !== null && !['1', '2', 'S', 1, 2].includes(item.term)) {
      return response(400, { error: 'term must be 1, 2, or S' });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM change_items WHERE request_id = ?', [requestId]);
    for (const item of normalized) {
      await connection.execute(
        `INSERT INTO change_items
          (request_id, action, course_code, study_year, term, old_value, new_value, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          item.action,
          item.courseCode,
          item.studyYear === null ? null : Number(item.studyYear),
          item.term === null ? null : String(item.term),
          item.oldValue == null ? null : JSON.stringify(item.oldValue),
          item.newValue == null ? null : JSON.stringify(item.newValue),
          item.sortOrder,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const savedItems = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_items_saved',
    entityType: 'change_request',
    entityId: String(requestId),
    newValue: { itemCount: savedItems.length },
  });
  return response(200, { data: { requestId, items: savedItems.map(normalizeChangeItem) } });
}

async function submitDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can submit drafts' });
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the draft owner can submit this request' });
  if (request.status !== 'draft') return response(409, { error: 'Only draft requests can be submitted' });
  const items = await queryRows('SELECT id FROM change_items WHERE request_id = ?', [requestId]);
  if (!items.length) return response(400, { error: 'Add at least one change item before submitting' });
  await pool.execute(`UPDATE change_requests SET status = 'pending', submitted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`, [requestId]);
  const updatedRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const data = normalizeChangeRequest(updatedRows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_request_submitted',
    entityType: 'change_request',
    entityId: String(requestId),
    oldValue: request,
    newValue: data,
  });
  return response(200, { data });
}

async function decideDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can approve or reject change requests' });
  const action = String(body.action ?? '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) return response(400, { error: 'action must be approve or reject' });
  const requestRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requestRows[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.status !== 'pending') return response(409, { error: 'Only pending requests can be reviewed' });
  const note = String(body.note ?? '').trim() || null;
  if (action === 'reject' && !note) return response(400, { error: 'A rejection reason is required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (action === 'approve' && request.type === 'edit_course') {
      const items = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
      for (const rawItem of items) {
        const item = normalizeChangeItem(rawItem);
        if (item.action !== 'EDIT_FIELD' || !item.course_code) continue;
        const value = item.new_value ?? {};
        const courseRows = await queryRows(
          'SELECT course_id FROM course WHERE course_code = ? OR REPLACE(course_code, \' \', \'\') = REPLACE(?, \' \', \'\') LIMIT 1',
          [item.course_code, item.course_code],
        );
        if (!courseRows.length) throw new Error(`Course not found: ${item.course_code}`);
        await connection.execute(
          `UPDATE course
              SET title_th = COALESCE(?, title_th),
                  title_en = COALESCE(?, title_en),
                  credits_total = COALESCE(?, credits_total)
            WHERE course_id = ?`,
          [value.name ?? null, value.nameEn ?? null, value.credits == null ? null : Number(value.credits), courseRows[0].course_id],
        );
      }
    }
    await connection.execute(
      `UPDATE change_requests
          SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ?
        WHERE id = ? AND status = 'pending'`,
      [action === 'approve' ? 'approved' : 'rejected', actor.username, note, requestId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const updatedRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const data = normalizeChangeRequest(updatedRows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: `change_request_${action}d`,
    entityType: 'change_request',
    entityId: String(requestId),
    oldValue: request,
    newValue: data,
  });
  return response(200, { data });
}

async function getDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  if (!Number.isInteger(requestId)) return response(400, { error: 'requestId is required' });
  const body = requestBody(event) ?? {};
  const actor = actorFromRequest(event, body);
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (!canEditDraft(actor) && request.created_by !== actor.username) {
    return response(403, { error: 'You are not allowed to view this request' });
  }
  const items = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
  return response(200, { data: { request, items: items.map(normalizeChangeItem) } });
}

async function listDraftChangeRequests(event) {
  const query = event.queryStringParameters ?? {};
  const body = requestBody(event) ?? {};
  const actor = actorFromRequest(event, body);
  const status = String(query.status ?? '').trim();
  const conditions = [];
  const params = [];
  if (status) {
    if (!['draft', 'pending', 'approved', 'rejected'].includes(status)) return response(400, { error: 'Invalid status' });
    conditions.push('cr.status = ?');
    params.push(status);
  }
  if (!canEditDraft(actor)) {
    conditions.push('cr.created_by = ?');
    params.push(actor.username);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryRows(
    `SELECT cr.*, COUNT(ci.id) AS item_count
       FROM change_requests cr
       LEFT JOIN change_items ci ON ci.request_id = cr.id
       ${where}
      GROUP BY cr.id
      ORDER BY cr.created_at DESC, cr.id DESC`,
    params,
  );
  return response(200, { data: rows.map((row) => ({ ...normalizeChangeRequest(row), item_count: Number(row.item_count) })) });
}

async function getActivePlanForDraft(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can load an active plan for editing' });
  const query = event.queryStringParameters ?? {};
  const conditions = ['sp.curriculum_id = ?', 'sp.active = 1'];
  const params = [curriculumId];
  if (query.studyYear) {
    conditions.push('spi.study_year = ?');
    params.push(Number.parseInt(query.studyYear, 10));
  }
  if (query.term) {
    conditions.push('spi.semester = ?');
    params.push(Number.parseInt(query.term, 10));
  }
  const plans = await queryRows(
    `SELECT sp.study_plan_id, sp.curriculum_id, sp.pathway_id, sp.plan_name, sp.active
       FROM study_plan sp
      WHERE sp.curriculum_id = ? AND sp.active = 1
      ORDER BY sp.study_plan_id`,
    [curriculumId],
  );
  if (!plans.length) return response(404, { error: 'Active study plan not found' });
  const items = await queryRows(
    `SELECT spi.study_year, spi.semester, spi.item_order, spi.course_id,
            c.course_code, c.title_th, c.title_en, spi.requirement_text, spi.credits
       FROM study_plan_item spi
       JOIN study_plan sp ON sp.study_plan_id = spi.study_plan_id AND sp.active = 1
       LEFT JOIN course c ON c.course_id = spi.course_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY spi.study_year, spi.semester, spi.item_order`,
    params,
  );
  return response(200, { data: { plans, items } });
}

async function getCurriculumWorkflow(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const rows = await queryRows(
    `SELECT curriculum_id, status, updated_by, updated_role, updated_at
       FROM curriculum_workflow
      WHERE curriculum_id = ?`,
    [curriculumId],
  );
  return response(200, { data: rows[0] ?? { curriculum_id: curriculumId, status: 'draft' } });
}

async function updateCurriculumWorkflow(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  const body = requestBody(event);
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  if (!body) return response(400, { error: 'Request body must be valid JSON' });

  const action = String(body.action ?? '').toLowerCase();
  const nextStatus = {
    submit: 'review',
    review: 'review',
    approve: 'approved',
    reject: 'rejected',
    reset: 'draft',
  }[action];
  if (!nextStatus) {
    return response(400, { error: 'action must be submit, approve, reject, or reset' });
  }

  const actor = actorFromRequest(event, body);
  if (!['instructor', 'staff', 'curriculum_admin'].includes(actor.role)) {
    return response(403, { error: 'Only instructor, staff, or curriculum admin can update curriculum workflow' });
  }

  const current = await queryRows(
    `SELECT curriculum_id, status, updated_by, updated_role, updated_at
       FROM curriculum_workflow
      WHERE curriculum_id = ?`,
    [curriculumId],
  );
  const oldValue = current[0] ?? { curriculum_id: curriculumId, status: 'draft' };
  await pool.execute(
    `INSERT INTO curriculum_workflow
      (curriculum_id, status, updated_by, updated_role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by),
       updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
    [curriculumId, nextStatus, actor.username, actor.role],
  );
  const newValue = {
    curriculum_id: curriculumId,
    status: nextStatus,
    updated_by: actor.username,
    updated_role: actor.role,
  };
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: `workflow_${action}`,
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue,
    newValue,
  });
  return response(200, { data: newValue });
}

function parseChangePayload(row) {
  if (!row) return row;
  return { ...row, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload };
}

async function listCurriculumChanges(event) {
  const query = event.queryStringParameters ?? {};
  const conditions = [];
  const params = [];
  if (query.curriculumId) {
    conditions.push('curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryRows(
    `SELECT change_id, curriculum_id, operation, payload, status,
            requested_by, requested_role, reviewed_by, reviewed_role,
            review_note, created_at, reviewed_at
       FROM curriculum_change_request
       ${where}
      ORDER BY created_at DESC, change_id DESC`,
    params,
  );
  return response(200, { data: rows.map(parseChangePayload) });
}

async function createCurriculumChange(event) {
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'curriculum_admin') {
    return response(403, { error: 'Only curriculum admin can create curriculum changes' });
  }
  const operation = String(body.operation ?? 'update').toLowerCase();
  const curriculumId = String(body.curriculumId ?? '').trim();
  const payload = { ...(body.payload ?? {}) };
  if (!['create', 'update'].includes(operation) || !curriculumId) {
    return response(400, { error: 'curriculumId and operation are required' });
  }
  const changeType = String(body.changeType ?? payload.changeType ?? 'academic_year');
  payload.changeType = changeType;
  if (changeType === 'academic_year' && !Number.isInteger(Number(payload.academicYear))) {
    return response(400, { error: 'payload.academicYear must be an integer' });
  }
  if (['course_replace', 'course_remove'].includes(changeType) && !payload.curriculumCourseId) {
    return response(400, { error: `${changeType} requires curriculumCourseId` });
  }
  if (['course_replace', 'course_add'].includes(changeType) && !payload.newCourseCode) {
    return response(400, { error: `${changeType} requires newCourseCode` });
  }
  if (!['academic_year', 'course_replace', 'course_add', 'course_remove'].includes(changeType)) {
    return response(400, { error: 'Unsupported curriculum change type' });
  }
  if (operation === 'update') {
    const existing = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
    if (!existing.length) return response(404, { error: 'Curriculum not found' });
  }
  if (['course_replace', 'course_remove'].includes(changeType)) {
    const existingCourse = await queryRows(
      `SELECT cc.curriculum_course_id, c.course_code, c.title_th, c.credits_total
         FROM curriculum_course cc
         JOIN course c ON c.course_id = cc.course_id
        WHERE cc.curriculum_course_id = ? AND cc.curriculum_id = ?
        LIMIT 1`,
      [payload.curriculumCourseId, curriculumId],
    );
    if (!existingCourse.length) return response(404, { error: 'Existing curriculum course not found' });
    payload.oldCourse = existingCourse[0];
  }
  if (['course_replace', 'course_add'].includes(changeType)) {
    const newCourse = await queryRows(
      `SELECT course_id, course_code, title_th, credits_total
         FROM course
        WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
        LIMIT 1`,
      [payload.newCourseCode, payload.newCourseCode],
    );
    if (!newCourse.length) return response(404, { error: 'New course not found' });
    payload.newCourse = newCourse[0];
  }
  const currentWorkflow = await queryRows(
    'SELECT status FROM curriculum_workflow WHERE curriculum_id = ?',
    [curriculumId],
  );
  const previousWorkflowStatus = currentWorkflow[0]?.status ?? 'draft';
  const [result] = await pool.execute(
    `INSERT INTO curriculum_change_request
      (curriculum_id, operation, payload, requested_by, requested_role)
     VALUES (?, ?, ?, ?, ?)`,
    [curriculumId, operation, JSON.stringify({
      ...payload,
      previousWorkflowStatus,
      ...(changeType === 'academic_year' ? { academicYear: Number(payload.academicYear) } : {}),
    }), actor.username, actor.role],
  );
  if (operation === 'update') {
    await pool.execute(
      `INSERT INTO curriculum_workflow (curriculum_id, status, updated_by, updated_role)
       VALUES (?, 'review', ?, ?)
       ON DUPLICATE KEY UPDATE status = 'review', updated_by = VALUES(updated_by),
         updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
      [curriculumId, actor.username, actor.role],
    );
  }
  const data = {
    change_id: result.insertId,
    curriculum_id: curriculumId,
    operation,
    payload,
    status: 'pending',
    requested_by: actor.username,
    requested_role: actor.role,
  };
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'curriculum_change_requested',
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue: null,
    newValue: data,
  });
  return response(201, { data });
}

async function decideCurriculumChange(event) {
  const changeId = pathParameter(event, 'changeId');
  const body = requestBody(event);
  if (!changeId || !body) return response(400, { error: 'changeId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (!['staff', 'curriculum_admin'].includes(actor.role)) {
    return response(403, { error: 'Only staff or curriculum admin can review changes' });
  }
  const action = String(body.action ?? '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) return response(400, { error: 'action must be approve or reject' });
  const rows = await queryRows('SELECT * FROM curriculum_change_request WHERE change_id = ?', [changeId]);
  const change = parseChangePayload(rows[0]);
  if (!change) return response(404, { error: 'Change request not found' });
  if (change.status !== 'pending') return response(409, { error: 'Change request has already been reviewed' });

  if (action === 'approve') {
    if (change.payload?.changeType === 'course_replace') {
      const replacement = await queryRows(
        `SELECT course_id FROM course
          WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
          LIMIT 1`,
        [change.payload.newCourseCode, change.payload.newCourseCode],
      );
      if (!replacement.length) return response(404, { error: 'Replacement course not found' });
      await pool.execute(
        `UPDATE curriculum_course
            SET course_id = ?
          WHERE curriculum_course_id = ? AND curriculum_id = ?`,
        [replacement[0].course_id, change.payload.curriculumCourseId, change.curriculum_id],
      );
    } else if (change.payload?.changeType === 'course_remove') {
      await pool.execute('DELETE FROM course_subcategory WHERE curriculum_course_id = ?', [change.payload.curriculumCourseId]);
      await pool.execute('DELETE FROM course_classification WHERE curriculum_course_id = ?', [change.payload.curriculumCourseId]);
      await pool.execute(
        'DELETE FROM curriculum_course WHERE curriculum_course_id = ? AND curriculum_id = ?',
        [change.payload.curriculumCourseId, change.curriculum_id],
      );
    } else if (change.payload?.changeType === 'course_add') {
      const newCourse = await queryRows(
        `SELECT course_id, course_code FROM course
          WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
          LIMIT 1`,
        [change.payload.newCourseCode, change.payload.newCourseCode],
      );
      if (!newCourse.length) return response(404, { error: 'New course not found' });
      const curriculumCourseId = change.payload.curriculumCourseId ||
        `${change.curriculum_id}-${String(change.payload.newCourseCode).replace(/\s+/g, '')}`;
      await pool.execute(
        `INSERT INTO curriculum_course
          (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          curriculumCourseId,
          change.curriculum_id,
          change.payload.pathwayId ?? null,
          newCourse[0].course_id,
          change.payload.courseGroup ?? 'วิชาเฉพาะ',
          change.payload.requirementType ?? 'required',
        ],
      );
    } else if (change.operation === 'create') {
      await pool.execute(
        'INSERT INTO curriculum (curriculum_id, academic_year) VALUES (?, ?)',
        [change.curriculum_id, Number(change.payload?.academicYear)],
      );
    } else {
      await pool.execute(
        'UPDATE curriculum SET academic_year = ? WHERE curriculum_id = ?',
        [Number(change.payload?.academicYear), change.curriculum_id],
      );
    }
  }
  await pool.execute(
    `UPDATE curriculum_change_request
        SET status = ?, reviewed_by = ?, reviewed_role = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE change_id = ?`,
    [action === 'approve' ? 'approved' : 'rejected', actor.username, actor.role, body.note ?? null, changeId],
  );
  const nextWorkflowStatus = action === 'approve'
    ? 'approved'
    : (change.payload?.previousWorkflowStatus ?? 'draft');
  await pool.execute(
    `INSERT INTO curriculum_workflow (curriculum_id, status, updated_by, updated_role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by),
       updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
    [change.curriculum_id, nextWorkflowStatus, actor.username, actor.role],
  );
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: `curriculum_change_${action}`,
    entityType: 'curriculum',
    entityId: change.curriculum_id,
    oldValue: change,
    newValue: { ...change, status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.username },
  });
  return response(200, { data: { ...change, status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.username } });
}

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    const route = event.routeKey ?? `${method} ${event.rawPath ?? event.path ?? ''}`;

    if (route === 'POST /api/auth/login') return await tuLogin(event);
    if (route === 'POST /api/change-requests') return await createDraftChangeRequest(event);
    if (route === 'PUT /api/change-requests/{requestId}/items') return await saveDraftChangeItems(event);
    if (route === 'POST /api/change-requests/{requestId}/submit') return await submitDraftChangeRequest(event);
    if (route === 'POST /api/change-requests/{requestId}/decision') return await decideDraftChangeRequest(event);
    if (route === 'POST /api/curriculum-changes') return await createCurriculumChange(event);
    if (route === 'POST /api/curriculum-changes/{changeId}/decision') return await decideCurriculumChange(event);
    if (route === 'POST /api/curricula/{curriculumId}/workflow') return await updateCurriculumWorkflow(event);
    if (method !== 'GET') return response(405, { error: 'Method not allowed' });
    if (route === 'GET /api/courses') return await listCourses(event);
    if (route.endsWith('/prerequisites') && route.startsWith('GET /api/courses/')) return await listPrerequisites(event);
    if (route === 'GET /api/courses/{courseCode}' || route.startsWith('GET /api/courses/')) return await getCourse(event);
    if (route === 'GET /api/curricula/{curriculumId}/graduation-conditions') return await listGraduationConditions(event);
    if (route === 'GET /api/curricula/{curriculumId}/workflow') return await getCurriculumWorkflow(event);
    if (route === 'GET /api/curricula/{curriculumId}/active-plan') return await getActivePlanForDraft(event);
    if (route === 'GET /api/change-requests') return await listDraftChangeRequests(event);
    if (route === 'GET /api/change-requests/{requestId}') return await getDraftChangeRequest(event);
    if (route === 'GET /api/study-plans') return await listStudyPlans(event);
    if (route === 'GET /api/study-plans/{studyPlanId}') return await getStudyPlan(event);
    if (route === 'GET /api/faculties') return await listFaculties();
    if (route === 'GET /api/departments') return await listDepartments(event);
    if (route === 'GET /api/audit-logs') return await listAuditLogs(event);
    if (route === 'GET /api/curriculum-changes') return await listCurriculumChanges(event);
    return response(404, { error: 'Route not found' });
  } catch (error) {
    console.error('API request failed', error);
    return response(500, { error: 'Internal server error' });
  }
};
