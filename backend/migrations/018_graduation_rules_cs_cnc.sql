USE curriculum;

-- Graduation rules for the two real curricula, so the graduation check computes their
-- conditions instead of reporting "no rule". Source: the curriculum documents as summarised
-- by the project owner (CS: 123 credits; CNC: 126 credits). Not demo data.
--
-- Safe to run more than once: every statement upserts on the table's unique key, so a run
-- that stopped part-way can simply be repeated. A curriculum that is missing from the
-- database is skipped (the SELECT returns no rows).
--
-- The derived tables below use aliases (ord, kind, params_json, note_text, cond_text) that
-- differ from the target column names. Reusing the target names makes the column
-- references in ON DUPLICATE KEY UPDATE ambiguous (MySQL error 1052).
--
-- Conditions 1 and 4 (learning outcomes, faculty/university requirements) cannot be computed.
-- They get the new rule type 'manual': shown as "waiting for staff review", and the verdict
-- is capped at 'met_pending_review' so it never reads as a plain pass.

ALTER TABLE graduation_rule
  MODIFY COLUMN rule_type
    ENUM('min_total_credits', 'min_gpa', 'min_grade_each', 'min_avg_grade', 'manual') NOT NULL;

-- ---- BSC-CS-2566 (condition texts already exist) ----
INSERT INTO graduation_rule (curriculum_id, condition_order, rule_type, params, note)
SELECT c.curriculum_id, v.ord, v.kind, CAST(v.params_json AS JSON), v.note_text
  FROM curriculum c
  JOIN (
    SELECT 1 AS ord, 'manual' AS kind, '{}' AS params_json, 'Learning outcomes: judged by staff' AS note_text
    UNION ALL SELECT 2, 'min_total_credits', '{"min": 123}', 'At least 123 credits'
    UNION ALL SELECT 3, 'min_gpa', '{"min": 2.0}', 'GPAX at least 2.00'
    UNION ALL SELECT 4, 'manual', '{}', 'Other faculty/university requirements: judged by staff'
    UNION ALL SELECT 5, 'min_grade_each', '{"courses": ["CS101", "CS102", "CS111"], "min_grade": "C"}', 'At least C in CS101, CS102, CS111'
    UNION ALL SELECT 6, 'min_avg_grade', '{"courses": ["CS100", "CS101", "CS102", "CS111", "CS232", "CS240", "CS251", "CS261"], "min": 2.0}', 'Average of 8 courses at least 2.00'
  ) v
 WHERE c.curriculum_id = 'BSC-CS-2566'
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type), params = VALUES(params), note = VALUES(note);

-- ---- BSC-CNC-2568 (no conditions existed, so add them first) ----
INSERT INTO curriculum_graduation_condition (curriculum_id, display_order, condition_text)
SELECT c.curriculum_id, v.ord, v.cond_text
  FROM curriculum c
  JOIN (
    SELECT 1 AS ord, 'บรรลุผลลัพธ์การเรียนรู้ตามมาตรฐานคุณวุฒิระดับปริญญาตรี' AS cond_text
    UNION ALL SELECT 2, 'สอบผ่านและได้รับหน่วยกิตสะสมรายวิชาครบตามโครงสร้างหลักสูตร และมีหน่วยกิตสะสมไม่ต่ำกว่า 126 หน่วยกิต'
    UNION ALL SELECT 3, 'ได้ค่าระดับเฉลี่ยสะสมไม่ต่ำกว่า 2.00 จากระบบ 4 ระดับคะแนน'
    UNION ALL SELECT 4, 'ปฏิบัติตามเงื่อนไขอื่น ๆ ที่คณะวิทยาศาสตร์และเทคโนโลยี และมหาวิทยาลัยธรรมศาสตร์กำหนด'
    UNION ALL SELECT 5, 'ได้ค่าระดับไม่ต่ำกว่า C ในรายวิชา คคป.101, คคป.102, คคป.222, คคป.231 และ คคป.235'
    UNION ALL SELECT 6, 'ได้ค่าเฉลี่ยรวมทั้ง 7 รายวิชาไม่ต่ำกว่า 2.00 ได้แก่ คคป.101, คคป.102, คคป.211, คคป.222, คคป.231, คคป.235 และ คคป.332'
  ) v
 WHERE c.curriculum_id = 'BSC-CNC-2568'
ON DUPLICATE KEY UPDATE condition_text = condition_text;

INSERT INTO graduation_rule (curriculum_id, condition_order, rule_type, params, note)
SELECT c.curriculum_id, v.ord, v.kind, CAST(v.params_json AS JSON), v.note_text
  FROM curriculum c
  JOIN (
    SELECT 1 AS ord, 'manual' AS kind, '{}' AS params_json, 'Learning outcomes: judged by staff' AS note_text
    UNION ALL SELECT 2, 'min_total_credits', '{"min": 126}', 'At least 126 credits'
    UNION ALL SELECT 3, 'min_gpa', '{"min": 2.0}', 'GPAX at least 2.00'
    UNION ALL SELECT 4, 'manual', '{}', 'Other faculty/university requirements: judged by staff'
    UNION ALL SELECT 5, 'min_grade_each', '{"courses": ["CNC101", "CNC102", "CNC222", "CNC231", "CNC235"], "min_grade": "C"}', 'At least C in CNC101, CNC102, CNC222, CNC231, CNC235'
    UNION ALL SELECT 6, 'min_avg_grade', '{"courses": ["CNC101", "CNC102", "CNC211", "CNC222", "CNC231", "CNC235", "CNC332"], "min": 2.0}', 'Average of 7 courses at least 2.00'
  ) v
 WHERE c.curriculum_id = 'BSC-CNC-2568'
ON DUPLICATE KEY UPDATE rule_type = VALUES(rule_type), params = VALUES(params), note = VALUES(note);
