USE curriculum;

-- Rollback for 020_graduation_grade_categories.sql.
-- Run manually only after confirming the backup and migration state.
ALTER TABLE graduation_grade_record
  DROP COLUMN category_label,
  DROP COLUMN category_code;
