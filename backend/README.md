# CS361 data importer

โฟลเดอร์นี้เป็นส่วน Backend สำหรับดึงข้อมูลจาก 3 API แล้วนำเข้า Amazon RDS MySQL

## Setup

```bash
cd backend
npm install
copy .env.example .env
```

จากนั้นเปิดไฟล์ `.env` แล้วกรอกค่า RDS และ URL ของ API จริง

```env
DB_HOST=your-rds-endpoint
DB_PORT=3306
DB_NAME=curriculum
DB_USER=admin
DB_PASSWORD=replace-me

FACULTY_API_URL=https://restapi.tu.ac.th/api/v2/std/fac/all
DEPARTMENT_API_URL=https://restapi.tu.ac.th/api/v2/std/dep/all
TU_APPLICATION_KEY=replace-with-tu-access-token
COURSE_API_URL=https://script.google.com/a/macros/dome.tu.ac.th/s/AKfycbxO0y-q5MC_dkvYOHwE5BguW0NYqBecLtF-JEvRJ42XnSouQ3Ij4-ss7paIYRX9wlU9SQ/exec
```

Faculty และ Department API ของ มธ. ต้องส่ง token ผ่าน header ชื่อ `Application-Key` โดยใช้ค่าเดียวกับ `TU_APPLICATION_KEY`

ห้าม commit ไฟล์ `.env` เพราะมี password และ API key

## Run

```bash
npm run typecheck
npm run import
```

Script จะดึง Faculty, Department และ Course Catalog แล้วบันทึกลงตารางที่สร้างใน RDS โดยใช้ `ON DUPLICATE KEY UPDATE` จึงรันซ้ำเพื่ออัปเดตข้อมูลได้

## Read API (Issue #14)

`template.yaml` deploys one AWS Lambda behind API Gateway HTTP API. The Lambda connects to the existing MySQL tables.

| Method and path | Description |
| --- | --- |
| `GET /api/courses` | List course placements. Optional query parameters: `q`, `curriculumId`, `pathwayId`, `limit` (1–500, default 100), and `offset`. |
| `GET /api/courses/{courseId}` | Return a course (by database ID or course code), curriculum placements, classifications, prerequisites, and imported detail data. |
| `GET /api/courses/{courseId}/prerequisites` | Return the prerequisite chain with depth and `completed: false` for the frontend checklist. |
| `GET /api/curricula/{curriculumId}/graduation-conditions` | List graduation conditions in display order. |
| `GET /api/study-plans` | List imported study plans. Optional query parameters: `curriculumId`, `pathwayId`, and `active`. |
| `GET /api/study-plans/{studyPlanId}` | Return one study plan with ordered year/semester items. Optional query parameters: `studyYear` and `semester`. |
| `GET /api/faculties` | List faculties. |
| `GET /api/departments` | List departments. Optional `facultyId` filters by faculty. |
| `GET /api/audit-logs` | List recent audit logs. Optional `limit` (1–500, default 100). |
| `POST /api/auth/login` | Authenticate a TU account through the TU Authentication API. |
| `GET /api/curricula/{curriculumId}/workflow` | Read the curriculum workflow status. |
| `POST /api/curricula/{curriculumId}/workflow` | Demo teacher/staff workflow action (`submit`, `approve`, `reject`, `reset`) and write an audit log. |

The workflow endpoint currently uses the V3 mock identity (`username` and `role` in the JSON body, or `x-user`/`x-role` headers). It is for the demo only; production should validate the TU Auth token in the backend before allowing mutations.

Set `TuApplicationKey` during deployment. The key is sent only from Lambda to TU and is never placed in the frontend.

Successful responses use `{ "data": ... }`; list endpoints return an array in `data`. A missing course returns 404. Unexpected database or schema errors return a generic 500 response and are logged in CloudWatch.

### Deploy

Install AWS SAM CLI and configure AWS credentials for the target account. The deployment needs an existing VPC, private subnets with a route to RDS, a Lambda security group, and an RDS security group rule allowing inbound MySQL (3306) from that Lambda security group. The Lambda must be able to reach RDS; public subnet placement alone does not provide that access. Database tables must match the entities in `../docs/v2-data-model-erd.md`, including `prerequisite`. Run all migration files, including `migrations/009_login_attempts.sql`, once against the target RDS before deploying. The included seed covers `BSC-CS-2566`; add verified conditions for other curricula before using that endpoint for them.

From this directory, validate and deploy with the database and network values for your environment:

```bash
sam validate --lint
sam build
sam deploy --guided
```

Provide `DbHost`, `DbInstanceIdentifier`, `DbName`, `DbUser`, `DbPassword`, `DbPort`, `VpcSubnetIds`, `LambdaSecurityGroupId`, `RdsProxySecurityGroupId`, and an existing `RdsProxyRoleArn` when prompted. In AWS Academy, `LabRole` can be used when its trust policy includes `rds.amazonaws.com` and it can read the generated Secrets Manager secret. `DbPassword` and demo password hash parameters are marked `NoEcho`. Keep `EnableDemoLogin` as `false`; if a temporary demo is required, pass scrypt hashes through the hash parameters and never commit the original passwords or hashes. The deployment creates an RDS Proxy and points Lambda to its endpoint; the proxy security group must allow inbound TCP 3306 from the Lambda security group, and the RDS security group must allow TCP 3306 from the proxy security group. Use at least two subnets in different Availability Zones. Do not put database credentials in source control or the SAM template. The stack outputs `ApiUrl` and `RdsProxyEndpoint`.

To generate a demo password hash in CloudShell without putting the plaintext in the repository:

```bash
read -s DEMO_PASSWORD
node -e 'const c=require("crypto"); const s=c.randomBytes(16); const h=c.scryptSync(process.argv[1],s,64,{N:16384,r:8,p:1}); console.log(`scrypt$${s.toString("hex")}$${h.toString("hex")}`)' "$DEMO_PASSWORD"
unset DEMO_PASSWORD
```

Pass the output as `DemoStaffPasswordHash` or the matching role parameter only when intentionally enabling demos. The login endpoint is throttled to 2 requests/second with burst 5, and five failed attempts for the same username/IP within 15 minutes produce HTTP 429.

Example calls after deployment:

```text
GET {ApiUrl}/api/faculties
GET {ApiUrl}/api/departments?facultyId=XX
GET {ApiUrl}/api/courses?curriculumId=BSC-CS-2566&limit=100
GET {ApiUrl}/api/courses/CS100
GET {ApiUrl}/api/courses/CS100/prerequisites
GET {ApiUrl}/api/curricula/BSC-CS-2566/graduation-conditions
GET {ApiUrl}/api/study-plans?curriculumId=BSC-CS-2566&pathwayId=BSC-CS-2566-CIS
GET {ApiUrl}/api/study-plans/{studyPlanId}
```

Import `postman/CS361Project-API.postman_collection.json` into Postman and set `baseUrl`, `courseCode`, and `curriculumId` to exercise the endpoints. The collection includes basic status and response-shape checks.

## V4: ตรวจสอบการสำเร็จการศึกษา (Demo เท่านั้น)

## การจัดการฉบับร่างคำขอ

เพิ่ม endpoint สำหรับเจ้าของคำขอเท่านั้น:

| Method and path | Description |
| --- | --- |
| `DELETE /api/change-requests/{requestId}` | ลบเฉพาะคำขอสถานะ `draft` ของผู้เรียก และลบรายการย่อยใน transaction เดียวกัน |
| `POST /api/change-requests/{requestId}/cancel` | ถอนคำขอสถานะ `pending` ของผู้เรียกกลับเป็น `draft` |

ทั้งสอง operation เขียน audit log และไม่เพิ่มสถานะ `cancelled` ในฐานข้อมูล การลบจะตอบ `409` หากมี `curriculum_versions.based_on_request_id` อ้างอิงอยู่

ตรวจรายการฉบับร่างซ้ำแบบไม่ลบข้อมูล:

```bash
npm run draft-cleanup
```

ระบบถือว่าซ้ำเมื่อ `created_by`, `title`, `type` และ `status = 'draft'` เหมือนกัน โดยเก็บ request ID ที่เก่าที่สุดไว้ การลบจริงต้องใช้ทั้งสอง flag และต้องได้รับอนุมัติจากเจ้าของข้อมูลก่อน:

```bash
npm run draft-cleanup -- --confirm --owner-approved
```

ห้ามรันโหมดลบจริงบน RDS จนกว่าจะทำตาม `docs/v4-rds-migration-runbook.md`: ยืนยัน environment/target แบบอ่านอย่างเดียว, ทำ RDS snapshot และทดสอบกู้คืน, ตรวจรายการซ้ำจาก dry-run และบันทึก request ID ที่จะเก็บ/ลบ หากเกิดปัญหาให้หยุดการรัน, เก็บ audit log และกู้คืนจาก snapshot ตามแผนของเจ้าของฐานข้อมูล ห้ามรัน migration หรือ `seed-demo.sql` เป็นส่วนหนึ่งของงานนี้

ปัจจุบัน V4 ประเมินผลการเรียน **สังเคราะห์สำหรับ Demo เท่านั้น** ใน repository ไม่มีข้อกำหนดการส่งออกเกรดจากสำนักทะเบียนหรือการเชื่อมต่อกับทะเบียนจริง โปรดอ่าน[สัญญาข้อมูลฉบับร่าง](../docs/v4-data-contract.md)ก่อนเตรียม fixture และอ่าน[คู่มือ migration สำหรับ RDS](../docs/v4-rds-migration-runbook.md)ก่อนดำเนินการกับฐานข้อมูล สถานะ migration ที่ apply แล้วบน RDS ซึ่ง deploy อยู่ยังไม่ทราบ ห้ามใช้คำสั่งเหล่านี้กับ RDS

### ลำดับ deploy เมื่อเตรียมพร้อมแล้ว

ไฟล์ `.mjs` ไม่ได้ deploy แยกทีละไฟล์: `src/api.mjs` และโมดูลที่ import เช่น `src/graduation/evaluate.mjs` จะถูกรวมเป็น Lambda package ด้วย AWS SAM ส่วน `src/graduation-import.mjs` เป็น CLI สำหรับนำเข้า Demo ไม่ใช่ Lambda route และห้ามชี้ไป RDS production ส่วน frontend เป็นการ deploy แยกผ่าน Amplify ตาม branch ที่ตั้งค่าไว้

ก่อน deploy V4 ไปยัง environment ที่ใช้จริง ต้องทำตามลำดับนี้:

1. ทดสอบ unit tests, CSV dry-run และ `sam validate --lint`/`sam build` ในเครื่อง
2. ให้ผู้ดูแลฐานข้อมูลตรวจสถานะ migration `001`–`009` บน RDS แบบอ่านอย่างเดียว เทียบ schema และสำรอง/ยืนยันการกู้คืนก่อนวางแผนเปลี่ยนฐานข้อมูล หากสถานะใดไม่ทราบหรือ apply ไปบางส่วน ให้หยุดและตรวจสอบก่อน
3. ทบทวนและอนุมัติ migration `010_graduation_verification.sql` และ `011_graduation_student_metadata.sql` แล้วให้ผู้ดูแล apply เฉพาะ migration ที่ตรวจแล้วว่ายังไม่เคย apply ตามแผนที่อนุมัติ ห้ามรัน migration ทั้งชุดโดยเดา และห้ามใช้ `fixtures/v4-demo/seed-demo.sql` บน RDS
4. เมื่อ schema พร้อมแล้ว จึง deploy Lambda ด้วย `sam build` และ `sam deploy` จาก `backend/` โดยใช้ stack parameters ของ environment ที่อนุมัติ การ deploy นี้จะส่ง routes V4 ไปกับ Lambda เดิม
5. deploy frontend ผ่าน Amplify เฉพาะ branch ที่เชื่อมกับ environment นั้น จากนั้นตรวจ API และหน้าจอด้วยบัญชี/ข้อมูล Demo ที่ได้รับอนุมัติ

คำสั่ง deploy ที่อยู่ในส่วนทั่วไปด้านบนเป็นตัวอย่างการ deploy stack และอาจแก้ทรัพยากร AWS จริง ห้ามรันจนกว่าจะยืนยัน account/region/stack, สถานะ migration, backup และแผน deploy ครบถ้วนแล้ว

### ฐานข้อมูลชั่วคราวในเครื่อง

`test:db` จะปฏิเสธ host ที่ไม่ใช่ loopback และฐานข้อมูลที่มีตารางอยู่แล้ว อีกทั้งไม่ลบข้อมูล โดยจะสร้างฐานข้อมูลในเครื่องชื่อ `curriculum` ใช้ base-schema stub สำหรับทดสอบ จากนั้น apply migration 001–010 ตามลำดับ โหลด seed สังเคราะห์ V4 แล้วทดสอบ importer และ API ให้ใช้ credential MySQL ชั่วคราวในเครื่องที่มีสิทธิ์สร้างฐานข้อมูลเท่านั้น base-schema stub ใช้เป็น fixture สำหรับทดสอบ migration และไม่ได้แทน schema ของ RDS production

รันจากโฟลเดอร์นี้:

```bash
npm test
V4_TEST_DB_HOST=127.0.0.1 V4_TEST_DB_PORT=3306 V4_TEST_DB_USER=root V4_TEST_DB_PASSWORD=... npm run test:db
```

ตัวอย่างสำหรับ PowerShell:

```powershell
$env:V4_TEST_DB_HOST = "127.0.0.1"
$env:V4_TEST_DB_PORT = "3306"
$env:V4_TEST_DB_USER = "root"
$env:V4_TEST_DB_PASSWORD = "your-local-scratch-password"
npm run test:db
Remove-Item Env:V4_TEST_DB_HOST, Env:V4_TEST_DB_PORT, Env:V4_TEST_DB_USER, Env:V4_TEST_DB_PASSWORD
```

หากฐานข้อมูล `curriculum` มีอยู่แล้วและมีตารางใด ๆ การทดสอบจะหยุดก่อน apply migration ห้ามกำหนดตัวแปรทดสอบให้ชี้ไป AWS, ฐานข้อมูลพัฒนาที่ใช้ร่วมกัน หรือ production

### นำเข้า CSV สำหรับ Demo

CLI ไม่มีโหมดใช้งานจริง ตัวแปรฐานข้อมูลต้องชี้ไปยังฐานข้อมูลชั่วคราวในเครื่องที่แยกไว้ และต้องเตรียมหลักสูตร Demo สังเคราะห์ที่ยังไม่เปิดใช้งานจาก `fixtures/v4-demo/seed-demo.sql`

```bash
node src/graduation-import.mjs --file fixtures/v4-demo/batch-001-demo-success.csv --mode demo --dry-run
node src/graduation-import.mjs --file fixtures/v4-demo/batch-001-demo-success.csv --mode demo
```

### API สำหรับอ่านข้อมูล V4

| Method และ path | สิทธิ์ |
| --- | --- |
| `GET /api/graduation/me` | เฉพาะนักศึกษา: อ่านผลของบัญชีที่เข้าสู่ระบบอยู่ |
| `GET /api/graduation/students` | อาจารย์/เจ้าหน้าที่: แสดงรายชื่อนักศึกษาสังเคราะห์หรือนักศึกษาที่ได้รับมอบหมาย |
| `GET /api/graduation/students/{studentId}` | นักศึกษาอ่านผลของตนเองได้ หรืออาจารย์/เจ้าหน้าที่อ่านได้เมื่อได้รับมอบหมาย ผู้ดูแลหลักสูตรไม่มีสิทธิ์ |
| `POST /api/graduation/assignments` | Staff เพิ่มนักศึกษาเข้ารายการตรวจ พร้อมชื่อและชั้นปี 1–4 |
| `GET /api/graduation/import-batches` | เฉพาะเจ้าหน้าที่: ดูประวัติการนำเข้าแบบสรุป ไม่มีแถวผลการเรียนหรือรหัสนักศึกษา |

ชื่อบัญชีนักศึกษา Demo คือ `demostudent01` ถึง `demostudent04` หากต้องการสาธิตในเครื่องโดยตั้งใจ ให้กำหนดค่า password hash แบบ scrypt ให้แต่ละ parameter (ใช้ hash เดียวกันได้เฉพาะ Demo) repository นี้ไม่มีรหัสผ่านให้ รหัสนักศึกษาที่ API ส่งกลับเป็นค่าจำลองรูปแบบ `DEMO*` ปิดการเข้าสู่ระบบ Demo ในระบบที่ใช้ร่วมกันหรือ production
