import 'dotenv/config';
import mysql from 'mysql2/promise';

type Faculty = { faculty_id: string; faculty_th: string; faculty_en?: string | null };
type Department = {
  faculty_id: string;
  department_code: string;
  department_name_th: string;
  department_name_en?: string | null;
};
type CourseRow = {
  course_id: string;
  curriculum_course_id: string;
  course_code: string;
  course_code_th?: string | null;
  title_th: string;
  title_en?: string | null;
  credits_total?: number | null;
  curriculum: {
    curriculum_id: string;
    pathway_id?: string | null;
    course_group?: string | null;
    requirement_type?: string | null;
  };
  classification?: {
    course_type?: { code?: string | null; label_th?: string | null } | null;
    subcategories?: Array<{ code: string; label_th?: string | null; detail?: string | null }>;
    other_detail?: string | null;
  };
  status?: string | null;
  active?: boolean;
};

type ApiCoursePayload = { data?: { courses?: CourseRow[] } | CourseRow[] };

const listFrom = (value: any, keys: string[] = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const pick = (value: any, keys: string[]) =>
  keys.map((key) => value?.[key]).find((item) => item !== undefined && item !== null && item !== '');

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const db = await mysql.createConnection({
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 3306),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
});

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json() as Promise<T>;
}

function academicYear(curriculumId: string): number | null {
  const match = curriculumId.match(/(?:^|-)(\d{4})(?:$|-)/);
  if (!match) return null;

  const year = Number(match[1]);
  // TU curriculum IDs use Buddhist Era years (for example, 2566 = 2023).
  return year >= 2400 && year < 2700 ? year - 543 : year;
}

async function importFaculties() {
  const url = process.env.FACULTY_API_URL;
  if (!url) return console.log('Skip Faculty API: FACULTY_API_URL is not set');
  const applicationKey = required('TU_APPLICATION_KEY');
  const response = await getJson<{ data: Faculty[] }>(url, {
    'Content-Type': 'application/json',
    'Application-Key': applicationKey,
  });
  for (const faculty of response.data) {
    await db.execute(
      `INSERT INTO faculty (faculty_id, faculty_th, faculty_en)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE faculty_th = VALUES(faculty_th), faculty_en = VALUES(faculty_en)`,
      [faculty.faculty_id, faculty.faculty_th, faculty.faculty_en ?? null],
    );
  }
  console.log(`Imported faculties: ${response.data.length}`);
}

async function importDepartments() {
  const url = process.env.DEPARTMENT_API_URL;
  if (!url) return console.log('Skip Department API: DEPARTMENT_API_URL is not set');
  const applicationKey = required('TU_APPLICATION_KEY');
  const response = await getJson<{ data: Department[] }>(url, {
    'Content-Type': 'application/json',
    'Application-Key': applicationKey,
  });
  for (const department of response.data) {
    await db.execute(
      `INSERT INTO department (department_code, faculty_id, department_name_th, department_name_en)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), department_name_th = VALUES(department_name_th), department_name_en = VALUES(department_name_en)`,
      [department.department_code, department.faculty_id, department.department_name_th, department.department_name_en ?? null],
    );
  }
  console.log(`Imported departments: ${response.data.length}`);
}

async function importCourses(): Promise<CourseRow[]> {
  const baseUrl = required('COURSE_API_URL');
  const url = `${baseUrl}?resource=courses&limit=1000`;
  const response = await getJson<ApiCoursePayload>(url);
  const rows = listFrom(response.data, ['courses']) as CourseRow[];

  for (const row of rows) {
    const curriculumId = row.curriculum.curriculum_id;
    const pathwayId = row.curriculum.pathway_id || null;
    const classification = row.classification;

    await db.execute(
      `INSERT INTO curriculum (curriculum_id, academic_year) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year)`,
      [curriculumId, academicYear(curriculumId)],
    );

    if (pathwayId) {
      await db.execute(
        `INSERT INTO pathway (pathway_id, curriculum_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE curriculum_id = VALUES(curriculum_id)`,
        [pathwayId, curriculumId],
      );
    }

    await db.execute(
      `INSERT INTO course (course_id, course_code, course_code_th, title_th, title_en, credits_total, status, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE course_code = VALUES(course_code), course_code_th = VALUES(course_code_th), title_th = VALUES(title_th), title_en = VALUES(title_en), credits_total = VALUES(credits_total), status = VALUES(status), active = VALUES(active)`,
      [row.course_id, row.course_code, row.course_code_th ?? null, row.title_th, row.title_en ?? null, row.credits_total ?? null, row.status ?? null, row.active ?? true],
    );

    await db.execute(
      `INSERT INTO curriculum_course (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE curriculum_id = VALUES(curriculum_id), pathway_id = VALUES(pathway_id), course_id = VALUES(course_id), course_group = VALUES(course_group), requirement_type = VALUES(requirement_type)`,
      [row.curriculum_course_id, curriculumId, pathwayId, row.course_id, row.curriculum.course_group ?? null, row.curriculum.requirement_type ?? null],
    );

    if (classification?.course_type) {
      await db.execute(
        `INSERT INTO course_classification (curriculum_course_id, course_type_code, course_type_label_th, other_detail)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE course_type_code = VALUES(course_type_code), course_type_label_th = VALUES(course_type_label_th), other_detail = VALUES(other_detail)`,
        [row.curriculum_course_id, classification.course_type.code ?? null, classification.course_type.label_th ?? null, classification.other_detail ?? null],
      );
    }

    for (const subcategory of classification?.subcategories ?? []) {
      await db.execute(
        `INSERT INTO course_subcategory (curriculum_course_id, subcategory_code, label_th, detail)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label_th = VALUES(label_th), detail = VALUES(detail)`,
        [row.curriculum_course_id, subcategory.code, subcategory.label_th ?? null, subcategory.detail ?? null],
      );
    }
  }

  console.log(`Imported course rows: ${rows.length}`);
  return rows;
}

async function importCourseDetails(rows: CourseRow[]) {
  const baseUrl = required('COURSE_API_URL');
  const courseByCode = new Map(rows.map((row) => [row.course_code.replace(/\s+/g, ''), row.course_id]));

  for (const row of rows) {
    const courseCode = encodeURIComponent(row.course_code);
    const [payload, prerequisitePayload] = await Promise.all([
      getJson<any>(`${baseUrl}?resource=course&course_code=${courseCode}`),
      getJson<any>(`${baseUrl}?resource=prerequisites&course_code=${courseCode}`),
    ]);
    const detail = payload?.data ?? payload;
    const descriptionTh = pick(detail, ['description_th', 'detail_th', 'description', 'course_description_th']);
    const descriptionEn = pick(detail, ['description_en', 'detail_en', 'course_description_en']);
    const contactHours = pick(detail, ['contact_hours', 'hours', 'contactHours']);

    await db.execute(
      `INSERT INTO course_detail (course_id, description_th, description_en, contact_hours_json, raw_json)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description_th = VALUES(description_th), description_en = VALUES(description_en),
         contact_hours_json = VALUES(contact_hours_json), raw_json = VALUES(raw_json)`,
      [
        row.course_id,
        descriptionTh ?? null,
        descriptionEn ?? null,
        contactHours == null ? null : JSON.stringify(contactHours),
        JSON.stringify(detail),
      ],
    );

    const prerequisiteRows = listFrom(
      prerequisitePayload?.data ?? prerequisitePayload,
      ['prerequisites', 'prerequisite_rules', 'prerequisite_courses', 'prerequisiteCourses', 'items', 'courses'],
    );
    for (const prerequisite of prerequisiteRows) {
      const prerequisiteCode = pick(prerequisite, ['course_code', 'code', 'prerequisite_course_code']);
      const prerequisiteId = pick(prerequisite, ['course_id', 'id', 'prerequisite_course_id'])
        ?? (prerequisiteCode ? courseByCode.get(String(prerequisiteCode).replace(/\s+/g, '')) : undefined);
      if (!prerequisiteId || prerequisiteId === row.course_id) continue;
      await db.execute(
        `INSERT IGNORE INTO prerequisite (course_id, prerequisite_course_id) VALUES (?, ?)`,
        [row.course_id, prerequisiteId],
      );
    }
  }
  console.log(`Imported course details: ${rows.length}`);
}

async function importStudyPlans(rows: CourseRow[]) {
  const baseUrl = required('COURSE_API_URL');
  const contexts = [...new Map(rows.map((row) => [
    `${row.curriculum.curriculum_id}|${row.curriculum.pathway_id ?? ''}`,
    { curriculumId: row.curriculum.curriculum_id, pathwayId: row.curriculum.pathway_id ?? null },
  ])).values()];

  for (const context of contexts) {
    const params = new URLSearchParams({ resource: 'study_plans', curriculum_id: context.curriculumId });
    if (context.pathwayId) params.set('pathway_id', context.pathwayId);
    const payload = await getJson<any>(`${baseUrl}?${params}`);
    const plans = listFrom(payload?.data ?? payload, ['study_plans', 'plans']);

    for (const plan of plans) {
      const planId = pick(plan, ['study_plan_id', 'id', 'plan_id']);
      if (!planId) continue;
      await db.execute(
        `INSERT INTO study_plan (study_plan_id, curriculum_id, pathway_id, plan_name, active, raw_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE curriculum_id = VALUES(curriculum_id), pathway_id = VALUES(pathway_id),
           plan_name = VALUES(plan_name), active = VALUES(active), raw_json = VALUES(raw_json)`,
        [planId, context.curriculumId, context.pathwayId, pick(plan, ['plan_name', 'name', 'title']) ?? null,
          pick(plan, ['active']) ?? true, JSON.stringify(plan)],
      );

      const detailParams = new URLSearchParams({ resource: 'study_plan', study_plan_id: String(planId) });
      const detailPayload = await getJson<any>(`${baseUrl}?${detailParams}`);
      const detail = detailPayload?.data ?? detailPayload;
      const items = listFrom(detail, ['items', 'courses', 'plan_items']);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const year = Number(pick(item, ['study_year', 'year', 'studyYear']) ?? 0);
        const semester = Number(pick(item, ['semester', 'term']) ?? 0);
        if (!year || !semester) continue;
        const code = pick(item, ['course_code', 'code']);
        const courseId = pick(item, ['course_id', 'id'])
          ?? (code ? rows.find((row) => row.course_code.replace(/\s+/g, '') === String(code).replace(/\s+/g, ''))?.course_id : null);
        await db.execute(
          `INSERT INTO study_plan_item (study_plan_id, study_year, semester, item_order, course_id, requirement_text, credits, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE course_id = VALUES(course_id), requirement_text = VALUES(requirement_text),
             credits = VALUES(credits), raw_json = VALUES(raw_json)`,
          [planId, year, semester, index, courseId ?? null,
            pick(item, ['requirement_text', 'requirement', 'description']) ?? null,
            pick(item, ['credits', 'credit']) ?? null, JSON.stringify(item)],
        );
      }
    }
  }
  console.log(`Imported study-plan contexts: ${contexts.length}`);
}

try {
  await importFaculties();
  await importDepartments();
  const courseRows = await importCourses();
  await importCourseDetails(courseRows);
  await importStudyPlans(courseRows);
} finally {
  await db.end();
}
