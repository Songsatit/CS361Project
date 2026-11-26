export const CNC_CATEGORY_CONFIG = Object.freeze({
  curriculumId: 'BSC-CNC-2568',
  totalCredits: 126,
  excessCreditPolicy: 'carry_to_free_elective',
  // TODO: confirm the registrar's exact treatment of excess credits.
  excessCreditSourceCodes: Object.freeze(['general_education', 'mathematics_foundation', 'major_required', 'project_or_coop']),
  minimumGradeByCourse: Object.freeze({ CNC101: 'C', CNC102: 'C', CNC222: 'C', CNC231: 'C', CNC235: 'C' }),
  mandatoryCourseCategory: Object.freeze({ CNC101: 'major_required', CNC102: 'major_required', CNC222: 'major_required', CNC231: 'major_required', CNC235: 'major_required' }),
  categories: Object.freeze([
    { code: 'general_education', label: 'วิชาศึกษาทั่วไป', minimumCredits: 24 },
    { code: 'mathematics_foundation', label: 'วิชาเฉพาะ–พื้นฐานด้านคณิตศาสตร์', minimumCredits: 9 },
    { code: 'major_required', label: 'วิชาเฉพาะ–วิชาบังคับ', minimumCredits: 81 },
    { code: 'project_or_coop', label: 'วิชาโครงงาน/สหกิจศึกษา', minimumCredits: 6 },
    { code: 'free_elective', label: 'วิชาเลือกเสรี', minimumCredits: 6 },
  ]),
});

if (CNC_CATEGORY_CONFIG.categories.reduce((sum, item) => sum + item.minimumCredits, 0) !== CNC_CATEGORY_CONFIG.totalCredits) {
  throw new Error('CNC category minimum credits do not add up to the curriculum total');
}
