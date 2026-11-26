# การทดสอบโหลดด้วย Locust

ไฟล์นี้เป็น workload แบบอ่านข้อมูลอย่างเดียวสำหรับ API ที่ deploy แล้ว เพื่อ
ใช้เก็บหลักฐาน V6 โดยจะเรียกข้อมูลรายวิชา วิชาบังคับก่อน แผนการเรียน และผล
ตรวจจบของนักศึกษาปัจจุบัน (ถ้าตั้งค่าไว้) จะไม่เรียก endpoint ธุรกิจแบบ POST,
PUT, PATCH หรือ DELETE ดังนั้นการรันตามปกติจะไม่สร้างเกรด ฉบับร่าง assignment
หรือการเปลี่ยนแปลงหลักสูตร

## วิธีติดตั้งและรัน

ติดตั้ง Locust แยกจาก environment ของ repository หากเครื่องยังไม่มี:

```powershell
py -m pip install locust
```

กำหนด URL และบัญชีสังเคราะห์/Demo ใน shell ห้าม commit password ลง Git:

```powershell
$env:LOADTEST_USERNAME = 'demostudent01'
$env:LOADTEST_PASSWORD = '<enter-demo-password>'
$env:CURRICULUM_ID = 'BSC-CS-2566'
$env:COURSE_CODE = 'CS100'
$env:STUDENT_PATH = '/api/graduation/me'
py -m locust -f loadtest/locustfile.py --host 'https://<deployed-host>'
```

เพื่อให้เปรียบเทียบ Baseline กับ After ได้ ให้ใช้จำนวนผู้ใช้ อัตราเพิ่มผู้ใช้
ระยะเวลา region และ commit ที่ deploy เหมือนกัน:

```powershell
py -m locust -f loadtest/locustfile.py --host 'https://<deployed-host>' `
  --headless -u 20 -r 5 -t 5m --csv results/v6-after
```

เก็บไฟล์ CSV และคำสั่งที่ใช้เป็นหลักฐาน บันทึกเวลา commit ของ Git, host,
จำนวนผู้ใช้ อัตราเพิ่มผู้ใช้ ระยะเวลา ข้อผิดพลาด และค่า AWS “Used $” ของแต่ละรอบ
ห้ามสรุปผลจนกว่าการรันทดสอบจะเสร็จสมบูรณ์

## การล้างข้อมูลและความปลอดภัยของข้อมูล

workload ที่ให้มานี้อ่านข้อมูลอย่างเดียว จึงไม่มีข้อมูลธุรกิจจากการทดสอบปกติที่
ต้องลบหลังจบงาน session cookie จะหมดอายุเองหรือถูกทิ้งเมื่อปิด Locust ห้ามสร้าง
คำสั่ง DELETE ไปยิง RDS ที่ใช้ร่วมกัน เพราะข้อมูล Demo ชุดเดียวกันอาจต้องใช้เก็บ
หลักฐาน E2E และ Access Control

หากการทดลองในอนาคตจำเป็นต้องเขียนข้อมูล ให้ใช้ฐานข้อมูลชั่วคราวแยกต่างหาก โดย
ตั้งชื่อขึ้นต้นด้วย `cs361_loadtest_` และจด run id ไว้ จากนั้นใช้คำสั่ง cleanup ที่
มี guard ด้านล่าง สคริปต์จะปฏิเสธ RDS/host ที่ไม่ใช่ loopback ชื่อฐานข้อมูลที่ดูเป็น
production และการลบที่ไม่มี `--confirm`

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = '...'
$env:DB_PASSWORD = '...'
$env:LOADTEST_DB_NAME = 'cs361_loadtest_20261201'
node backend/src/load-test-cleanup.mjs --confirm
```

สำหรับ RDS ที่ใช้ร่วมกัน วิธี cleanup ที่อนุมัติคือ restore snapshot ก่อนทดสอบ
หรือทิ้ง stack/ฐานข้อมูลที่แยกไว้ ตาม runbook ของทีม สคริปต์นี้ตั้งใจไม่ให้เป็น
เครื่องมือลบข้อมูล production

