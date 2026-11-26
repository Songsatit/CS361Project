import { gradePoints } from './evaluate.mjs';

const normalize = value => String(value ?? '').replace(/\s+/g, '').toUpperCase();
const orderOf = row => Number(row.academic_year ?? 0) * 10 + Number(row.semester ?? 0);

function meetsGrade(grade, minimum = 'D') {
  if (!minimum) return String(grade ?? '').toUpperCase() !== 'W';
  const actual = gradePoints(grade);
  const required = gradePoints(minimum);
  return actual !== null && required !== null && actual >= required;
}

/** Returns warnings only; it never mutates grades or blocks grade entry. */
export function evaluatePrerequisites(records = [], prerequisites = [], {
  timingPolicy = 'before_term',
  currentCourseCode = null,
  currentAcademicYear = null,
  currentSemester = null,
  currentlyEnrolled = [],
} = {}) {
  const rows = records.map(row => ({ ...row, course_code: normalize(row.course_code) }));
  const currentOrder = currentAcademicYear == null ? null : Number(currentAcademicYear) * 10 + Number(currentSemester ?? 1);
  const enrolled = new Set(currentlyEnrolled.map(normalize));
  const warnings = [];
  for (const rule of prerequisites) {
    if (Array.isArray(rule.anyOf) && rule.anyOf.length) {
      const alternatives = rule.anyOf.map(code => ({ ...rule, anyOf: null, prerequisiteCode: code }));
      const alternativeResult = evaluatePrerequisites(records, alternatives, { timingPolicy, currentCourseCode, currentAcademicYear, currentSemester, currentlyEnrolled });
      if (alternativeResult.warnings.length < alternatives.length) continue;
      warnings.push({ code: 'prerequisite_not_met', courseCode: normalize(currentCourseCode), prerequisiteCode: rule.anyOf.join(' หรือ '), minimumGrade: rule.minimumGrade ?? null, reason: 'any_of_not_met', message: `ยังไม่เคยศึกษาวิชาบังคับก่อนอย่างใดอย่างหนึ่ง: ${rule.anyOf.join(' หรือ ')}`, canBeWaived: true });
      continue;
    }
    const requiredCode = normalize(rule.prerequisiteCode ?? rule.course_code ?? rule.requiredCourseCode);
    if (!requiredCode) continue;
    const attempts = rows.filter(row => row.course_code === requiredCode);
    const passed = attempts.some(row => meetsGrade(row.grade, rule.minimumGrade ?? null));
    const studied = attempts.some(row => String(row.grade ?? '').toUpperCase() !== 'W');
    const sameTerm = currentOrder != null && attempts.some(row => orderOf(row) === currentOrder);
    const timingOkay = timingPolicy === 'before_or_same_term' ? attempts.some(row => orderOf(row) <= currentOrder) : attempts.some(row => orderOf(row) < currentOrder);
    if (passed && (currentOrder == null || timingOkay)) continue;
    if (rule.coRequisite && enrolled.has(requiredCode) && sameTerm) continue;
    warnings.push({
      code: 'prerequisite_not_met',
      courseCode: normalize(currentCourseCode),
      prerequisiteCode: requiredCode,
      minimumGrade: rule.minimumGrade ?? null,
      reason: !studied ? 'not_studied' : passed ? 'wrong_timing' : 'prerequisite_not_met',
      message: rule.minimumGrade ? `ยังไม่ผ่านวิชาบังคับก่อน ${requiredCode} ตามเกณฑ์ ${rule.minimumGrade}` : `ยังไม่เคยศึกษาวิชาบังคับก่อน ${requiredCode}`,
      canBeWaived: true,
    });
  }
  return { passed: warnings.length === 0, warnings };
}

export { meetsGrade as prerequisiteMeetsGrade };
