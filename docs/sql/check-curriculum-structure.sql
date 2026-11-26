-- Read-only checks for CS 2566 / CNC 2568 curriculum data.
-- Run against staging/RDS with a read-only account. No statement writes data.

-- 0) Confirm the real type before deciding whether a migration is needed.
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE,
       NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'course'
   AND COLUMN_NAME = 'credits_total';

-- a) CNC placements missing a main group or subcategory.
SELECT cc.curriculum_course_id,
       c.course_code,
       c.course_code_th,
       cc.course_group,
       cl.course_type_code,
       cl.course_type_label_th,
       COUNT(sc.subcategory_code) AS subcategory_count
  FROM curriculum_course cc
  JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id
  JOIN course c ON c.course_id = cc.course_id
  LEFT JOIN course_classification cl ON cl.curriculum_course_id = cc.curriculum_course_id
  LEFT JOIN course_subcategory sc ON sc.curriculum_course_id = cc.curriculum_course_id
 WHERE cc.curriculum_id = 'BSC-CNC-2568'
 GROUP BY cc.curriculum_course_id, c.course_code, c.course_code_th,
          cc.course_group, cl.course_type_code, cl.course_type_label_th
HAVING NULLIF(TRIM(cc.course_group), '') IS NULL OR COUNT(sc.subcategory_code) = 0
 ORDER BY c.course_code, cc.curriculum_course_id;

-- b) Actual credits for TU250-TU276. Keep all rows so pathway differences are visible.
SELECT cur.curriculum_id,
       cc.pathway_id,
       c.course_code,
       c.course_code_th,
       c.credits_total,
       cc.course_group,
       cl.course_type_code,
       cl.course_type_label_th
  FROM curriculum_course cc
  JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id
  JOIN course c ON c.course_id = cc.course_id
  LEFT JOIN course_classification cl ON cl.curriculum_course_id = cc.curriculum_course_id
 WHERE REPLACE(UPPER(c.course_code), ' ', '') REGEXP '^TU(25[0-9]|26[0-9]|27[0-6])$'
    OR REPLACE(UPPER(c.course_code_th), ' ', '') REGEXP '^มธ\\.(25[0-9]|26[0-9]|27[0-6])$'
 ORDER BY c.course_code, cur.curriculum_id, cc.pathway_id;

-- c1) Explicit CNC references named in the curriculum material.
WITH expected(code, thai_label) AS (
  SELECT 'CNC201', 'คคป.201' UNION ALL
  SELECT 'CNC303', 'คคป.303' UNION ALL
  SELECT 'CNC304', 'คคป.304' UNION ALL
  SELECT 'CNC403', 'คคป.403' UNION ALL
  SELECT 'CNC404', 'คคป.404'
)
SELECT e.code AS expected_code,
       e.thai_label,
       c.course_id,
       c.course_code AS db_code,
       c.course_code_th AS db_thai_code,
       c.credits_total
  FROM expected e
  LEFT JOIN course c
    ON REPLACE(UPPER(c.course_code), ' ', '') = e.code
    OR REPLACE(UPPER(c.course_code_th), ' ', '') = REPLACE(UPPER(e.thai_label), ' ', '')
 ORDER BY e.code, c.course_id;

-- c2) CNC courses currently classified as the 81-credit required group.
-- Compare this result with the 27-course list from the curriculum book; do not
-- infer the authoritative list from course_group alone.
SELECT DISTINCT c.course_code, c.course_code_th, c.credits_total,
       cc.course_group, cc.requirement_type
  FROM curriculum_course cc
  JOIN course c ON c.course_id = cc.course_id
 WHERE cc.curriculum_id = 'BSC-CNC-2568'
   AND (cc.course_group IN ('วิชาเฉพาะ–วิชาบังคับ', 'วิชาเฉพาะ - วิชาบังคับ')
        OR cc.requirement_type IN ('required', 'major_required'))
 ORDER BY c.course_code;

-- c3) Check the potentially ambiguous CNC211 / คคป.211 mapping.
SELECT course_id, course_code, course_code_th, title_th, credits_total
  FROM course
 WHERE REPLACE(UPPER(course_code), ' ', '') = 'CNC211'
    OR REPLACE(UPPER(course_code_th), ' ', '') = 'คคป.211';

-- d) Detect English TU codes, Thai มธ. codes, and other/mixed forms.
SELECT CASE
         WHEN REPLACE(UPPER(course_code), ' ', '') REGEXP '^TU[0-9]{3}$' THEN 'english_TU'
         WHEN REPLACE(UPPER(course_code_th), ' ', '') REGEXP '^มธ\\.[0-9]{3}$' THEN 'thai_MTU'
         ELSE 'other_or_mixed'
       END AS code_form,
       COUNT(*) AS row_count
  FROM course
 GROUP BY code_form
 ORDER BY code_form;

SELECT course_id, course_code, course_code_th
  FROM course
 WHERE (course_code REGEXP '[[:space:]]' OR course_code_th REGEXP '[[:space:]]')
    OR (course_code REGEXP '^TU[0-9]{3}$' AND course_code_th NOT REGEXP '^มธ\\.[0-9]{3}$')
    OR (course_code_th REGEXP '^มธ\\.[0-9]{3}$' AND course_code NOT REGEXP '^TU[0-9]{3}$')
 ORDER BY course_code, course_code_th;
