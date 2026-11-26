export const CS_GRADE_POLICY = Object.freeze({
  curriculumId: 'BSC-CS-2566',
  coreAveragePassPolicy: 'first_pass',
  // TODO: registrar must confirm whether first_pass, latest_pass, or best_pass is correct.
  coreAverageCourseMinimumGrades: Object.freeze({
    CS100: 'C', CS101: 'C', CS102: 'C', CS111: 'C',
    CS232: 'C', CS240: 'C', CS251: 'C', CS261: 'C',
  }),
});
