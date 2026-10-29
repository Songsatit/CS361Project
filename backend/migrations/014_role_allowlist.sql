USE curriculum;

-- Allowlist that grants a non-student TU account an elevated role at login.
-- tuLogin looks up the (lower-cased) TU username here; a hit returns the stored role,
-- a miss (or any query error) falls back to the least-privileged 'public' role.
-- Only instructor, staff, and curriculum_admin may be granted.
CREATE TABLE IF NOT EXISTS role_allowlist (
  tu_username VARCHAR(100) NOT NULL,
  role VARCHAR(32) NOT NULL,
  granted_by VARCHAR(100) NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tu_username),
  CONSTRAINT chk_role_allowlist_role CHECK (role IN ('instructor', 'staff', 'curriculum_admin'))
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed rows for a local scratch database only. These are synthetic DEMO usernames,
-- never real TU accounts. Do NOT apply the seed against production/RDS.
INSERT INTO role_allowlist (tu_username, role, granted_by) VALUES
  ('demo.instructor', 'instructor', 'DEMO-SEED'),
  ('demo.staff', 'staff', 'DEMO-SEED'),
  ('demo.curriculumadmin', 'curriculum_admin', 'DEMO-SEED')
ON DUPLICATE KEY UPDATE role = VALUES(role), granted_by = VALUES(granted_by);
