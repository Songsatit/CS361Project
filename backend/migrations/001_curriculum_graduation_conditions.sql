CREATE TABLE IF NOT EXISTS curriculum_graduation_condition (
  condition_id BIGINT NOT NULL AUTO_INCREMENT,
  curriculum_id VARCHAR(50) NOT NULL,
  display_order INT NOT NULL,
  condition_text TEXT NOT NULL,
  PRIMARY KEY (condition_id),
  UNIQUE KEY uq_curriculum_graduation_condition_order (curriculum_id, display_order),
  CONSTRAINT fk_graduation_condition_curriculum
    FOREIGN KEY (curriculum_id) REFERENCES curriculum (curriculum_id)
    ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO curriculum_graduation_condition (curriculum_id, display_order, condition_text)
SELECT 'BSC-CS-2566', conditions.display_order, conditions.condition_text
FROM (
  SELECT 1 AS display_order, 'บรรลุผลลัพธ์การเรียนรู้ตามมาตรฐานคุณวุฒิระดับปริญญาตรี' AS condition_text
  UNION ALL SELECT 2, 'สอบผ่านและได้รับหน่วยกิตสะสมรายวิชาครบตามโครงสร้างหลักสูตร และมีหน่วยกิตสะสมไม่ต่ำกว่า 123 หน่วยกิต'
  UNION ALL SELECT 3, 'ได้ค่าระดับเฉลี่ยสะสมไม่ต่ำกว่า 2.00 จากระบบ 4 ระดับคะแนน'
  UNION ALL SELECT 4, 'ปฏิบัติตามเงื่อนไขอื่น ๆ ที่คณะวิทยาศาสตร์และเทคโนโลยี และมหาวิทยาลัยธรรมศาสตร์กำหนด'
  UNION ALL SELECT 5, 'ได้ค่าระดับไม่ต่ำกว่า C ในรายวิชา คพ.101, คพ.102 และ คพ.111'
  UNION ALL SELECT 6, 'ได้ค่าเฉลี่ยรวมทั้ง 8 รายวิชาไม่ต่ำกว่า 2.00 ได้แก่ คพ.100, คพ.101, คพ.102, คพ.111, คพ.232, คพ.240, คพ.251 และ คพ.261'
) AS conditions
JOIN curriculum curr ON curr.curriculum_id = 'BSC-CS-2566'
ON DUPLICATE KEY UPDATE condition_text = VALUES(condition_text);
