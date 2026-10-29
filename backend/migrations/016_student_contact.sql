USE curriculum;

-- Editable contact fields that belong to our system, not to the TU profile.
-- The TU profile (name, faculty, email, status) stays read-only and is fetched live;
-- only these three fields are stored and editable by the student via PATCH.
CREATE TABLE IF NOT EXISTS student_contact (
  student_id VARCHAR(20) NOT NULL,
  secondary_email VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  notify_enabled TINYINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
