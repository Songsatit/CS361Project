USE curriculum;

ALTER TABLE curriculum
  ADD COLUMN title_th VARCHAR(255) NULL AFTER curriculum_id;

ALTER TABLE curriculum
  ADD COLUMN title_en VARCHAR(255) NULL AFTER title_th;
