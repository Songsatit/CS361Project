# [Architecture] Data Model / ERD สำหรับ V2

> เอกสารนี้เริ่มจาก ERD ของ V2 และมีภาคผนวก V4 ด้านล่างเพื่อให้เห็นตารางตรวจสอบการสำเร็จการศึกษาและ data flow ที่เพิ่มเข้ามา

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

## ภาคผนวก V4: ตรวจสอบการสำเร็จการศึกษา (Demo เท่านั้น)

Migration `010_graduation_verification.sql` เพิ่มตาราง 5 ตารางสำหรับรับผลการเรียนแบบ CSV ประเมินเงื่อนไขจบ และจำกัดการตรวจสอบตามผู้ได้รับมอบหมาย ตารางชุดนี้ยังไม่ใช่การเชื่อมต่อทะเบียนจริง และ fixture ที่ใช้ทดสอบเป็นข้อมูลสังเคราะห์เท่านั้น

### ERD ของตาราง V4

เส้นทึบด้านล่างแสดง foreign key ที่ migration สร้างจริง ส่วนความสัมพันธ์กับ `student_id`, `assignee_username` และ `curriculum_id` ในบางตารางเป็นการอ้างอิงเชิงข้อมูลเท่านั้น เพราะ migration นี้ยังไม่ได้สร้าง foreign key ไปยังตารางผู้ใช้หรือตารางหลักสูตรสำหรับคอลัมน์เหล่านั้น

```mermaid
erDiagram
    CURRICULUM ||--o{ GRADUATION_RULE : defines
    GRADUATION_IMPORT_BATCH ||--o{ GRADUATION_IMPORT_ERROR : records
    GRADUATION_IMPORT_BATCH ||--o{ GRADUATION_GRADE_RECORD : supplies

    GRADUATION_IMPORT_BATCH {
        bigint batch_id PK
        string source_key
        enum data_mode
        string source_batch_id
        string file_sha256
        datetime exported_at
        enum status
        int row_total
        int row_inserted
        int row_updated
        int row_unchanged
        int row_rejected
        json error_summary
        string imported_by
    }
    GRADUATION_IMPORT_ERROR {
        bigint error_id PK
        bigint batch_id FK
        int line_no
        string student_id
        string error_code
    }
    GRADUATION_GRADE_RECORD {
        bigint grade_record_id PK
        string student_id
        string curriculum_id
        smallint academic_year
        tinyint semester
        string course_code
        decimal credits
        string grade
        string row_hash
        bigint batch_id FK
    }
    GRADUATION_RULE {
        bigint rule_id PK
        string curriculum_id FK
        int condition_order
        enum rule_type
        json params
        string note
    }
    GRADUATION_STUDENT_ASSIGNMENT {
        bigint assignment_id PK
        string assignee_username
        string student_id
        string assigned_by
        timestamp assigned_at
    }
```

`GRADUATION_STUDENT_ASSIGNMENT` จำกัดว่าอาจารย์หรือเจ้าหน้าที่คนใดดูผลของนักศึกษาคนใดได้ แต่ใน migration นี้ไม่มี FK ไปยังตารางบัญชีผู้ใช้ และไม่มี FK ของ `student_id` ไปยังทะเบียนนักศึกษา `GRADUATION_GRADE_RECORD` ใช้ unique key จากนักศึกษา หลักสูตร ปี ภาคเรียน และรหัสวิชาเพื่อให้การนำเข้าซ้ำอัปเดตแถวเดิม

### Data flow ของ V4

```mermaid
flowchart LR
    CSV["CSV ผลการเรียน<br/>ปัจจุบันใช้ fixture สังเคราะห์"] --> ADAPTER["CSV adapter<br/>ตรวจ header และแถว"]
    ADAPTER --> CLI["graduation-import.mjs<br/>Demo mode"]
    CLI --> BATCH[("graduation_import_batch")]
    CLI --> ERROR[("graduation_import_error")]
    CLI --> GRADE[("graduation_grade_record")]
    WEB["Frontend<br/>ตรวจการสำเร็จการศึกษา"] --> API["API Lambda<br/>อ่านข้อมูลตามสิทธิ์"]
    API --> EVAL["evaluate.mjs<br/>ประเมิน graduation_rule"]
    EVAL --> RULE[("graduation_rule")]
    EVAL --> GRADE
    API --> ASSIGN[("graduation_student_assignment")]
    API --> CONDITION[("curriculum_graduation_condition")]
```

V4 เพิ่ม route ใน Lambda เดิมและ frontend เรียก API สำหรับอ่านผล ส่วน CLI ใช้นำเข้า CSV ใน Demo เท่านั้น ปัจจุบันไม่มีการเชื่อมต่อทะเบียนจริง สถานะ migration บน RDS ที่ deploy อยู่ยังไม่ทราบ จึงห้ามรัน migration หรือ importer กับ RDS จนกว่าจะตรวจสอบสถานะ อนุมัติ data contract และมีแผน deploy แยกต่างหาก
