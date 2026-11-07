# V5 — ระบบอัตโนมัติและการกำหนดโครงสร้างพื้นฐานด้วยโค้ด (Automation / Infrastructure as Code)

## เป้าหมายและขอบเขตของงาน (Goal and Scope)

V5 มีเป้าหมายเพื่อทำให้ขั้นตอนสำคัญในการตั้งค่าโครงสร้างพื้นฐานและการนำระบบขึ้นใช้งาน (Deployment) สามารถทำซ้ำได้ผ่านระบบอัตโนมัติ (Automation) และการกำหนดโครงสร้างพื้นฐานด้วยโค้ด (Infrastructure as Code หรือ IaC) เพื่อลดการตั้งค่าด้วยตนเองและลดความคลาดเคลื่อนของการตั้งค่าระหว่างแต่ละครั้ง

ภายใน Repository มีไฟล์ `backend/template.yaml` อยู่แล้ว ซึ่งเป็น AWS SAM / CloudFormation Template ที่ใช้กำหนดทรัพยากรต่าง ๆ ได้แก่ HTTP API, Lambda Functions, RDS Proxy, Proxy Target Group และการตั้งค่า Environment ต่าง ๆ

V5 จึงพัฒนาต่อยอดจาก IaC ที่มีอยู่เดิม โดยไม่เปลี่ยนแปลงสถาปัตยกรรมหลักของระบบใน V1–V4 ที่ใช้งานอยู่

สิ่งที่เพิ่มเติมใน V5 ประกอบด้วย

- ระบบ CI สำหรับ Pull Request และ Push โดยจะติดตั้ง Dependencies, ทดสอบระบบ, ตรวจสอบ TypeScript, ตรวจสอบ SAM Template และ Build ระบบ
- Workflow สำหรับ Deploy ไปยัง AWS ที่กำหนดให้ผู้มีสิทธิ์ต้องสั่งทำงานด้วยตนเองผ่าน `workflow_dispatch`
- การยืนยันตัวตนกับ AWS ผ่าน GitHub Actions OIDC โดยไม่ต้องเก็บ AWS Access Key แบบถาวรไว้ใน Git
- คำสั่งสำหรับ Deploy ระบบซ้ำได้ โดยใช้ SAM Template ที่มีอยู่เดิม
- เอกสารอธิบายสิ่งที่ต้องเตรียมใน AWS ภายนอก Repository รวมถึงการตั้งค่าที่ต้องมีการควบคุมสิทธิ์

**ข้อจำกัดและขอบเขตที่สำคัญ (Important Boundary)**

SAM Template ในปัจจุบันใช้ทรัพยากรที่มีอยู่แล้ว ได้แก่ VPC, Private Subnets, Security Groups, IAM Roles และ RDS Instance

ดังนั้น Workflow ของ V5 จะทำให้การ Deploy เฉพาะส่วนของ Stack ที่ SAM จัดการได้เป็นระบบอัตโนมัติ แต่ไม่ได้สร้างทรัพยากร VPC, Network, Database และ IAM ที่มีอยู่เดิมขึ้นมาใหม่

ทรัพยากรเหล่านี้ต้องได้รับการจัดการผ่าน IaC Stack แยกต่างหากที่ได้รับอนุมัติ หรือเตรียมไว้ล่วงหน้าโดยผู้ดูแลระบบ AWS ที่มีสิทธิ์

ห้ามดำเนินการ Deploy ไปยัง AWS Account ที่ใช้ร่วมกันหรือ Production Environment จนกว่าจะตรวจสอบเป้าหมายและ Change Set เรียบร้อยแล้ว

## ไฟล์ที่เพิ่มและไฟล์ที่เกี่ยวข้องใน Repository (What Is in the Repository)

| ตำแหน่งไฟล์ | หน้าที่ |
|---|---|
| `.github/workflows/ci.yml` | กำหนดขั้นตอนตรวจสอบโค้ดและ SAM Template แบบอัตโนมัติ |
| `.github/workflows/deploy-aws.yml` | กำหนดขั้นตอน Manual Deployment ไปยัง AWS พร้อมการยืนยันตัวตน |
| `backend/template.yaml` | ไฟล์ Infrastructure as Code ที่ใช้ AWS SAM / CloudFormation ซึ่งมีอยู่เดิม |
| `docs/v5-automation.md` | เอกสารอธิบายสถาปัตยกรรม การตั้งค่า วิธีใช้งาน และหลักฐานของ V5 |

## กระบวนการทำงานของ CI (CI Flow)

CI (Continuous Integration) คือกระบวนการตรวจสอบโค้ดโดยอัตโนมัติ เมื่อมีการ Push โค้ด หรือสร้าง Pull Request เพื่อช่วยตรวจสอบปัญหาก่อนนำโค้ดเข้าสู่ Branch หลัก

```text
Pull Request / Push
        |
        v
Checkout source
        |
        v
npm ci
        |
        +--> npm test
        +--> npm run typecheck
        |
        v
sam validate --lint
        |
        v
sam build
        |
        v
ผลการตรวจสอบ CI (ผ่าน / ไม่ผ่าน)
```

ขั้นตอนการทำงานมีดังนี้

1. Checkout Source: ดึง Source Code จาก Repository
2. Install Dependencies: ติดตั้ง Dependencies ด้วยคำสั่ง `npm ci`
3. Automated Tests: ทดสอบระบบด้วยคำสั่ง `npm test`
4. Type Check: ตรวจสอบชนิดข้อมูลด้วยคำสั่ง `npm run typecheck`
5. SAM Validate: ตรวจสอบความถูกต้องของ Infrastructure Template
6. SAM Build: เตรียมไฟล์สำหรับการนำระบบไป Deploy
7. CI Result: แสดงผลว่าการตรวจสอบผ่านหรือไม่ผ่าน

หากขั้นตอนใดไม่ผ่าน ระบบจะแสดงข้อผิดพลาดเพื่อให้ผู้พัฒนาสามารถแก้ไขก่อนนำโค้ดไปใช้งานในขั้นตอนต่อไป

## กระบวนการ Deploy ไปยัง AWS (AWS Deployment Flow)

การ Deploy ไปยัง AWS จะใช้ Workflow ที่กำหนดให้ผู้มีสิทธิ์เป็นผู้เริ่มทำงานด้วยตนเองผ่าน `workflow_dispatch`

```text
ผู้ดูแลระบบที่ได้รับอนุญาตเริ่ม workflow_dispatch
        |
        v
ติดตั้ง Dependencies + ทดสอบระบบ + ตรวจสอบ TypeScript
        |
        v
SAM Validate + Build
        |
        v
GitHub OIDC ขอสิทธิ์เข้าถึง AWS ผ่าน IAM Role
        |
        v
sam deploy (ใช้ SAM / CloudFormation Stack ที่มีอยู่)
        |
        v
CloudFormation สร้างหรือปรับปรุงทรัพยากรตาม Change Set
        |
        v
ตรวจสอบ Stack Outputs / ทดสอบ API
```

Workflow นี้จะไม่ Deploy โดยอัตโนมัติทุกครั้งที่มีการ Push โค้ด แต่กำหนดให้ต้องมีผู้สั่งเริ่มทำงานด้วยตนเอง

เหตุผลคือ CI เป็นกระบวนการตรวจสอบที่สามารถทำงานได้บ่อยและมีความเสี่ยงต่ำ ส่วนการ Deploy ไปยัง AWS อาจส่งผลกระทบต่อทรัพยากรที่ใช้งานจริง จึงต้องมีการตัดสินใจและอนุมัติโดยผู้มีสิทธิ์ก่อน

## การตั้งค่า GitHub Environment

สร้าง GitHub Environment ชื่อ `aws-deploy` และกำหนดสิทธิ์ผู้ที่สามารถ Deploy ได้ตามความเหมาะสม รวมถึงสามารถเพิ่มผู้ตรวจสอบหรือผู้อนุมัติก่อน Deploy (Required Reviewers) เพื่อเพิ่มความปลอดภัย

### 1. Variables (ค่าการตั้งค่าทั่วไป)

กำหนดค่าต่อไปนี้ใน GitHub Environment โดย Variables ใช้สำหรับเก็บค่าการตั้งค่าทั่วไปที่ไม่ใช่ข้อมูลลับ

| Variable | ความหมาย |
|---|---|
| `AWS_REGION` | Region ของ AWS ที่ใช้ติดตั้งระบบ |
| `SAM_STACK_NAME` | ชื่อ CloudFormation Stack |
| `DB_HOST` | Hostname ของ RDS Instance ที่มีอยู่แล้ว |
| `DB_INSTANCE_IDENTIFIER` | Identifier ของ RDS Instance |
| `DB_NAME` | ชื่อ Database หรือ Schema |
| `DB_USER` | ชื่อผู้ใช้ Database |
| `DB_PORT` | Port ของ Database โดยทั่วไปคือ `3306` |
| `VPC_SUBNET_IDS` | รายการ Private Subnet IDs คั่นด้วยเครื่องหมายจุลภาค โดยควรอยู่คนละ Availability Zone |
| `LAMBDA_SECURITY_GROUP_ID` | Security Group ที่กำหนดให้ Lambda |
| `RDS_PROXY_SECURITY_GROUP_ID` | Security Group ที่กำหนดให้ RDS Proxy |
| `LAMBDA_EXECUTION_ROLE_ARN` | ARN ของ Lambda Execution Role ที่มีอยู่แล้ว |
| `RDS_PROXY_ROLE_ARN` | ARN ของ RDS Proxy Role ที่มีอยู่แล้ว |
| `TU_AUTH_URL` | URL สำหรับเชื่อมต่อระบบยืนยันตัวตนของมหาวิทยาลัยธรรมศาสตร์ |
| `FRONTEND_ORIGIN` | Origin ของ Frontend ที่ Deploy แล้ว |

### 2. Secrets (ข้อมูลลับ)

กำหนดค่าต่อไปนี้ในส่วน Secrets ของ GitHub Environment

| Secret | ความหมาย |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | ARN ของ AWS IAM Role ที่อนุญาตให้ Repository และ Environment นี้เข้าถึง AWS ผ่าน OIDC |
| `DB_PASSWORD` | รหัสผ่าน Database |
| `TU_APPLICATION_KEY` | Application Key สำหรับเชื่อมต่อ TU API |
| `JWT_SECRET` | Secret Key ที่ใช้สำหรับลงลายเซ็น Access Token ของ API |

ห้ามนำ Password, Application Key หรือ JWT Signing Key ไปเขียนไว้ใน Workflow YAML, Repository Variables, ไฟล์ `.env` ที่ Commit ขึ้น Git หรือ Log ที่สามารถเปิดเผยข้อมูลได้

ใน Workflow ของเรากำหนด `EnableDemoLogin=false` ไว้อย่างชัดเจน และไม่ควรส่ง Demo Password Hash ไปยังระบบ เว้นแต่จะเป็นการ Deploy สำหรับ Demo ที่ได้รับอนุมัติแล้วเท่านั้น

## การตั้งค่า AWS OIDC

สร้าง IAM Role ที่มี Trust Relationship กับ GitHub OIDC Provider ซึ่งใช้ URL ดังนี้

`token.actions.githubusercontent.com`

ควรจำกัด Trust Policy ให้เฉพาะ Repository นี้และ GitHub Environment ชื่อ `aws-deploy` หรือ Branch และ Environment ที่ได้รับอนุมัติเท่านั้น

นอกจากนี้ IAM Role ต้องได้รับ Permission เท่าที่จำเป็นสำหรับการ Deploy CloudFormation / SAM Stack และการเข้าถึงทรัพยากรที่เกี่ยวข้อง

ไม่ควรใช้ Administrator-wide Policy เป็นสิทธิ์ถาวรสำหรับการ Deploy

หาก AWS Academy Lab ไม่อนุญาตให้ตั้งค่า OIDC หรือสร้าง IAM Role ที่จำเป็น จะไม่สามารถใช้ GitHub Deployment Workflow ตามที่กำหนดไว้ได้ ในกรณีนี้ให้ Deploy ผ่าน AWS CloudShell หรือ Terminal ที่ได้รับอนุญาต และบันทึกข้อจำกัดดังกล่าวไว้ในเอกสาร

## การตรวจสอบระบบซ้ำบนเครื่อง Local (Local Repeatable Verification)

สามารถตรวจสอบและ Build ระบบบนเครื่องของผู้พัฒนาได้ โดยไม่จำเป็นต้อง Deploy ไปยัง AWS

เริ่มจาก Repository Root แล้วใช้คำสั่งดังนี้

```bash
cd backend
npm ci
npm test
npm run typecheck
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
```

คำสั่งเหล่านี้ใช้สำหรับติดตั้ง Dependencies ทดสอบระบบ ตรวจสอบความถูกต้องของโค้ดและ Infrastructure Template รวมถึง Build ระบบเท่านั้น

**คำสั่งเหล่านี้ไม่ได้ทำการ Deploy หรือเปลี่ยนแปลงทรัพยากรใน AWS Account**

## ขั้นตอนการ Deploy สำหรับผู้ที่ได้รับอนุญาต (Authorized Deployment Runbook)

ก่อนเริ่ม Deploy ต้องดำเนินการตามขั้นตอนต่อไปนี้

1. ตรวจสอบ AWS Account, Region, Stack Name และ Environment ที่ต้องการ Deploy รวมถึงตรวจสอบว่าได้รับอนุมัติจากผู้รับผิดชอบแล้ว
2. ตรวจสอบ VPC, Private Subnet IDs, Lambda / RDS Proxy Security Groups, IAM Roles และ RDS Target ให้ถูกต้อง
3. ตรวจสอบสถานะ Database Migration รวมถึงแผนการ Backup และ Restore โดย Workflow นี้ไม่ได้ดำเนินการ Database Migration ให้โดยอัตโนมัติ
4. ตรวจสอบ SAM Template และ CloudFormation Change Set ก่อนอนุมัติการเปลี่ยนแปลง
5. ตั้งค่า GitHub Environment ชื่อ `aws-deploy` พร้อม Variables และ Secrets ที่จำเป็น
6. เปิด GitHub Actions → `V5 - Manual AWS Deployment` → `Run workflow` แล้วเลือก Branch ที่ต้องการ Deploy
7. ตรวจสอบผลการทำงานของ Workflow และเหตุการณ์ต่าง ๆ ใน CloudFormation Stack
8. บันทึกค่า `ApiUrl` และ `RdsProxyEndpoint` จาก Stack Outputs แล้วทดสอบ API ตามขั้นตอนที่ได้รับอนุมัติ
9. หาก Deploy ไม่สำเร็จ ให้ตรวจสอบ CloudFormation Events และ Lambda / CloudWatch Logs ก่อน ห้ามสั่ง Deploy ซ้ำทันทีโดยไม่ตรวจสอบ หาก Resource อยู่ในสถานะ Failed หรือ Rollback

## หลักฐานที่ต้องจัดเก็บสำหรับการส่งงาน V5 (V5 Evidence to Capture)

ควรจัดเก็บหลักฐานจากการทำงานจริงของระบบ โดยห้ามสร้างภาพหน้าจอหรือหลักฐานขึ้นมาเอง

หลักฐานที่ควรจัดเตรียม ได้แก่

- ภาพหน้าจอ GitHub Actions CI Run ที่แสดงผลการทดสอบ, Type Check, SAM Validation และ Build ว่าสำเร็จ
- ไฟล์ SAM Template ภายใน Repository พร้อมตัวอย่างทรัพยากรที่จัดการผ่าน CloudFormation
- ภาพหน้าจอ Manual Deployment Run ที่สำเร็จ หากสมาชิกในทีมได้รับอนุญาตให้ Deploy ไปยัง AWS
- ภาพหน้าจอ CloudFormation Stack และ Outputs โดยปกปิดข้อมูลสำคัญที่ไม่ควรเปิดเผย
- การเปรียบเทียบก่อนและหลังใช้ระบบ Automation โดยแสดงให้เห็นว่าขั้นตอนใดที่เคยต้องตั้งค่าผ่าน AWS Console ด้วยตนเอง และขั้นตอนใดที่เปลี่ยนมาใช้ CI / SAM Workflow
- คำอธิบายข้อดีและข้อจำกัดของระบบ เช่น VPC / RDS / IAM ที่มีอยู่เดิมยังเป็นสิ่งที่ต้องเตรียมไว้ล่วงหน้า การใช้ Manual Approval ช่วยป้องกันการ Deploy โดยไม่ตั้งใจ และ OIDC มีความปลอดภัยกว่าการใช้ Credentials แบบถาวร แต่ต้องมีการตั้งค่า IAM ก่อนใช้งาน

## การเชื่อมโยงกับข้อกำหนดของ V5 (Requirement Mapping)

| ข้อกำหนด V5 | วิธีการดำเนินงาน / หลักฐาน |
|---|---|
| กำหนด Infrastructure ที่สำคัญด้วย Code | ใช้ `backend/template.yaml` ซึ่งเป็น AWS SAM / CloudFormation Template ที่มีอยู่เดิม |
| ตรวจสอบและ Build ระบบซ้ำได้ | ใช้ `.github/workflows/ci.yml` |
| สามารถ Deploy ระบบซ้ำได้ | ใช้ `.github/workflows/deploy-aws.yml` และ Manual Workflow Trigger |
| ลดการตั้งค่าด้วยตนเอง | รวมค่าการตั้งค่าที่จำเป็นไว้ใน GitHub Environment |
| ลดความเสี่ยงจากการเปิดเผยข้อมูลลับ | ใช้ GitHub Secrets ร่วมกับ OIDC และไม่เก็บ AWS Credentials ไว้ใน Repository |
| ระบุข้อจำกัดและแนวทางจัดการความเสี่ยง | กำหนดให้ VPC / RDS / IAM ที่มีอยู่เดิมเป็นทรัพยากรที่ต้องเตรียมไว้ล่วงหน้า และควบคุมการ Deploy ผ่านการอนุมัติจากผู้มีสิทธิ์ |