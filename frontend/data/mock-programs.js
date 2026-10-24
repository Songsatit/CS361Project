/* Fallback curriculum metadata used only when the API is unavailable. */
window.MOCK_PROGRAMS = [

  /* =====================================================
     COMPUTER SCIENCE
     Curriculum 2023
     ===================================================== */

  {
    id: "cis",
    code: "วท.บ. วิทยาการคอมพิวเตอร์และสารสนเทศ",
    nameEn: "Computer and Information Science",
    revisionYear: 2566,
    curriculumId: "BSC-CS-2566",
    pathwayId: "BSC-CS-2566-CIS",
    faculty: "คณะวิทยาศาสตร์และเทคโนโลยี",
    duration: "หลักสูตร 4 ปี",
    totalCredits: 123,

    summary:
      "หลักสูตรวิทยาการคอมพิวเตอร์ ฉบับ พ.ศ. 2566 มุ่งพัฒนาความรู้และทักษะด้านวิทยาการคอมพิวเตอร์ การพัฒนาซอฟต์แวร์ ระบบสารสนเทศ วิทยาการข้อมูล ปัญญาประดิษฐ์ และเทคโนโลยีดิจิทัล",

    structure: [
      {
        label: "วิชาศึกษาทั่วไป",
        credits: 30
      },
      {
        label: "วิชาเฉพาะ – วิชาแกน",
        credits: 12
      },
      {
        label: "วิชาเฉพาะ – วิชาเฉพาะด้าน",
        credits: 42
      },
      {
        label: "วิชาเอก",
        credits: 30
      },
      {
        label: "วิชาบังคับนอกสาขา",
        credits: 3
      },
      {
        label: "วิชาเลือกเสรี",
        credits: 6
      }
    ],

    conditions: [
      "บรรลุผลลัพธ์การเรียนรู้ตามมาตรฐานคุณวุฒิระดับปริญญาตรี",
      "สอบผ่านและได้รับหน่วยกิตสะสมรายวิชาครบตามโครงสร้างหลักสูตร และมีหน่วยกิตสะสมไม่ต่ำกว่า 123 หน่วยกิต",
      "ได้ค่าระดับเฉลี่ยสะสมไม่ต่ำกว่า 2.00 จากระบบ 4 ระดับคะแนน",
      "ปฏิบัติตามเงื่อนไขอื่น ๆ ที่คณะวิทยาศาสตร์และเทคโนโลยี และมหาวิทยาลัยธรรมศาสตร์กำหนด",
      "ได้ค่าระดับไม่ต่ำกว่า C ในรายวิชา คพ.101, คพ.102 และ คพ.111",
      "ได้ค่าเฉลี่ยรวมทั้ง 8 รายวิชาไม่ต่ำกว่า 2.00 ได้แก่ คพ.100, คพ.101, คพ.102, คพ.111, คพ.232, คพ.240, คพ.251 และ คพ.261"
    ],

    plan: [

      {
        year: 1,
        term: 1,
        courses: [
          "CS100",
          "CS101",
          "CS102",
          "TU100",
          "TU101",
          "TU108",
          "ST216"
        ]
      },

      {
        year: 1,
        term: 2,
        courses: [
          "CS111",
          "CS180",
          "MA211",
          "TU103",
          "TU106",
          "TU109",
          "EL105"
        ]
      },

      {
        year: 2,
        term: 1,
        courses: [
          "LAS101",
          "CS216",
          "CS233",
          "CS240",
          "CS261",
          "EL295",
          "ST329"
        ]
      },

      {
        year: 2,
        term: 2,
        courses: [
          "CS234",
          "CS232",
          "CS251",
          "CS262",
          "CS271",
          "EL395",
          "TU201"
        ]
      },

      {
        year: 3,
        term: 1,
        courses: [
          "CS263",
          "CS264",
          "CS301",
          "CS361",
          "CS364"
        ]
      },

      {
        year: 3,
        term: 2,
        courses: [
          "CS303",
          "CS305",
          "CS362",
          "CS363",
          "CS367"
        ]
      },

      {
        year: 4,
        term: 1,
        courses: [
          "CS403",
          "FREE3"
        ]
      },

      {
        year: 4,
        term: 2,
        courses: [
          "FREE3"
        ]
      }

    ]
  },


  /* =====================================================
     COMPUTER NETWORKS AND CYBERSECURITY
     Curriculum 2025
     ===================================================== */

  {
    id: "cnctu",
    code: "วท.บ. คอมพิวเตอร์เครือข่ายและความปลอดภัยทางไซเบอร์",
    nameEn: "Bachelor of Science Program in Computer Networks and Cybersecurity",
    revisionYear: 2568,
    curriculumId: "BSC-CNC-2568",
    faculty: "คณะวิทยาศาสตร์และเทคโนโลยี",
    duration: "หลักสูตร 4 ปี",
    totalCredits: 126,

    summary:
      "หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาคอมพิวเตอร์เครือข่ายและความปลอดภัยทางไซเบอร์ มุ่งเน้นความรู้และทักษะด้านระบบเครือข่าย คอมพิวเตอร์ คลาวด์ ระบบปฏิบัติการ และความมั่นคงปลอดภัยทางไซเบอร์",

    structure: [
      {
        label: "วิชาศึกษาทั่วไป",
        credits: 24
      },
      {
        label: "วิชาเฉพาะ – พื้นฐานด้านคณิตศาสตร์",
        credits: 9
      },
      {
        label: "วิชาเฉพาะ – วิชาบังคับ",
        credits: 81
      },
      {
        label: "วิชาโครงงาน / สหกิจศึกษา",
        credits: 6
      },
      {
        label: "วิชาเลือกเสรี",
        credits: 6
      }
    ],

    conditions: [
      "ศึกษารายวิชาครบตามโครงสร้างหลักสูตรและมีหน่วยกิตสะสมไม่ต่ำกว่า 126 หน่วยกิต",
      "สอบผ่านรายวิชาตามโครงสร้างและข้อกำหนดของหลักสูตร",
      "ต้องสอบไล่ได้ไม่ต่ำกว่าระดับ C ในรายวิชา คคป.101, คคป.102, คคป.222, คคป.231 และ คคป.235",
      "ต้องสอบไล่ได้ค่าเฉลี่ยรวมทั้ง 7 รายวิชาไม่ต่ำกว่า 2.00 ได้แก่ คคป.101, คคป.102, คคป.211, คคป.222, คคป.231, คคป.235 และ คคป.332",
      "เลือกแผนโครงงานหรือแผนสหกิจศึกษาอย่างใดอย่างหนึ่งตามข้อกำหนดของหลักสูตร"
    ],

    plan: [

      {
        year: 1,
        term: 1,
        courses: [
          "CNC101",
          "CNC102",
          "CNC103",
          "MA211",
          "TU100",
          "LAS101",
          "TU201"
        ]
      },

      {
        year: 1,
        term: 2,
        courses: [
          "CNC104",
          "CNC105",
          "CNC111",
          "ST216",
          "EL105",
          "TU109",
          "TU103"
        ]
      },

      {
        year: 2,
        term: 1,
        courses: [
          "CNC201",
          "CNC211",
          "CNC222",
          "CNC231",
          "CNC261",
          "EL295",
          "TU250"
        ]
      },

      {
        year: 2,
        term: 2,
        courses: [
          "CNC223",
          "CNC224",
          "CNC232",
          "CNC233",
          "CNC235",
          "CNC262",
          "CNC271"
        ]
      },

      {
        year: 3,
        term: 1,
        courses: [
          "CNC301",
          "CNC324",
          "CNC331",
          "CNC332",
          "CNC362",
          "CNC371",
          "CNC384"
        ]
      },

      {
        year: 3,
        term: 2,
        courses: [
          "CNC333",
          "CNC334",
          "CNC345",
          "FREE3",
          "FREE3"
        ]
      },

      {
        year: 3,
        term: 3,
        courses: [
          "CNC304"
        ]
      },

      {
        year: 4,
        term: 1,
        courses: [
          "CNC404"
        ]
      }

    ]
  }

];

const computerScienceProgram = window.MOCK_PROGRAMS.find(item => item.id === "cis");

if (computerScienceProgram) {
  window.MOCK_PROGRAMS.splice(1, 0, {
    ...computerScienceProgram,
    id: "acs",
    code: "วท.บ. คอมพิวเตอร์ประยุกต์",
    nameEn: "Applied Computer Science",
    curriculumId: "BSC-CS-2566",
    pathwayId: "BSC-CS-2566-ACS",
    summary:
      "หลักสูตรคอมพิวเตอร์ประยุกต์ ฉบับ พ.ศ. 2566 มุ่งเน้นการประยุกต์ใช้ความรู้ด้านคอมพิวเตอร์และเทคโนโลยีดิจิทัลในการพัฒนาระบบและแก้ปัญหาในบริบทจริง"
  });

}


/* =========================================================
   GENERAL DATA
   ========================================================= */

const FAQS = [

  {
    category: "หลักสูตรทั่วไป",
    q: "หลักสูตรวิทยาการคอมพิวเตอร์ พ.ศ. 2566 มีทั้งหมดกี่หน่วยกิต?",
    a: "หลักสูตรวิทยาการคอมพิวเตอร์ ฉบับ พ.ศ. 2566 กำหนดจำนวนหน่วยกิตรวมตลอดหลักสูตร 123 หน่วยกิต"
  },

  {
    category: "หลักสูตรทั่วไป",
    q: "หลักสูตรคอมพิวเตอร์เครือข่ายและความปลอดภัยทางไซเบอร์มีกี่หน่วยกิต?",
    a: "หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาคอมพิวเตอร์เครือข่ายและความปลอดภัยทางไซเบอร์ พ.ศ. 2568 กำหนดจำนวนหน่วยกิตรวมไม่น้อยกว่า 126 หน่วยกิต"
  },

  {
    category: "การลงทะเบียนเรียน",
    q: "วิชาบังคับก่อนคืออะไร?",
    a: "วิชาบังคับก่อนคือรายวิชาที่นักศึกษาต้องผ่านตามเงื่อนไขก่อนจึงจะสามารถลงทะเบียนเรียนรายวิชาที่กำหนดได้"
  },

  {
    category: "การสำเร็จการศึกษา",
    q: "หลักสูตรวิทยาการคอมพิวเตอร์ต้องมี GPA เท่าไร?",
    a: "เกณฑ์การสำเร็จการศึกษาของหลักสูตรวิทยาการคอมพิวเตอร์กำหนดค่าระดับเฉลี่ยสะสมไม่ต่ำกว่า 2.00"
  },

  {
    category: "การสำเร็จการศึกษา",
    q: "หลักสูตร CNCTU ต้องมีหน่วยกิตเท่าไร?",
    a: "หลักสูตรคอมพิวเตอร์เครือข่ายและความปลอดภัยทางไซเบอร์กำหนดหน่วยกิตรวมไม่น้อยกว่า 126 หน่วยกิต"
  },

  {
    category: "การสำเร็จการศึกษา",
    q: "CNCTU มีแผนโครงงานและสหกิจศึกษาหรือไม่?",
    a: "มี นักศึกษาสามารถเลือกแผนโครงงานหรือแผนสหกิจศึกษา โดยต้องเลือกกลุ่มใดกลุ่มหนึ่งตามข้อกำหนดของหลักสูตร"
  },

  {
    category: "ระบบ",
    q: "สามารถตรวจสอบสถานะการสำเร็จการศึกษาของนักศึกษาได้หรือไม่?",
    a: "ขณะนี้ระบบให้บริการข้อมูลหลักสูตรและการค้นหาข้อมูลสาธารณะ ส่วนการตรวจสอบสถานะรายบุคคลจากสำนักทะเบียนยังไม่เปิดให้บริการ"
  }

];


/* =========================================================
   STATE
   ========================================================= */

const state = {
  view: "home",

  programId: null,
  courseCode: null,

  navOpen: false,

  programTab: "overview",
  year: 1,

  courseQuery: "",
  programFilter: "all",
  noPrereqOnly: false,

  faqQuery: "",
  openFaq: null,

  homeQuery: "",
  user: null,
  studentProfile: null,
  studentProfileLoading: false,
  studentProfileAttempted: false,
  studentProfileError: "",
  curriculumChanges: [],
  curriculumChangesLoaded: false,
  curriculumCourses: [],
  curriculumCoursesLoaded: false,
  curriculumCoursesKey: null,
  accountMenuOpen: false,
  loginOpen: false,
  loginError: "",
  apiStatus: "loading",
  apiError: ""
};

const API_BASE = "https://qowe6iixr6.execute-api.us-east-1.amazonaws.com";
const CURRICULUM_ID = "BSC-CS-2566";
const COURSE_CATALOG_API = "https://script.google.com/a/macros/dome.tu.ac.th/s/AKfycbw75ktHQ9wrWMNcMBq1rd0OnNCi3OOJwwNS0kTT5OQDYGiBA1Up7B-Ufbhtu603HZcZ/exec";
const courseDetailRequests = new Map();
const workflowRequests = new Map();
const workflowCache = new Map();
const auditLogRequests = new Map();
const auditLogCache = new Map();
