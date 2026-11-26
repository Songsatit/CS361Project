USE curriculum;

-- One submission state per student. Individual row verification remains in
-- graduation_grade_record and is intentionally not duplicated here.
CREATE TABLE IF NOT EXISTS graduation_grade_submission (
  student_id VARCHAR(20) NOT NULL,
  status ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED') NOT NULL DEFAULT 'DRAFT',
  return_note VARCHAR(1000) NULL,
  submitted_at TIMESTAMP NULL,
  submitted_by VARCHAR(100) NULL,
  reviewed_at TIMESTAMP NULL,
  reviewed_by VARCHAR(100) NULL,
  approved_at TIMESTAMP NULL,
  approved_by VARCHAR(100) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS graduation_grade_submission_history (
  history_id BIGINT NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(20) NOT NULL,
  from_status ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED') NULL,
  to_status ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED') NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_username VARCHAR(100) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  note VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_grade_submission_history_student (student_id, created_at),
  CONSTRAINT fk_grade_submission_history_student
    FOREIGN KEY (student_id) REFERENCES graduation_grade_submission (student_id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Existing students start editable. No grade row is updated or deleted.
INSERT IGNORE INTO graduation_grade_submission (student_id, status)
SELECT DISTINCT student_id FROM graduation_grade_record;
