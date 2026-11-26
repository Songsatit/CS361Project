import mysql from 'mysql2/promise';
import { classifyCurriculumCourse } from './category-config/index.mjs';

export function categoryUpdateForRow(row) {
  if (row.entry_type === 'free_elective') return { code: 'free_elective', label: 'วิชาเลือกเสรี' };
  return classifyCurriculumCourse({
    curriculumId: row.curriculum_id,
    courseGroup: row.course_group,
    classificationCode: row.course_type_code,
  });
}

export async function backfillCategories(conn, { apply = false } = {}) {
  const [rows] = await conn.query(`
    SELECT g.grade_record_id, g.curriculum_id, g.course_code, g.entry_type,
           cc.course_group, cl.course_type_code
      FROM graduation_grade_record g
      LEFT JOIN course c ON REPLACE(c.course_code, ' ', '') = REPLACE(g.course_code, ' ', '')
      LEFT JOIN curriculum_course cc ON cc.course_id = c.course_id AND cc.curriculum_id = g.curriculum_id
      LEFT JOIN course_classification cl ON cl.curriculum_course_id = cc.curriculum_course_id
     WHERE g.category_code IS NULL
     ORDER BY g.grade_record_id`);
  const updates = rows.map(row => ({ row, category: categoryUpdateForRow(row) }));
  if (apply) {
    for (const { row, category } of updates) {
      await conn.execute(
        `UPDATE graduation_grade_record
            SET category_code = ?, category_label = ?
          WHERE grade_record_id = ? AND category_code IS NULL`,
        [category.code, category.label, row.grade_record_id],
      );
    }
  }
  const uncategorized = updates.filter(item => item.category.code === 'uncategorized');
  const categoryCounts = Object.fromEntries(
    updates.reduce((counts, item) => counts.set(item.category.code, (counts.get(item.category.code) ?? 0) + 1), new Map()),
  );
  return {
    scanned: updates.length,
    updated: apply ? updates.length : 0,
    categoryCounts,
    uncategorizedCount: uncategorized.length,
    uncategorizedCourseCodes: [...new Set(uncategorized.map(item => item.row.course_code))].sort(),
  };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const apply = process.argv.includes('--apply');
  const conn = await mysql.createConnection({
    host: process.env.V4_TEST_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'curriculum',
  });
  try {
    console.log(JSON.stringify(await backfillCategories(conn, { apply }), null, 2));
  } finally {
    await conn.end();
  }
}
