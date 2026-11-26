export const CNC_CATEGORY_CONFIG = Object.freeze({
  curriculumId: 'BSC-CNC-2568',
  totalCredits: 126,
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
