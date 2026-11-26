import { categoryConfigFor } from './category-config/index.mjs';
import { gradePoints } from './evaluate.mjs';

const normalizeCourse = value => String(value ?? '').replace(/\s+/g, '').toUpperCase();
const asCredits = value => Math.round((Number(value) || 0) * 1000);
const displayCredits = value => asCredits(value) / 1000;
const fromMilliCredits = value => Number(value || 0) / 1000;
const attemptOrder = record => Number(record.academic_year ?? 0) * 10 + Number(record.semester ?? 0);
const passGrade = (grade, minimumGrade = 'D') => {
  if (grade === 'ACC') return true;
  if (grade === 'S') return minimumGrade === 'D';
  const points = gradePoints(grade);
  const minimum = gradePoints(minimumGrade);
  return points !== null && minimum !== null && points >= minimum;
};

function courseMatches(code, group) {
  const normalized = normalizeCourse(code);
  if (group.courses?.some(item => normalizeCourse(item) === normalized)) return true;
  const range = group.courseCodeRange;
  if (!range) return false;
  const prefix = normalizeCourse(range.prefix);
  const match = normalized.match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match) return false;
  const number = Number(match[1]);
  return number >= Number(range.minNumber) && number <= Number(range.maxNumber);
}

function groupContainsRecord(group, records) {
  return (records ?? []).some(row => courseMatches(row.course_code, group)
    || Object.values(group.coursesByMajor ?? {}).some(courses => courses.some(course => normalizeCourse(course) === normalizeCourse(row.course_code)))
    || (group.subgroups ?? []).some(child => groupContainsRecord(child, [row]))
    || (group.groups ?? []).some(child => groupContainsRecord(child, [row])));
}

function evaluateGroup(group, records, config) {
  const passing = records.filter(row => passGrade(row.grade, config.minimumGradeByCourse?.[normalizeCourse(row.course_code)] ?? group.minimumGrade ?? 'D'));
  const matched = [...new Map(passing.filter(row => courseMatches(row.course_code, group)).map(row => [normalizeCourse(row.course_code), row])).values()];
  const creditSum = matched.reduce((sum, row) => sum + asCredits(row.credits), 0);
  const required = asCredits(group.requiredCredits);
  const children = group.subgroups ?? group.groups ?? [];
  const result = {
    code: group.code ?? null,
    type: group.type,
    requiredCredits: displayCredits(group.requiredCredits),
    earnedCredits: fromMilliCredits(Math.min(creditSum, required)),
    passed: false,
    warnings: [],
    courses: matched.map(row => ({ courseCode: normalizeCourse(row.course_code), credits: Number(row.credits) || 0, grade: row.grade })),
  };
  if (group.type === 'all') {
    const subResults = children.map(child => evaluateGroup(child, records, config));
    result.groups = subResults;
    result.earnedCredits = children.length
      ? subResults.reduce((sum, child) => sum + Number(child.earnedCredits || 0), 0)
      : fromMilliCredits(Math.min(creditSum, required));
    result.passed = (children.length ? subResults.every(item => item.passed) : creditSum >= required);
  } else if (group.type === 'one_of') {
    const options = (group.courses ?? []).map(course => evaluateGroup({ type: 'all', requiredCredits: group.requiredCredits, courses: [course] }, records, config));
    result.options = options;
    const best = options.find(item => item.passed) ?? options.sort((a, b) => b.earnedCredits - a.earnedCredits)[0];
    result.earnedCredits = best?.earnedCredits ?? 0;
    result.passed = Boolean(best?.passed);
  } else if (group.type === 'one_group_of') {
    const options = children.map(child => evaluateGroup({ ...child, type: child.type ?? 'all' }, records, config));
    result.options = options;
    const best = options.find(item => item.passed) ?? options.sort((a, b) => b.earnedCredits - a.earnedCredits)[0];
    result.earnedCredits = best?.earnedCredits ?? 0;
    result.passed = Boolean(best?.passed);
    if (!result.passed && options.some(item => item.earnedCredits > 0)) result.warnings.push('ต้องเลือกวิชาเป็นกลุ่มเดียวกัน');
  } else if (group.type === 'pick_credits') {
    result.passed = creditSum >= required;
    result.earnedCredits = displayCredits(Math.min(creditSum, required));
  } else {
    result.warnings.push(`ไม่รู้จักชนิดกลุ่ม ${group.type}`);
  }
  return result;
}

function structuredCategory(definition, records, config, majorCode) {
  const groups = definition.groupsByMajor?.[majorCode] ?? definition.groups;
  if (definition.groupsByMajor && !majorCode) {
    return { groups: [], passed: false, warnings: ['ไม่ทราบเอกของนักศึกษา จึงยังประเมินหมวดนี้ไม่ได้'] };
  }
  const results = (groups ?? []).map(group => evaluateGroup(group, records, config));
  return { groups: results, passed: results.length > 0 && results.every(item => item.passed), warnings: results.flatMap(item => item.warnings ?? []) };
}

// Category evaluation intentionally does not select a latest attempt. A course is counted
// once when any attempt meets its configured minimum grade; F/U/W never pass and S counts
// as passing for the default D threshold (the current curriculum configs use letter grades).
export function evaluateByCategory(records, { curriculumId, majorCode = null } = {}) {
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
  const syntheticCodes = new Set(['GEN', 'CORE', 'SPEC', 'MAJOR', 'OUT', 'FREE', 'REQUIRED', 'MATH', 'PROJECT']);
  const knownConfiguredCourse = !records.some(row => syntheticCodes.has(normalizeCourse(row.course_code)))
    && definitions.some(definition => (definition.groups ?? []).some(group => groupContainsRecord(group, records)));
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

  const excessSources = config.excessCreditSourceCodes ?? ['general_education', 'major_specific', 'major'];
  const carriedToFreeElective = ['carry_to_free_elective', 'carry_to_free_elective_limited'].includes(config.excessCreditPolicy)
    ? excessSources.reduce((sum, code) => sum + Math.max(0, rawEarned[code] - (definitions.find(item => item.code === code)?.minimumCredits ?? 0)), 0)
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
    const structured = knownConfiguredCourse ? structuredCategory(definition, records.filter(row => normalizeCourse(row.course_code) && row.category_code === definition.code), config, majorCode) : null;
    const categoryWarnings = structured?.warnings ?? [];
    return {
      code: definition.code,
      label: definition.label,
      requiredCredits: definition.minimumCredits,
      earnedCredits: earned,
      rawEarnedCredits: raw,
      excessCredits: Math.max(0, raw - definition.minimumCredits),
      carriedInCredits: carriedIn,
      carriedFromExcess: carriedIn > 0,
      missingCredits: missing,
      passed: structured ? structured.passed && missing === 0 : missing === 0,
      warnings: categoryWarnings,
      groups: structured?.groups ?? [],
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
