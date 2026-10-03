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
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

const queryRows = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

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
    data: { ...courses[0], placements: courses, prerequisites, detail },
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

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    const route = event.routeKey ?? `${method} ${event.rawPath ?? event.path ?? ''}`;

    if (method !== 'GET') return response(405, { error: 'Method not allowed' });
    if (route === 'GET /api/courses') return await listCourses(event);
    if (route.endsWith('/prerequisites') && route.startsWith('GET /api/courses/')) return await listPrerequisites(event);
    if (route === 'GET /api/courses/{courseCode}' || route.startsWith('GET /api/courses/')) return await getCourse(event);
    if (route === 'GET /api/curricula/{curriculumId}/graduation-conditions') return await listGraduationConditions(event);
    if (route === 'GET /api/study-plans') return await listStudyPlans(event);
    if (route === 'GET /api/study-plans/{studyPlanId}') return await getStudyPlan(event);
    if (route === 'GET /api/faculties') return await listFaculties();
    if (route === 'GET /api/departments') return await listDepartments(event);
    return response(404, { error: 'Route not found' });
  } catch (error) {
    console.error('API request failed', error);
    return response(500, { error: 'Internal server error' });
  }
};
