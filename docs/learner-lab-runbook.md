# Learner Lab Runbook สำหรับ CS361

เอกสารนี้ใช้สำหรับเตรียมและตรวจระบบ CS361 บน AWS Academy Learner Lab เท่านั้น
การ deploy ต้องทำจาก AWS CloudShell ใน `us-east-1` โดยผู้ดูแลที่ได้รับอนุญาต
Agent ห้ามเรียก AWS, deploy, apply migration หรือเรียก TU API จริง

## ขอบเขตและข้อจำกัด

- งบประมาณของ Learner Lab จำกัดประมาณ 50 USD และ credentials หมดอายุตาม session
- สภาพแวดล้อมนี้ deploy จาก CloudShell ไม่มี CI/OIDC ดังนั้น workflow
  `.github/workflows/deploy-aws.yml` ใช้เป็นเอกสารอ้างอิงไม่ได้สำหรับ Learner Lab
- ใช้ `LabRole` ที่มีอยู่แล้ว ไม่สร้าง IAM role ใหม่
- Region ต้องเป็น `us-east-1`
- ห้ามใส่รหัสผ่าน, TU Application-Key, JWT secret หรือค่าจริงใด ๆ ลง repository หรือ command history
- บัญชี Demo ต้องตั้งรหัสผ่านใหม่เอง และต้องปิด `EnableDemoLogin` หลังการสาธิต

## สถาปัตยกรรม

```text
Amplify (appRoot: frontend)
  /api/<*> Rewrite
    -> API Gateway HTTP API
      -> Lambda cs361-app-read / cs361-app-auth
         (arm64, nodejs22, private subnets)
      -> Lambda cs361-app-dbinit (one-off, VPC)
         -> RDS MySQL 8.4 (stack cs361-infra)
```

`NatMode` มีสามค่า:

- `none` — ไม่มีทางออกอินเทอร์เน็ตจาก Lambda; TU login จะ timeout
- `instance` — NAT instance; ค่าเริ่มต้นและเหมาะกับงบจำกัด
- `gateway` — NAT Gateway; เสถียรกว่าแต่มีค่าใช้จ่ายสูงกว่า

RDS Proxy ปิดเป็นค่าเริ่มต้น (`UseProxy=false`) ใน Learner Lab เพื่อควบคุมค่าใช้จ่าย
Lambda ต่อ RDS โดยตรงผ่าน security group

## เตรียม CloudShell

รันจาก root ของ repository:

```bash
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_PAGER=""
sed -i 's/\r$//' infra/deploy-learnerlab.sh
bash infra/deploy-learnerlab.sh
```

รหัสผ่าน master และ app ต้องเป็นภาษาอังกฤษผสมตัวเลขอย่างน้อย 12 ตัว
แนะนำให้ export เฉพาะใน session ปัจจุบัน:

```bash
export DB_MASTER_PASSWORD='ตั้งค่าใหม่เองอย่างน้อย 12 ตัว'
export DB_APP_PASSWORD='ตั้งค่าใหม่เองอย่างน้อย 12 ตัว'
```

ห้ามใช้ค่าตัวอย่างข้างต้นเป็นรหัสจริง และห้าม echo ค่า secret ออกมา

## ขั้นตอน deploy ตามลำดับ

### 1. สร้าง network และ RDS

```bash
bash infra/deploy-learnerlab.sh infra instance
```

ถ้าไม่ต้องการ NAT ใช้ `none` ได้ แต่ TU login จะใช้งานไม่ได้:

```bash
bash infra/deploy-learnerlab.sh infra none
```

ตรวจผ่านเมื่อคำสั่งจบสำเร็จและ output แสดง `DbHost`, private subnet IDs,
Lambda security group และ `NatModeInUse`

### 2. เปลี่ยน NAT mode

```bash
bash infra/deploy-learnerlab.sh nat instance
```

คำสั่งนี้ใช้ค่าพารามิเตอร์เดิมของ stack และเปลี่ยนเฉพาะ `NatMode`
ตรวจผ่านเมื่อ CloudFormation update เสร็จและแสดง `NatMode is now: instance`

### 3. Deploy backend

ก่อนรัน ต้องตั้ง frontend origin ให้ตรงกับ Amplify จริงโดยไม่มี trailing slash:

```bash
export FRONTEND_ORIGIN='https://<AMPLIFY_APP_ID>.amplifyapp.com'
export TU_APPLICATION_KEY='ใช้ key จริงจากผู้ดูแล โดยอย่าใส่ลงไฟล์หรือ commit'
bash infra/deploy-learnerlab.sh backend
```

สคริปต์จะรัน `npm ci`, `npm test`, `npm run typecheck`, `sam validate`,
`sam build` และ `sam deploy` ให้เอง หากทดสอบ Node ใน CloudShell ไม่ได้เพราะเป็น
Node v20 ให้ใช้ `SKIP_TESTS=1` เฉพาะเมื่อผู้ดูแลยอมรับความเสี่ยง:

```bash
SKIP_TESTS=1 bash infra/deploy-learnerlab.sh backend
```

ตรวจผ่านเมื่อ app stack สร้าง Lambda/API สำเร็จ และ output มี API URL กับชื่อ db-init

### 4. เตรียมฐานข้อมูล

ต้องใช้ app password ค่าเดียวกับขั้นตอน backend:

```bash
bash infra/deploy-learnerlab.sh dbinit
```

db-init จะสร้าง database `curriculum`, import dump ที่ sanitized เมื่อยังไม่มี
ตาราง `course`, สร้าง `schema_migrations`, ใช้ baseline migration 001–014 และ
apply migration ที่ยังไม่ถูกบันทึกตั้งแต่ 015 เป็นต้นไปตามลำดับ จากนั้นสร้าง user
`cs361_app` ด้วยสิทธิ์เฉพาะ `SELECT, INSERT, UPDATE, DELETE` บน `curriculum.*`

คำสั่ง invoke ในสคริปต์ต้องมี `--cli-read-timeout 0` เพราะ import อาจเกิน 60 วินาที
และไม่ควรปล่อยให้ CLI retry จนรันซ้ำ

ตรวจผ่านเมื่อผลลัพธ์มี `ok: true`, ไม่มี migration error และจำนวนตารางหลักสมเหตุสมผล

### 5. ตั้ง Amplify rewrite

ใน Amplify Console → Hosting → Rewrites and redirects เพิ่ม:

| Source | Target | Type |
|---|---|---|
| `/api/<*>` | `https://zr7hcd7xn3.execute-api.us-east-1.amazonaws.com/api/<*>` | Rewrite (200) |

วาง rule นี้เหนือ SPA fallback และต้องใช้ Rewrite ไม่ใช่ Redirect เพื่อให้ cookie
เป็น same-site ตามที่ backend ตั้ง `SameSite=Lax` ไว้

## กับดักที่เคยพบ

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| NAT ไม่มี internet และ login timeout | `t4g.nano` ถูก `dnf` OOM-kill ระหว่างติดตั้ง iptables | ใช้ `t4g.micro` และ swap 1GB; user data ทำงานครั้งเดียวตอน boot จึงต้องลบ/สร้าง instance ใหม่เมื่อจำเป็น |
| stack จำค่า NAT instance type เก่า | update เปลี่ยน mode แต่ใช้ parameter เดิม | ส่ง `NatInstanceType=t4g.micro` เองตอน deploy/update |
| API 500 หรือ login 502 ด้วย `Access denied for user 'cs361_app'` | app password ใน backend ไม่ตรงกับ db-init | export `DB_APP_PASSWORD` ค่าเดียวกันทั้งสองขั้น และตรวจ regex `^[A-Za-z0-9]{12,}$` |
| password ใช้ไม่ได้ | password ไม่ใช่ภาษาอังกฤษ+ตัวเลข หรือสั้นกว่า 12 ตัว | ตั้งค่าใหม่ตามข้อกำหนด |
| TU key ถูกอ่านไม่ครบจาก prompt | paste ผ่าน hidden prompt ไม่สมบูรณ์ | เขียนค่าลง `/tmp/tukey.txt` แบบชั่วคราว, ใช้ `tr -d ' \r\n'`, แล้วลบไฟล์ทันที โดยห้ามใส่ค่าจริงในเอกสาร |
| db-init ถูก invoke ซ้อน | AWS CLI หมดเวลาอ่านก่อน Lambda เสร็จ | ใช้ `--cli-read-timeout 0` |
| `infra` รันซ้ำแล้วถาม master password | CloudFormation deploy ต้องรับค่าพารามิเตอร์ | ใส่ master password ของ stack เดิมให้ถูกต้อง |
| `nat <mode>` ใช้ค่าเก่า | คำสั่งนี้ใช้ค่าพารามิเตอร์เดิมของ stack | ตรวจค่าเดิมก่อน และส่งค่าที่ต้องการผ่าน `infra` หากต้องเปลี่ยนค่าอื่นด้วย |
| AWS CLI เหมือนค้าง | pager เปิดอยู่ | `export AWS_PAGER=""` |
| shell script รันไม่ได้ | ไฟล์มี CRLF | `sed -i 's/\r$//' infra/deploy-learnerlab.sh` |
| TU ตอบ 403 `invalid token` | Application-Key ผิดหรือหมดอายุ | หลัง PR แก้ login ระบบต้องตอบ 502 และ log เฉพาะ status/type ไม่ใช่นับเป็นรหัสผ่านผิด |

## ตรวจ TU key แบบไม่ใช้ข้อมูลจริง

ใช้ username/password ปลอมเพื่อทดสอบว่า key ใช้งานได้และปลายทางตอบโครงสร้างปกติ
โดยอ่าน key จากตัวแปรหรือไฟล์ชั่วคราว ห้ามพิมพ์ key ลง command history:

```bash
export TU_APPLICATION_KEY="<ใส่ค่าใน session เท่านั้น>"
curl --silent --show-error --request POST \
  --url 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify2' \
  --header "Application-Key: $TU_APPLICATION_KEY" \
  --header 'Content-Type: application/json' \
  --data '{"UserName":"DEMO-NOT-A-REAL-USER","PassWord":"DEMO-NOT-A-REAL-PASSWORD"}'
```

ผลที่คาดหวังคือ HTTP 200 และ `status:false` สำหรับข้อมูลปลอม ไม่ใช่ HTTP 403
ถ้าได้ 403 ให้ตรวจ Application-Key กับผู้ดูแลก่อนทดสอบระบบต่อ

## ควบคุมค่าใช้จ่ายและ teardown

- ตรวจ `Used $` อย่างน้อยวันละครั้ง
- ก่อนเลิกงานให้หยุด RDS:

  ```bash
  aws rds stop-db-instance --region us-east-1 --db-instance-identifier cs361-infra-db
  ```

- ตรวจว่าไม่มี NAT Gateway ค้าง เพราะมีค่าใช้จ่ายต่อชั่วโมงและค่า public IPv4
- ลบ snapshot เก่าที่ไม่ต้องใช้ตามนโยบายของเจ้าของระบบ
- RDS อาจถูกเปิดกลับเองหลังหยุดครบ 7 วัน
- เมื่อต้องลบ stack ให้ใช้คำสั่งที่มี confirmation:

  ```bash
  bash infra/deploy-learnerlab.sh teardown
  ```

  การลบ infra stack จะทิ้ง final snapshot ตาม `DeletionPolicy: Snapshot`

ตัวเลขค่าใช้จ่ายในเอกสารนี้เป็นประมาณการเท่านั้น ค่าจริงต้องอ้างอิง Cost Explorer
ของ account และช่วงเวลาที่ใช้งานจริง

## สถานะการตรวจสอบ

### ตรวจจาก repository แล้ว

- ตรวจลำดับคำสั่งใน `infra/deploy-learnerlab.sh`
- ตรวจ resource, parameter และ NAT mode ใน `infra/network-db.yaml`
- ตรวจ Lambda runtime, architecture, timeout และ `UseProxy=false` ใน `backend/template.yaml`
- ตรวจลำดับ baseline/migration และสิทธิ์ app user ใน `backend/src/db-init.mjs`
- ตรวจ Amplify target API ID ตามสถานะ Learner Lab ที่ได้รับมา

### ยังไม่ได้ตรวจบน AWS จริงในงานนี้

- ยังไม่ได้ยืนยันว่า NAT instance ใช้งานได้จริงหลัง boot
- ยังไม่ได้ทดสอบ login TU สำเร็จด้วย Application-Key จริง
- ยังไม่ได้รัน `infra`, `backend`, `dbinit`, `teardown` หรือคำสั่ง AWS ใด ๆ
- ยังไม่ได้ apply migration หรือ seed ใด ๆ

## ความเสี่ยงบัญชี Demo

Repository เป็น public จึงต้องตั้ง Demo password เอง ห้ามใช้ค่าตัวอย่างหรือ password ที่
ซ้ำกับระบบอื่น และต้องตั้ง `EnableDemoLogin=false` หลังการนำเสนอวันที่ 4 ธันวาคม 2026

