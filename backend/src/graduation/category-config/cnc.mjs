export const CNC_CATEGORY_CONFIG = Object.freeze({
  curriculumId: 'BSC-CNC-2568',
  academicYear: 2025,
  totalCredits: 126,
  excessCreditPolicy: 'carry_to_free_elective_limited',
  // TODO: confirm the registrar's official excess-credit treatment.
  excessCreditSourceCodes: Object.freeze(['general_education', 'mathematics_foundation', 'major_required', 'project_or_coop']),
  minimumGradeByCourse: Object.freeze({ CNC101: 'C', CNC102: 'C', CNC222: 'C', CNC231: 'C', CNC235: 'C' }),
  mandatoryCourseCategory: Object.freeze({ CNC101: 'major_required', CNC102: 'major_required', CNC222: 'major_required', CNC231: 'major_required', CNC235: 'major_required' }),
  categories: Object.freeze([
    { code: 'general_education', label: 'วิชาศึกษาทั่วไป', minimumCredits: 24, groups: Object.freeze([
      { code: 'world_and_society', type: 'all', requiredCredits: 3, courses: Object.freeze(['TU109']) },
      { code: 'aesthetics_and_communication', type: 'all', requiredCredits: 6, courses: Object.freeze(['EL105', 'LAS101']) },
      { code: 'math_science_technology', type: 'one_of', requiredCredits: 3, courses: Object.freeze(['TU103', 'SC207']) },
      { code: 'health_and_future_skills', type: 'all', requiredCredits: 9, subgroups: Object.freeze([
        Object.freeze({ type: 'all', requiredCredits: 3, courses: Object.freeze(['EL295']) }),
        Object.freeze({ type: 'pick_credits', requiredCredits: 3, courses: Object.freeze(['TU201', 'TU202', 'TU301']) }),
        Object.freeze({ type: 'pick_credits', requiredCredits: 3, courseCodeRange: Object.freeze({ prefix: 'TU', minNumber: 250, maxNumber: 276 }) }),
      ]) },
      { code: 'social_service', type: 'all', requiredCredits: 3, courses: Object.freeze(['TU100']) },
    ]) },
    { code: 'mathematics_foundation', label: 'วิชาเฉพาะ–พื้นฐานด้านคณิตศาสตร์', minimumCredits: 9, groups: Object.freeze([
      { code: 'math_statistics_all', type: 'all', requiredCredits: 6, courses: Object.freeze(['ST216', 'CNC201']) },
      { code: 'calculus_choice', type: 'one_of', requiredCredits: 3, courses: Object.freeze(['MA211', 'AM101']) },
    ]) },
    { code: 'major_required', label: 'วิชาเฉพาะ–วิชาบังคับ', minimumCredits: 81, groups: Object.freeze([
      { code: 'major_required_all', type: 'all', requiredCredits: 81, courses: Object.freeze(['CNC101', 'CNC102', 'CNC103', 'CNC104', 'CNC105', 'CNC111', 'CNC211', 'CNC222', 'CNC223', 'CNC224', 'CNC231', 'CNC232', 'CNC233', 'CNC235', 'CNC261', 'CNC262', 'CNC271', 'CNC301', 'CNC324', 'CNC331', 'CNC332', 'CNC333', 'CNC334', 'CNC345', 'CNC362', 'CNC371', 'CNC384']) },
    ]) },
    { code: 'project_or_coop', label: 'วิชาโครงงาน/สหกิจศึกษา', minimumCredits: 6, groups: Object.freeze([
      { code: 'project_or_coop_choice', type: 'one_group_of', requiredCredits: 6, groups: Object.freeze([
        Object.freeze({ code: 'project', courses: Object.freeze(['CNC303', 'CNC403']), requiredCredits: 6 }),
        Object.freeze({ code: 'coop', courses: Object.freeze(['CNC304', 'CNC404']), requiredCredits: 6 }),
      ]) },
    ]) },
    { code: 'free_elective', label: 'วิชาเลือกเสรี', minimumCredits: 6 },
    { code: 'extra_credits', label: 'หน่วยกิตส่วนเกิน', minimumCredits: 0 },
  ]),
});

if (CNC_CATEGORY_CONFIG.categories.reduce((sum, item) => sum + item.minimumCredits, 0) !== CNC_CATEGORY_CONFIG.totalCredits) {
  throw new Error('CNC category minimum credits do not add up to the curriculum total');
}
