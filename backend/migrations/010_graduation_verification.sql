USE curriculum;

-- V4 graduation verification: schema only.
-- Demo curriculum, demo rules, and demo assignments are NOT created here.
-- They live in backend/fixtures/v4-demo/seed-demo.sql so production never receives demo rows.

-- One row per import attempt. Stores counts and error codes only, never row values.
CREATE TABLE IF NOT EXISTS graduation_import_batch (
  batch_id BIGINT NOT NULL AUTO_INCREMENT,
  source_key VARCHAR(50) NOT NULL,
  data_mode ENUM('demo', 'live') NOT NULL,
  source_batch_id VARCHAR(100) NULL,
  file_sha256 CHAR(64) NOT NULL,
  exported_at DATETIME NULL,
  status ENUM('success', 'partial', 'failed') NOT NULL,
  row_total INT NOT NULL DEFAULT 0,
  row_inserted INT NOT NULL DEFAULT 0,
  row_updated INT NOT NULL DEFAULT 0,
  row_unchanged INT NOT NULL DEFAULT 0,
  row_rejected INT NOT NULL DEFAULT 0,
  error_summary JSON NULL,
  imported_by VARCHAR(100) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  PRIMARY KEY (batch_id),
  KEY idx_graduation_batch_source_finished (source_key, finished_at),
  KEY idx_graduation_batch_file (source_key, file_sha256)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Rejected rows. student_id is kept only when it passed format validation.
-- NULL student_id means the row cannot be tied to a student.
CREATE TABLE IF NOT EXISTS graduation_import_error (
  error_id BIGINT NOT NULL AUTO_INCREMENT,
  batch_id BIGINT NOT NULL,
  line_no INT NOT NULL,
  student_id VARCHAR(20) NULL,
  error_code VARCHAR(50) NOT NULL,
  PRIMARY KEY (error_id),
  KEY idx_graduation_error_batch_student (batch_id, student_id),
  CONSTRAINT fk_graduation_error_batch
    FOREIGN KEY (batch_id) REFERENCES graduation_import_batch (batch_id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- One row per student, curriculum, academic year, semester, and course.
-- Re-importing the same key updates the row in place, so duplicates cannot appear.
CREATE TABLE IF NOT EXISTS graduation_grade_record (
  grade_record_id BIGINT NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(20) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  academic_year SMALLINT NOT NULL,
  semester TINYINT NOT NULL,
  course_code VARCHAR(30) NOT NULL,
  credits DECIMAL(4, 1) NOT NULL,
  grade VARCHAR(3) NOT NULL,
  row_hash CHAR(64) NOT NULL,
  batch_id BIGINT NOT NULL,
  PRIMARY KEY (grade_record_id),
  UNIQUE KEY uq_graduation_grade_attempt (student_id, curriculum_id, academic_year, semester, course_code),
  KEY idx_graduation_grade_student (student_id),
  CONSTRAINT chk_graduation_grade_semester CHECK (semester IN (1, 2, 3)),
  CONSTRAINT chk_graduation_grade_credits CHECK (credits >= 0 AND credits <= 12),
  CONSTRAINT fk_graduation_grade_batch
    FOREIGN KEY (batch_id) REFERENCES graduation_import_batch (batch_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Computable graduation rules, keyed to curriculum_graduation_condition.display_order.
-- A condition with no rule row is reported as "ข้อมูลไม่ครบ" instead of being guessed.
CREATE TABLE IF NOT EXISTS graduation_rule (
  rule_id BIGINT NOT NULL AUTO_INCREMENT,
  curriculum_id VARCHAR(50) NOT NULL,
  condition_order INT NOT NULL,
  rule_type ENUM('min_total_credits', 'min_gpa', 'min_grade_each', 'min_avg_grade') NOT NULL,
  params JSON NOT NULL,
  note VARCHAR(255) NULL,
  PRIMARY KEY (rule_id),
  UNIQUE KEY uq_graduation_rule_condition (curriculum_id, condition_order),
  CONSTRAINT fk_graduation_rule_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Which instructor or staff member may view which student's graduation check.
CREATE TABLE IF NOT EXISTS graduation_student_assignment (
  assignment_id BIGINT NOT NULL AUTO_INCREMENT,
  assignee_username VARCHAR(100) NOT NULL,
  student_id VARCHAR(20) NOT NULL,
  assigned_by VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id),
  UNIQUE KEY uq_graduation_assignment (assignee_username, student_id),
  KEY idx_graduation_assignment_student (student_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
