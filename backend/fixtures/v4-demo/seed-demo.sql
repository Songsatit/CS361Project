-- V4 DEMO SEED. Synthetic data only. Run against a local scratch database, never RDS.
-- Requires migrations 001 and 007 (curriculum.active) and 010 (graduation tables) to be applied first.
--
-- Demo curriculum DEMO-GRAD-V4 is inactive (active = 0), so it stays out of the public catalog.
-- Its condition texts and rules are demo rules. They are NOT the real BSC-CS-2566 rules.

USE curriculum;

INSERT INTO curriculum (curriculum_id, academic_year, active)
VALUES ('DEMO-GRAD-V4', 2025, 0)
ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year), active = 0;

INSERT INTO curriculum_graduation_condition (curriculum_id, display_order, condition_text)
VALUES
  ('DEMO-GRAD-V4', 1, '[DEMO] ผลการเรียนรู้ตามมาตรฐานคุณวุฒิ (ไม่มีกฎที่ระบบตรวจได้ในเวอร์ชันนี้)'),
  ('DEMO-GRAD-V4', 2, '[DEMO] สะสมหน่วยกิตที่ได้รับไม่ต่ำกว่า 12 หน่วยกิต'),
  ('DEMO-GRAD-V4', 3, '[DEMO] ค่าระดับเฉลี่ยสะสม (GPA) ไม่ต่ำกว่า 2.00'),
  ('DEMO-GRAD-V4', 4, '[DEMO] เงื่อนไขอื่นที่ระบบยังไม่มีข้อมูลตรวจ'),
  ('DEMO-GRAD-V4', 5, '[DEMO] ได้ระดับไม่ต่ำกว่า C ใน DEMO101 และ DEMO102'),
  ('DEMO-GRAD-V4', 6, '[DEMO] ค่าเฉลี่ยของ DEMO100, DEMO101, DEMO102 และ DEMO111 ไม่ต่ำกว่า 2.00')
ON DUPLICATE KEY UPDATE condition_text = VALUES(condition_text);

INSERT INTO graduation_rule (curriculum_id, condition_order, rule_type, params, note)
VALUES
  ('DEMO-GRAD-V4', 2, 'min_total_credits', JSON_OBJECT('min', 12), 'DEMO rule'),
  ('DEMO-GRAD-V4', 3, 'min_gpa', JSON_OBJECT('min', 2.00), 'DEMO rule'),
  ('DEMO-GRAD-V4', 5, 'min_grade_each', JSON_OBJECT('courses', JSON_ARRAY('DEMO101', 'DEMO102'), 'min_grade', 'C'), 'DEMO rule'),
  ('DEMO-GRAD-V4', 6, 'min_avg_grade', JSON_OBJECT('courses', JSON_ARRAY('DEMO100', 'DEMO101', 'DEMO102', 'DEMO111'), 'min', 2.00), 'DEMO rule')
ON DUPLICATE KEY UPDATE params = VALUES(params), note = VALUES(note);

-- DEMO0001 and DEMO0002 are visible to the demo instructor and staff accounts.
-- DEMO0003 is visible to the demo staff account only, so the instructor gets 403 for it.
INSERT IGNORE INTO graduation_student_assignment (assignee_username, student_id, assigned_by)
VALUES
  ('instructor', 'DEMO0001', 'demo-seed'),
  ('instructor', 'DEMO0002', 'demo-seed'),
  ('staff', 'DEMO0001', 'demo-seed'),
  ('staff', 'DEMO0002', 'demo-seed'),
  ('staff', 'DEMO0003', 'demo-seed');
