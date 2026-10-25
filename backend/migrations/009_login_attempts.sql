USE curriculum;

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  failed_count INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL,
  last_attempt_at DATETIME NOT NULL,
  PRIMARY KEY (attempt_key),
  KEY idx_login_attempts_username (username),
  KEY idx_login_attempts_locked_until (locked_until)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
