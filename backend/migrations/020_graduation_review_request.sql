USE curriculum;

-- A student submits one review request per curriculum. The request locks self-reported
-- grade edits while staff review it; returning the request lets the student correct it.
CREATE TABLE IF NOT EXISTS graduation_review_request (
  review_request_id BIGINT NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(20) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  status ENUM('draft', 'pending_review', 'approved', 'returned') NOT NULL DEFAULT 'draft',
  submitted_by VARCHAR(100) NULL,
  submitted_at TIMESTAMP NULL,
  reviewed_by VARCHAR(100) NULL,
  reviewed_at TIMESTAMP NULL,
  review_note VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (review_request_id),
  KEY idx_graduation_review_student (student_id, curriculum_id, updated_at),
  KEY idx_graduation_review_queue (status, updated_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
