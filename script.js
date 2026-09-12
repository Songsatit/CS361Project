/* =========================================================
   CURRICULUM COMPASS
   Real curriculum data - Thammasat University

   Sources:
   - B.Sc. Computer Science, Curriculum 2023
   - B.Sc. Computer Networks and Cybersecurity, Curriculum 2025
   ========================================================= */


/* =========================================================
   COURSE DATA
   ========================================================= */

const COURSES = {

  /* =========================
     GENERAL EDUCATION
     ========================= */

  "TU101": {
    name: "โลก, อาเซียน และไทย",
    nameEn: "Thailand, ASEAN, and the World",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "ศึกษาความสัมพันธ์ของประเทศไทย อาเซียน และโลกในบริบททางสังคม เศรษฐกิจ และการเปลี่ยนแปลงของโลก"
  },

  "TU100": {
    name: "พลเมืองกับการลงมือแก้ปัญหา",
    nameEn: "Civic Engagement",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "การเรียนรู้ผ่านการมีส่วนร่วมและการลงมือแก้ปัญหาที่เกี่ยวข้องกับสังคม"
  },

  "TU103": {
    name: "ชีวิตกับความยั่งยืน",
    nameEn: "Life and Sustainability",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "ความสัมพันธ์ระหว่างมนุษย์ ธรรมชาติ สิ่งแวดล้อม พลังงาน เศรษฐกิจ และสังคมเพื่อการดำเนินชีวิตอย่างยั่งยืน"
  },

  "TU107": {
    name: "ทักษะดิจิทัลกับการแก้ปัญหา",
    nameEn: "Digital Skill and Problem Solving",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พัฒนาทักษะดิจิทัลและการใช้เทคโนโลยีเพื่อการแก้ปัญหา"
  },

  "TU108": {
    name: "การพัฒนาและจัดการตนเอง",
    nameEn: "Self-Development and Management",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "การพัฒนาตนเอง การจัดการเวลา และการเตรียมความพร้อมสำหรับการเรียนและการทำงาน"
  },

  "TU109": {
    name: "นวัตกรรมกับกระบวนคิดผู้ประกอบการ",
    nameEn: "Innovation and Entrepreneurial Mindset",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "แนวคิดผู้ประกอบการ การประเมินความเสี่ยง การสร้างโอกาสใหม่ การตัดสินใจ และการพัฒนาธุรกิจ"
  },

  "TU201": {
    name: "ความรู้ทางการเงินสำหรับบุคคล",
    nameEn: "Financial Literacy for Individuals",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พื้นฐานความรู้ทางการเงินสำหรับการบริหารจัดการทางการเงินส่วนบุคคล"
  },

  "TU202": {
    name: "ครบเครื่องเรื่องลงทุน",
    nameEn: "Complete Investment",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "แนวคิดและหลักการพื้นฐานเกี่ยวกับการลงทุน"
  },

  "TU301": {
    name: "การลงทุนในตลาดหลักทรัพย์ฯ",
    nameEn: "Investment in the Stock Market",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พื้นฐานการลงทุนและการวิเคราะห์การลงทุนในตลาดหลักทรัพย์"
  },

  "EL105": {
    name: "ทักษะการสื่อสารทางภาษาอังกฤษ",
    nameEn: "English Communication Skills",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พัฒนาทักษะการฟัง พูด อ่าน และเขียนภาษาอังกฤษในบริบททางวิชาการและสังคม"
  },

  "LAS101": {
    name: "การคิด อ่าน และเขียนอย่างมีวิจารณญาณ",
    nameEn: "Critical Thinking, Reading, and Writing",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พัฒนาการคิดเชิงวิพากษ์ การอ่าน การวิเคราะห์ และการเขียนอย่างมีเหตุผล"
  },

  "EL295": {
    name: "ภาษาอังกฤษเชิงวิชาการและทักษะศึกษา 1",
    nameEn: "Academic English and Study Skills 1",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พัฒนาทักษะภาษาอังกฤษเชิงวิชาการและทักษะการเรียน"
  },

  "EL395": {
    name: "ภาษาอังกฤษเชิงวิชาการและทักษะการศึกษา 2",
    nameEn: "Academic English and Study Skills 2",
    credits: 3,
    category: "บังคับนอกสาขา",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พัฒนาทักษะภาษาอังกฤษเชิงวิชาการและทักษะการศึกษาในระดับต่อเนื่อง"
  },

  "SC207": {
    name: "สังคมคาร์บอนต่ำที่มีความยั่งยืน",
    nameEn: "Low Carbon Society with Sustainability",
    credits: 3,
    category: "ศึกษาทั่วไป",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "แนวคิดสังคมคาร์บอนต่ำ พลังงานทางเลือก การจัดการขยะ เศรษฐกิจหมุนเวียน และความเป็นกลางทางคาร์บอน"
  },


  /* =====================================================
     COMPUTER SCIENCE - 2023
     ===================================================== */

  "CS100": {
    name: "การพัฒนาเว็บแอปพลิเคชันเบื้องต้น",
    nameEn: "Basic Web Development",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ตามแผนการศึกษา",
    desc: "พื้นฐานการพัฒนาเว็บ HTML, CSS, JavaScript วงจรการพัฒนา และการนำเว็บขึ้นใช้งาน"
  },

  "CS101": {
    name: "โครงสร้างแบบไม่ต่อเนื่อง",
    nameEn: "Discrete Structures",
    credits: 3,
    category: "วิชาแกน",
    prereq: [],
    term: "ปี 1",
    desc: "ตรรกศาสตร์ เซต ฟังก์ชัน ความสัมพันธ์ พีชคณิตบูลีน การนับ และกราฟ โดยเน้นการประยุกต์ใช้ในวิทยาการคอมพิวเตอร์"
  },

  "CS102": {
    name: "พื้นฐานการแก้ปัญหาและการโปรแกรมคอมพิวเตอร์",
    nameEn: "Problem Solving Basics and Computer Programming",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 1",
    desc: "การแก้ปัญหาด้วยวิธีการทางคอมพิวเตอร์ การออกแบบและการโปรแกรมเชิงโครงสร้าง ชนิดข้อมูล ฟังก์ชัน การทดสอบ และการตรวจหาข้อผิดพลาด"
  },

  "CS111": {
    name: "แนวคิดเชิงวัตถุ",
    nameEn: "Object-Oriented Concepts",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: ["CS102"],
    term: "ปี 1",
    desc: "แนวคิดเชิงวัตถุ คลาส วัตถุ และแนวทางการพัฒนาซอฟต์แวร์ โดยมีวิชาบังคับก่อนเป็น คพ.102 หรือ คพ.103"
  },

  "CS180": {
    name: "ส่วนต่อประสานและประสบการณ์ผู้ใช้เบื้องต้น",
    nameEn: "Introduction to User Interface and User Experience",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 1",
    desc: "พื้นฐานส่วนต่อประสานผู้ใช้และประสบการณ์ผู้ใช้"
  },

  "CS213": {
    name: "โครงสร้างข้อมูล",
    nameEn: "Data Structures",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "โครงสร้างข้อมูลและการจัดการข้อมูลเพื่อใช้ในการพัฒนาโปรแกรม"
  },

  "CS216": {
    name: "โครงสร้างข้อมูลและขั้นตอนวิธี",
    nameEn: "Data Structures and Algorithms",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "โครงสร้างข้อมูลและขั้นตอนวิธีสำหรับการแก้ปัญหาทางคอมพิวเตอร์"
  },

  "CS217": {
    name: "การออกแบบและวิเคราะห์ขั้นตอนวิธี",
    nameEn: "Design and Analysis of Algorithms",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "การออกแบบและวิเคราะห์ประสิทธิภาพของขั้นตอนวิธี"
  },

  "CS221": {
    name: "โครงสร้างและระบบคอมพิวเตอร์เบื้องต้น",
    nameEn: "Introduction to Computer System and Organization",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานโครงสร้างและองค์ประกอบของระบบคอมพิวเตอร์"
  },

  "CS222": {
    name: "ระบบปฏิบัติการ",
    nameEn: "Operating Systems",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "หลักการและองค์ประกอบของระบบปฏิบัติการ"
  },

  "CS223": {
    name: "เทคโนโลยีจำลองสภาพแวดล้อมเสมือน",
    nameEn: "Virtualization Technology",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "แนวคิดและเทคโนโลยีการจำลองสภาพแวดล้อมเสมือน"
  },

  "CS232": {
    name: "เทคโนโลยีกลุ่มเมฆเบื้องต้น",
    nameEn: "Introduction to Cloud Computing Technology",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานเทคโนโลยี Cloud Computing และการประยุกต์ใช้"
  },

  "CS233": {
    name: "สถาปัตยกรรมคอมพิวเตอร์และระบบปฏิบัติการ",
    nameEn: "Computer Architecture and Operating Systems",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "สถาปัตยกรรมคอมพิวเตอร์และระบบปฏิบัติการ สำหรับวิชาเอกคอมพิวเตอร์ประยุกต์"
  },

  "CS240": {
    name: "หลักการวิทยาการข้อมูล",
    nameEn: "Principles of Data Science",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานแนวคิดและกระบวนการทางวิทยาการข้อมูล"
  },

  "CS241": {
    name: "ภาษาโปรแกรมและกรอบความคิด",
    nameEn: "Programming Languages and Paradigms",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "ภาษาโปรแกรมและแนวคิดกรอบความคิดในการเขียนโปรแกรม"
  },

  "CS242": {
    name: "ภาษาไพทอนและการประยุกต์",
    nameEn: "Python Programming and Applications",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "การเขียนโปรแกรมภาษา Python และการประยุกต์ใช้"
  },

  "CS251": {
    name: "ระบบฐานข้อมูล 1",
    nameEn: "Database Systems 1",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานระบบฐานข้อมูลและการจัดการข้อมูล"
  },

  "CS261": {
    name: "วิศวกรรมซอฟต์แวร์เบื้องต้น",
    nameEn: "Introduction to Software Engineering",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานกระบวนการพัฒนาซอฟต์แวร์และวิศวกรรมซอฟต์แวร์"
  },

  "CS262": {
    name: "การทดสอบซอฟต์แวร์เบื้องต้น",
    nameEn: "Introduction to Software Testing",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 2",
    desc: "หลักการและเทคนิคพื้นฐานในการทดสอบซอฟต์แวร์"
  },

  "CS263": {
    name: "การกำหนดความต้องการทางซอฟต์แวร์",
    nameEn: "Software Requirement Specification",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "การวิเคราะห์และกำหนดความต้องการของซอฟต์แวร์"
  },

  "CS264": {
    name: "ความปลอดภัยทางซอฟต์แวร์และความเป็นส่วนตัวของข้อมูล",
    nameEn: "Software Security and Data Privacy",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "ความปลอดภัยของซอฟต์แวร์และการคุ้มครองความเป็นส่วนตัวของข้อมูล"
  },

  "CS271": {
    name: "ปัญญาประดิษฐ์เบื้องต้น",
    nameEn: "Artificial Intelligence Fundamentals",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานปัญญาประดิษฐ์และการประยุกต์ใช้"
  },

  "CS301": {
    name: "การเตรียมความพร้อมสำหรับโครงงานพิเศษและสหกิจศึกษา",
    nameEn: "Preparation for Senior Projects and Co-operative Education",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 3",
    desc: "การเตรียมความพร้อมสำหรับโครงงานพิเศษและสหกิจศึกษา"
  },

  "CS303": {
    name: "โครงงานพิเศษ 1",
    nameEn: "Special Projects 1",
    credits: 2,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 3-4",
    desc: "โครงงานพิเศษระยะที่ 1"
  },

  "CS304": {
    name: "สหกิจศึกษา 1",
    nameEn: "Co-operative Education 1",
    credits: 2,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ภาคฤดูร้อน",
    desc: "สหกิจศึกษา 1"
  },

  "CS305": {
    name: "จรรยาบรรณทางวิชาชีพและเชิงสังคม",
    nameEn: "Social and Professional Ethics",
    credits: 3,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 3",
    desc: "จริยธรรมทางวิชาชีพและผลกระทบทางสังคมของเทคโนโลยี"
  },

  "CS361": {
    name: "สถาปัตยกรรมซอฟต์แวร์บนคลาวด์",
    nameEn: "Cloud-Based Software Architecting",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "การออกแบบสถาปัตยกรรมซอฟต์แวร์บนระบบคลาวด์"
  },

  "CS362": {
    name: "การออกแบบซอฟต์แวร์และระบบ",
    nameEn: "Software System and Design",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "การออกแบบซอฟต์แวร์และระบบ"
  },

  "CS363": {
    name: "โครงงานทางวิศวกรรมซอฟต์แวร์",
    nameEn: "Software Engineering Project",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "การทำโครงงานด้านวิศวกรรมซอฟต์แวร์"
  },

  "CS364": {
    name: "การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์พกพา",
    nameEn: "Mobile Application Development",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "การพัฒนาโปรแกรมประยุกต์สำหรับอุปกรณ์พกพา"
  },

  "CS367": {
    name: "แนวคิดการพัฒนาเว็บบริการ",
    nameEn: "Web Service Development Concepts",
    credits: 3,
    category: "วิชาเอก",
    prereq: [],
    term: "ปี 3",
    desc: "แนวคิดและการพัฒนา Web Service"
  },

  "CS403": {
    name: "โครงงานพิเศษ 2",
    nameEn: "Special Projects 2",
    credits: 4,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 4",
    desc: "โครงงานพิเศษระยะที่ 2"
  },

  "CS404": {
    name: "สหกิจศึกษา 2",
    nameEn: "Co-operative Education 2",
    credits: 4,
    category: "วิชาเฉพาะด้าน",
    prereq: [],
    term: "ปี 4",
    desc: "สหกิจศึกษา 2"
  },


  /* =====================================================
     COMPUTER NETWORKS AND CYBERSECURITY - 2025
     ===================================================== */

  "CNC101": {
    name: "การคิดอย่างมีวิจารณญาณและการแก้ปัญหาอย่างเป็นระบบ",
    nameEn: "Critical Thinking and Systematic Problem Solving",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "การคิดอย่างมีวิจารณญาณและการแก้ปัญหาอย่างเป็นระบบ"
  },

  "CNC102": {
    name: "พื้นฐานการเขียนโปรแกรม",
    nameEn: "Programming Fundamentals",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "พื้นฐานการเขียนโปรแกรม"
  },

  "CNC103": {
    name: "พื้นฐานของระบบคอมพิวเตอร์",
    nameEn: "Foundation of Computer Systems",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "พื้นฐานระบบคอมพิวเตอร์"
  },

  "CNC104": {
    name: "การเขียนโปรแกรมไพธอนเบื้องต้น",
    nameEn: "Basic Python Programming",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "พื้นฐานการเขียนโปรแกรมด้วยภาษา Python"
  },

  "CNC105": {
    name: "การจัดการระบบคอมพิวเตอร์",
    nameEn: "Computer System Management",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "การจัดการระบบคอมพิวเตอร์"
  },

  "CNC111": {
    name: "การเขียนโปรแกรมเชิงวัตถุและโครงสร้างข้อมูล",
    nameEn: "Object-Oriented Programming and Data Structures",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 1",
    desc: "การเขียนโปรแกรมเชิงวัตถุและโครงสร้างข้อมูล"
  },

  "CNC201": {
    name: "คณิตศาสตร์และสถิติสำหรับคอมพิวเตอร์เครือข่ายและความปลอดภัยไซเบอร์",
    nameEn: "Mathematics and Statistics for Computer Networks and Cybersecurity",
    credits: 3,
    category: "พื้นฐานด้านคณิตศาสตร์",
    prereq: [],
    term: "ปี 2",
    desc: "คณิตศาสตร์และสถิติสำหรับคอมพิวเตอร์เครือข่ายและความปลอดภัยไซเบอร์"
  },

  "CNC211": {
    name: "อัลกอริทึมและเทคนิคการแก้ปัญหา",
    nameEn: "Algorithms and Problem-solving Techniques",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "อัลกอริทึมและเทคนิคการแก้ปัญหา"
  },

  "CNC222": {
    name: "พื้นฐานระบบลีนุกซ์",
    nameEn: "Linux System Fundamentals",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานระบบปฏิบัติการ Linux"
  },

  "CNC223": {
    name: "เทคโนโลยีการจำลองเสมือน",
    nameEn: "Virtualization Technology",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "เทคโนโลยี Virtualization"
  },

  "CNC224": {
    name: "การดูแลระบบลีนุกซ์",
    nameEn: "Linux System Administration",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC222"],
    term: "ปี 2",
    desc: "การดูแลและบริหารระบบ Linux"
  },

  "CNC231": {
    name: "พื้นฐานระบบเครือข่ายคอมพิวเตอร์",
    nameEn: "Computer Networking Fundamentals",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานระบบเครือข่ายคอมพิวเตอร์"
  },

  "CNC232": {
    name: "พื้นฐานเทคโนโลยีคลาวด์",
    nameEn: "Cloud Foundations",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานเทคโนโลยี Cloud"
  },

  "CNC233": {
    name: "เครือข่ายไอพีขั้นสูง",
    nameEn: "Advanced IP Networking",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC231"],
    term: "ปี 2",
    desc: "เครือข่าย IP ขั้นสูง"
  },

  "CNC235": {
    name: "พื้นฐานความปลอดภัยของระบบคอมพิวเตอร์",
    nameEn: "Computer Security Fundamentals",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานความปลอดภัยของระบบคอมพิวเตอร์"
  },

  "CNC261": {
    name: "ระบบการจัดการฐานข้อมูล",
    nameEn: "Database Management Systems",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "ระบบการจัดการฐานข้อมูล"
  },

  "CNC262": {
    name: "การพัฒนาเว็บแอปพลิเคชัน",
    nameEn: "Web Application Development",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "การพัฒนาเว็บแอปพลิเคชัน"
  },

  "CNC271": {
    name: "พื้นฐานปัญญาประดิษฐ์",
    nameEn: "Artificial Intelligence Fundamentals",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 2",
    desc: "พื้นฐานปัญญาประดิษฐ์"
  },

  "CNC301": {
    name: "การเตรียมโครงงานพิเศษ / การเตรียมสหกิจศึกษา",
    nameEn: "Special Project / Co-operative Education Preparation",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "การเตรียมความพร้อมสำหรับโครงงานพิเศษหรือสหกิจศึกษา"
  },

  "CNC324": {
    name: "การเขียนโปรแกรมระบบสำหรับลีนุกซ์",
    nameEn: "Linux System Programming",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC222"],
    term: "ปี 3",
    desc: "การเขียนโปรแกรมระบบสำหรับ Linux"
  },

  "CNC331": {
    name: "ความเป็นส่วนตัวและความปลอดภัยของข้อมูล",
    nameEn: "Data Privacy and Security",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC235", "CNC261"],
    term: "ปี 3",
    desc: "หลักการความเป็นส่วนตัวของข้อมูล เทคนิคการรักษาความปลอดภัย การจัดการข้อมูลอย่างปลอดภัย กฎหมาย และการกำกับดูแลข้อมูล"
  },

  "CNC332": {
    name: "การบำรุงรักษาและการป้องกันเครือข่าย",
    nameEn: "Network Monitoring and Defense",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "การตรวจสอบ ดูแล และป้องกันระบบเครือข่าย"
  },

  "CNC333": {
    name: "การประเมินช่องโหว่และการทดสอบการเจาะระบบ",
    nameEn: "Vulnerability Assessment and Penetration Testing",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC235"],
    term: "ปี 3",
    desc: "การประเมินช่องโหว่และการทดสอบการเจาะระบบ"
  },

  "CNC334": {
    name: "พื้นฐานนิติวิทยาศาสตร์ดิจิทัล",
    nameEn: "Fundamentals of Digital Forensics",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: ["CNC235"],
    term: "ปี 3",
    desc: "หลักการและแนวปฏิบัติในการสืบสวนทางดิจิทัล การวิเคราะห์ระบบไฟล์ การกู้คืนข้อมูล และการสืบสวนข้อมูลดิจิทัล"
  },

  "CNC345": {
    name: "หัวข้อเลือกสรรด้านคอมพิวเตอร์เครือข่ายและความปลอดภัยไซเบอร์",
    nameEn: "Selected Topics in Computer Network and Cybersecurity",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "หัวข้อเลือกสรรด้านคอมพิวเตอร์เครือข่ายและความปลอดภัยไซเบอร์"
  },

  "CNC362": {
    name: "ความปลอดภัยของเว็บแอปพลิเคชัน",
    nameEn: "Web Application Security",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "ความปลอดภัยของเว็บแอปพลิเคชัน"
  },

  "CNC371": {
    name: "การเรียนรู้ของเครื่องและการประยุกต์ใช้ในความปลอดภัยทางไซเบอร์",
    nameEn: "Machine Learning and Its Application in Cybersecurity",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "การเรียนรู้ของเครื่องและการประยุกต์ใช้ในงานความปลอดภัยไซเบอร์"
  },

  "CNC384": {
    name: "ปัจจัยมนุษย์และความปลอดภัยทางไซเบอร์",
    nameEn: "Human Factors and Cybersecurity",
    credits: 3,
    category: "วิชาบังคับ",
    prereq: [],
    term: "ปี 3",
    desc: "ปัจจัยมนุษย์ที่เกี่ยวข้องกับความปลอดภัยทางไซเบอร์"
  },

  "CNC303": {
    name: "โครงงานพิเศษ 1",
    nameEn: "Special Projects 1",
    credits: 2,
    category: "โครงงาน/สหกิจศึกษา",
    prereq: [],
    term: "ปี 4",
    desc: "โครงงานพิเศษ 1"
  },

  "CNC304": {
    name: "สหกิจศึกษา 1",
    nameEn: "Co-operative Education 1",
    credits: 2,
    category: "โครงงาน/สหกิจศึกษา",
    prereq: [],
    term: "ภาคฤดูร้อน",
    desc: "สหกิจศึกษา 1 โดยมีระยะเวลาปฏิบัติงานตามเงื่อนไขของหลักสูตร"
  },

  "CNC403": {
    name: "โครงงานพิเศษ 2",
    nameEn: "Special Projects 2",
    credits: 4,
    category: "โครงงาน/สหกิจศึกษา",
    prereq: ["CNC303"],
    term: "ปี 4",
    desc: "โครงงานพิเศษ 2"
  },

  "CNC404": {
    name: "สหกิจศึกษา 2",
    nameEn: "Co-operative Education 2",
    credits: 4,
    category: "โครงงาน/สหกิจศึกษา",
    prereq: ["CNC304"],
    term: "ปี 4",
    desc: "สหกิจศึกษา 2"
  },

  "CNC336": {
    name: "การจัดการความปลอดภัยบนคลาวด์",
    nameEn: "Cloud Security Management",
    credits: 3,
    category: "วิชาเลือกเสรี",
    prereq: [],
    term: "ตามการเปิดสอน",
    desc: "การจัดการความปลอดภัยบนระบบคลาวด์"
  },

  "CNC338": {
    name: "ความปลอดภัยของเครือข่ายไร้สายและอินเทอร์เน็ตของสรรพสิ่ง",
    nameEn: "IoT and Wireless Networks Security",
    credits: 3,
    category: "วิชาเลือกเสรี",
    prereq: [],
    term: "ตามการเปิดสอน",
    desc: "ความปลอดภัยของเครือข่ายไร้สายและ Internet of Things"
  }
};


/* =========================================================
   PROGRAM DATA
   ========================================================= */

const PROGRAMS = [

  /* =====================================================
     COMPUTER SCIENCE
     Curriculum 2023
     ===================================================== */

  {
    id: "cs",
    code: "วท.บ. วิทยาการคอมพิวเตอร์",
    nameEn: "Bachelor of Science Program in Computer Science",
    revisionYear: 2566,
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
    a: "ใน V1 ระบบนี้เน้นข้อมูลหลักสูตรและการค้นหาข้อมูลสาธารณะ ส่วนการตรวจสอบสถานะรายบุคคลด้วยข้อมูลจริงจากสำนักทะเบียนจะเป็นระยะถัดไป"
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

  homeQuery: ""
};


/* =========================================================
   HELPERS
   ========================================================= */

const icon = (name, size = 18, cls = "") =>
  `<i data-lucide="${name}" width="${size}" height="${size}" class="${cls}"></i>`;

const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

const norm = s =>
  (s || "")
    .toString()
    .toLowerCase();

function findUnlocks(code) {
  return Object.entries(COURSES)
    .filter(([, c]) => c.prereq.includes(code))
    .map(([k]) => k);
}

function programsContaining(code) {
  return PROGRAMS.filter(
    p => p.plan.some(t => t.courses.includes(code))
  );
}

function seal(year) {
  return `
    <div class="seal">
      <span class="seal-ring"></span>
      <span class="seal-year">${year}</span>
      <span class="seal-label">ปรับปรุง</span>
    </div>
  `;
}

function chip(text, tone = "ink") {
  return `
    <span class="chip chip-${tone}">
      ${esc(text)}
    </span>
  `;
}

function courseCode(code) {
  return `
    <span class="course-code">
      ${esc(code)}
    </span>
  `;
}

function crumbs(items) {
  return `
    <div class="crumbs">
      ${items
      .map(
        (it, i) => `
            <span class="crumb-item">
              ${i
            ? icon("chevron-right", 13, "crumb-sep")
            : ""
          }

              ${it.view
            ? `
                    <button
                      class="crumb-link"
                      data-go="${it.view}"
                      ${it.id ? `data-id="${it.id}"` : ""}
                    >
                      ${esc(it.label)}
                    </button>
                  `
            : `
                    <span class="crumb-current">
                      ${esc(it.label)}
                    </span>
                  `
          }
            </span>
          `
      )
      .join("")}
    </div>
  `;
}


/* =========================================================
   PROGRAM CARD
   ========================================================= */

function programCard(p) {
  return `
    <button
      class="program-card"
      data-go="program"
      data-id="${p.id}"
    >

      ${seal(p.revisionYear)}

      <div class="program-card-body">

        <div class="program-card-faculty">
          ${esc(p.faculty)}
        </div>

        <h3>
          ${esc(p.code)}
        </h3>

        <div class="program-card-en">
          ${esc(p.nameEn)}
        </div>

        <div class="program-card-stats">

          <span>
            ${icon("graduation-cap", 14)}
            ${esc(p.duration)}
          </span>

          <span>
            ${courseCode(p.totalCredits + " นก.")}
          </span>

        </div>

      </div>

      ${icon("chevron-right", 18, "program-card-chevron")}

    </button>
  `;
}


/* =========================================================
   HOME
   ========================================================= */

function renderHome() {

  const q = state.homeQuery.trim();

  let results = [];

  if (q) {

    const x = norm(q);

    PROGRAMS.forEach(p => {

      if (
        norm(
          p.code +
          p.nameEn +
          p.faculty
        ).includes(x)
      ) {
        results.push([
          "หลักสูตร",
          p.code,
          "program",
          p.id
        ]);
      }

    });

    Object.entries(COURSES).forEach(
      ([code, c]) => {

        if (
          norm(
            code +
            c.name +
            c.nameEn
          ).includes(x)
        ) {

          results.push([
            "รายวิชา",
            `${code} · ${c.name}`,
            "course",
            code
          ]);

        }

      }
    );

    FAQS.forEach(f => {

      if (
        norm(
          f.q +
          f.a
        ).includes(x)
      ) {

        results.push([
          "คำถาม",
          f.q,
          "faq",
          ""
        ]);

      }

    });

    results = results.slice(0, 6);
  }


  return `
    <div>

      <section class="hero">

        <div class="hero-inner">

          <div class="hero-eyebrow">
            ${icon("compass", 15)}
            ศูนย์ข้อมูลหลักสูตรกลาง
          </div>

          <h1 class="hero-title">
            รู้เส้นทางวิชา<br>
            ก่อนก้าวเดินแต่ละเทอม
          </h1>

          <p class="hero-sub">
            ค้นหลักสูตร แผนการเรียน รายวิชา
            วิชาบังคับก่อน และเงื่อนไขการสำเร็จการศึกษา
            ในที่เดียว — เข้าถึงได้ทันทีโดยไม่ต้องเข้าสู่ระบบ
          </p>

          <div class="hero-search">

            ${icon(
    "search",
    18,
    "hero-search-icon"
  )}

            <input
              id="homeSearch"
              value="${esc(state.homeQuery)}"
              placeholder="ค้นหาหลักสูตร รายวิชา หรือคำถาม เช่น “CS251” หรือ “CNCTU”"
              autocomplete="off"
            >

            <div
              id="homeSearchResults"
              class="home-search-results"
              style="display:none;"
              ></div>

          </div>

          ${results.length
      ? `
                <div class="hero-results">

                  ${results
        .map(
          r => `
                        <button
                          class="hero-result-row"
                          data-go="${r[2]}"
                          data-id="${r[3]}"
                        >

                          <span class="hero-result-type">
                            ${r[0]}
                          </span>

                          <span class="hero-result-label">
                            ${esc(r[1])}
                          </span>

                          ${icon(
            "chevron-right",
            15
          )}

                        </button>
                      `
        )
        .join("")}

                </div>
              `
      : ""
    }

        </div>

      </section>


      <section class="section">

        <div class="section-head">

          <h2>
            หลักสูตรที่เปิดสอน
          </h2>

          <button
            class="link-btn"
            data-go="programs"
          >
            ดูทั้งหมด
            ${icon("arrow-right", 14)}
          </button>

        </div>

        <div class="program-grid">

          ${PROGRAMS
      .map(programCard)
      .join("")}

        </div>

      </section>


      <section class="section quick-links">

        <button
          class="quick-card"
          data-go="courses"
        >

          ${icon("book-open", 22)}

          <div>

            <div class="quick-card-title">
              ค้นหารายวิชา
            </div>

            <div class="quick-card-sub">
              ค้นหาด้วยรหัสวิชา ชื่อวิชา
              หรือหลักสูตร
            </div>

          </div>

          ${icon("chevron-right", 18)}

        </button>


        <button
          class="quick-card"
          data-go="faq"
        >

          ${icon("circle-help", 22)}

          <div>

            <div class="quick-card-title">
              คำถามที่พบบ่อย
            </div>

            <div class="quick-card-sub">
              รวมคำตอบเรื่องหลักสูตร
              การลงทะเบียน และการสำเร็จการศึกษา
            </div>

          </div>

          ${icon("chevron-right", 18)}

        </button>

      </section>

    </div>
  `;
}


/* =========================================================
   PROGRAM LIST
   ========================================================= */

function renderPrograms() {

  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "หลักสูตรทั้งหมด"
    }
  ])}

      <h1 class="page-title">
        หลักสูตรที่เปิดสอน
      </h1>

      <p class="page-sub">
        ข้อมูลจากเอกสารหลักสูตรของมหาวิทยาลัยธรรมศาสตร์
      </p>

      <div class="program-grid program-grid--wide">

        ${PROGRAMS
      .map(programCard)
      .join("")}

      </div>

    </div>
  `;
}


/* =========================================================
   PROGRAM DETAIL
   ========================================================= */

function renderProgram() {

  const p =
    PROGRAMS.find(
      x => x.id === state.programId
    ) || PROGRAMS[0];


  const years = [
    ...new Set(
      p.plan.map(t => t.year)
    )
  ];


  if (!years.includes(state.year)) {
    state.year = years[0];
  }


  const terms =
    p.plan.filter(
      t => t.year === state.year
    );


  let content = "";


  /* -------------------------
     OVERVIEW
     ------------------------- */

  if (
    state.programTab === "overview"
  ) {

    content = `
      <div class="panel">

        <p class="program-summary">
          ${esc(p.summary)}
        </p>


        <div class="stat-row">

          <div class="stat-box">

            <div class="stat-num">
              ${p.totalCredits}
            </div>

            <div class="stat-label">
              หน่วยกิตรวม
            </div>

          </div>


          <div class="stat-box">

            <div class="stat-num">
              4
            </div>

            <div class="stat-label">
              ปีการศึกษา
            </div>

          </div>


          <div class="stat-box">

            <div class="stat-num">
              ${years.length}
            </div>

            <div class="stat-label">
              ชั้นปีในแผน
            </div>

          </div>

        </div>


        <h3 class="panel-subhead">
          โครงสร้างหน่วยกิต
        </h3>


        <div class="structure">

          ${p.structure
        .map(
          s => `
                <div class="structure-row">

                  <div class="structure-label">
                    ${esc(s.label)}
                  </div>

                  <div class="structure-track">

                    <div
                      class="structure-fill"
                      style="width:${(s.credits /
              p.totalCredits) *
            100
            }%"
                    ></div>

                  </div>

                  <div class="structure-value">
                    ${s.credits} นก.
                  </div>

                </div>
              `
        )
        .join("")}

        </div>

      </div>
    `;
  }


  /* -------------------------
     STUDY PLAN
     ------------------------- */

  else if (
    state.programTab === "plan"
  ) {

    content = `
      <div class="panel">

        <div class="year-tabs">

          ${years
        .map(
          y => `
                <button
                  class="year-tab ${state.year === y
              ? "year-tab--active"
              : ""
            }"
                  data-year="${y}"
                >
                  ชั้นปีที่ ${y}
                </button>
              `
        )
        .join("")}

        </div>


        <div class="term-grid">

          ${terms
        .map(t => {

          let total = 0;

          t.courses.forEach(code => {

            if (
              COURSES[code]
            ) {
              total +=
                COURSES[code].credits;
            }

          });


          return `
                <div class="term-card">

                  <div class="term-card-head">

                    <span>
                      ${t.term === 3
              ? "ภาคฤดูร้อน"
              : `ภาคการศึกษาที่ ${t.term}`
            }
                    </span>

                    <span class="term-card-credits">
                      ${total ||
            "ตามรายวิชาเลือก"
            }
                      ${total
              ? " นก."
              : ""
            }
                    </span>

                  </div>


                  <div class="term-course-list">

                    ${t.courses
              .map(code => {

                if (
                  code ===
                  "FREE3"
                ) {

                  return `
                            <div class="term-course-row">

                              <span class="course-code">
                                FREE
                              </span>

                              <span class="term-course-name">
                                วิชาเลือกเสรี
                              </span>

                              <span class="term-course-cr">
                                3 นก.
                              </span>

                            </div>
                          `;
                }


                const c =
                  COURSES[code];


                if (!c) {

                  return `
                            <div class="term-course-row">

                              ${courseCode(
                    code
                  )}

                              <span class="term-course-name">
                                รายวิชาตามเอกสารหลักสูตร
                              </span>

                              <span class="term-course-cr">
                                –
                              </span>

                            </div>
                          `;
                }


                return `
                          <button
                            class="term-course-row"
                            data-go="course"
                            data-id="${code}"
                          >

                            ${courseCode(code)}

                            <span class="term-course-name">
                              ${esc(c.name)}
                            </span>

                            <span class="term-course-cr">
                              ${c.credits} นก.
                            </span>

                          </button>
                        `;

              })
              .join("")}

                  </div>

                </div>
              `;

        })
        .join("")}

        </div>

      </div>
    `;
  }


  /* -------------------------
     GRADUATION
     ------------------------- */

  else {

    content = `
      <div class="panel">

        <div class="conditions-list">

          ${p.conditions
        .map(
          c => `
                <div class="condition-row">

                  <span class="condition-check">
                    ${icon("check", 13)}
                  </span>

                  <span>
                    ${esc(c)}
                  </span>

                </div>
              `
        )
        .join("")}

        </div>


        <div class="note-banner">

          การตรวจสอบสถานะรายบุคคลด้วยข้อมูลจริง
          จากสำนักทะเบียนจะเปิดให้ใช้งานในระยะถัดไป

        </div>

      </div>
    `;
  }


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "หลักสูตรทั้งหมด",
      view: "programs"
    },
    {
      label: p.code
    }
  ])}


      <div class="program-header">

        ${seal(p.revisionYear)}

        <div>

          <div class="program-header-faculty">
            ${esc(p.faculty)}
          </div>

          <h1 class="page-title">
            ${esc(p.code)}
          </h1>

          <div class="program-header-en">
            ${esc(p.nameEn)}
          </div>

        </div>

      </div>


      <div class="tabs">

        ${[
      ["overview", "ภาพรวม"],
      ["plan", "แผนการเรียน"],
      [
        "grad",
        "เงื่อนไขการสำเร็จการศึกษา"
      ]
    ]
      .map(
        ([id, label]) => `
              <button
                class="tab ${state.programTab === id
            ? "tab--active"
            : ""
          }"
                data-tab="${id}"
              >
                ${label}
              </button>
            `
      )
      .join("")}

      </div>


      ${content}

    </div>
  `;
}


/* =========================================================
   COURSE SEARCH
   ========================================================= */

function renderCourses() {

  const list =
    Object.entries(COURSES)
      .filter(([code, c]) => {

        if (
          state.noPrereqOnly &&
          c.prereq.length
        ) {
          return false;
        }


        if (
          state.programFilter !==
          "all"
        ) {

          const p =
            PROGRAMS.find(
              p =>
                p.id ===
                state.programFilter
            );


          if (
            p &&
            !p.plan.some(
              t =>
                t.courses.includes(
                  code
                )
            )
          ) {
            return false;
          }

        }


        return (
          !state.courseQuery.trim() ||
          norm(
            code +
            c.name +
            c.nameEn
          ).includes(
            norm(
              state.courseQuery
            )
          )
        );

      });


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "ค้นหารายวิชา"
    }
  ])}


      <h1 class="page-title">
        ค้นหารายวิชา
      </h1>


      <p class="page-sub">
        พบ ${list.length} รายวิชาจากข้อมูลหลักสูตร
      </p>


      <div class="filter-bar">

        <div class="hero-search hero-search--compact">

          ${icon(
    "search",
    16,
    "hero-search-icon"
  )}

          <input
            id="courseSearch"
            value="${esc(
    state.courseQuery
  )}"
            placeholder="ค้นหาด้วยรหัสวิชาหรือชื่อวิชา"
          >

        </div>


        <select
          id="programFilter"
          class="select"
        >

          <option value="all">
            ทุกหลักสูตร
          </option>

          ${PROGRAMS
      .map(
        p => `
                <option
                  value="${p.id}"
                  ${state.programFilter ===
            p.id
            ? "selected"
            : ""
          }
                >
                  ${esc(p.code)}
                </option>
              `
      )
      .join("")}

        </select>


        <label class="checkbox-pill">

          <input
            id="noPrereq"
            type="checkbox"
            ${state.noPrereqOnly
      ? "checked"
      : ""
    }
          >

          ${icon(
      "list-filter",
      14
    )}

          ไม่มีวิชาบังคับก่อน

        </label>

      </div>


      <div class="course-grid">

        ${list
      .map(
        ([code, c]) => `
              <button
                class="course-card"
                data-go="course"
                data-id="${code}"
              >

                <div class="course-card-top">

                  ${courseCode(code)}

                  ${chip(
          c.credits +
          " นก.",
          "brass"
        )}

                </div>


                <div class="course-card-name">
                  ${esc(c.name)}
                </div>


                <div class="course-card-en">
                  ${esc(c.nameEn)}
                </div>


                <div class="course-card-foot">

                  ${chip(c.category)}

                  <span
                    class="
                      course-card-prereq
                      ${c.prereq.length
            ? ""
            : "course-card-prereq--none"
          }
                    "
                  >
                    ${c.prereq.length
            ? "มีวิชาบังคับก่อน"
            : "ไม่มีวิชาบังคับก่อน"
          }
                  </span>

                </div>

              </button>
            `
      )
      .join("")}


        ${!list.length
      ? `
              <div class="empty-state">
                ไม่พบรายวิชาที่ตรงกับเงื่อนไขการค้นหา
              </div>
            `
      : ""
    }

      </div>

    </div>
  `;
}


/* =========================================================
   COURSE DETAIL
   ========================================================= */

function renderCourse() {

  const code =
    state.courseCode ||
    "CS101";

  const c =
    COURSES[code];


  if (!c) {

    return `
      <div class="page">

        ${crumbs([
      {
        label: "หน้าแรก",
        view: "home"
      },
      {
        label: "ค้นหารายวิชา",
        view: "courses"
      }
    ])}

        <div class="empty-state">
          ไม่พบข้อมูลรายวิชา ${esc(code)}
        </div>

      </div>
    `;
  }


  const ps =
    programsContaining(code);

  const prereqs =
    c.prereq || [];

  const unlocks =
    findUnlocks(code);


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "ค้นหารายวิชา",
      view: "courses"
    },
    {
      label: code
    }
  ])}


      <div class="course-detail-head">

        <div>

          ${courseCode(code)}

          <h1
            class="page-title"
            style="margin-top:8px"
          >
            ${esc(c.name)}
          </h1>

          <div class="program-header-en">
            ${esc(c.nameEn)}
          </div>

        </div>


        <div class="course-detail-meta">

          ${chip(
    c.credits +
    " หน่วยกิต",
    "brass"
  )}

          ${chip(c.category)}

        </div>

      </div>


      <p class="program-summary">
        ${esc(c.desc)}
      </p>


      <div class="meta-grid">

        <div class="meta-box">

          <div class="meta-label">
            เปิดสอน
          </div>

          <div class="meta-value">
            ${esc(c.term)}
          </div>

        </div>


        <div class="meta-box">

          <div class="meta-label">
            อยู่ในหลักสูตร
          </div>

          <div class="meta-value">

            ${ps.length
      ? ps
        .map(
          p =>
            `<div>${esc(
              p.code
            )}</div>`
        )
        .join("")
      : "—"
    }

          </div>

        </div>

      </div>


      <h3 class="panel-subhead">
        เส้นทางรายวิชา
      </h3>


      <div class="chain">


        <div class="chain-lane">

          <div class="chain-lane-label">
            ต้องผ่านมาก่อน
          </div>


          <div class="chain-nodes">

            ${prereqs.length
      ? prereqs
        .map(
          p =>
            COURSES[p]
              ? `
                            <div class="chain-node">

                              <div class="chain-node-code">
                                ${p}
                              </div>

                              <div class="chain-node-name">
                                ${esc(
                COURSES[p]
                  .name
              )}
                              </div>

                            </div>
                          `
              : `
                            <div class="chain-node chain-node--condition">
                              ${esc(p)}
                            </div>
                          `
        )
        .join("")
      : `
                  <div class="chain-node chain-node--empty">
                    ไม่มีวิชาบังคับก่อน
                  </div>
                `
    }

          </div>

        </div>


        <div class="chain-arrow">
          ${icon("arrow-right", 20)}
        </div>


        <div class="chain-lane chain-lane--current">

          <div class="chain-lane-label">
            รายวิชานี้
          </div>

          <div class="chain-node chain-node--current">

            <div class="chain-node-code">
              ${code}
            </div>

            <div class="chain-node-name">
              ${esc(c.name)}
            </div>

          </div>

        </div>


        <div class="chain-arrow">
          ${icon("arrow-right", 20)}
        </div>


        <div class="chain-lane">

          <div class="chain-lane-label">
            ปลดล็อกวิชาถัดไป
          </div>


          <div class="chain-nodes">

            ${unlocks.length
      ? unlocks
        .map(
          u => `
                        <div class="chain-node chain-node--future">

                          <div class="chain-node-code">
                            ${u}
                          </div>

                          <div class="chain-node-name">
                            ${esc(
            COURSES[u]
              .name
          )}
                          </div>

                        </div>
                      `
        )
        .join("")
      : `
                  <div class="chain-node chain-node--empty">
                    ยังไม่มีวิชาที่ต่อยอด
                  </div>
                `
    }

          </div>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   FAQ
   ========================================================= */

function renderFaq() {

  const grouped = {};


  FAQS
    .filter(
      f =>
        norm(
          f.q + f.a
        ).includes(
          norm(
            state.faqQuery
          )
        )
    )
    .forEach(f => {

      if (!grouped[f.category]) {
        grouped[f.category] = [];
      }

      grouped[f.category].push(f);

    });


  return `
    <div class="page">

      ${crumbs([
    {
      label: "หน้าแรก",
      view: "home"
    },
    {
      label: "คำถามที่พบบ่อย"
    }
  ])}


      <h1 class="page-title">
        คำถามที่พบบ่อย
      </h1>


      <p class="page-sub">
        รวมคำตอบเกี่ยวกับหลักสูตร
        การลงทะเบียน และการสำเร็จการศึกษา
      </p>


      <div
        class="hero-search hero-search--compact"
        style="margin-bottom:28px"
      >

        ${icon(
    "search",
    16,
    "hero-search-icon"
  )}

        <input
          id="faqSearch"
          value="${esc(
    state.faqQuery
  )}"
          placeholder="พิมพ์คำถาม เช่น “หน่วยกิต” หรือ “สำเร็จการศึกษา”"
        >

      </div>


      ${Object.keys(grouped).length

      ? Object.entries(grouped)
        .map(
          ([cat, items]) => `
                  <div class="faq-group">

                    <div class="faq-group-title">
                      ${esc(cat)}
                    </div>


                    ${items
              .map(
                (f, i) => {

                  const k =
                    cat + i;

                  const o =
                    state.openFaq ===
                    k;


                  return `
                            <div class="faq-item">

                              <button
                                class="faq-question"
                                data-faq="${esc(k)}"
                              >

                                <span>
                                  ${esc(f.q)}
                                </span>

                                ${icon(
                    "chevron-down",
                    16,
                    `faq-chevron ${o
                      ? "faq-chevron--open"
                      : ""
                    }`
                  )}

                              </button>


                              ${o
                      ? `
                                    <div class="faq-answer">
                                      ${esc(f.a)}
                                    </div>
                                  `
                      : ""
                    }

                            </div>
                          `;

                }
              )
              .join("")}

                  </div>
                `
        )
        .join("")

      : `
            <div class="empty-state">
              ไม่พบคำถามที่ตรงกับคำค้นหา
            </div>
          `
    }

    </div>
  `;
}


/* =========================================================
   SHELL
   ========================================================= */

function shell(content) {

  const active =
    id =>
      state.view === id ||
      (
        id === "programs" &&
        state.view === "program"
      ) ||
      (
        id === "courses" &&
        state.view === "course"
      );


  const nav = [
    ["home", "หน้าแรก"],
    ["programs", "หลักสูตร"],
    ["courses", "ค้นหารายวิชา"],
    ["faq", "คำถามที่พบบ่อย"]
  ];


  return `
    <header class="topbar">

      <button
        class="brand"
        data-go="home"
      >

        ${icon("compass", 22)}

        <span>
          เข็มทิศหลักสูตร
        </span>

      </button>


      <nav class="topnav">

        ${nav
      .map(
        ([id, label]) => `
              <button
                class="topnav-item ${active(id)
            ? "topnav-item--active"
            : ""
          }"
                data-go="${id}"
              >
                ${label}
              </button>
            `
      )
      .join("")}

      </nav>


      <button
        class="menu-btn"
        id="menuBtn"
        aria-label="เมนู"
      >
        ${icon(
        state.navOpen
          ? "x"
          : "menu",
        20
      )}
      </button>


      ${state.navOpen
      ? `
            <div class="mobile-nav">

              ${nav
        .map(
          ([id, label]) => `
                    <button
                      class="mobile-nav-item"
                      data-go="${id}"
                    >
                      ${label}
                    </button>
                  `
        )
        .join("")}

            </div>
          `
      : ""
    }

    </header>


    <main class="main">
      ${content}
    </main>


    <footer class="footer">

      <div>

        ${icon(
      "compass",
      16
    )}

        เข็มทิศหลักสูตร
        — ศูนย์ข้อมูลหลักสูตรกลาง

      </div>


      <div class="footer-note">

        ข้อมูลในหน้านี้เปิดให้เข้าถึงแบบสาธารณะ
        ไม่ต้องเข้าสู่ระบบ ·
        ระยะถัดไปจะเปิดให้ตรวจสอบสถานะรายบุคคล
        ด้วยข้อมูลจากสำนักทะเบียน

      </div>

    </footer>
  `;
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

  const pages = {
    home: renderHome,
    programs: renderPrograms,
    program: renderProgram,
    courses: renderCourses,
    course: renderCourse,
    faq: renderFaq
  };


  const renderer =
    pages[state.view];


  const page =
    renderer
      ? renderer()
      : renderHome();


  document.getElementById(
    "app"
  ).innerHTML =
    shell(page);


  if (window.lucide) {
    lucide.createIcons();
  }


  bind();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function go(v, id, addHistory = true) {
  state.view = v;

  if (v === "program") {
    state.programId = id;
    state.programTab = "overview";
  }

  if (v === "course") {
    state.courseCode = id;
  }

  state.navOpen = false;

  // เก็บหน้าปัจจุบันไว้ใน Browser History
  if (addHistory) {
    const pageState = {
      view: v,
      programId: state.programId,
      courseCode: state.courseCode,
      programTab: state.programTab,
      year: state.year
    };

    history.pushState(
      pageState,
      "",
      window.location.pathname
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  render();
}


/* =========================================================
   BIND EVENTS
   ========================================================= */

function bind() {


  /* -------------------------
     Navigation
     ------------------------- */

  document
    .querySelectorAll(
      "[data-go]"
    )
    .forEach(b => {

      b.onclick = () => {

        go(
          b.dataset.go,
          b.dataset.id
        );

      };

    });


  /* -------------------------
     Mobile menu
     ------------------------- */

  const menu =
    document.getElementById(
      "menuBtn"
    );


  if (menu) {

    menu.onclick = () => {

      state.navOpen =
        !state.navOpen;

      render();

    };

  }


  /* -------------------------
     HOME SEARCH
     ------------------------- */

  const hs = document.getElementById("homeSearch");

  if (hs) {
    hs.oninput = e => {
      state.homeQuery = e.target.value;

      // ไม่ render ทั้งหน้า
      // เพื่อไม่ให้ input หลุด focus ตอนพิมพ์
      const query = state.homeQuery.trim().toLowerCase();

      // หา container ของผลค้นหา
      const resultsBox = document.getElementById("homeSearchResults");

      if (resultsBox) {
        if (!query) {
          resultsBox.innerHTML = "";
          resultsBox.style.display = "none";
          return;
        }

        let results = [];

        // -------------------------
        // SEARCH PROGRAMS
        // -------------------------
        PROGRAMS.forEach(p => {
          const text = (
            p.code +
            " " +
            p.nameEn +
            " " +
            p.faculty
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="program"
              data-id="${p.id}"
            >
              <span class="search-result-type">หลักสูตร</span>
              <span class="search-result-title">
                ${esc(p.code)}
              </span>
            </button>
          `);
          }
        });

        // -------------------------
        // SEARCH COURSES
        // -------------------------
        Object.entries(COURSES).forEach(([code, c]) => {
          const text = (
            code +
            " " +
            c.name +
            " " +
            c.nameEn
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="course"
              data-id="${code}"
            >
              <span class="search-result-type">รายวิชา</span>
              <span class="search-result-title">
                ${esc(code)} · ${esc(c.name)}
              </span>
            </button>
          `);
          }
        });

        // -------------------------
        // SEARCH FAQ
        // -------------------------
        FAQS.forEach(f => {
          const text = (
            f.q +
            " " +
            f.a
          ).toLowerCase();

          if (text.includes(query)) {
            results.push(`
            <button
              class="search-result-item"
              data-go="faq"
            >
              <span class="search-result-type">คำถาม</span>
              <span class="search-result-title">
                ${esc(f.q)}
              </span>
            </button>
          `);
          }
        });

        results = results.slice(0, 6);

        if (results.length) {
          resultsBox.innerHTML = results.join("");
          resultsBox.style.display = "block";

          // bind เฉพาะปุ่มผลค้นหา
          resultsBox
            .querySelectorAll("[data-go]")
            .forEach(btn => {
              btn.onclick = () => {
                go(
                  btn.dataset.go,
                  btn.dataset.id
                );
              };
            });
        } else {
          resultsBox.innerHTML = `
          <div class="search-no-result">
            ไม่พบข้อมูลที่ตรงกับคำค้นหา
          </div>
        `;
          resultsBox.style.display = "block";
        }
      }
    };
  }


  /* -------------------------
     COURSE SEARCH
     ------------------------- */

  const cs =
    document.getElementById(
      "courseSearch"
    );


  if (cs) {
    cs.oninput = e => {
      state.courseQuery = e.target.value;

      const query = norm(
        state.courseQuery
      );

      document
        .querySelectorAll(".course-card")
        .forEach(card => {
          const text =
            norm(card.textContent);

          card.style.display =
            !query || text.includes(query)
              ? ""
              : "none";
        });
    };
  }

  /* -------------------------
     PROGRAM FILTER
     ------------------------- */

  const pf =
    document.getElementById(
      "programFilter"
    );


  if (pf) {

    pf.onchange = e => {

      state.programFilter =
        e.target.value;

      render();

    };

  }


  /* -------------------------
     NO PREREQUISITE
     ------------------------- */

  const np =
    document.getElementById(
      "noPrereq"
    );


  if (np) {

    np.onchange = e => {

      state.noPrereqOnly =
        e.target.checked;

      render();

    };

  }


  /* -------------------------
     FAQ SEARCH
     ------------------------- */

  const fs =
    document.getElementById(
      "faqSearch"
    );


  if (fs) {

    fs.oninput = e => {

      state.faqQuery =
        e.target.value;



    };

  }


  /* -------------------------
     PROGRAM TABS
     ------------------------- */

  document
    .querySelectorAll(
      "[data-tab]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.programTab =
          b.dataset.tab;

        render();

      };

    });


  /* -------------------------
     YEAR TABS
     ------------------------- */

  document
    .querySelectorAll(
      "[data-year]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.year =
          Number(
            b.dataset.year
          );

        render();

      };

    });


  /* -------------------------
     FAQ OPEN / CLOSE
     ------------------------- */

  document
    .querySelectorAll(
      "[data-faq]"
    )
    .forEach(b => {

      b.onclick = () => {

        state.openFaq =
          state.openFaq ===
            b.dataset.faq
            ? null
            : b.dataset.faq;

        render();

      };

    });

}


/* =========================================================
   START
   ========================================================= */

/* =========================================================
BROWSER BACK / FORWARD
========================================================= */

window.addEventListener("popstate", event => {
  const pageState = event.state;

  // ถ้าไม่มี history state ให้กลับหน้าแรก
  if (!pageState) {
    state.view = "home";
    state.programId = null;
    state.courseCode = null;
    state.programTab = "overview";
    state.year = 1;
  } else {
    state.view = pageState.view || "home";
    state.programId = pageState.programId || null;
    state.courseCode = pageState.courseCode || null;
    state.programTab =
      pageState.programTab || "overview";
    state.year = pageState.year || 1;
  }

  state.navOpen = false;

  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

render();