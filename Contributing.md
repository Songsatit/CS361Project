# คู่มือทำงานร่วมกัน
 **ห้าม push ตรงเข้า `main`** — ทุกงานต้องผ่าน Branch แล้วเปิด Pull Request เสมอ

---

## ขั้นตอนทำงาน (ภาพรวม)

1. ดึง `main` ให้ล่าสุดก่อนเริ่มงาน
2. แยก Branch ใหม่จาก `main`
3. แก้โค้ด + ทดสอบในเครื่องตัวเอง
4. Commit เป็นก้อนเล็ก ๆ ที่อธิบายได้ในประโยคเดียว
5. Push ขึ้น GitHub
6. เปิด Pull Request ผูกกับ Issue
7. รอเพื่อน Review + Approve
8. Squash and Merge เข้า `main`
9. ลบ Branch ทิ้ง แล้วกลับไป pull `main` ใหม่

---

## 1. ตั้งชื่อ Branch

รูปแบบ: `ประเภท/เลขissue-คำอธิบายสั้นๆ`

| ประเภท | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| `feature/` | เพิ่มฟีเจอร์ใหม่ | `feature/12-rds-provision` |
| `fix/` | แก้บั๊ก | `fix/16-empty-search-result` |
| `docs/` | แก้เอกสารอย่างเดียว | `docs/18-adr-v2` |
| `chore/` | งานตั้งค่า repo/เครื่องมือ | `chore/ci-pipeline` |

กติกาเสริม: ตัวพิมพ์เล็กทั้งหมด, เว้นวรรคใช้ `-`, และ **1 Branch = 1 งาน** ไม่ยำหลาย Issue ไว้ด้วยกัน

---

## 2. เขียน Commit

รูปแบบ: `ประเภท: อธิบายสั้นๆ`

| ประเภท | ความหมาย |
|---|---|
| `feat` | เพิ่มฟีเจอร์ใหม่ |
| `fix` | แก้บั๊ก |
| `docs` | แก้เอกสาร |
| `style` | จัด format โค้ด ไม่กระทบการทำงาน |
| `refactor` | จัดโครงสร้างโค้ดใหม่ พฤติกรรมเดิม |
| `chore` | งานดูแล repo |

ตัวอย่าง: `feat: add course search endpoint`

เช็คตัวเอง: ถ้าอธิบาย commit ต้องใช้คำว่า "และ" หลายครั้ง แปลว่าก้อนใหญ่เกินไป ให้แยกเป็นหลาย commit

---

## 3. เปิด Pull Request

ใน PR ควรมี 4 อย่างนี้:

- **Summary** — สรุปว่า PR นี้ทำอะไร
- **Closes #เลข** — ผูกกับ Issue (merge แล้ว Issue ปิดอัตโนมัติ)
- **วิธีทดสอบ** — ทดสอบยังไง ผลเป็นไง
- **Screenshot** — ถ้าแก้หน้าเว็บ แนบก่อน/หลังด้วย

**ก่อน Merge เช็คให้ครบ:**
- [ ] ตรงตาม Acceptance Criteria ของ Issue
- [ ] ไม่มีไฟล์ที่ไม่เกี่ยวข้องติดมา
- [ ] มีคน Approve อย่างน้อย 1 คน (ไม่ใช่ตัวเอง)
- [ ] Comment จาก Review ถูกแก้/ตอบครบแล้ว

---

## 4. Merge และเก็บกวาด

ใช้ **Squash and merge** เสมอ — รวมทุก commit ใน PR เป็น 1 commit เดียวบน `main`

หลัง merge เสร็จ:
```bash
# ลบ branch เก่าบน GitHub (กดปุ่ม Delete branch)

git switch main
git pull origin main
```
