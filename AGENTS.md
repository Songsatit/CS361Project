# AGENTS.md

แนวทางสำหรับ AI agent และผู้ร่วมพัฒนาในโปรเจค CS361 Curriculum System

## โครงสร้างโปรเจค

- `frontend/` — Static SPA (vanilla JS) `script.js` + `style.css` + `index.html`, ข้อมูล fallback ใน `data/`. Deploy ผ่าน AWS Amplify. เรียก API ผ่าน `API_BASE`.
- `backend/` — AWS Lambda (Node.js ESM) `src/api.mjs` เป็น router หลัก, `src/graduation/` เป็น pure logic. Deploy ด้วย AWS SAM (`template.yaml`).
- `backend/migrations/` — SQL migration เรียงตามเลข apply กับ MySQL (RDS)
- `backend/test/` — เทสต์ด้วย `node --test`
- `docs/` — เอกสารสถาปัตยกรรม ADR ERD

## คำสั่งที่ใช้บ่อย (รันจาก `backend/`)

```bash
npm test            # unit tests (ไม่แตะ DB)
npm run typecheck   # tsc --noEmit
npm run test:db     # integration ต่อ MySQL local เท่านั้น (ต้องตั้ง V4_TEST_DB_HOST=127.0.0.1)
```

> บน Windows PowerShell ใช้ `npm.cmd` แทน `npm` หากติด execution policy

## กฎการทำงาน

- **1 branch = 1 งาน** แตกจาก `main` ตั้งชื่อ `type/<issue>-คำอธิบาย` (ดู `Contributing.md`)
- **ห้าม push เข้า `main` ตรง ๆ** ต้องผ่าน PR + review (ไม่อนุมัติ PR ตัวเอง)
- commit เล็ก อธิบายได้ประโยคเดียว รูปแบบ `type: ชื่องาน (#issue)`
- ทุก commit ต้องผ่าน `npm test` และ `npm run typecheck`
- merge ด้วย Squash and merge

## ข้อห้ามด้านความปลอดภัยและข้อมูล

- **ห้าม commit secret/password/API key** ลง repo (ใช้ env var; ดู `.env.example`)
- **ห้าม `sam deploy` / `amplify deploy` / แตะ AWS/RDS** จาก agent — เขียนโค้ด/เอกสารแล้วให้ผู้ดูแลรันเอง
- **ห้าม apply migration หรือรัน seed กับ production**
- **ห้ามรัน `test:db` กับ host อื่นที่ไม่ใช่ `127.0.0.1`/`localhost`** (ตัวเทสต์ปฏิเสธ host ที่ไม่ใช่ loopback อยู่แล้ว)
- ข้อมูลทดสอบใช้ `DEMO*` หรือข้อมูลสังเคราะห์เท่านั้น ห้ามใช้ข้อมูลจริง
- **ห้ามเรียก TU API เพื่อดึงรายชื่อนักศึกษาทั้งคณะ หรือดึงเกรดนักศึกษา**

## กฎเชิงธุรกิจที่ห้ามแก้

- "ผู้ส่งคำขอห้ามอนุมัติเอง" (change request / curriculum change) — ห้ามลบหรือผ่อนปรน
- นักศึกษาดูผลได้เฉพาะของตนเอง; อาจารย์/เจ้าหน้าที่ดูได้เฉพาะนักศึกษาที่ได้รับมอบหมาย (`graduation_student_assignment`); `curriculum_admin` และผู้ไม่ล็อกอินไม่มีสิทธิ์อ่านผลการเรียน
- ห้ามแสดงผลที่ยังไม่มีข้อมูล หรือข้อมูลที่นักศึกษากรอกเอง เป็น "ผ่าน" โดยไม่มีป้ายกำกับแหล่งที่มา

## V4 Graduation — แนวคิดแหล่งข้อมูล

ผลการเรียนแต่ละแถวมีแหล่งที่มา (`source`) และสถานะยืนยัน (`verification_status`):
- `imported` — นำเข้าจาก CSV (CLI) ถือเป็นข้อมูลที่ยืนยันแล้วโดยปริยาย
- `self_reported` + `unverified` — นักศึกษากรอกเอง ยังไม่ยืนยัน (แก้/ลบได้เฉพาะเจ้าของ)
- `self_reported` + `verified` — เจ้าหน้าที่ยืนยันแล้ว (แก้/ลบไม่ได้)
- `self_reported` + `rejected` — เจ้าหน้าที่ปฏิเสธ

วิชาที่ `is_in_progress = 1` (กำลังเรียน) ไม่ถูกนับในการประเมินจบ และต้องแสดงแยกกลุ่ม
