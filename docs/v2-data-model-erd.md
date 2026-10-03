# [Architecture] Data Model / ERD สำหรับ V2

## Goal

ออกแบบ Data Model สำหรับข้อมูลหลักสูตร รายวิชา และวิชาบังคับก่อน เพื่อรองรับข้อมูลหลายปีหลักสูตร การค้นหา และการกรองข้อมูลใน V2

## Entities

```mermaid
erDiagram
    FACULTY ||--o{ DEPARTMENT : has
    DEPARTMENT ||--o{ CURRICULUM_DEPARTMENT : maps
    CURRICULUM ||--o{ PATHWAY : has
    CURRICULUM ||--o{ CURRICULUM_GRADUATION_CONDITION : requires
    CURRICULUM ||--o{ CURRICULUM_DEPARTMENT : linked_to
    PATHWAY ||--o{ CURRICULUM_DEPARTMENT : linked_to
    PATHWAY ||--o{ CURRICULUM_COURSE : contains
    COURSE ||--o{ CURRICULUM_COURSE : included_in
    CURRICULUM_COURSE ||--o{ COURSE_CLASSIFICATION : classified_as
    COURSE_CLASSIFICATION ||--o{ COURSE_SUBCATEGORY : has
    COURSE ||--o{ PREREQUISITE : has
    COURSE ||--o{ PREREQUISITE : is_required_by
    COURSE ||--o| COURSE_DETAIL : describes
    CURRICULUM ||--o{ STUDY_PLAN : has
    PATHWAY ||--o{ STUDY_PLAN : scopes
    STUDY_PLAN ||--o{ STUDY_PLAN_ITEM : contains
    COURSE ||--o{ STUDY_PLAN_ITEM : includes

    FACULTY {
        string faculty_id PK
        string faculty_th
        string faculty_en
    }
    DEPARTMENT {
        string department_code PK
        string faculty_id FK
        string department_name_th
        string department_name_en
    }
    CURRICULUM {
        string curriculum_id PK
        int academic_year
    }
    CURRICULUM_GRADUATION_CONDITION {
        int condition_id PK
        string curriculum_id FK
        int display_order
        string condition_text
    }
    PATHWAY {
        string pathway_id PK
        string curriculum_id FK
    }
    COURSE {
        string course_id PK
        string course_code
        string course_code_th
        string title_th
        string title_en
        int credits_total
        string status
        boolean active
    }
    COURSE_DETAIL {
        string course_id PK, FK
        text description_th
        text description_en
        json contact_hours_json
        json raw_json
        timestamp updated_at
    }
    CURRICULUM_COURSE {
        string curriculum_course_id PK
        string curriculum_id FK
        string pathway_id FK
        string course_id FK
        string course_group
        string requirement_type
    }
    CURRICULUM_DEPARTMENT {
        string curriculum_id PK, FK
        string pathway_id PK, FK
        string department_code PK, FK
    }
    COURSE_CLASSIFICATION {
        string curriculum_course_id PK, FK
        string course_type_code
        string course_type_label_th
        string other_detail
    }
    COURSE_SUBCATEGORY {
        string curriculum_course_id PK, FK
        string subcategory_code PK
        string label_th
        string detail
    }
    PREREQUISITE {
        string course_id PK, FK
        string prerequisite_course_id PK, FK
    }
    STUDY_PLAN {
        string study_plan_id PK
        string curriculum_id FK
        string pathway_id FK
        string plan_name
        boolean active
        json raw_json
    }
    STUDY_PLAN_ITEM {
        string study_plan_id PK, FK
        int study_year PK
        int semester PK
        int item_order PK
        string course_id FK
        string requirement_text
        decimal credits
        json raw_json
    }
```

## Design notes

- `FACULTY` และ `DEPARTMENT` รับข้อมูลจาก Faculty API และ Department API
- `CURRICULUM`, `PATHWAY`, `COURSE` และ `CURRICULUM_COURSE` รับข้อมูลจาก Course Catalog API
- `COURSE` แยกจาก `CURRICULUM_COURSE` เพราะวิชาเดียวกันสามารถอยู่ได้หลาย pathway
- `CURRICULUM_DEPARTMENT` ใช้เชื่อมข้อมูลสาขาจาก University API กับหลักสูตรจาก Course Catalog API
- ID จาก API ใช้ชนิดข้อมูล `string` เพราะเป็นรหัส เช่น `BSC-CS-2566-CIS-CS100`
- `CURRICULUM_COURSE` เป็นตารางเชื่อมระหว่าง pathway กับรายวิชา
- `COURSE_CLASSIFICATION` เก็บประเภทและหมวดหมู่ของรายวิชาตาม curriculum placement
- `PREREQUISITE` รองรับความสัมพันธ์วิชาบังคับก่อนแบบหลายต่อหลาย
- `COURSE_DETAIL` เก็บรายละเอียดเพิ่มเติมของรายวิชาที่มาจาก Course Catalog API
- `STUDY_PLAN` และ `STUDY_PLAN_ITEM` เก็บแผนการเรียนแยกตาม pathway ปีการศึกษา และภาคการศึกษา
- `CURRICULUM_GRADUATION_CONDITION` เก็บเงื่อนไขสำเร็จการศึกษาที่ Frontend ใช้แสดง
- ข้อมูลจากทั้งสาม API ควรถูกแปลงเข้าสู่ Model นี้ก่อนส่งให้ Frontend

## Acceptance criteria

- มี ERD ที่ทีมเห็นชอบ
- รองรับหลักสูตรหลายปีการศึกษา
- รองรับการค้นหารายวิชาและกรองตามหลักสูตร/หมวดวิชา
- รองรับการแสดงวิชาบังคับก่อน
- ระบุ Mapping ระหว่างข้อมูลจาก API กับ Entity ในระบบ
