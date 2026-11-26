USE curriculum;

-- Student-entered rows may describe a course that is not in the catalog and may
-- repeat the same course in a later term. Keep imported rows compatible while
-- making the origin and attempt explicit.
ALTER TABLE graduation_grade_record
  ADD COLUMN course_name VARCHAR(255) NULL AFTER course_code,
  ADD COLUMN entry_type ENUM('catalog', 'free_elective') NOT NULL DEFAULT 'catalog' AFTER course_name,
  ADD COLUMN attempt_no TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER semester;

ALTER TABLE graduation_grade_record
  DROP INDEX uq_graduation_grade_attempt,
  ADD UNIQUE KEY uq_graduation_grade_attempt
    (student_id, curriculum_id, academic_year, semester, course_code, attempt_no);

