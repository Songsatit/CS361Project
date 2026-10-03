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
COURSE_API_URL=https://script.google.com/a/macros/dome.tu.ac.th/s/AKfycbw75ktHQ9wrWMNcMBq1rd0OnNCi3OOJwwNS0kTT5OQDYGiBA1Up7B-Ufbhtu603HZcZ/exec
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

Successful responses use `{ "data": ... }`; list endpoints return an array in `data`. A missing course returns 404. Unexpected database or schema errors return a generic 500 response and are logged in CloudWatch.

### Deploy

Install AWS SAM CLI and configure AWS credentials for the target account. The deployment needs an existing VPC, private subnets with a route to RDS, a Lambda security group, and an RDS security group rule allowing inbound MySQL (3306) from that Lambda security group. The Lambda must be able to reach RDS; public subnet placement alone does not provide that access. Database tables must match the entities in `../docs/v2-data-model-erd.md`, including `prerequisite`. Run `migrations/001_curriculum_graduation_conditions.sql` and `migrations/002_course_catalog_details.sql` once against the target RDS before deploying. The included seed covers `BSC-CS-2566`; add verified conditions for other curricula before using that endpoint for them.

From this directory, validate and deploy with the database and network values for your environment:

```bash
sam validate --lint
sam build
sam deploy --guided
```

Provide `DbHost`, `DbName`, `DbUser`, `DbPassword`, `DbPort`, `VpcSubnetIds`, and `LambdaSecurityGroupId` when prompted. `DbPassword` is marked `NoEcho`. Do not put database credentials in source control or the SAM template. The stack output `ApiUrl` is the base URL to configure in the frontend.

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
