# คู่มือ migration V4 และ RDS

## สถานะสภาพแวดล้อมปัจจุบัน

ระบบ deploy อยู่บน AWS และใช้ฐานข้อมูล RDS แต่ repository นี้ **ยังยืนยันไม่ได้ว่า RDS ใช้ migration ถึงไฟล์ใดในช่วง `001`–`009`** สถานะ migration ที่ apply แล้วจึงถือว่า **ไม่ทราบจนกว่าเจ้าของฐานข้อมูลจะตรวจสอบ** ห้ามอนุมานจากการที่ระบบ deploy อยู่หรือจากรายชื่อไฟล์ใน repository

`010_graduation_verification.sql` เป็น migration สำหรับ schema ส่วน `backend/fixtures/v4-demo/seed-demo.sql` มีหลักสูตร กฎ และ assignment สังเคราะห์สำหรับ Demo แยกต่างหาก ห้ามรัน seed นี้กับ RDS production

## ตรวจสอบกับฐานข้อมูล MySQL ชั่วคราวในเครื่อง

ใช้ MySQL ที่แยกจากระบบจริง ไม่มี credential ของ production และไม่มีเส้นทางเชื่อมต่อไป RDS อ่าน SQL ก่อนใช้ จากนั้นสร้างฐานข้อมูลทิ้งได้สำหรับการทดสอบ โดยใช้ schema ตั้งต้นเฉพาะ test จาก `backend/test/fixtures/base-schema-stub.sql` ตาม migration ที่จำเป็น แล้วรัน migration `010` และ database tests โหลด seed Demo และ fixture เฉพาะในฐานข้อมูลชั่วคราวนี้เท่านั้น

ตัวอย่างสร้างฐานข้อมูลชั่วคราว (ปรับชื่อและ credential ให้ตรงกับ MySQL ในเครื่อง):

```sh
mysql -h 127.0.0.1 -u root -p -e "CREATE DATABASE curriculum_v4_scratch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

SQL ปัจจุบันมี `USE curriculum;` ดังนั้นชุด database test ต้องใช้ฐานข้อมูลชื่อ `curriculum` หรือปรับ SQL ในสำเนาสำหรับ scratch อย่างระมัดระวัง ห้ามเปลี่ยนปลายทางให้เป็น RDS ที่ deploy อยู่

จากโฟลเดอร์ `backend/` ให้รัน unit tests และ CSV dry-run ก่อน ส่วน database test ใช้ MySQL ในเครื่องเท่านั้น โดยกำหนด `DB_HOST`, `DB_NAME`, `DB_USER` และ `DB_PASSWORD` ที่เป็นของ scratch ชุด test ต้องหยุดทันทีหากตรวจยืนยันไม่ได้ว่าเป้าหมายเป็น loopback/scratch อย่าอ่าน credential จาก deployment config

## ตรวจสอบความสอดคล้องของ RDS แบบอ่านอย่างเดียว (สำหรับเจ้าของ/ผู้ดูแลฐานข้อมูล)

ก่อนวางแผน migration จริง เจ้าของ RDS ต้อง:

1. ระบุ RDS instance และ database ที่ถูกต้อง ยืนยันสภาพแวดล้อม และกำหนดช่วงเวลาบำรุงรักษา
2. สำรองข้อมูลเป็น RDS snapshot และตรวจว่าสามารถกู้คืนได้
3. ใช้บัญชีอ่านอย่างเดียวตรวจตาราง คอลัมน์ index และ foreign key ที่ migration `001`–`010` ต้องใช้ เทียบกับไฟล์ migration และ schema ที่แอปคาดหวัง
4. บันทึกแต่ละ migration ว่า `applied`, `not applied`, `partially applied` หรือ `unknown` พร้อมหลักฐาน หาก migration มี seed insert หรือแก้ข้อมูล ต้องตรวจแถวนั้นด้วย การมี schema อย่างเดียวไม่ยืนยันว่ารันครบ
5. แก้สถานะบางส่วน/ไม่ทราบให้ชัดก่อนทำสิ่งใด ห้ามรัน migration ทั้งชุดและห้ามถือว่า `IF NOT EXISTS` พิสูจน์ว่ารันซ้ำได้อย่างปลอดภัย

ปัจจุบัน repository ไม่มี migration ledger ที่ใช้ยืนยันสถานะได้ จึงต้องจัดทำกระบวนการติดตาม migration ที่ผ่านการทบทวนก่อนเปลี่ยน RDS จริง ห้ามเติมประวัติย้อนหลังโดยการคาดเดา

## Checklist สำหรับการ apply บน production ในอนาคต (คู่มือนี้ยังไม่อนุญาตให้ทำ)

การ apply production ต้องเป็นงานแยกและผ่านการตรวจทานก่อน ต้องมีแผนเฉพาะ migration ที่ตรวจแล้วว่ายังไม่ apply, backup/restore plan, วิธี rollback หรือ recovery ที่ทดสอบแล้ว, ผู้ดูแลเป็นผู้รันด้วยบัญชีสิทธิ์ต่ำสุด, การตรวจ schema ก่อนและหลัง และ smoke test ของแอป ห้าม apply Demo seed หรือข้อมูล transcript สังเคราะห์ลง RDS

Importer ปัจจุบันรองรับ Demo เท่านั้น การนำเข้าข้อมูลจริงจากทะเบียนต้องมี data contract ที่อนุมัติแล้ว การอนุญาตจากเจ้าของข้อมูล แผนความปลอดภัย/การเก็บรักษา และการทบทวนการใช้งานโดยชัดแจ้งก่อนพัฒนา
