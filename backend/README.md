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
