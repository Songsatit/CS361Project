USE curriculum;

CREATE TABLE IF NOT EXISTS curriculum_workflow (
  curriculum_id VARCHAR(50) NOT NULL,
  status ENUM('draft', 'review', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  updated_by VARCHAR(100) NULL,
  updated_role VARCHAR(30) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (curriculum_id),
  CONSTRAINT fk_workflow_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
