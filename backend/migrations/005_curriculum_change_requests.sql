USE curriculum;

CREATE TABLE IF NOT EXISTS curriculum_change_request (
  change_id BIGINT NOT NULL AUTO_INCREMENT,
  curriculum_id VARCHAR(50) NULL,
  operation ENUM('create', 'update') NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(100) NOT NULL,
  requested_role VARCHAR(30) NOT NULL,
  reviewed_by VARCHAR(100) NULL,
  reviewed_role VARCHAR(30) NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  PRIMARY KEY (change_id),
  KEY idx_curriculum_change_status (status),
  KEY idx_curriculum_change_curriculum (curriculum_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
