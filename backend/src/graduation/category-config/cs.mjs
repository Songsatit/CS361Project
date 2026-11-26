export const CS_CATEGORY_CONFIG = Object.freeze({
  curriculumId: 'BSC-CS-2566',
  totalCredits: 123,
  excessCreditPolicy: 'no_carry_over',
  // TODO: confirm the registrar's exact treatment of excess credits.
  excessCreditSourceCodes: Object.freeze(['general_education', 'major_core', 'major_specific', 'major', 'outside_major_required']),
  minimumGradeByCourse: Object.freeze({ CS101: 'C', CS102: 'C', CS111: 'C' }),
  mandatoryCourseCategory: Object.freeze({ CS101: 'major_core', CS102: 'major_core', CS111: 'major_core' }),
  categories: Object.freeze([
    { code: 'general_education', label: 'วิชาศึกษาทั่วไป', minimumCredits: 30 },
    { code: 'major_core', label: 'วิชาเฉพาะ–วิชาแกน', minimumCredits: 12 },
    { code: 'major_specific', label: 'วิชาเฉพาะ–วิชาเฉพาะด้าน', minimumCredits: 42 },
    { code: 'major', label: 'วิชาเอก', minimumCredits: 30 },
    { code: 'outside_major_required', label: 'วิชาบังคับนอกสาขา', minimumCredits: 3 },
    { code: 'free_elective', label: 'วิชาเลือกเสรี', minimumCredits: 6 },
    { code: 'extra_credits', label: 'หน่วยกิตส่วนเกิน', minimumCredits: 0 },
  ]),
});

if (CS_CATEGORY_CONFIG.categories.reduce((sum, item) => sum + item.minimumCredits, 0) !== CS_CATEGORY_CONFIG.totalCredits) {
  throw new Error('CS category minimum credits do not add up to the curriculum total');
}
