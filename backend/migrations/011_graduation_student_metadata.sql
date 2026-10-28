USE curriculum;

-- Optional metadata used by the V4 student progress view.
-- Existing assignments remain valid; NULL means the source has not provided it.
ALTER TABLE graduation_student_assignment
  ADD COLUMN display_name VARCHAR(255) NULL AFTER student_id;

ALTER TABLE graduation_student_assignment
  ADD COLUMN student_year TINYINT NULL AFTER display_name;
