-- TEST STUB ONLY. NOT the production schema.
-- The repo has no migration for these base tables, so the real RDS schema cannot be
-- reproduced from this repository. This stub contains only the columns and keys that
-- migrations 001-010 reference, so the migration order can be exercised on a scratch DB.
-- Real RDS state is unknown (see docs/v4-migration-runbook.md).

USE curriculum;

CREATE TABLE IF NOT EXISTS curriculum (
  curriculum_id VARCHAR(50) NOT NULL,
  academic_year INT NOT NULL,
  PRIMARY KEY (curriculum_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course (
  course_id VARCHAR(100) NOT NULL,
  course_code VARCHAR(30) NULL,
  PRIMARY KEY (course_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pathway (
  pathway_id VARCHAR(100) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (pathway_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Lets migration 001 seed its condition rows, as it does on a database that already has this curriculum.
INSERT INTO curriculum (curriculum_id, academic_year) VALUES ('BSC-CS-2566', 2023)
ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year);
