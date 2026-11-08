// Pure grading logic for V4 graduation verification. No database or network access.
//
// A condition is computed only when a graduation_rule row exists for it. Any other
// condition is reported as "incomplete" rather than guessed from its text. A rule of type
// 'manual' marks a condition that only a person can judge: it is reported as "manual" and
// caps the verdict at 'met_pending_review'.
// When the data is stale, failed, or partially rejected, no condition is reported as
// passed or not passed, and the verdict stays inconclusive.

export const GRADE_POINTS = Object.freeze({ A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 });
const PASS_ONLY_GRADES = new Set(['S', 'P']); // no GPA points; counts as earned credit
const FAIL_ONLY_GRADES = new Set(['U']); // no GPA points; earns no credit
const NO_RESULT_GRADES = new Set(['W', 'I']); // result not available yet, treated as missing
export const ACCEPTED_GRADES = new Set([
  ...Object.keys(GRADE_POINTS),
  ...PASS_ONLY_GRADES,
  ...FAIL_ONLY_GRADES,
  ...NO_RESULT_GRADES,
]);
export const DEFAULT_SNAPSHOT_MAX_AGE_DAYS = 30;
export const DEFAULT_GRADE_ATTEMPT_POLICY = 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const EPSILON = 1e-9;

export function gradePoints(grade) {
  return Object.hasOwn(GRADE_POINTS, grade) ? GRADE_POINTS[grade] : null;
}

export function earnsCredit(grade) {
  const points = gradePoints(grade);
  if (points !== null) return points >= 1;
  return PASS_ONLY_GRADES.has(grade);
}

const normalizeCourse = (code) => String(code ?? '').replace(/\s+/g, '');
const attemptOrder = (record) => Number(record.academic_year) * 10 + Number(record.semester);
const roundTo = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

const categoryText = value => String(value ?? '').trim().toLowerCase();
const isGeneralEducation = value => categoryText(value).includes('ศึกษาทั่วไป')
  || categoryText(value).includes('general_education')
  || categoryText(value).includes('general education');
const isFreeElective = value => categoryText(value).includes('วิชาเลือกเสรี')
  || categoryText(value).includes('free_elective')
  || categoryText(value).includes('free elective');

// Course placement/category is data, not a hard-coded credit rule.
export function classifyCourseCredit(record, { courseCatalog = null, category = null } = {}) {
  const code = normalizeCourse(record.course_code);
  const catalogProvided = courseCatalog instanceof Map;
  const catalogCourse = catalogProvided ? courseCatalog.get(code) : undefined;
  if (record.credit_category_status === 'pending') {
    return { category: record.requested_credit_category ?? null, countable: false, reviewStatus: 'pending_category_review', freeElectiveEligible: false };
  }
  if ((record.catalog_status === 'not_found' && !record.credit_category) || (catalogProvided && !catalogCourse && !record.credit_category)) {
    return { category: null, countable: false, reviewStatus: 'pending_catalog_review', freeElectiveEligible: false };
  }
  const sourceCategory = category
    ?? record.credit_category
    ?? catalogCourse?.requirement_type
    ?? catalogCourse?.course_group
    ?? null;
  const general100 = isGeneralEducation(sourceCategory) && /100$/.test(code);
  return {
    category: sourceCategory,
    countable: true,
    reviewStatus: general100 ? 'classified' : (sourceCategory ? 'classified' : 'pending_category_review'),
    freeElectiveEligible: isFreeElective(sourceCategory) && !general100,
  };
}

export function summarizeCreditBuckets(records, options = {}) {
  const latest = latestAttempts(records);
  const buckets = new Map();
  const pendingReview = [];
  for (const record of latest.values()) {
    if (!earnsCredit(record.grade)) continue;
    const classification = classifyCourseCredit(record, options);
    if (!classification.countable) {
      pendingReview.push({ courseCode: record.course_code, reason: classification.reviewStatus });
      continue;
    }
    const key = classification.freeElectiveEligible ? 'free_elective' : (classification.category ?? 'unclassified');
    buckets.set(key, Number(buckets.get(key) ?? 0) + Number(record.credits));
  }
  return { buckets, pendingReview };
}

// Splits grade rows by how far they can be trusted. Only `counted` rows may feed the verdict.
//   inProgress - the course is still being taken, so it is shown apart and never evaluated
//   rejected   - staff rejected the row
//   counted    - verified rows. CLI imports default to 'verified' (migration 015), so a
//                registrar import counts and a self-reported row counts only once staff verify it
//   pending    - anything else (a self-reported row nobody has verified yet): shown with a
//                label, never counted, so student-entered data cannot read as a pass
// Rows from a database without migration 015 have none of these fields. They are treated as
// imported + verified + not in progress, which is what every such row is.
//
// countSelfReported: when true, a student-entered row that nobody has decided yet also counts
// (it is still labelled self_reported + unverified wherever it is shown). It is off by default
// here; the API turns it on while the grade data is a mock and staff review is not required.
// A row staff rejected, and a course still in progress, never count either way.
export function partitionGradeRecords(records, { countSelfReported = false } = {}) {
  const counted = [];
  const pending = [];
  const rejected = [];
  const inProgress = [];
  for (const record of records) {
    const status = record.verification_status ?? 'verified';
    if (Number(record.is_in_progress ?? 0) === 1) inProgress.push(record);
    else if (status === 'rejected') rejected.push(record);
    else if (status === 'verified') counted.push(record);
    else if (countSelfReported && record.source === 'self_reported') counted.push(record);
    else pending.push(record);
  }
  return { counted, pending, rejected, inProgress };
}

// The curriculum a student is checked against: the one in their most recent attempt.
export function pickCurriculum(records) {
  let best = null;
  for (const record of records) {
    if (!best || attemptOrder(record) > attemptOrder(best)) best = record;
  }
  return best?.curriculum_id ?? null;
}

export function normalizeGradeAttemptPolicy(policy) {
  return policy === 'latest' ? 'latest' : DEFAULT_GRADE_ATTEMPT_POLICY;
}

// Each course counts once for earned credits. GPA can use every attempt or only the
// latest attempt, according to the curriculum setting.
function latestAttempts(records) {
  const latest = new Map();
  for (const record of records) {
    const code = normalizeCourse(record.course_code);
    const current = latest.get(code);
    if (!current || attemptOrder(record) > attemptOrder(current)) latest.set(code, record);
  }
  return latest;
}

export function summarize(records) {
  const options = arguments[1] ?? {};
  const attemptPolicy = normalizeGradeAttemptPolicy(options.attemptPolicy);
  const latest = latestAttempts(records);
  const gpaRecords = attemptPolicy === 'latest' ? [...latest.values()] : records;
  let earnedCredits = 0;
  let gpaCredits = 0;
  let weightedPoints = 0;
  const earnedByCourse = new Map();
  for (const record of latest.values()) {
    const credits = Number(record.credits);
    const code = normalizeCourse(record.course_code);
    if (earnsCredit(record.grade) && !earnedByCourse.has(code)) {
      earnedByCourse.set(code, credits);
      earnedCredits += credits;
    }
  }
  for (const record of gpaRecords) {
    const credits = Number(record.credits);
    const points = gradePoints(record.grade);
    if (points !== null) {
      gpaCredits += credits;
      weightedPoints += points * credits;
    }
  }
  const creditAllocation = options.courseCatalog instanceof Map
    ? summarizeCreditBuckets(records, options)
    : null;
  if (creditAllocation) {
    const excluded = new Set(creditAllocation.pendingReview.map(item => normalizeCourse(item.courseCode)));
    earnedCredits -= [...excluded].reduce((sum, code) => sum + Number(latest.get(code)?.credits ?? 0), 0);
  }
  return {
    latest,
    attemptPolicy,
    earnedCredits,
    gpaCredits,
    weightedPoints,
    gpa: gpaCredits > 0 ? weightedPoints / gpaCredits : null,
    creditBuckets: creditAllocation?.buckets ?? null,
    pendingCreditReview: creditAllocation?.pendingReview ?? [],
  };
}

const incomplete = (reason, details = {}) => ({ status: 'incomplete', reason, details });
const passFail = (passed, reason, details) => ({
  status: passed ? 'passed' : 'not_passed',
  reason: passed ? null : reason,
  details,
});

export function evaluateRule(rule, summary) {
  const params = rule.params ?? {};
  const courses = Array.isArray(params.courses) ? params.courses.map(normalizeCourse) : [];

  switch (rule.rule_type) {
    case 'min_total_credits': {
      if (!summary.latest.size) return incomplete('no_data');
      const required = Number(params.min);
      if (!Number.isFinite(required)) return incomplete('unsupported_rule');
      return passFail(summary.earnedCredits + EPSILON >= required, 'below_minimum', {
        earnedCredits: roundTo(summary.earnedCredits, 1),
        required,
      });
    }
    case 'min_gpa': {
      if (summary.gpa === null) return incomplete('no_graded_data');
      const required = Number(params.min);
      if (!Number.isFinite(required)) return incomplete('unsupported_rule');
      // Compare the unrounded GPA so that 1.995 cannot pass a 2.00 threshold.
      return passFail(summary.gpa + EPSILON >= required, 'below_minimum', {
        gpa: roundTo(summary.gpa, 2),
        required,
      });
    }
    case 'min_grade_each': {
      const minPoints = gradePoints(params.min_grade);
      if (minPoints === null || !courses.length) return incomplete('unsupported_rule');
      const missing = [];
      const belowMinimum = [];
      const nonComparable = [];
      for (const code of courses) {
        const attempt = summary.latest.get(code);
        if (!attempt || NO_RESULT_GRADES.has(attempt.grade)) {
          missing.push(code);
        } else if (PASS_ONLY_GRADES.has(attempt.grade)) {
          nonComparable.push(code);
        } else if (FAIL_ONLY_GRADES.has(attempt.grade) || gradePoints(attempt.grade) < minPoints) {
          belowMinimum.push(code);
        }
      }
      // A definite failure outweighs missing data: the rule cannot pass either way.
      if (belowMinimum.length) {
        return { status: 'not_passed', reason: 'below_minimum', details: { belowMinimum, missing, requiredGrade: params.min_grade } };
      }
      if (missing.length) return incomplete('missing_courses', { missing, requiredGrade: params.min_grade });
      if (nonComparable.length) return incomplete('non_comparable_grade', { courses: nonComparable, requiredGrade: params.min_grade });
      return { status: 'passed', reason: null, details: { requiredGrade: params.min_grade, courses } };
    }
    case 'min_avg_grade': {
      const required = Number(params.min);
      if (!courses.length || !Number.isFinite(required)) return incomplete('unsupported_rule');
      const missing = [];
      const nonGpa = [];
      let total = 0;
      for (const code of courses) {
        const attempt = summary.latest.get(code);
        if (!attempt || NO_RESULT_GRADES.has(attempt.grade)) {
          missing.push(code);
          continue;
        }
        const points = gradePoints(attempt.grade);
        if (points === null) {
          nonGpa.push(code);
          continue;
        }
        total += points;
      }
      if (missing.length) return incomplete('missing_courses', { missing });
      if (nonGpa.length) return incomplete('non_gpa_grade', { courses: nonGpa });
      const average = total / courses.length;
      return passFail(average + EPSILON >= required, 'below_minimum', {
        average: roundTo(average, 2),
        required,
        courses,
      });
    }
    // A condition only a person can judge (learning outcomes, faculty-specific requirements).
    // It is never computed and never passes on its own: it stays "manual" until staff review it.
    case 'manual':
      return { status: 'manual', reason: 'manual_review', details: {} };
    default:
      return incomplete('unsupported_rule');
  }
}

// dataSource.status values: ok, stale, import_failed, import_partial,
// student_rows_rejected, no_source.
export function evaluateGraduation({ conditions, rules, records, dataSource, attemptPolicy = DEFAULT_GRADE_ATTEMPT_POLICY, courseCatalog = null }) {
  const rulesByOrder = new Map(rules.map((rule) => [Number(rule.condition_order), rule]));
  const dataOk = dataSource.status === 'ok';

  if (!records.length) {
    return {
      verdict: 'no_data',
      conditions: conditions.map((condition) => ({
        order: condition.order,
        text: condition.text,
        status: 'incomplete',
        reason: 'no_data',
        details: {},
      })),
      totals: null,
    };
  }

  const summary = summarize(records, { attemptPolicy, courseCatalog });
  const results = conditions.map((condition) => {
    const rule = rulesByOrder.get(condition.order);
    const outcome = rule ? evaluateRule(rule, summary) : incomplete('no_rule');
    if (!dataOk) {
      // Hide computed values from stale or partial data so they cannot be read as a result.
      return { order: condition.order, text: condition.text, status: 'incomplete', reason: `data_${dataSource.status}`, details: {} };
    }
    return { order: condition.order, text: condition.text, status: outcome.status, reason: outcome.reason, details: outcome.details };
  });

  // Every condition is required. One definite failure means "not met" even if other
  // conditions lack data. Stale or failed data blocks any verdict, so it stays inconclusive.
  let verdict;
  if (!conditions.length || !dataOk) {
    verdict = 'inconclusive';
  } else if (results.some((item) => item.status === 'not_passed')) {
    verdict = 'not_met';
  } else if (results.some((item) => item.status === 'incomplete')) {
    verdict = 'inconclusive';
  } else if (results.some((item) => item.status === 'manual')) {
    // Everything the system can compute passed, but a person still has to judge the rest.
    // This is deliberately not "met": nobody has confirmed the manual conditions.
    verdict = 'met_pending_review';
  } else {
    verdict = 'met';
  }

  return {
    verdict,
    conditions: results,
    totals: dataOk
      ? { earnedCredits: roundTo(summary.earnedCredits, 1), gpa: summary.gpa === null ? null : roundTo(summary.gpa, 2) }
      : null,
    creditBuckets: dataOk ? Object.fromEntries(summary.creditBuckets ?? []) : null,
    pendingCreditReview: dataOk ? summary.pendingCreditReview : [],
  };
}

const toIso = (value) => (value ? new Date(value).toISOString() : null);

export function resolveDataSource({
  latestBatch = null,
  studentRejectedInLatest = 0,
  unidentifiedRejectedInLatest = 0,
  asOf = null,
  now = new Date(),
  maxAgeDays = DEFAULT_SNAPSHOT_MAX_AGE_DAYS,
}) {
  let status = 'ok';
  if (!latestBatch) {
    status = 'no_source';
  } else if (latestBatch.status === 'failed') {
    status = 'import_failed';
  } else if (latestBatch.status === 'partial' && unidentifiedRejectedInLatest > 0) {
    status = 'import_partial';
  } else if (latestBatch.status === 'partial' && studentRejectedInLatest > 0) {
    status = 'student_rows_rejected';
  } else if (!asOf || now.getTime() - asOf.getTime() > maxAgeDays * DAY_MS) {
    status = 'stale';
  }

  return {
    status,
    asOf: toIso(asOf),
    maxAgeDays,
    lastImport: latestBatch
      ? {
          batchId: Number(latestBatch.batch_id),
          status: latestBatch.status,
          sourceBatchId: latestBatch.source_batch_id ?? null,
          exportedAt: toIso(latestBatch.exported_at),
          finishedAt: toIso(latestBatch.finished_at),
          rowRejected: Number(latestBatch.row_rejected ?? 0),
        }
      : null,
  };
}

// A student with no registrar-imported rows has no import snapshot that could be stale or
// partial, so the import batch status says nothing about their data. Their data source is
// the self-reported rows that count (verified ones, plus undecided ones when `countUnverified`
// is on). With none counting there is nothing to evaluate, so the source stays "no_source".
// `basis` lets the UI label the source: 'self_reported' means unverified rows are included.
export function resolveSelfReportedSource(records, { countUnverified = false, now = new Date() } = {}) {
  let asOf = null;
  let usable = 0;
  let anyUnverified = false;
  for (const record of records) {
    if (record.source !== 'self_reported') continue;
    if (Number(record.is_in_progress ?? 0) === 1) continue;
    const status = record.verification_status;
    if (status !== 'verified' && !(countUnverified && status === 'unverified')) continue;
    usable += 1;
    if (status !== 'verified') anyUnverified = true;
    if (!record.verified_at) continue;
    const value = new Date(record.verified_at);
    if (!asOf || value > asOf) asOf = value;
  }
  // Unverified rows carry no timestamp, so the data is "as of now" (read live from the database).
  if (anyUnverified) asOf = now;
  return {
    status: usable ? 'ok' : 'no_source',
    basis: anyUnverified ? 'self_reported' : 'self_reported_verified',
    asOf: toIso(asOf),
    maxAgeDays: null,
    lastImport: null,
  };
}

// Access rules for graduation data.
// - A student may view only their own record.
// - Instructor and staff may view only students assigned to them.
// - Curriculum admins and anonymous users may view nothing.
export function canViewGraduation(actor, studentId, assignedStudentIds) {
  if (!actor?.authenticated) return { allowed: false, own: false };
  if (actor.role === 'student') {
    return actor.username === studentId ? { allowed: true, own: true } : { allowed: false, own: false };
  }
  if (actor.role === 'instructor' || actor.role === 'staff') {
    return assignedStudentIds.has(studentId) ? { allowed: true, own: false } : { allowed: false, own: false };
  }
  return { allowed: false, own: false };
}
