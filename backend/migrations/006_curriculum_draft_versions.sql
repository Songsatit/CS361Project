USE curriculum;

-- Draft requests are separate from the published curriculum tables.
-- The live curriculum is changed only by the later approve transaction.
CREATE TABLE IF NOT EXISTS change_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  curriculum_id VARCHAR(50) NULL,
  type ENUM('add_curriculum', 'edit_structure', 'edit_course') NOT NULL,
  status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  base_version_id BIGINT NULL,
  source_curriculum_id VARCHAR(50) NULL,
  title VARCHAR(255) NOT NULL,
  note TEXT NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  reviewed_by VARCHAR(100) NULL,
  reviewed_at TIMESTAMP NULL,
  reject_reason TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_change_requests_curriculum (curriculum_id),
  KEY idx_change_requests_status (status),
  KEY idx_change_requests_created_by (created_by),
  CONSTRAINT fk_change_requests_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_change_requests_source_curriculum
    FOREIGN KEY (source_curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS change_items (
  id BIGINT NOT NULL AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  action ENUM(
    'ADD_COURSE',
    'REMOVE_COURSE',
    'MOVE_COURSE',
    'EDIT_FIELD',
    'ADD_PREREQ',
    'REMOVE_PREREQ',
    'CREATE_CURRICULUM'
  ) NOT NULL,
  course_code VARCHAR(30) NULL,
  study_year TINYINT UNSIGNED NULL,
  term VARCHAR(10) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_change_items_request (request_id),
  KEY idx_change_items_course (course_code),
  CONSTRAINT fk_change_items_request
    FOREIGN KEY (request_id) REFERENCES change_requests (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS curriculum_versions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  curriculum_id VARCHAR(50) NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  based_on_request_id BIGINT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_by VARCHAR(100) NULL,
  activated_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_curriculum_version (curriculum_id, version_no),
  KEY idx_curriculum_versions_active (curriculum_id, is_active),
  KEY idx_curriculum_versions_request (based_on_request_id),
  CONSTRAINT fk_curriculum_versions_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_curriculum_versions_request
    FOREIGN KEY (based_on_request_id) REFERENCES change_requests (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE change_requests
  ADD CONSTRAINT fk_change_requests_base_version
  FOREIGN KEY (base_version_id) REFERENCES curriculum_versions (id)
  ON DELETE SET NULL;
