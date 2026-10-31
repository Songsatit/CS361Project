USE curriculum;

-- People who signed in through TU. Written by the login handler for the signed-in person
-- only (no roster is pulled from the TU API). It lets staff and curriculum admins find a
-- student or a reviewer by name instead of typing an ID. It holds no grades, and a row here
-- gives nobody access to that person's record: access still needs a row in
-- graduation_student_assignment.
-- role is 'student' for TU student accounts and 'staff' for every other TU account.
CREATE TABLE IF NOT EXISTS graduation_user_directory (
  username VARCHAR(100) NOT NULL,
  role ENUM('student', 'staff') NOT NULL,
  display_name VARCHAR(255) NULL,
  first_login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username),
  KEY idx_graduation_directory_role_login (role, last_login_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
