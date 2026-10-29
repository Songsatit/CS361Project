USE curriculum;

-- V4 self-reported grades: track where each grade row came from, whether staff verified
-- it, and whether the course is still in progress (not counted toward graduation yet).
--
-- Existing rows were all CSV imports, so the defaults mark them 'imported' + 'verified'.
-- The CLI importer keeps writing those defaults; only the self-report API sets other values.
-- The unique key from migration 010 (student_id, curriculum_id, academic_year, semester,
-- course_code) already matches the contract's attempt key, so it is left unchanged.

ALTER TABLE graduation_grade_record
  ADD COLUMN source ENUM('imported', 'self_reported') NOT NULL DEFAULT 'imported' AFTER grade;

ALTER TABLE graduation_grade_record
  ADD COLUMN verification_status ENUM('unverified', 'verified', 'rejected') NOT NULL DEFAULT 'verified' AFTER source;

ALTER TABLE graduation_grade_record
  ADD COLUMN is_in_progress TINYINT NOT NULL DEFAULT 0 AFTER verification_status;

-- Who verified/rejected a self-reported row, when, and the staff note. NULL until acted on.
ALTER TABLE graduation_grade_record
  ADD COLUMN verified_by VARCHAR(100) NULL AFTER is_in_progress;

ALTER TABLE graduation_grade_record
  ADD COLUMN verified_at TIMESTAMP NULL AFTER verified_by;

ALTER TABLE graduation_grade_record
  ADD COLUMN verification_note VARCHAR(500) NULL AFTER verified_at;

-- batch_id is NULL for self-reported rows (they never came from an import batch).
-- Migration 010 made it NOT NULL; relax it so self-report inserts are possible.
ALTER TABLE graduation_grade_record
  MODIFY COLUMN batch_id BIGINT NULL;

CREATE INDEX idx_graduation_grade_source
  ON graduation_grade_record (source, verification_status);
