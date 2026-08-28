const COURSES = {
  GE101: { name: "ทักษะการใช้ภาษาไทย", nameEn: "Thai Language Skills", credits: 3, category: "ศึกษาทั่วไป", prereq: [], term: "ทุกภาคการศึกษา", desc: "ฝึกฝนการอ่าน การเขียน และการนำเสนอความคิดอย่างมีเหตุผลผ่านภาษาไทย เพื่อใช้เป็นพื้นฐานในการสื่อสารเชิงวิชาการ" },
  GE102: { name: "ภาษาอังกฤษเพื่อการสื่อสาร 1", nameEn: "English for Communication 1", credits: 3, category: "ศึกษาทั่วไป", prereq: [], term: "ทุกภาคการศึกษา", desc: "พัฒนาทักษะฟัง พูด อ่าน เขียนภาษาอังกฤษระดับพื้นฐานเพื่อการสื่อสารในชีวิตประจำวันและการศึกษา" },
  GE103: { name: "ภาษาอังกฤษเพื่อการสื่อสาร 2", nameEn: "English for Communication 2", credits: 3, category: "ศึกษาทั่วไป", prereq: ["GE102"], term: "ทุกภาคการศึกษา", desc: "ต่อยอดทักษะภาษาอังกฤษสู่ระดับที่ซับซ้อนขึ้น เน้นการอ่านบทความวิชาการและการเขียนเชิงสรุปความ" },
  GE201: { name: "พลเมืองและสังคมดิจิทัล", nameEn: "Digital Citizenship & Society", credits: 3, category: "ศึกษาทั่วไป", prereq: [], term: "ทุกภาคการศึกษา", desc: "ทำความเข้าใจสิทธิ หน้าที่ และความรับผิดชอบของพลเมืองในสังคมที่ขับเคลื่อนด้วยข้อมูลและเทคโนโลยีดิจิทัล" },
  GE202: { name: "การคิดเชิงวิพากษ์และการแก้ปัญหา", nameEn: "Critical Thinking & Problem Solving", credits: 3, category: "ศึกษาทั่วไป", prereq: [], term: "ทุกภาคการศึกษา", desc: "ฝึกกระบวนการคิดอย่างมีระบบ การตั้งคำถาม และการแก้ปัญหาด้วยหลักฐานเชิงประจักษ์" },
  MATH101: { name: "แคลคูลัส 1", nameEn: "Calculus 1", credits: 3, category: "พื้นฐานวิชาชีพ", prereq: [], term: "ภาคการศึกษาที่ 1", desc: "ลิมิต อนุพันธ์ และการประยุกต์ใช้แคลคูลัสเชิงอนุพันธ์กับปัญหาทางวิทยาศาสตร์และวิศวกรรม" },
  MATH102: { name: "แคลคูลัส 2", nameEn: "Calculus 2", credits: 3, category: "พื้นฐานวิชาชีพ", prereq: ["MATH101"], term: "ภาคการศึกษาที่ 2", desc: "ปริพันธ์ อนุกรม และสมการเชิงอนุพันธ์เบื้องต้น ต่อยอดจากแคลคูลัส 1" },
  MATH201: { name: "พีชคณิตเชิงเส้น", nameEn: "Linear Algebra", credits: 3, category: "พื้นฐานวิชาชีพ", prereq: ["MATH101"], term: "ภาคการศึกษาที่ 1", desc: "เมทริกซ์ ปริภูมิเวกเตอร์ และการแปลงเชิงเส้น พื้นฐานสำคัญของกราฟิกและการเรียนรู้ของเครื่อง" },
  STAT201: { name: "ความน่าจะเป็นและสถิติ", nameEn: "Probability & Statistics", credits: 3, category: "พื้นฐานวิชาชีพ", prereq: ["MATH101"], term: "ภาคการศึกษาที่ 1", desc: "หลักความน่าจะเป็น การแจกแจงข้อมูล และการอนุมานเชิงสถิติสำหรับงานวิเคราะห์ข้อมูล" },
  CS101: { name: "หลักการเขียนโปรแกรมเบื้องต้น", nameEn: "Introduction to Programming", credits: 3, category: "แกน", prereq: [], term: "ภาคการศึกษาที่ 1", desc: "แนวคิดพื้นฐานของการเขียนโปรแกรม ตัวแปร เงื่อนไข การวนซ้ำ และฟังก์ชัน ผ่านภาษาโปรแกรมระดับสูง" },
  CS110: { name: "คณิตศาสตร์ดิสครีต", nameEn: "Discrete Mathematics", credits: 3, category: "แกน", prereq: [], term: "ภาคการศึกษาที่ 1", desc: "ตรรกศาสตร์ เซต ทฤษฎีกราฟ และการนับ ซึ่งเป็นภาษาทางคณิตศาสตร์ของวิทยาการคอมพิวเตอร์" },
  CS102: { name: "การเขียนโปรแกรมเชิงวัตถุ", nameEn: "Object-Oriented Programming", credits: 3, category: "แกน", prereq: ["CS101"], term: "ภาคการศึกษาที่ 2", desc: "หลักการของคลาส วัตถุ การสืบทอด และพหุสัณฐาน สำหรับออกแบบซอฟต์แวร์ขนาดกลางถึงใหญ่" },
  CS210: { name: "สถาปัตยกรรมคอมพิวเตอร์", nameEn: "Computer Architecture", credits: 3, category: "แกน", prereq: ["CS101"], term: "ภาคการศึกษาที่ 2", desc: "โครงสร้างของหน่วยประมวลผล หน่วยความจำ และการทำงานระดับฮาร์ดแวร์ที่รองรับซอฟต์แวร์" },
  CS201: { name: "โครงสร้างข้อมูลและอัลกอริทึม", nameEn: "Data Structures & Algorithms", credits: 3, category: "แกน", prereq: ["CS102", "CS110"], term: "ภาคการศึกษาที่ 1", desc: "ลิสต์ ต้นไม้ กราฟ และการวิเคราะห์ความซับซ้อนของอัลกอริทึมการค้นหาและการเรียงลำดับ" },
  CS230: { name: "เครือข่ายคอมพิวเตอร์", nameEn: "Computer Networks", credits: 3, category: "บังคับ", prereq: ["CS210"], term: "ภาคการศึกษาที่ 1", desc: "สถาปัตยกรรมเครือข่าย โพรโทคอล TCP/IP และหลักการสื่อสารข้อมูลระหว่างระบบ" },
  CS202: { name: "ระบบฐานข้อมูล", nameEn: "Database Systems", credits: 3, category: "บังคับ", prereq: ["CS201"], term: "ภาคการศึกษาที่ 2", desc: "แบบจำลองข้อมูลเชิงสัมพันธ์ ภาษา SQL การนอร์มัลไลซ์ และการออกแบบฐานข้อมูล" },
  CS220: { name: "ระบบปฏิบัติการ", nameEn: "Operating Systems", credits: 3, category: "บังคับ", prereq: ["CS210", "CS201"], term: "ภาคการศึกษาที่ 2", desc: "การจัดการโพรเซส หน่วยความจำ และไฟล์ในระบบปฏิบัติการ พร้อมปัญหาการทำงานพร้อมกัน" },
  CS301: { name: "วิศวกรรมซอฟต์แวร์", nameEn: "Software Engineering", credits: 3, category: "บังคับ", prereq: ["CS201"], term: "ภาคการศึกษาที่ 1", desc: "วงจรชีวิตของการพัฒนาซอฟต์แวร์ การเก็บความต้องการ การออกแบบ และการทำงานเป็นทีม" },
  CS310: { name: "ปัญญาประดิษฐ์เบื้องต้น", nameEn: "Introduction to Artificial Intelligence", credits: 3, category: "บังคับ", prereq: ["CS201", "STAT201"], term: "ภาคการศึกษาที่ 1", desc: "การค้นหาสถานะ ระบบผู้เชี่ยวชาญ และแนวคิดพื้นฐานของการเรียนรู้ของเครื่อง" },
  CS320: { name: "ความมั่นคงปลอดภัยไซเบอร์", nameEn: "Cybersecurity", credits: 3, category: "บังคับ", prereq: ["CS230"], term: "ภาคการศึกษาที่ 1", desc: "ภัยคุกคามทางไซเบอร์ การเข้ารหัสข้อมูล และแนวปฏิบัติในการป้องกันระบบสารสนเทศ" },
  CS330: { name: "การพัฒนาซอฟต์แวร์บนเว็บ", nameEn: "Web Application Development", credits: 3, category: "เลือกเฉพาะสาขา", prereq: ["CS202"], term: "ภาคการศึกษาที่ 2", desc: "การพัฒนาเว็บแอปพลิเคชันฝั่งหน้าบ้านและหลังบ้าน การเชื่อมต่อฐานข้อมูล และการนำระบบขึ้นใช้งานจริง" },
  CSELE1: { name: "วิชาเลือกเฉพาะสาขา: การประมวลผลภาพ", nameEn: "Major Elective: Image Processing", credits: 3, category: "เลือกเฉพาะสาขา", prereq: ["CS201"], term: "ภาคการศึกษาที่ 2", desc: "เทคนิคการประมวลผลและวิเคราะห์ภาพดิจิทัลเบื้องต้น" },
  CS398: { name: "การฝึกงาน/สหกิจศึกษา", nameEn: "Internship / Cooperative Education", credits: 6, category: "บังคับ", prereq: ["สะสมหน่วยกิตไม่น้อยกว่า 90 หน่วยกิต"], term: "ภาคฤดูร้อน", desc: "ปฏิบัติงานจริงในสถานประกอบการไม่น้อยกว่า 300 ชั่วโมง ภายใต้การนิเทศของอาจารย์และพี่เลี้ยง" },
  CS401: { name: "โครงงานวิทยาการคอมพิวเตอร์ 1", nameEn: "Senior Project I", credits: 1, category: "บังคับ", prereq: ["CS301"], term: "ภาคการศึกษาที่ 1", desc: "กำหนดหัวข้อ ศึกษาความเป็นไปได้ และวางแผนโครงงานร่วมกับอาจารย์ที่ปรึกษา" },
  CS402: { name: "โครงงานวิทยาการคอมพิวเตอร์ 2", nameEn: "Senior Project II", credits: 2, category: "บังคับ", prereq: ["CS401"], term: "ภาคการศึกษาที่ 2", desc: "พัฒนาและนำเสนอโครงงานที่วางแผนไว้จนแล้วเสร็จ พร้อมสอบป้องกันโครงงาน" },
  IT101: { name: "เทคโนโลยีสารสนเทศเบื้องต้น", nameEn: "Introduction to Information Technology", credits: 3, category: "แกน", prereq: [], term: "ภาคการศึกษาที่ 1", desc: "ภาพรวมของระบบสารสนเทศ ฮาร์ดแวร์ ซอฟต์แวร์ และบทบาทของไอทีในองค์กร" },
  IT201: { name: "การจัดการฐานข้อมูล", nameEn: "Database Management", credits: 3, category: "บังคับ", prereq: ["CS101"], term: "ภาคการศึกษาที่ 2", desc: "การออกแบบและบริหารจัดการฐานข้อมูลสำหรับองค์กร รวมถึงการดูแลรักษาและความปลอดภัยของข้อมูล" },
  IT210: { name: "การจัดการเครือข่ายและระบบ", nameEn: "Network & System Administration", credits: 3, category: "บังคับ", prereq: ["CS210"], term: "ภาคการศึกษาที่ 1", desc: "การติดตั้งดูแลระบบเครือข่ายและเซิร์ฟเวอร์ในองค์กร" },
  IT301: { name: "การจัดการโครงการเทคโนโลยีสารสนเทศ", nameEn: "IT Project Management", credits: 3, category: "บังคับ", prereq: ["IT201"], term: "ภาคการศึกษาที่ 1", desc: "หลักการบริหารโครงการไอที การวางแผน ควบคุมงบประมาณ และบริหารความเสี่ยง" },
  IT398: { name: "สหกิจศึกษา", nameEn: "Cooperative Education", credits: 6, category: "บังคับ", prereq: ["สะสมหน่วยกิตไม่น้อยกว่า 90 หน่วยกิต"], term: "ภาคฤดูร้อน", desc: "ปฏิบัติงานจริงในสถานประกอบการด้านไอทีไม่น้อยกว่า 16 สัปดาห์" },
};

const PROGRAMS = [
  {
    id: "cs",
    code: "วท.บ. วิทยาการคอมพิวเตอร์",
    nameEn: "B.Sc. in Computer Science",
    revisionYear: 2565,
    faculty: "คณะวิทยาศาสตร์และเทคโนโลยี",
    duration: "หลักสูตร 4 ปี",
    totalCredits: 132,
    summary:
      "มุ่งผลิตบัณฑิตที่มีพื้นฐานการคิดเชิงคำนวณ ออกแบบและพัฒนาซอฟต์แวร์ได้อย่างเป็นระบบ ครอบคลุมตั้งแต่โครงสร้างข้อมูล ระบบฐานข้อมูล ไปจนถึงปัญญาประดิษฐ์และความมั่นคงปลอดภัยไซเบอร์",
    structure: [
      { label: "หมวดวิชาศึกษาทั่วไป", credits: 30 },
      { label: "หมวดวิชาเฉพาะ – แกน", credits: 39 },
      { label: "หมวดวิชาเฉพาะ – บังคับ", credits: 39 },
      { label: "หมวดวิชาเฉพาะ – เลือก", credits: 15 },
      { label: "หมวดวิชาเลือกเสรี", credits: 9 },
    ],
    conditions: [
      "ศึกษารายวิชาครบตามโครงสร้างหลักสูตร ไม่น้อยกว่า 132 หน่วยกิต",
      "ได้ค่าระดับคะแนนเฉลี่ยสะสมตลอดหลักสูตรไม่ต่ำกว่า 2.00",
      "ผ่านการฝึกงานหรือสหกิจศึกษาไม่น้อยกว่า 300 ชั่วโมง",
      "ผ่านโครงงานวิทยาการคอมพิวเตอร์ทั้งรายวิชา CS401 และ CS402",
      "ผ่านเกณฑ์ทดสอบความรู้ภาษาอังกฤษตามที่มหาวิทยาลัยกำหนด",
      "ไม่มีภาระหนี้สินค้างชำระกับมหาวิทยาลัย ณ วันยื่นขอสำเร็จการศึกษา",
    ],
    plan: [
      { year: 1, term: 1, courses: ["GE101", "GE102", "MATH101", "CS101", "CS110"] },
      { year: 1, term: 2, courses: ["GE103", "GE201", "MATH102", "CS102", "CS210"] },
      { year: 2, term: 1, courses: ["MATH201", "STAT201", "CS201", "CS230", "GE202"] },
      { year: 2, term: 2, courses: ["CS202", "CS220", "CSELE1"] },
      { year: 3, term: 1, courses: ["CS301", "CS310", "CS320"] },
      { year: 3, term: 2, courses: ["CS330", "CS398"] },
      { year: 4, term: 1, courses: ["CS401"] },
      { year: 4, term: 2, courses: ["CS402"] },
    ],
  },
  {
    id: "it",
    code: "วท.บ. เทคโนโลยีสารสนเทศ",
    nameEn: "B.Sc. in Information Technology",
    revisionYear: 2565,
    faculty: "คณะวิทยาศาสตร์และเทคโนโลยี",
    duration: "หลักสูตร 4 ปี",
    totalCredits: 129,
    summary:
      "เน้นการประยุกต์ใช้เทคโนโลยีสารสนเทศเพื่อสนับสนุนการดำเนินงานขององค์กร ครอบคลุมการจัดการฐานข้อมูล เครือข่าย และการบริหารโครงการไอที",
    structure: [
      { label: "หมวดวิชาศึกษาทั่วไป", credits: 30 },
      { label: "หมวดวิชาเฉพาะ – แกน", credits: 33 },
      { label: "หมวดวิชาเฉพาะ – บังคับ", credits: 42 },
      { label: "หมวดวิชาเฉพาะ – เลือก", credits: 15 },
      { label: "หมวดวิชาเลือกเสรี", credits: 9 },
    ],
    conditions: [
      "ศึกษารายวิชาครบตามโครงสร้างหลักสูตร ไม่น้อยกว่า 129 หน่วยกิต",
      "ได้ค่าระดับคะแนนเฉลี่ยสะสมตลอดหลักสูตรไม่ต่ำกว่า 2.00",
      "ผ่านสหกิจศึกษาไม่น้อยกว่า 16 สัปดาห์",
      "ผ่านเกณฑ์ทดสอบความรู้ภาษาอังกฤษตามที่มหาวิทยาลัยกำหนด",
      "ไม่มีภาระหนี้สินค้างชำระกับมหาวิทยาลัย ณ วันยื่นขอสำเร็จการศึกษา",
    ],
    plan: [
      { year: 1, term: 1, courses: ["GE101", "GE102", "MATH101", "IT101", "CS101"] },
      { year: 1, term: 2, courses: ["GE103", "GE201", "MATH102", "CS102", "CS210"] },
      { year: 2, term: 1, courses: ["MATH201", "STAT201", "IT210", "CS230", "GE202"] },
      { year: 2, term: 2, courses: ["IT201", "CS202"] },
      { year: 3, term: 1, courses: ["IT301", "CS320"] },
      { year: 3, term: 2, courses: ["IT398"] },
    ],
  },
];

const FAQS = [
  { category: "หลักสูตรทั่วไป", q: "หลักสูตรวิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศต่างกันอย่างไร", a: "วิทยาการคอมพิวเตอร์เน้นพื้นฐานเชิงทฤษฎีและการพัฒนาซอฟต์แวร์เชิงลึก เช่น อัลกอริทึมและปัญญาประดิษฐ์ ส่วนเทคโนโลยีสารสนเทศเน้นการประยุกต์ใช้ระบบสารสนเทศและโครงสร้างพื้นฐานไอทีในองค์กร" },
  { category: "หลักสูตรทั่วไป", q: "หลักสูตรปรับปรุงปี 2565 ต่างจากหลักสูตรเดิมอย่างไร", a: "หลักสูตรปรับปรุงเพิ่มรายวิชาด้านความมั่นคงปลอดภัยไซเบอร์และปัญญาประดิษฐ์เป็นวิชาบังคับ พร้อมปรับโครงสร้างหน่วยกิตหมวดวิชาเลือกให้ยืดหยุ่นขึ้น" },
  { category: "การลงทะเบียนเรียน", q: "หากสอบตกวิชาที่เป็นวิชาบังคับก่อน จะลงทะเบียนวิชาถัดไปได้หรือไม่", a: "ไม่ได้ ระบบทะเบียนจะปฏิเสธการลงทะเบียนวิชาที่มีวิชาบังคับก่อนโดยอัตโนมัติ จนกว่าจะสอบผ่านวิชาบังคับก่อนนั้น ยกเว้นได้รับอนุมัติเป็นกรณีพิเศษจากอาจารย์ผู้รับผิดชอบหลักสูตร" },
  { category: "การลงทะเบียนเรียน", q: "สามารถลงทะเบียนเรียนล่วงหน้าก่อนถึงชั้นปีที่กำหนดในแผนการเรียนได้หรือไม่", a: "สามารถทำได้หากมีคุณสมบัติครบตามวิชาบังคับก่อนของรายวิชานั้น และไม่ขัดกับตารางสอนของภาคการศึกษา ควรปรึกษาอาจารย์ที่ปรึกษาก่อนลงทะเบียน" },
  { category: "การสำเร็จการศึกษา", q: "ต้องฝึกงานหรือสหกิจศึกษากี่ชั่วโมงจึงจะสำเร็จการศึกษาได้", a: "หลักสูตรวิทยาการคอมพิวเตอร์กำหนดไม่น้อยกว่า 300 ชั่วโมง ส่วนหลักสูตรเทคโนโลยีสารสนเทศกำหนดสหกิจศึกษาไม่น้อยกว่า 16 สัปดาห์ ทั้งนี้ขึ้นอยู่กับเงื่อนไขของแต่ละหลักสูตร" },
  { category: "การสำเร็จการศึกษา", q: "เกรดเฉลี่ยสะสมต้องไม่ต่ำกว่าเท่าใดจึงจะสำเร็จการศึกษาได้", a: "ทุกหลักสูตรกำหนดเกณฑ์ค่าระดับคะแนนเฉลี่ยสะสมตลอดหลักสูตรไม่ต่ำกว่า 2.00 ตามข้อบังคับของมหาวิทยาลัยว่าด้วยการศึกษาระดับปริญญาตรี" },
  { category: "การสำเร็จการศึกษา", q: "ต้องการตรวจสอบสถานะการสำเร็จการศึกษาของตนเองแบบละเอียด ต้องทำอย่างไร", a: "การตรวจสอบสถานะรายบุคคลโดยใช้ข้อมูลจริงจากสำนักทะเบียนต้องเข้าสู่ระบบด้วยบัญชีนักศึกษา ซึ่งจะเปิดให้ใช้งานในระยะถัดไปของระบบ" },
  { category: "การโอนหน่วยกิต", q: "นักศึกษาที่มีผลการเรียนจากสถาบันอื่นสามารถโอนหน่วยกิตได้หรือไม่", a: "สามารถทำได้ตามระเบียบการเทียบโอนรายวิชาของมหาวิทยาลัย โดยรายวิชาที่ขอโอนต้องมีเนื้อหาและหน่วยกิตใกล้เคียงกับรายวิชาในหลักสูตร และต้องยื่นคำร้องผ่านเจ้าหน้าที่ฝ่ายวิชาการของคณะ" },
];


const state = { view:'home', programId:null, courseCode:null, navOpen:false, programTab:'overview', year:1, courseQuery:'', programFilter:'all', noPrereqOnly:false, faqQuery:'', openFaq:null, homeQuery:'' };
const icon=(name,size=18,cls='')=>`<i data-lucide="${name}" width="${size}" height="${size}" class="${cls}"></i>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>(s||'').toString().toLowerCase();
function findUnlocks(code){return Object.entries(COURSES).filter(([,c])=>c.prereq.includes(code)).map(([k])=>k)}
function programsContaining(code){return PROGRAMS.filter(p=>p.plan.some(t=>t.courses.includes(code)))}
function seal(year){return `<div class="seal"><span class="seal-ring"></span><span class="seal-year">${year}</span><span class="seal-label">ปรับปรุง</span></div>`}
function chip(text,tone='ink'){return `<span class="chip chip-${tone}">${esc(text)}</span>`}
function courseCode(code){return `<span class="course-code">${esc(code)}</span>`}
function crumbs(items){return `<div class="crumbs">${items.map((it,i)=>`<span class="crumb-item">${i?icon('chevron-right',13,'crumb-sep'):''}${it.view?`<button class="crumb-link" data-go="${it.view}" ${it.id?`data-id="${it.id}"`:''}>${esc(it.label)}</button>`:`<span class="crumb-current">${esc(it.label)}</span>`}</span>`).join('')}</div>`}
function programCard(p){return `<button class="program-card" data-go="program" data-id="${p.id}">${seal(p.revisionYear)}<div class="program-card-body"><div class="program-card-faculty">${esc(p.faculty)}</div><h3>${esc(p.code)}</h3><div class="program-card-en">${esc(p.nameEn)}</div><div class="program-card-stats"><span>${icon('graduation-cap',14)} ${esc(p.duration)}</span><span>${courseCode(p.totalCredits+' นก.')}</span></div></div>${icon('chevron-right',18,'program-card-chevron')}</button>`}
function renderHome(){let q=state.homeQuery.trim(), results=[];if(q){let x=norm(q);PROGRAMS.forEach(p=>{if(norm(p.code+p.nameEn).includes(x))results.push(['หลักสูตร',p.code,'program',p.id])});Object.entries(COURSES).forEach(([code,c])=>{if(norm(code+c.name+c.nameEn).includes(x))results.push(['รายวิชา',`${code} · ${c.name}`,'course',code])});FAQS.forEach((f,i)=>{if(norm(f.q).includes(x))results.push(['คำถาม',f.q,'faq',''])});results=results.slice(0,6)}return `<div><section class="hero"><div class="hero-inner"><div class="hero-eyebrow">${icon('compass',15)} ศูนย์ข้อมูลหลักสูตรกลาง</div><h1 class="hero-title">รู้เส้นทางวิชา<br>ก่อนก้าวเดินแต่ละเทอม</h1><p class="hero-sub">ค้นหลักสูตร แผนการเรียน รายวิชา วิชาบังคับก่อน และเงื่อนไขการสำเร็จการศึกษา ในที่เดียว — เข้าถึงได้ทันทีโดยไม่ต้องเข้าสู่ระบบ</p><div class="hero-search">${icon('search',18,'hero-search-icon')}<input id="homeSearch" value="${esc(state.homeQuery)}" placeholder="ค้นหาหลักสูตร รายวิชา หรือคำถาม เช่น “CS201” หรือ “ฝึกงาน”"></div>${results.length?`<div class="hero-results">${results.map(r=>`<button class="hero-result-row" data-go="${r[2]}" data-id="${r[3]}"><span class="hero-result-type">${r[0]}</span><span class="hero-result-label">${esc(r[1])}</span>${icon('chevron-right',15)}</button>`).join('')}</div>`:''}</div></section><section class="section"><div class="section-head"><h2>หลักสูตรที่เปิดสอน</h2><button class="link-btn" data-go="programs">ดูทั้งหมด ${icon('arrow-right',14)}</button></div><div class="program-grid">${PROGRAMS.map(programCard).join('')}</div></section><section class="section quick-links"><button class="quick-card" data-go="courses">${icon('book-open',22)}<div><div class="quick-card-title">ค้นหารายวิชา</div><div class="quick-card-sub">กรองตามหลักสูตร หมวดวิชา หรือวิชาบังคับก่อน</div></div>${icon('chevron-right',18)}</button><button class="quick-card" data-go="faq">${icon('circle-help',22)}<div><div class="quick-card-title">คำถามที่พบบ่อย</div><div class="quick-card-sub">รวมคำตอบเรื่องการลงทะเบียนและการสำเร็จการศึกษา</div></div>${icon('chevron-right',18)}</button></section></div>`}
function renderPrograms(){return `<div class="page">${crumbs([{label:'หน้าแรก',view:'home'},{label:'หลักสูตรทั้งหมด'}])}<h1 class="page-title">หลักสูตรที่เปิดสอน</h1><p class="page-sub">ข้อมูลโครงสร้างหลักสูตร แผนการเรียน และเงื่อนไขการสำเร็จการศึกษาของแต่ละหลักสูตร</p><div class="program-grid program-grid--wide">${PROGRAMS.map(programCard).join('')}</div></div>`}
function renderProgram(){const p=PROGRAMS.find(x=>x.id===state.programId)||PROGRAMS[0], years=[...new Set(p.plan.map(t=>t.year))], terms=p.plan.filter(t=>t.year===state.year); if(!years.includes(state.year))state.year=years[0]; let content='';if(state.programTab==='overview')content=`<div class="panel"><p class="program-summary">${p.summary}</p><div class="stat-row"><div class="stat-box"><div class="stat-num">${p.totalCredits}</div><div class="stat-label">หน่วยกิตรวม</div></div><div class="stat-box"><div class="stat-num">${(p.duration.match(/\d+/)||['4'])[0]}</div><div class="stat-label">ปีการศึกษา</div></div><div class="stat-box"><div class="stat-num">${p.plan.length}</div><div class="stat-label">ภาคการศึกษาในแผน</div></div></div><h3 class="panel-subhead">โครงสร้างหน่วยกิต</h3><div class="structure">${p.structure.map(s=>`<div class="structure-row"><div class="structure-label">${s.label}</div><div class="structure-track"><div class="structure-fill" style="width:${s.credits/p.totalCredits*100}%"></div></div><div class="structure-value">${s.credits} นก.</div></div>`).join('')}</div></div>`;else if(state.programTab==='plan')content=`<div class="panel"><div class="year-tabs">${years.map(y=>`<button class="year-tab ${state.year===y?'year-tab--active':''}" data-year="${y}">ชั้นปีที่ ${y}</button>`).join('')}</div><div class="term-grid">${terms.map(t=>{let total=t.courses.reduce((s,c)=>s+(COURSES[c]?.credits||0),0);return `<div class="term-card"><div class="term-card-head"><span>ภาคการศึกษาที่ ${t.term}</span><span class="term-card-credits">${total} นก.</span></div><div class="term-course-list">${t.courses.map(c=>`<button class="term-course-row" data-go="course" data-id="${c}">${courseCode(c)}<span class="term-course-name">${COURSES[c]?.name||c}</span><span class="term-course-cr">${COURSES[c]?.credits??'–'} นก.</span></button>`).join('')}</div></div>`}).join('')}</div></div>`;else content=`<div class="panel"><div class="conditions-list">${p.conditions.map(c=>`<div class="condition-row"><span class="condition-check">${icon('check',13)}</span><span>${esc(c)}</span></div>`).join('')}</div><div class="note-banner">การตรวจสอบสถานะรายบุคคลด้วยข้อมูลจริงจากสำนักทะเบียนจะเปิดให้ใช้งานสำหรับนักศึกษา อาจารย์ และเจ้าหน้าที่ที่เข้าสู่ระบบ ในระยะถัดไป</div></div>`;return `<div class="page">${crumbs([{label:'หน้าแรก',view:'home'},{label:'หลักสูตรทั้งหมด',view:'programs'},{label:p.code}])}<div class="program-header">${seal(p.revisionYear)}<div><div class="program-header-faculty">${p.faculty}</div><h1 class="page-title">${p.code}</h1><div class="program-header-en">${p.nameEn}</div></div></div><div class="tabs">${[['overview','ภาพรวม'],['plan','แผนการเรียน'],['grad','เงื่อนไขการสำเร็จการศึกษา']].map(([id,l])=>`<button class="tab ${state.programTab===id?'tab--active':''}" data-tab="${id}">${l}</button>`).join('')}</div>${content}</div>`}
function renderCourses(){const list=Object.entries(COURSES).filter(([code,c])=>{if(state.noPrereqOnly&&c.prereq.length)return false;if(state.programFilter!=='all'&&!PROGRAMS.find(p=>p.id===state.programFilter)?.plan.some(t=>t.courses.includes(code)))return false;return !state.courseQuery.trim()||norm(code+c.name+c.nameEn).includes(norm(state.courseQuery))});return `<div class="page">${crumbs([{label:'หน้าแรก',view:'home'},{label:'ค้นหารายวิชา'}])}<h1 class="page-title">ค้นหารายวิชา</h1><p class="page-sub">พบทั้งหมด ${Object.keys(COURSES).length} รายวิชา จากหลักสูตรที่เปิดสอน</p><div class="filter-bar"><div class="hero-search hero-search--compact">${icon('search',16,'hero-search-icon')}<input id="courseSearch" value="${esc(state.courseQuery)}" placeholder="ค้นหาด้วยรหัสวิชาหรือชื่อวิชา"></div><select id="programFilter" class="select"><option value="all">ทุกหลักสูตร</option>${PROGRAMS.map(p=>`<option value="${p.id}" ${state.programFilter===p.id?'selected':''}>${p.code}</option>`).join('')}</select><label class="checkbox-pill"><input id="noPrereq" type="checkbox" ${state.noPrereqOnly?'checked':''}>${icon('list-filter',14)} ไม่มีวิชาบังคับก่อน</label></div><div class="course-grid">${list.map(([code,c])=>`<button class="course-card" data-go="course" data-id="${code}"><div class="course-card-top">${courseCode(code)}${chip(c.credits+' นก.','brass')}</div><div class="course-card-name">${c.name}</div><div class="course-card-en">${c.nameEn}</div><div class="course-card-foot">${chip(c.category)}<span class="course-card-prereq ${c.prereq.length?'':'course-card-prereq--none'}">${c.prereq.length?'มีวิชาบังคับก่อน':'ไม่มีวิชาบังคับก่อน'}</span></div></button>`).join('')}${!list.length?'<div class="empty-state">ไม่พบรายวิชาที่ตรงกับเงื่อนไขการค้นหา ลองปรับตัวกรองอีกครั้ง</div>':''}</div></div>`}
function renderCourse(){const code=state.courseCode||'CS101',c=COURSES[code],ps=programsContaining(code), prereqs=c.prereq,unlocks=findUnlocks(code);return `<div class="page">${crumbs([{label:'หน้าแรก',view:'home'},{label:'ค้นหารายวิชา',view:'courses'},{label:code}])}<div class="course-detail-head"><div>${courseCode(code)}<h1 class="page-title" style="margin-top:8px">${c.name}</h1><div class="program-header-en">${c.nameEn}</div></div><div class="course-detail-meta">${chip(c.credits+' หน่วยกิต','brass')}${chip(c.category)}</div></div><p class="program-summary">${c.desc}</p><div class="meta-grid"><div class="meta-box"><div class="meta-label">เปิดสอน</div><div class="meta-value">${c.term}</div></div><div class="meta-box"><div class="meta-label">อยู่ในหลักสูตร</div><div class="meta-value">${ps.length?ps.map(p=>`<div>${p.code}</div>`).join(''):'—'}</div></div></div><h3 class="panel-subhead">เส้นทางรายวิชา</h3><div class="chain"><div class="chain-lane"><div class="chain-lane-label">ต้องผ่านมาก่อน</div><div class="chain-nodes">${prereqs.length?prereqs.map(p=>COURSES[p]?`<div class="chain-node"><div class="chain-node-code">${p}</div><div class="chain-node-name">${COURSES[p].name}</div></div>`:`<div class="chain-node chain-node--condition">${p}</div>`).join(''):'<div class="chain-node chain-node--empty">ไม่มีวิชาบังคับก่อน</div>'}</div></div><div class="chain-arrow">${icon('arrow-right',20)}</div><div class="chain-lane chain-lane--current"><div class="chain-lane-label">รายวิชานี้</div><div class="chain-node chain-node--current"><div class="chain-node-code">${code}</div><div class="chain-node-name">${c.name}</div></div></div><div class="chain-arrow">${icon('arrow-right',20)}</div><div class="chain-lane"><div class="chain-lane-label">ปลดล็อกวิชาถัดไป</div><div class="chain-nodes">${unlocks.length?unlocks.map(u=>`<div class="chain-node chain-node--future"><div class="chain-node-code">${u}</div><div class="chain-node-name">${COURSES[u].name}</div></div>`).join(''):'<div class="chain-node chain-node--empty">ยังไม่มีวิชาที่ต่อยอด</div>'}</div></div></div></div>`}
function renderFaq(){const grouped={};FAQS.filter(f=>norm(f.q+f.a).includes(norm(state.faqQuery))).forEach(f=>(grouped[f.category]??=[]).push(f));return `<div class="page">${crumbs([{label:'หน้าแรก',view:'home'},{label:'คำถามที่พบบ่อย'}])}<h1 class="page-title">คำถามที่พบบ่อย</h1><p class="page-sub">รวมคำตอบเกี่ยวกับหลักสูตร การลงทะเบียน และการสำเร็จการศึกษาที่มีผู้สอบถามบ่อย</p><div class="hero-search hero-search--compact" style="margin-bottom:28px">${icon('search',16,'hero-search-icon')}<input id="faqSearch" value="${esc(state.faqQuery)}" placeholder="พิมพ์คำถาม เช่น “ฝึกงาน” หรือ “เกรดเฉลี่ย”"></div>${Object.keys(grouped).length?Object.entries(grouped).map(([cat,items])=>`<div class="faq-group"><div class="faq-group-title">${cat}</div>${items.map((f,i)=>{let k=cat+i,o=state.openFaq===k;return `<div class="faq-item"><button class="faq-question" data-faq="${esc(k)}"><span>${f.q}</span>${icon('chevron-down',16,`faq-chevron ${o?'faq-chevron--open':''}`)}</button>${o?`<div class="faq-answer">${f.a}</div>`:''}</div>`}).join('')}</div>`).join(''):'<div class="empty-state">ไม่พบคำถามที่ตรงกับคำค้นหา ลองใช้คำอื่น</div>'}</div>`}
function shell(content){const active=id=>state.view===id||(id==='programs'&&state.view==='program')||(id==='courses'&&state.view==='course');const nav=[['home','หน้าแรก'],['programs','หลักสูตร'],['courses','ค้นหารายวิชา'],['faq','คำถามที่พบบ่อย']];return `<header class="topbar"><button class="brand" data-go="home">${icon('compass',22)}<span>เข็มทิศหลักสูตร</span></button><nav class="topnav">${nav.map(([id,l])=>`<button class="topnav-item ${active(id)?'topnav-item--active':''}" data-go="${id}">${l}</button>`).join('')}</nav><button class="menu-btn" id="menuBtn" aria-label="เมนู">${icon(state.navOpen?'x':'menu',20)}</button>${state.navOpen?`<div class="mobile-nav">${nav.map(([id,l])=>`<button class="mobile-nav-item" data-go="${id}">${l}</button>`).join('')}</div>`:''}</header><main class="main">${content}</main><footer class="footer"><div>${icon('compass',16)} เข็มทิศหลักสูตร — ศูนย์ข้อมูลหลักสูตรกลาง</div><div class="footer-note">ข้อมูลในหน้านี้เปิดให้เข้าถึงแบบสาธารณะ ไม่ต้องเข้าสู่ระบบ · ระยะถัดไปจะเปิดให้ตรวจสอบสถานะรายบุคคลด้วยข้อมูลจากสำนักทะเบียน</div></footer>`}
function render(){let page={home:renderHome,programs:renderPrograms,program:renderProgram,courses:renderCourses,course:renderCourse,faq:renderFaq}[state.view]();document.getElementById('app').innerHTML=shell(page);if(window.lucide)lucide.createIcons();bind()}
function go(v,id){state.view=v;if(v==='program')state.programId=id;if(v==='course')state.courseCode=id;state.navOpen=false;window.scrollTo({top:0,behavior:'smooth'});render()}
function bind(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go,b.dataset.id));const menu=document.getElementById('menuBtn');if(menu)menu.onclick=()=>{state.navOpen=!state.navOpen;render()};const hs=document.getElementById('homeSearch');if(hs)hs.oninput=e=>{state.homeQuery=e.target.value;render()};const cs=document.getElementById('courseSearch');if(cs)cs.oninput=e=>{state.courseQuery=e.target.value;render()};const pf=document.getElementById('programFilter');if(pf)pf.onchange=e=>{state.programFilter=e.target.value;render()};const np=document.getElementById('noPrereq');if(np)np.onchange=e=>{state.noPrereqOnly=e.target.checked;render()};const fs=document.getElementById('faqSearch');if(fs)fs.oninput=e=>{state.faqQuery=e.target.value;render()};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.programTab=b.dataset.tab;render()});document.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{state.year=Number(b.dataset.year);render()});document.querySelectorAll('[data-faq]').forEach(b=>b.onclick=()=>{state.openFaq=state.openFaq===b.dataset.faq?null:b.dataset.faq;render()})}
render();
