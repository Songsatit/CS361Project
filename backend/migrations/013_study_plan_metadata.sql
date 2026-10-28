ALTER TABLE study_plan
  ADD COLUMN plan_name_th VARCHAR(255) NULL AFTER plan_name,
  ADD COLUMN plan_name_en VARCHAR(255) NULL AFTER plan_name_th;

