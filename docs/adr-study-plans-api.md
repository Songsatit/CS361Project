# ADR draft: ลดการยิงซ้ำของ Study Plan และข้อมูลเสริม

สถานะ: รอทีมเลือกแนวทางฝั่ง backend/AWS

## บริบท

หน้าแรกต้องโหลดข้อมูลหลักสูตร รายวิชา เงื่อนไขการจบ และแผนการเรียน ข้อมูลบางชุดมีจำนวนรายการมาก ทำให้การเปิดหน้าแรกยิง request หลายชุดพร้อมกันและอาจชน throttling ของ API Gateway ได้ โดยเฉพาะการเรียก prerequisites ต่อวิชาและรายละเอียด study plan ต่อแผน

## การเปลี่ยนแปลงฝั่ง frontend ที่ทำแล้ว

- ใช้ตัวกลาง `apiGet` สำหรับ GET ข้อมูลที่อยู่ในเส้นทางหลักของการโหลดข้อมูล
- จำกัด request ที่ทำงานพร้อมกันไม่เกิน 3 รายการ
- ใช้ in-flight dedupe สำหรับ URL เดียวกัน และ cache ใน memory อายุ 5 นาที
- retry เฉพาะ HTTP 429/503 ที่ 2, 5 และ 10 วินาที โดยเคารพ `Retry-After`
- ไม่โหลด prerequisites ทุกวิชาตอนเปิดหน้าแรก แต่โหลดเมื่อเปิดรายละเอียดวิชา
- โหลด study-plan detail เมื่อผู้ใช้เปิดหลักสูตร/แผนที่เลือก ไม่โหลดทุกแผนตั้งแต่ต้น
- แยก error ของ curricula, conditions, study plans และ prerequisites เป็นข้อมูลเสริม พร้อมข้อความสถานะและปุ่มลองใหม่

## หลักฐานและวิธีวัด

จำนวน request ก่อนแก้ให้วัดจาก Network tab ในการเปิดหน้าแรก โดยแยกเป็น:

- `C`: `/api/courses/{code}/prerequisites` ต่อวิชา
- `M`: `/api/curricula/{id}/graduation-conditions` ต่อหลักสูตร
- `P`: `/api/study-plans/{id}` ต่อแผน
- รายการหลัก: `/api/courses`, `/api/curricula`, `/api/study-plans`

หลังแก้ `C` และ `P` จะไม่ถูกยิงเป็นชุดตอนเปิดหน้าแรก แต่เกิดเมื่อผู้ใช้เปิดรายละเอียดที่เกี่ยวข้อง และ request ทั้งหมดผ่านคิวร่วมเดียวกัน

## ทางเลือกฝั่ง backend/AWS (ยังไม่เลือก)

### A. เพิ่ม endpoint รวม

ให้ endpoint study plans คืนรายการพร้อม items และอาจเพิ่ม prerequisites ทั้งหลักสูตรใน response เดียว

ข้อดี: ลดจำนวน round trip และลดโอกาสชน throttling

ข้อจำกัด: response ใหญ่ขึ้น, ต้องออกแบบ pagination/สิทธิ์/รูปแบบข้อมูลใหม่ และต้องแก้ backend

### B. ปรับ throttling

เพิ่ม `DefaultRouteSettings` หรือกำหนด `RouteSettings` เฉพาะ endpoint ที่มีการอ่านข้อมูลจำนวนมาก

ข้อดี: ทำได้เร็วและไม่เปลี่ยน response contract

ข้อจำกัด: ไม่แก้ปัญหา request ซ้ำ, Learner Lab มีข้อจำกัดด้าน quota และอาจไม่ควรพึ่งการเพิ่ม limit เป็นวิธีหลัก

### C. เพิ่ม Cache-Control สำหรับ GET

กำหนด header cache สำหรับข้อมูลที่เปลี่ยนไม่บ่อย เช่น catalog และ study plan

ข้อดี: ลดภาระ API เมื่อมี browser/CDN cache

ข้อจำกัด: ต้องกำหนด TTL และ invalidation ให้ถูกต้อง ไม่เหมาะกับข้อมูลส่วนตัวหรือข้อมูลที่กำลังรออนุมัติ

## ข้อเสนอแนะเพื่อการตัดสินใจ

ใช้แนวทาง frontend ที่ทำแล้วเป็น baseline ก่อน จากนั้นพิจารณา A สำหรับ endpoint รวม หากยังมี latency สูง และใช้ C กับข้อมูล public ที่มีการเปลี่ยนไม่บ่อย ส่วน B ควรใช้เมื่อมีหลักฐานว่า quota เป็นคอขวดจริงและตรวจสอบข้อจำกัดของ Learner Lab แล้ว

เอกสารนี้ยังไม่เลือกทางเลือกใดและไม่มีการแก้ AWS หรือ deploy.
