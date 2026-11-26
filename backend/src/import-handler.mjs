import mysql from 'mysql2/promise';

const CURRICULA = Object.freeze({
  CS: { id: 'BSC-CS-2566', env: 'COURSE_API_URL_CS' },
  CNC: { id: 'BSC-CNC-2568', env: 'COURSE_API_URL_CNC' },
});

const listFrom = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data)) return value.data;
  return [];
};
const pick = (value, keys) => keys.map(key => value?.[key]).find(value => value !== undefined && value !== null && value !== '');
const cleanCode = value => String(value ?? '').replace(/\s+/g, '').toUpperCase();
const academicYear = id => { const match = String(id).match(/(?:^|-)(\d{4})(?:$|-)/); const year = Number(match?.[1]); return year >= 2400 ? year - 543 : year || null; };

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function apiUrl(base, params) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function handler(event = {}) {
  const curriculum = String(event.curriculum ?? '').toUpperCase();
  const selected = CURRICULA[curriculum];
  if (!selected) throw new Error('curriculum must be CS or CNC');
  const base = process.env[selected.env];
  if (!base) throw new Error(`Missing ${selected.env}`);
  const payload = await getJson(apiUrl(base, { resource: 'courses', limit: '1000' }));
  const rows = listFrom(payload?.data, ['courses']).filter(row => row?.curriculum?.curriculum_id === selected.id || row?.curriculum_id === selected.id);
  const summary = {
    curriculum,
    curriculumId: selected.id,
    dryRun: event.dryRun !== false,
    sourceRows: rows.length,
    courseCodes: [...new Set(rows.map(row => cleanCode(row.course_code)).filter(Boolean))].length,
    missingCourseGroup: rows.filter(row => !String(row.curriculum?.course_group ?? row.course_group ?? '').trim()).length,
    withClassification: rows.filter(row => row.classification?.course_type || row.course_type_code).length,
    withSubcategories: rows.filter(row => (row.classification?.subcategories ?? row.subcategories ?? []).length).length,
  };
  if (summary.dryRun) return { ok: true, ...summary, message: 'dry-run: no database writes performed' };
  if (!rows.length) throw new Error(`No ${selected.id} rows returned by source API`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'curriculum', user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  try {
    await conn.beginTransaction();
    for (const row of rows) {
      const curriculumId = row.curriculum?.curriculum_id ?? row.curriculum_id;
      const pathwayId = row.curriculum?.pathway_id ?? row.pathway_id ?? null;
      const courseId = row.course_id ?? row.course?.course_id;
      if (!curriculumId || !courseId || !row.course_code) continue;
      const group = row.curriculum?.course_group ?? row.course_group ?? null;
      const requirement = row.curriculum?.requirement_type ?? row.requirement_type ?? null;
      const classification = row.classification ?? {};
      await conn.execute(`INSERT INTO curriculum (curriculum_id, academic_year) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year)`, [curriculumId, academicYear(curriculumId)]);
      if (pathwayId) await conn.execute(`INSERT INTO pathway (pathway_id, curriculum_id) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE curriculum_id = VALUES(curriculum_id)`, [pathwayId, curriculumId]);
      await conn.execute(`INSERT INTO course (course_id, course_code, course_code_th, title_th, title_en, credits_total, status, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE course_code=VALUES(course_code), course_code_th=VALUES(course_code_th),
        title_th=VALUES(title_th), title_en=VALUES(title_en), credits_total=VALUES(credits_total), status=VALUES(status), active=VALUES(active)`,
        [courseId, row.course_code, row.course_code_th ?? null, row.title_th ?? row.course?.title_th ?? null, row.title_en ?? row.course?.title_en ?? null, row.credits_total ?? row.course?.credits_total ?? null, row.status ?? 'active', row.active ?? 1]);
      await conn.execute(`INSERT INTO curriculum_course (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
        VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE course_group=VALUES(course_group), requirement_type=VALUES(requirement_type), pathway_id=VALUES(pathway_id)`,
        [row.curriculum_course_id, curriculumId, pathwayId, courseId, group, requirement]);
      const type = classification.course_type ?? {};
      if (type.code || type.label_th || classification.other_detail) await conn.execute(`INSERT INTO course_classification
        (curriculum_course_id, course_type_code, course_type_label_th, other_detail) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE course_type_code=VALUES(course_type_code), course_type_label_th=VALUES(course_type_label_th), other_detail=VALUES(other_detail)`,
        [row.curriculum_course_id, type.code ?? null, type.label_th ?? null, classification.other_detail ?? null]);
      for (const sub of classification.subcategories ?? []) await conn.execute(`INSERT INTO course_subcategory
        (curriculum_course_id, subcategory_code, label_th, detail) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE label_th=VALUES(label_th), detail=VALUES(detail)`, [row.curriculum_course_id, sub.code, sub.label_th ?? null, sub.detail ?? null]);
    }
    await conn.commit();
    return { ok: true, ...summary, dryRun: false, written: rows.length };
  } catch (error) { await conn.rollback(); throw error; } finally { await conn.end(); }
}
