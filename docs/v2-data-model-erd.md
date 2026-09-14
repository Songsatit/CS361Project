# [Architecture] Data Model / ERD สำหรับ V2

## Goal

ออกแบบ Data Model สำหรับข้อมูลหลักสูตร รายวิชา และวิชาบังคับก่อน เพื่อรองรับข้อมูลหลายปีหลักสูตร การค้นหา และการกรองข้อมูลใน V2

## Entities

```mermaid
erDiagram
    FACULTY ||--o{ DEPARTMENT : has
    DEPARTMENT ||--o{ PROGRAM : offers
    PROGRAM ||--o{ CURRICULUM_VERSION : has
    CURRICULUM_VERSION ||--o{ CURRICULUM_COURSE : contains
    COURSE ||--o{ CURRICULUM_COURSE : included_in
    COURSE ||--o{ PREREQUISITE : requires
    COURSE ||--o{ PREREQUISITE : required_by

    FACULTY {
        bigint id PK
        string code
        string name
    }
    DEPARTMENT {
        bigint id PK
        bigint faculty_id FK
        string code
        string name
    }
    PROGRAM {
        bigint id PK
        bigint department_id FK
        string code
        string name
    }
    CURRICULUM_VERSION {
        bigint id PK
        bigint program_id FK
        int academic_year
        int total_credits
    }
    COURSE {
        bigint id PK
        string course_code
        string name
        decimal credits
        string category
    }
    CURRICULUM_COURSE {
        bigint curriculum_version_id PK, FK
        bigint course_id PK, FK
        int recommended_year
        int recommended_term
    }
    PREREQUISITE {
        bigint course_id PK, FK
        bigint prerequisite_course_id PK, FK
    }
```

## Design notes

- `CURRICULUM_VERSION` แยกปีหลักสูตร เพื่อให้โปรแกรมเดียวมีหลายหลักสูตรตามปีการศึกษาได้
- `CURRICULUM_COURSE` เป็นตารางเชื่อมระหว่างหลักสูตรกับรายวิชา
- `PREREQUISITE` รองรับความสัมพันธ์วิชาบังคับก่อนแบบหลายต่อหลาย
- ข้อมูลจาก University Curriculum API ควรถูกแปลงเข้าสู่ Model นี้ก่อนส่งให้ Frontend

## Acceptance criteria

- มี ERD ที่ทีมเห็นชอบ
- รองรับหลักสูตรหลายปีการศึกษา
- รองรับการค้นหารายวิชาและกรองตามหลักสูตร/หมวดวิชา
- รองรับการแสดงวิชาบังคับก่อน
- ระบุ Mapping ระหว่างข้อมูลจาก API กับ Entity ในระบบ
