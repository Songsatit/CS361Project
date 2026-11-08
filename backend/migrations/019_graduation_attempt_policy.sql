USE curriculum;

-- V4 graduation policy: choose whether GPAX uses every graded attempt or only
-- the latest attempt for each course. The default preserves the agreed rule:
-- every attempt contributes to GPA; earned credits still count once per course.
ALTER TABLE curriculum
  ADD COLUMN graduation_attempt_policy ENUM('all', 'latest') NOT NULL DEFAULT 'all';

-- Self-reported courses may be outside the catalog. Keep that fact and the eventual
-- staff classification on the grade row so graduation logic never guesses a category.
ALTER TABLE graduation_grade_record
  ADD COLUMN catalog_status ENUM('found', 'not_found', 'pending_review') NOT NULL DEFAULT 'found' AFTER grade,
  ADD COLUMN credit_category VARCHAR(50) NULL AFTER catalog_status;
