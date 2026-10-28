# Amplify `/api/*` rewrite (ขั้นตอนที่ผู้ใช้ต้องตั้งเองหลัง merge)

การย้าย JWT ไป HttpOnly cookie ใช้แนวทาง **same-origin**: หน้าเว็บเรียก API ผ่านโดเมนเดียวกับตัวเว็บ
ที่ path `/api/*` แล้วให้ AWS Amplify Hosting ทำ **Rewrite (200)** ไปยัง API Gateway ปลายทาง
cookie จึงถูกส่งไปกับทุก request เพราะเป็นโดเมนเดียวกัน และตั้ง `SameSite=Lax` ได้

> Amplify Hosting อ่าน rewrite จาก **Amplify Console เท่านั้น** ไม่ได้อ่านจาก `amplify.yml`
> และ **ไม่** อ่านไฟล์ `_redirects` แบบ Netlify ส่วน `customHttp.yml` ใช้ตั้ง HTTP header อย่างเดียว
> ด้วยเหตุนี้ repo จึงไม่มีไฟล์ rewrite ให้ ต้องตั้งใน Console ตามขั้นตอนด้านล่าง

## ตั้ง rewrite ใน Amplify Console

1. เปิด Amplify Console → เลือก app ของ frontend → เมนู **Hosting → Rewrites and redirects**
2. เพิ่ม rule ใหม่:

   | ช่อง | ค่า |
   | --- | --- |
   | Source address | `/api/<*>` |
   | Target address | `https://qowe6iixr6.execute-api.us-east-1.amazonaws.com/api/<*>` |
   | Type | **Rewrite (200)** |

3. ต้องเป็น **Rewrite (200)** เท่านั้น **ห้ามใช้ Redirect (301/302)** เพราะ redirect จะทำให้
   เบราว์เซอร์ยิง request ใหม่ข้ามโดเมน cookie จะไม่ถูกส่งไปด้วย
4. วาง rule นี้ให้อยู่ **เหนือ** rule SPA fallback (`/<*>` → `/index.html`) ถ้ามี เพื่อให้ `/api/*`
   ถูกจับก่อน
5. บันทึกแล้ว redeploy frontend branch ที่เกี่ยวข้อง

## สิ่งที่ backend ต้องมีให้พร้อม (deploy เอง ไม่รวมใน PR นี้)

- ตั้ง env `FRONTEND_ORIGIN` ของ Lambda ให้เท่ากับ origin ของหน้าเว็บจริง (ไม่ใช่ `*`)
  เพราะ response ส่ง `Access-Control-Allow-Credentials: true`
- Route ใหม่ `POST /api/auth/logout` และ `GET /api/auth/me` ต้องถูก map ใน API Gateway
  (ดู `backend/template.yaml`) ก่อน deploy — ถ้าใช้ catch-all `ANY /{proxy+}` อยู่แล้วจะครอบคลุมให้เอง

## หมายเหตุ CSP (`customHttp.yml`)

`connect-src` ปัจจุบันมีทั้ง `'self'` และ URL `execute-api...` อยู่แล้ว
- `'self'` ครอบคลุมการเรียก `/api/*` แบบ same-origin หลังตั้ง rewrite
- ยังคง URL `execute-api...` ไว้ชั่วคราวเพื่อให้ rollback ได้โดยไม่ต้องแก้ CSP ซ้ำ หาก rewrite มีปัญหา
- **PR ถัดไป**: หลังยืนยันว่า `/api/*` ทำงานผ่าน rewrite แล้ว ให้ลบ URL `execute-api...` ออกจาก
  `connect-src` เพื่อปิดช่องเรียก API ข้ามโดเมนโดยตรง

## เช็กลิสต์ทดสอบในเบราว์เซอร์จริง (ทำเองหลัง deploy ห้ามใช้ curl)

ทดสอบทั้งใน **Chrome และ Safari**:

- [ ] Login สำเร็จแล้วเปิด DevTools → Application → Cookies ของโดเมนหน้าเว็บ ต้องเห็น cookie ชื่อ
      `token` ที่มี flag `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] หลัง login แล้ว **refresh หน้า** ยังอยู่ในสถานะล็อกอิน (frontend เรียก `GET /api/auth/me`)
- [ ] เรียก API ที่ต้องล็อกอิน (เช่น หน้าตรวจสอบการจบ / จัดการหลักสูตร) ได้ข้อมูลปกติ ไม่ติด CORS
- [ ] ทำ action ที่เปลี่ยนข้อมูล (เช่น สร้าง/ส่งคำขอแก้ไข) สำเร็จ โดย request มี header `X-CS361-CSRF: 1`
      (ดูใน Network tab)
- [ ] Logout แล้ว cookie `token` หายไปจาก Application tab และกลับสู่สถานะไม่ล็อกอิน
- [ ] ปล่อยให้ token หมดอายุ (15 นาที) แล้วเรียก API ต้องได้ 401 และ frontend เด้งออกจากระบบเอง
- [ ] ถ้า cookie ไม่ถูกส่ง: เช็กว่า request ยิงไป `/api/*` (โดเมนเดียวกับหน้าเว็บ) จริง ไม่ใช่
      `execute-api...` โดยตรง และ rule เป็น Rewrite 200 ไม่ใช่ redirect
