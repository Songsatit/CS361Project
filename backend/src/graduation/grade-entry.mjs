export const SELF_REPORTED_GRADES = new Set(['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'S', 'U', 'W']);

export function validateGradeEntry(body = {}) {
  const entryType = body.entryType === 'free_elective' ? 'free_elective' : 'catalog';
  const courseCode = String(body.courseCode ?? '').replace(/\s+/g, '').toUpperCase();
  const courseName = String(body.courseName ?? '').trim();
  const inProgress = body.inProgress === true;
  const grade = inProgress ? '-' : String(body.grade ?? '').trim().toUpperCase();
  const credits = Number(body.credits);
  const errors = [];

  if (!courseCode || !/^[A-Z0-9]{2,30}$/.test(courseCode)) errors.push('courseCode is invalid');
  if (entryType === 'free_elective' && !courseName) errors.push('courseName is required for a free elective');
  if (!inProgress && !SELF_REPORTED_GRADES.has(grade)) errors.push('grade is not accepted');
  if (entryType === 'free_elective' && (!Number.isInteger(credits) || credits < 1)) {
    errors.push('credits must be a positive integer for a free elective');
  }
  return { ok: errors.length === 0, errors, entryType, courseCode, courseName, grade, credits, inProgress };
}

