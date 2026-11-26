import { categoryConfigFor } from './category-config/index.mjs';
import { gradePoints } from './evaluate.mjs';

const normalizeCourse = value => String(value ?? '').replace(/\s+/g, '').toUpperCase();
const attemptOrder = record => Number(record.academic_year ?? 0) * 10 + Number(record.semester ?? 0);
const passGrade = (grade, minimumGrade = 'D') => {
  if (grade === 'ACC') return true;
  if (grade === 'S') return minimumGrade === 'D';
  const points = gradePoints(grade);
  const minimum = gradePoints(minimumGrade);
  return points !== null && minimum !== null && points >= minimum;
};

// Category evaluation intentionally does not select a latest attempt. A course is counted
// once when any attempt meets its configured minimum grade; F/U/W never pass and S counts
// as passing for the default D threshold (the current curriculum configs use letter grades).
export function evaluateByCategory(records, { curriculumId } = {}) {
  const config = categoryConfigFor(curriculumId);
  if (!config) return { status: 'incomplete', reason: 'unsupported_curriculum', categories: [], total: null, uncategorizedWarnings: [] };
  const definitions = config.categories;
  const categoryCodes = new Set(definitions.map(item => item.code));
  const byCourse = new Map();
  for (const record of records ?? []) {
    const code = normalizeCourse(record.course_code);
    if (!byCourse.has(code)) byCourse.set(code, []);
    byCourse.get(code).push(record);
  }

  const rawEarned = Object.fromEntries(definitions.map(item => [item.code, 0]));
  const coursesByCategory = Object.fromEntries(definitions.map(item => [item.code, []]));
  const uncategorizedWarnings = [];
  for (const [courseCode, attempts] of byCourse) {
    const knownCategories = [...new Set(attempts.map(row => row.category_code).filter(code => categoryCodes.has(code)))];
    if (!knownCategories.length) {
      const accAttempt = attempts.find(row => row.grade === 'ACC');
      if (accAttempt) {
        const credits = Number(accAttempt.credits) || 0;
        rawEarned.extra_credits += credits;
        coursesByCategory.extra_credits.push({ courseCode, credits, grade: 'ACC', minimumGrade: 'D', attemptCount: attempts.length });
        uncategorizedWarnings.push({ courseCode, reason: 'uncategorized_acc_extra', attempts: attempts.length });
      } else {
        uncategorizedWarnings.push({ courseCode, reason: 'uncategorized', attempts: attempts.length });
      }
      continue;
    }
    if (knownCategories.length > 1) {
      uncategorizedWarnings.push({ courseCode, reason: 'conflicting_categories', categories: knownCategories });
    }
    const categoryCode = knownCategories[0];
    const minimumGrade = config.minimumGradeByCourse?.[courseCode] ?? 'D';
    const passing = attempts.filter(row => passGrade(row.grade, minimumGrade)).sort((a, b) => attemptOrder(a) - attemptOrder(b));
    if (!passing.length) continue;
    const chosen = passing[0];
    const credits = Number(chosen.credits) || 0;
    rawEarned[categoryCode] += credits;
    coursesByCategory[categoryCode].push({
      courseCode,
      credits,
      grade: chosen.grade,
      minimumGrade,
      attemptCount: attempts.length,
    });
  }

  const carriedToFreeElective = config.excessCreditPolicy === 'carry_to_free_elective'
    ? config.excessCreditSourceCodes.reduce((sum, code) => sum + Math.max(0, rawEarned[code] - (definitions.find(item => item.code === code)?.minimumCredits ?? 0)), 0)
    : 0;
  const categories = definitions.map(definition => {
    const raw = rawEarned[definition.code];
    const ownEarned = definition.code === 'extra_credits' ? raw : Math.min(raw, definition.minimumCredits);
    const carriedIn = definition.code === 'free_elective' ? carriedToFreeElective : 0;
    const earned = ownEarned + carriedIn;
    const missing = Math.max(0, definition.minimumCredits - earned);
    const mandatoryMissingCourses = Object.entries(config.minimumGradeByCourse ?? {})
      .filter(([code]) => config.mandatoryCourseCategory?.[code] === definition.code)
      .filter(([code]) => (records ?? []).filter(row => normalizeCourse(row.course_code) === code).every(row => !passGrade(row.grade, config.minimumGradeByCourse[code])))
      .map(([courseCode, minimumGrade]) => ({ courseCode, minimumGrade }));
    return {
      code: definition.code,
      label: definition.label,
      requiredCredits: definition.minimumCredits,
      earnedCredits: earned,
      rawEarnedCredits: raw,
      excessCredits: Math.max(0, raw - definition.minimumCredits),
      carriedInCredits: carriedIn,
      missingCredits: missing,
      passed: missing === 0,
      courses: coursesByCategory[definition.code],
      mandatoryMissingCourses,
    };
  });
  const earnedCredits = Object.values(rawEarned).reduce((sum, value) => sum + value, 0);
  const requiredCredits = config.totalCredits;
  const totalPassed = earnedCredits >= requiredCredits;
  const categoriesPassed = categories.every(category => category.passed);
  return {
    status: 'ok',
    curriculumId,
    excessCreditPolicy: config.excessCreditPolicy,
    categories,
    total: { requiredCredits, earnedCredits, missingCredits: Math.max(0, requiredCredits - earnedCredits), passed: totalPassed },
    passedAllCategories: categoriesPassed && totalPassed,
    uncategorizedWarnings,
  };
}
