export const CS_CATEGORY_CONFIG = Object.freeze({
  curriculumId: 'BSC-CS-2566',
  academicYear: 2023,
  totalCredits: 123,
  excessCreditPolicy: 'carry_to_free_elective_limited',
  // TODO: confirm the registrar's official excess-credit treatment.
  excessCreditSourceCodes: Object.freeze(['general_education', 'major_core', 'major_specific', 'major', 'outside_major_required']),
  minimumGradeByCourse: Object.freeze({ CS101: 'C', CS102: 'C', CS111: 'C' }),
  mandatoryCourseCategory: Object.freeze({ CS101: 'major_core', CS102: 'major_core', CS111: 'major_core' }),
  categories: Object.freeze([
    { code: 'general_education', label: 'วิชาศึกษาทั่วไป', minimumCredits: 30, groups: Object.freeze([
      { code: 'world_and_society', type: 'all', requiredCredits: 6, courses: Object.freeze(['TU101', 'TU109']) },
      { code: 'aesthetics_and_communication', type: 'all', requiredCredits: 9, courses: Object.freeze(['EL105', 'LAS101', 'TU106']) },
      { code: 'math_science_technology', type: 'one_of', requiredCredits: 3, courses: Object.freeze(['TU103', 'TU107']) },
      { code: 'health_and_future_skills', type: 'all', requiredCredits: 9, subgroups: Object.freeze([
        Object.freeze({ type: 'all', requiredCredits: 6, courses: Object.freeze(['EL295', 'TU108']) }),
        Object.freeze({ type: 'one_of', requiredCredits: 3, courses: Object.freeze(['TU201', 'TU202', 'TU301']) }),
      ]) },
      { code: 'social_service', type: 'all', requiredCredits: 3, courses: Object.freeze(['TU100']) },
    ]) },
    { code: 'major_core', label: 'วิชาเฉพาะ–วิชาแกน', minimumCredits: 12, groups: Object.freeze([
      { code: 'core_all', type: 'all', requiredCredits: 12, courses: Object.freeze(['MA211', 'CS101', 'ST216', 'ST329']) },
    ]) },
    { code: 'major_specific', label: 'วิชาเฉพาะ–วิชาเฉพาะด้าน', minimumCredits: 42, groups: Object.freeze([
      { code: 'organization_and_information_systems', type: 'all', requiredCredits: 3, courses: Object.freeze(['CS301']) },
      { code: 'applied_technology', type: 'all', requiredCredits: 9, courses: Object.freeze(['CS180', 'CS240', 'CS271']) },
      { code: 'software_technology_and_methods', type: 'all', requiredCredits: 12, subgroups: Object.freeze([
        Object.freeze({ type: 'all', requiredCredits: 6, courses: Object.freeze(['CS100', 'CS261']) }),
        Object.freeze({ type: 'one_of', requiredCredits: 2, courses: Object.freeze(['CS303', 'CS304']) }),
        Object.freeze({ type: 'one_of', requiredCredits: 4, courses: Object.freeze(['CS403', 'CS404']) }),
      ]) },
      { code: 'system_infrastructure', type: 'all', requiredCredits: 15, courses: Object.freeze(['CS102', 'CS111', 'CS232', 'CS251', 'CS305']) },
      { code: 'hardware_and_architecture', type: 'all', requiredCredits: 3, coursesByMajor: Object.freeze({
        computer_science_information: Object.freeze(['CS221']),
        applied_computer: Object.freeze(['CS233']),
      }) },
    ]) },
    { code: 'major', label: 'วิชาเอก', minimumCredits: 30, groupsByMajor: Object.freeze({
      computer_science_information: Object.freeze([{ code: 'major_information_set', type: 'all', requiredCredits: 30, courses: Object.freeze(['CS213', 'CS217', 'CS222', 'CS223', 'CS241', 'CS242', 'CS314', 'CS331', 'CS332', 'CS372']) }]),
      applied_computer: Object.freeze([{ code: 'major_applied_set', type: 'all', requiredCredits: 30, courses: Object.freeze(['CS216', 'CS234', 'CS262', 'CS263', 'CS264', 'CS361', 'CS362', 'CS363', 'CS364', 'CS367']) }]),
    }) },
    { code: 'outside_major_required', label: 'วิชาบังคับนอกสาขา', minimumCredits: 3, groups: Object.freeze([
      { code: 'outside_major_english', type: 'all', requiredCredits: 3, courses: Object.freeze(['EL395']) },
    ]) },
    { code: 'free_elective', label: 'วิชาเลือกเสรี', minimumCredits: 6 },
    { code: 'extra_credits', label: 'หน่วยกิตส่วนเกิน', minimumCredits: 0 },
  ]),
  crossPairWarnings: Object.freeze([
    Object.freeze({ courses: Object.freeze(['CS303', 'CS404']), message: 'ตรวจสอบ: จับคู่ CS303 กับ CS404 ข้ามแผน' }),
    Object.freeze({ courses: Object.freeze(['CS304', 'CS403']), message: 'ตรวจสอบ: จับคู่ CS304 กับ CS403 ข้ามแผน' }),
  ]),
});

if (CS_CATEGORY_CONFIG.categories.reduce((sum, item) => sum + item.minimumCredits, 0) !== CS_CATEGORY_CONFIG.totalCredits) {
  throw new Error('CS category minimum credits do not add up to the curriculum total');
}
