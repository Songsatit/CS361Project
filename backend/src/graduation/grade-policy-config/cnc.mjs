export const CNC_GRADE_POLICY = Object.freeze({
  curriculumId: 'BSC-CNC-2568',
  coreAveragePassPolicy: 'first_pass',
  // TODO: registrar must confirm whether first_pass, latest_pass, or best_pass is correct.
  coreAverageCourseMinimumGrades: Object.freeze({
    CNC101: 'C', CNC102: 'C', CNC211: 'D', CNC222: 'C',
    CNC231: 'C', CNC235: 'C', CNC332: 'D',
  }),
});
