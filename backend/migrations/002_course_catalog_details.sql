CREATE TABLE IF NOT EXISTS course_detail (
  course_id VARCHAR(100) NOT NULL,
  description_th TEXT NULL,
  description_en TEXT NULL,
  contact_hours_json JSON NULL,
  raw_json JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id),
  CONSTRAINT fk_course_detail_course FOREIGN KEY (course_id) REFERENCES course (course_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_plan (
  study_plan_id VARCHAR(100) NOT NULL,
  curriculum_id VARCHAR(50) NOT NULL,
  pathway_id VARCHAR(100) NULL,
  plan_name TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_json JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (study_plan_id),
  KEY idx_study_plan_curriculum (curriculum_id),
  KEY idx_study_plan_pathway (pathway_id),
  CONSTRAINT fk_study_plan_curriculum FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id) ON DELETE CASCADE,
  CONSTRAINT fk_study_plan_pathway FOREIGN KEY (pathway_id) REFERENCES pathway (pathway_id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_plan_item (
  study_plan_id VARCHAR(100) NOT NULL,
  study_year INT NOT NULL,
  semester INT NOT NULL,
  item_order INT NOT NULL DEFAULT 0,
  course_id VARCHAR(100) NULL,
  requirement_text TEXT NULL,
  credits DECIMAL(5,2) NULL,
  raw_json JSON NULL,
  PRIMARY KEY (study_plan_id, study_year, semester, item_order),
  KEY idx_study_plan_item_course (course_id),
  CONSTRAINT fk_study_plan_item_plan FOREIGN KEY (study_plan_id) REFERENCES study_plan (study_plan_id) ON DELETE CASCADE,
  CONSTRAINT fk_study_plan_item_course FOREIGN KEY (course_id) REFERENCES course (course_id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
