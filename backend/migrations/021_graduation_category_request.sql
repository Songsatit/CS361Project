USE curriculum;

-- A student's requested category is advisory. It must not affect graduation totals
-- until an assigned reviewer confirms the category.
ALTER TABLE graduation_grade_record
  ADD COLUMN requested_credit_category VARCHAR(50) NULL AFTER catalog_status,
  ADD COLUMN credit_category_status ENUM('pending', 'confirmed') NOT NULL DEFAULT 'confirmed' AFTER requested_credit_category;
