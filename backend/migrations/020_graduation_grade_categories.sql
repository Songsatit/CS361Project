USE curriculum;

-- Store the curriculum category snapshot alongside a grade row. This migration is
-- intentionally additive: it does not change or delete any existing grade value.
ALTER TABLE graduation_grade_record
  ADD COLUMN category_code VARCHAR(64) NULL AFTER entry_type,
  ADD COLUMN category_label VARCHAR(255) NULL AFTER category_code;
