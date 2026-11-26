// Automated tests for V4 graduation verification. All data here is synthetic (DEMO*).
// Run from backend/: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import {
  batchStatus,
  gradeKey,
  parseCsv,
  planImport,
  prepareImportFile,
  readCsvTable,
  validateRow,
  ImportFileError,
} from '../src/graduation/adapter.mjs';
import {
  canViewGraduation,
  evaluateGraduation,
  calcGPAX,
  calcCoreAverageCondition,
  partitionGradeRecords,
  resolveDataSource,
} from '../src/graduation/evaluate.mjs';
import { isAccEligible, validateGradeEntry } from '../src/graduation/grade-entry.mjs';
import { normalizeAcademicYear } from '../src/graduation/academic-year.mjs';
import { categoryConfigFor, categoryConfigTotals, classifyCurriculumCourse } from '../src/graduation/category-config/index.mjs';
import { gradePolicyFor } from '../src/graduation/grade-policy-config/index.mjs';
import { backfillCategories, categoryUpdateForRow } from '../src/graduation/category-backfill.mjs';
import { evaluateByCategory } from '../src/graduation/category-evaluate.mjs';
import { evaluatePrerequisites } from '../src/graduation/prerequisite-evaluate.mjs';
import { normalizeCourseCode } from '../src/graduation/course-code.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(path.join(here, '..', 'fixtures', 'v4-demo', name), 'utf8');

// Mirrors the demo rules in fixtures/v4-demo/seed-demo.sql. Keep the two in sync.
const DEMO_CONDITIONS = [
  { order: 1, text: '[DEMO] outcome' },
  { order: 2, text: '[DEMO] credits >= 12' },
  { order: 3, text: '[DEMO] GPA >= 2.00' },
  { order: 4, text: '[DEMO] other' },
  { order: 5, text: '[DEMO] C in DEMO101 and DEMO102' },
  { order: 6, text: '[DEMO] average >= 2.00' },
];
const DEMO_RULES = [
  { condition_order: 2, rule_type: 'min_total_credits', params: { min: 12 } },
  { condition_order: 3, rule_type: 'min_gpa', params: { min: 2 } },
  { condition_order: 5, rule_type: 'min_grade_each', params: { courses: ['DEMO101', 'DEMO102'], min_grade: 'C' } },
  { condition_order: 6, rule_type: 'min_avg_grade', params: { courses: ['DEMO100', 'DEMO101', 'DEMO102', 'DEMO111'], min: 2, courseMinimumGrades: { DEMO100: 'D', DEMO101: 'D', DEMO102: 'D', DEMO111: 'D' } } },
];

// Builds DB-shaped grade rows from a CSV, the way the import writes them.
function recordsFromCsv(text, studentId) {
  const prepared = prepareImportFile(text);
  const plan = planImport(prepared);
  return plan.accepted
    .filter((item) => item.record.studentId === studentId)
    .map((item) => ({
      student_id: item.record.studentId,
      curriculum_id: item.record.curriculumId,
      academic_year: item.record.academicYear,
      semester: item.record.semester,
      course_code: item.record.courseCode,
      credits: item.record.credits,
      grade: item.record.grade,
    }));
}

const batch = (overrides = {}) => ({ status: 'success', batch_id: 1, source_batch_id: 'DEMO-BATCH-001', exported_at: new Date('2026-10-27T01:00:00Z'), finished_at: new Date(), row_rejected: 0, ...overrides });
const FRESH_OK = resolveDataSource({ latestBatch: batch(), asOf: new Date('2026-10-27T01:00:00Z'), now: new Date('2026-10-28T02:00:00Z') });
const ok = (status, extra = {}) => ({ ...FRESH_OK, status, ...extra });
const statusOf = (result, order) => result.conditions.find((item) => item.order === order);

test('grade entry accepts the supported student grades', () => {
  for (const grade of ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'S', 'U', 'W']) {
    assert.equal(validateGradeEntry({ courseCode: 'CS101', grade, credits: 3 }).ok, true, grade);
  }
});

test('normalizeCourseCode uses one canonical English code format', () => {
  assert.equal(normalizeCourseCode('TU 250'), 'TU250');
  assert.equal(normalizeCourseCode('มธ.250'), 'TU250');
  assert.equal(normalizeCourseCode('คคป.211'), 'CNC211');
  assert.equal(normalizeCourseCode('คพ.101'), 'CS101');
  assert.equal(normalizeCourseCode('  cnc 211 '), 'CNC211');
});

test('normalizeAcademicYear keeps CE internal and converts BE only at the boundary', () => {
  assert.equal(normalizeAcademicYear(2023), 2023);
  assert.equal(normalizeAcademicYear(2566, { sourceCalendar: 'BE' }), 2023);
  assert.equal(normalizeAcademicYear(2023, { sourceCalendar: 'BE' }), null);
  assert.equal(normalizeAcademicYear(2566), null);
});

test('curriculum category config groups add up to each category', async () => {
  const { categoryConfigFor } = await import('../src/graduation/category-config/index.mjs');
  for (const curriculumId of ['BSC-CS-2566', 'BSC-CNC-2568']) {
    const config = categoryConfigFor(curriculumId);
    assert.equal(normalizeAcademicYear(config.academicYear), config.academicYear);
    for (const category of config.categories) {
      const groups = category.groups ?? [];
      if (groups.length) assert.equal(groups.reduce((sum, group) => sum + Number(group.requiredCredits ?? 0), 0), category.minimumCredits, `${curriculumId}:${category.code}`);
      for (const group of groups.filter(item => item.type === 'all')) {
        assert.ok(Number(group.requiredCredits) > 0, `${curriculumId}:${category.code}:${group.code}`);
      }
      for (const majorGroups of Object.values(category.groupsByMajor ?? {})) {
        assert.equal(majorGroups.reduce((sum, group) => sum + Number(group.requiredCredits ?? 0), 0), category.minimumCredits, `${curriculumId}:${category.code}:major`);
      }
    }
  }
  const cs = categoryConfigFor('BSC-CS-2566');
  const cnc = categoryConfigFor('BSC-CNC-2568');
  assert.equal(cs.categories.reduce((sum, item) => sum + item.minimumCredits, 0), 123);
  assert.equal(cnc.categories.reduce((sum, item) => sum + item.minimumCredits, 0), 126);
});

test('ACC is accepted only for TU after course-code normalization', () => {
  assert.equal(validateGradeEntry({ courseCode: 'TU250', grade: 'ACC', credits: 1.5 }).ok, true);
  assert.equal(validateGradeEntry({ courseCode: 'มธ.250', grade: 'ACC', credits: 1.5 }).ok, true);
  for (const courseCode of ['EL105', 'LAS101', 'CS102']) {
    const result = validateGradeEntry({ courseCode, grade: 'ACC', credits: 3 });
    assert.equal(result.ok, false, courseCode);
    assert.equal(result.errors[0], 'ACC ใช้ได้เฉพาะวิชา มธ. (TU)');
  }
  assert.equal(validateGradeEntry({ courseCode: 'TU999', grade: 'ACC', credits: 3 }).ok, true);
  assert.equal(isAccEligible('EL105', { config: { allowedCoursePrefixes: ['EL'] } }), true);
  assert.equal(validateGradeEntry({ courseCode: 'EL105', grade: 'ACC', credits: 3 }, { accConfig: { allowedCoursePrefixes: ['EL'] } }).ok, true);
});

test('free elective entry requires a name and positive integer credits', () => {
  assert.equal(validateGradeEntry({ entryType: 'free_elective', courseCode: 'EL001', grade: 'A', credits: 3 }).ok, false);
  assert.equal(validateGradeEntry({ entryType: 'free_elective', courseCode: 'EL001', courseName: 'วิชาเสรี', grade: 'A', credits: 3 }).ok, true);
  assert.equal(validateGradeEntry({ entryType: 'free_elective', courseCode: 'EL001', courseName: 'วิชาเสรี', grade: 'A', credits: 3.5 }).ok, false);
});

test('W and F are accepted and in-progress has no grade', () => {
  assert.equal(validateGradeEntry({ courseCode: 'CS101', grade: 'W', credits: 3 }).ok, true);
  assert.equal(validateGradeEntry({ courseCode: 'CS101', grade: 'F', credits: 3 }).ok, true);
  assert.equal(validateGradeEntry({ courseCode: 'CS101', inProgress: true, credits: 3 }).ok, true);
});

test('calcGPAX counts every attempt, including F, and excludes S/U/W from GPAX', () => {
  const records = [
    { course_code: 'R1', credits: 3, grade: 'A' },
    { course_code: 'R1', credits: 3, grade: 'B' },
    { course_code: 'R1', credits: 3, grade: 'F' },
    { course_code: 'S1', credits: 3, grade: 'S' },
    { course_code: 'U1', credits: 3, grade: 'U' },
    { course_code: 'W1', credits: 3, grade: 'W' },
  ];
  const result = calcGPAX(records);
  assert.equal(result.gradedCredits, 9);
  assert.equal(result.weightedPoints, 21);
  assert.equal(result.gpa, 21 / 9);
});

test('ACC earns category credits but never enters GPAX, including when uncategorized', () => {
  const result = calcGPAX([{ course_code: 'TU250', credits: 1.5, grade: 'ACC' }, { course_code: 'CS101', credits: 3, grade: 'C' }]);
  assert.equal(result.gradedCredits, 3);
  const category = evaluateByCategory([{ course_code: 'TU250', credits: 1.5, grade: 'ACC', category_code: 'uncategorized' }], { curriculumId: 'BSC-CS-2566' });
  assert.equal(category.categories.find(item => item.code === 'extra_credits').earnedCredits, 1.5);
  assert.equal(category.uncategorizedWarnings[0].reason, 'uncategorized_acc_extra');
});

test('calcGPAX gives a 3-credit course taken three times a 9-credit denominator', () => {
  const result = calcGPAX([
    { course_code: 'R1', credits: 3, grade: 'F' },
    { course_code: 'R1', credits: 3, grade: 'B' },
    { course_code: 'R1', credits: 3, grade: 'A' },
  ]);
  assert.equal(result.gradedCredits, 9);
  assert.equal(result.gpa, 7 / 3);
});

test('core average uses a passing later attempt when D is below a C requirement', () => {
  const result = calcCoreAverageCondition([
    { course_code: 'CS101', credits: 3, grade: 'D', academic_year: 2025, semester: 1 },
    { course_code: 'CS101', credits: 3, grade: 'B', academic_year: 2026, semester: 1 },
  ], {
    curriculumId: 'BSC-CS-2566',
    courses: ['CS101'],
    requiredAverage: 2,
    courseMinimumGrades: { CS101: 'C' },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.details.selected[0].grade, 'B');
});

test('core average policies choose first, latest, or best passing attempt and flag duplicates', () => {
  const records = [
    { course_code: 'CS100', grade: 'D', academic_year: 2025, semester: 1 },
    { course_code: 'CS100', grade: 'B', academic_year: 2026, semester: 1 },
  ];
  const options = { curriculumId: 'BSC-CS-2566', courses: ['CS100'], requiredAverage: 2, courseMinimumGrades: { CS100: 'D' } };
  const first = calcCoreAverageCondition(records, { ...options, coreAveragePassPolicy: 'first_pass' });
  const latest = calcCoreAverageCondition(records, { ...options, coreAveragePassPolicy: 'latest_pass' });
  const best = calcCoreAverageCondition(records, { ...options, coreAveragePassPolicy: 'best_pass' });
  assert.equal(first.details.selected[0].grade, 'D');
  assert.equal(latest.details.selected[0].grade, 'B');
  assert.equal(best.details.selected[0].grade, 'B');
  assert.deepEqual(first.details.multiplePassingAttempts, ['CS100']);
  assert.equal(first.details.reviewRequired, true);
});

test('core average ignores a latest F when an earlier attempt passed', () => {
  const result = calcCoreAverageCondition([
    { course_code: 'CS101', grade: 'C', academic_year: 2025, semester: 1 },
    { course_code: 'CS101', grade: 'F', academic_year: 2026, semester: 1 },
  ], {
    curriculumId: 'BSC-CS-2566',
    courses: ['CS101'],
    requiredAverage: 2,
    courseMinimumGrades: { CS101: 'C' },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.details.selected[0].grade, 'C');
});

test('core-average D grades do not count as passing for CS or CNC config', () => {
  const cs = gradePolicyFor('BSC-CS-2566');
  const cnc = gradePolicyFor('BSC-CNC-2568');
  const csResult = calcCoreAverageCondition([
    { course_code: 'CS100', grade: 'D', academic_year: 2025, semester: 1 },
  ], { curriculumId: 'BSC-CS-2566', courses: ['CS100'], requiredAverage: 2 });
  const cncResult = calcCoreAverageCondition([
    { course_code: 'CNC211', grade: 'D', academic_year: 2025, semester: 1 },
  ], { curriculumId: 'BSC-CNC-2568', courses: ['CNC211'], requiredAverage: 2 });
  assert.equal(Object.values(cs.coreAverageCourseMinimumGrades).every(grade => grade === 'C'), true);
  assert.equal(Object.values(cnc.coreAverageCourseMinimumGrades).every(grade => grade === 'C'), true);
  assert.deepEqual(csResult.details.missing, ['CS100']);
  assert.deepEqual(cncResult.details.missing, ['CNC211']);
});

test('core average reaches the exact 2.00 boundary', () => {
  const result = calcCoreAverageCondition([
    { course_code: 'CS100', grade: 'C', academic_year: 2025, semester: 1 },
    { course_code: 'CS232', grade: 'C', academic_year: 2025, semester: 1 },
  ], {
    curriculumId: 'BSC-CS-2566',
    courses: ['CS100', 'CS232'],
    requiredAverage: 2,
    courseMinimumGrades: { CS100: 'C', CS232: 'D' },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.details.average, 2);
});

test('backend category configs stay separate and add up to each curriculum total', () => {
  const totals = categoryConfigTotals();
  assert.deepEqual(totals['BSC-CS-2566'], { totalCredits: 123, categoryCredits: 123 });
  assert.deepEqual(totals['BSC-CNC-2568'], { totalCredits: 126, categoryCredits: 126 });
  assert.equal(classifyCurriculumCourse({ curriculumId: 'BSC-CS-2566', courseGroup: 'วิชาศึกษาทั่วไป' }).code, 'general_education');
  assert.equal(classifyCurriculumCourse({ curriculumId: 'BSC-CNC-2568', courseGroup: 'วิชาศึกษาทั่วไป' }).code, 'general_education');
  assert.equal(classifyCurriculumCourse({ curriculumId: 'BSC-CS-2566', courseGroup: 'วิชาเฉพาะ' }).code, 'uncategorized');
});

const categoryRow = (course_code, category_code, credits, grade = 'A', academic_year = 2566, semester = 1) => ({ course_code, category_code, credits, grade, academic_year, semester });
const completeCsRows = ({ general = 30, major = 30 } = {}) => [
  categoryRow('GEN', 'general_education', general),
  categoryRow('CORE', 'major_core', 12),
  categoryRow('SPEC', 'major_specific', 42),
  categoryRow('MAJOR', 'major', major),
  categoryRow('OUT', 'outside_major_required', 3),
  categoryRow('FREE', 'free_elective', 6),
  categoryRow('CS101', 'major_core', 0, 'C'),
  categoryRow('CS102', 'major_core', 0, 'C'),
  categoryRow('CS111', 'major_core', 0, 'C'),
];

test('evaluateByCategory passes CS at exactly 123 and keeps CNC config separate', () => {
  const cs = evaluateByCategory(completeCsRows(), { curriculumId: 'BSC-CS-2566' });
  assert.equal(cs.total.earnedCredits, 123);
  assert.equal(cs.passedAllCategories, true);
  assert.equal(cs.categories.find(item => item.code === 'major_core').requiredCredits, 12);
  const cnc = evaluateByCategory([categoryRow('GEN', 'general_education', 24)], { curriculumId: 'BSC-CNC-2568' });
  assert.equal(cnc.total.requiredCredits, 126);
  assert.notEqual(cnc.categories.some(item => item.code === 'major_core'), true);
});

test('evaluateByCategory passes CNC at exactly 126 credits', () => {
  const rows = [
    categoryRow('GEN', 'general_education', 24),
    categoryRow('MATH', 'mathematics_foundation', 9),
    categoryRow('REQUIRED', 'major_required', 81),
    categoryRow('PROJECT', 'project_or_coop', 6),
    categoryRow('FREE', 'free_elective', 6),
    ...['CNC101', 'CNC102', 'CNC222', 'CNC231', 'CNC235'].map(code => categoryRow(code, 'major_required', 0, 'C')),
  ];
  const result = evaluateByCategory(rows, { curriculumId: 'BSC-CNC-2568' });
  assert.equal(result.total.earnedCredits, 126);
  assert.equal(result.passedAllCategories, true);
});

test('category configs declare limited excess-credit policy without changing current evaluator behavior', () => {
  assert.equal(categoryConfigFor('BSC-CS-2566').excessCreditPolicy, 'carry_to_free_elective_limited');
  assert.equal(categoryConfigFor('BSC-CNC-2568').excessCreditPolicy, 'carry_to_free_elective_limited');
  const result = evaluateByCategory(completeCsRows({ general: 33, major: 27 }), { curriculumId: 'BSC-CS-2566' });
  assert.equal(result.total.earnedCredits, 123);
  assert.equal(result.total.passed, true);
  assert.equal(result.passedAllCategories, false);
  assert.equal(result.categories.find(item => item.code === 'major').missingCredits, 3);
  assert.equal(result.categories.find(item => item.code === 'free_elective').carriedInCredits, 3);
  assert.equal(result.categories.find(item => item.code === 'free_elective').earnedCredits, 9);
});

test('evaluateByCategory counts repeated courses once and keeps only earned grades', () => {
  const result = evaluateByCategory([
    categoryRow('REPEAT', 'general_education', 3, 'F'),
    categoryRow('REPEAT', 'general_education', 3, 'A', 2567),
    categoryRow('FAIL', 'general_education', 3, 'W'),
    categoryRow('FAIL2', 'general_education', 3, 'U'),
    categoryRow('PASS', 'general_education', 3, 'S'),
  ], { curriculumId: 'BSC-CS-2566' });
  const general = result.categories.find(item => item.code === 'general_education');
  assert.equal(general.rawEarnedCredits, 6);
  assert.deepEqual(general.courses.map(item => item.courseCode), ['REPEAT', 'PASS']);
});

test('structured category groups enforce one_of, one_group_of, ranges, and missing major warnings', () => {
  const result = evaluateByCategory([
    categoryRow('TU250', 'general_education', 1.5),
    categoryRow('TU201', 'general_education', 3),
    categoryRow('CNC303', 'project_or_coop', 3),
    categoryRow('CNC404', 'project_or_coop', 3),
  ], { curriculumId: 'BSC-CNC-2568' });
  const ge = result.categories.find(item => item.code === 'general_education');
  const project = result.categories.find(item => item.code === 'project_or_coop');
  assert.equal(ge.groups.length, 5);
  assert.equal(project.groups[0].passed, false);
  assert.match(project.warnings[0], /กลุ่มเดียวกัน/);
  const cs = evaluateByCategory([categoryRow('CS221', 'major_specific', 3)], { curriculumId: 'BSC-CS-2566' });
  assert.match(cs.categories.find(item => item.code === 'major').warnings[0], /ไม่ทราบเอก/);
});

test('prerequisite evaluation uses any passing attempt and emits timing warnings', () => {
  const result = evaluatePrerequisites([
    { course_code: 'CS303', grade: 'C', academic_year: 2566, semester: 1 },
    { course_code: 'CS304', grade: 'W', academic_year: 2566, semester: 2 },
  ], [{ prerequisiteCode: 'CS303', minimumGrade: 'C' }], {
    currentCourseCode: 'CS403', currentAcademicYear: 2567, currentSemester: 1,
  });
  assert.equal(result.passed, true);
  const failed = evaluatePrerequisites([], [{ prerequisiteCode: 'CS303', minimumGrade: 'C' }], { currentCourseCode: 'CS403', currentAcademicYear: 2567, currentSemester: 1 });
  assert.equal(failed.warnings[0].reason, 'not_studied');
});

test('prerequisite OR groups do not require the other alternative and do not invent D', async () => {
  const { evaluatePrerequisites } = await import('../src/graduation/prerequisite-evaluate.mjs');
  const result = evaluatePrerequisites([
    { course_code: 'CS102', grade: 'S', academic_year: 2566, semester: 1 },
  ], [{ anyOf: ['CS102', 'CS103'], minimumGrade: null }], {
    currentCourseCode: 'CS111', currentAcademicYear: 2567, currentSemester: 1,
  });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 0);
});

test('mandatory course below C is not counted and appears as missing', () => {
  const result = evaluateByCategory([categoryRow('CS101', 'major_core', 3, 'D')], { curriculumId: 'BSC-CS-2566' });
  const core = result.categories.find(item => item.code === 'major_core');
  assert.equal(core.rawEarnedCredits, 0);
  assert.deepEqual(core.mandatoryMissingCourses, [
    { courseCode: 'CS101', minimumGrade: 'C' },
    { courseCode: 'CS102', minimumGrade: 'C' },
    { courseCode: 'CS111', minimumGrade: 'C' },
  ]);
});

test('uncategorized records become explicit warnings', () => {
  const result = evaluateByCategory([categoryRow('UNKNOWN', 'uncategorized', 3, 'A')], { curriculumId: 'BSC-CS-2566' });
  assert.deepEqual(result.uncategorizedWarnings, [{ courseCode: 'UNKNOWN', reason: 'uncategorized', attempts: 1 }]);
});

test('self-reported free electives keep the free-elective category', () => {
  assert.deepEqual(categoryUpdateForRow({ entry_type: 'free_elective', curriculum_id: 'BSC-CS-2566', course_group: null }), {
    code: 'free_elective',
    label: 'วิชาเลือกเสรี',
  });
});

test('category migration is additive and does not overwrite grade values', () => {
  const sql = readFileSync(path.join(here, '..', 'migrations', '020_graduation_grade_categories.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN category_code/);
  assert.match(sql, /ADD COLUMN category_label/);
  assert.doesNotMatch(sql, /UPDATE\s+graduation_grade_record/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+graduation_grade_record/i);
});

test('category backfill updates only category fields and reports uncategorized rows', async () => {
  const updates = [];
  const conn = {
    async query() {
      return [[
        { grade_record_id: 1, curriculum_id: 'BSC-CS-2566', course_code: 'TU101', entry_type: 'catalog', course_group: 'วิชาศึกษาทั่วไป', course_type_code: null },
        { grade_record_id: 2, curriculum_id: 'BSC-CS-2566', course_code: 'UNKNOWN1', entry_type: 'catalog', course_group: 'วิชาเฉพาะ', course_type_code: null },
        { grade_record_id: 3, curriculum_id: 'BSC-CS-2566', course_code: 'FREE1', entry_type: 'free_elective', course_group: null, course_type_code: null },
      ]];
    },
    async execute(sql, params) {
      updates.push({ sql, params });
    },
  };
  const result = await backfillCategories(conn, { apply: true });
  assert.equal(result.scanned, 3);
  assert.equal(result.updated, 3);
  assert.equal(result.uncategorizedCount, 1);
  assert.deepEqual(result.uncategorizedCourseCodes, ['UNKNOWN1']);
  assert.equal(updates.length, 3);
  assert.deepEqual(updates[0].params, ['general_education', 'วิชาศึกษาทั่วไป', 1]);
  assert.deepEqual(updates[2].params, ['free_elective', 'วิชาเลือกเสรี', 3]);
  assert.match(updates[0].sql, /SET category_code = \?, category_label = \?/);
  assert.match(updates[0].sql, /WHERE grade_record_id = \? AND category_code IS NULL/);
});

test('backfill preserves attempts, grades, source type, and curriculum-specific categories', async () => {
  const state = [
    { grade_record_id: 11, curriculum_id: 'BSC-CS-2566', course_code: 'REPEAT1', attempt_no: 1, grade: 'A', entry_type: 'catalog', course_group: 'วิชาเฉพาะ–วิชาแกน', course_type_code: null, category_code: null },
    { grade_record_id: 12, curriculum_id: 'BSC-CS-2566', course_code: 'REPEAT1', attempt_no: 2, grade: 'F', entry_type: 'catalog', course_group: 'วิชาเฉพาะ–วิชาแกน', course_type_code: null, category_code: null },
    { grade_record_id: 13, curriculum_id: 'BSC-CS-2566', course_code: 'SELF1', attempt_no: 1, grade: 'S', entry_type: 'catalog', course_group: 'วิชาศึกษาทั่วไป', course_type_code: null, category_code: null },
    { grade_record_id: 14, curriculum_id: 'BSC-CS-2566', course_code: 'FREE1', attempt_no: 1, grade: 'U', entry_type: 'free_elective', course_group: null, course_type_code: null, category_code: null },
    { grade_record_id: 15, curriculum_id: 'BSC-CNC-2568', course_code: 'SAME1', attempt_no: 1, grade: 'W', entry_type: 'catalog', course_group: 'วิชาเฉพาะ–วิชาบังคับ', course_type_code: null, category_code: null },
  ];
  const before = state.map(row => ({ id: row.grade_record_id, grade: row.grade, attempt: row.attempt_no }));
  const conn = {
    async query() {
      return [state.filter(row => row.category_code == null).map(({ grade_record_id, curriculum_id, course_code, entry_type, course_group, course_type_code }) => ({ grade_record_id, curriculum_id, course_code, entry_type, course_group, course_type_code }))];
    },
    async execute(sql, [code, label, id]) {
      const row = state.find(item => item.grade_record_id === id);
      row.category_code = code;
      row.category_label = label;
    },
  };
  const first = await backfillCategories(conn, { apply: true });
  const second = await backfillCategories(conn, { apply: true });
  assert.equal(first.scanned, 5);
  assert.deepEqual(first.categoryCounts, { major_core: 2, general_education: 1, free_elective: 1, major_required: 1 });
  assert.deepEqual(second, { scanned: 0, updated: 0, categoryCounts: {}, uncategorizedCount: 0, uncategorizedCourseCodes: [] });
  assert.deepEqual(state.map(row => ({ id: row.grade_record_id, grade: row.grade, attempt: row.attempt_no })), before);
  assert.equal(state[0].category_code, state[1].category_code);
  assert.equal(state[2].category_code, 'general_education');
  assert.equal(state[3].category_code, 'free_elective');
  assert.equal(state[4].category_code, 'major_required');
});

test('rollback migration is additive reversal only and does not rewrite grade data', () => {
  const sql = readFileSync(path.join(here, '..', 'migrations', 'rollback', '020_graduation_grade_categories.down.sql'), 'utf8');
  assert.match(sql, /DROP COLUMN category_label/);
  assert.match(sql, /DROP COLUMN category_code/);
  assert.doesNotMatch(sql, /UPDATE\s+graduation_grade_record/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+graduation_grade_record/i);
});

// ---------- Adapter: CSV parsing and contract validation ----------

test('parseCsv handles BOM, CRLF, quoted fields, and doubled quotes', () => {
  const rows = parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n');
  assert.deepEqual(rows.map((row) => row.values), [['a', 'b'], ['x, y', 'say "hi"']]);
});

test('readCsvTable rejects a file whose header lacks exportedAt', () => {
  assert.throws(
    () => readCsvTable(fixture('batch-003-demo-header-missing.csv')),
    (error) => error instanceof ImportFileError && error.code === 'E_HEADER_MISSING' && error.details.missing.includes('exportedAt'),
  );
});

test('batch-001 is fully valid and imports as success', () => {
  const prepared = prepareImportFile(fixture('batch-001-demo-success.csv'));
  const plan = planImport(prepared);
  assert.equal(prepared.sourceBatchId, 'DEMO-BATCH-001');
  assert.equal(plan.counts.rejected, 0);
  assert.equal(plan.counts.inserted, 23);
  assert.equal(batchStatus(plan.counts), 'success');
});

test('batch-002 rejects one identified row for DEMO0003 and imports as partial', () => {
  const plan = planImport(prepareImportFile(fixture('batch-002-demo-partial.csv')));
  assert.equal(plan.counts.rejected, 1);
  assert.deepEqual(plan.errorRows.map((row) => [row.studentId, row.errorCode]), [['DEMO0003', 'E_GRADE']]);
  assert.equal(batchStatus(plan.counts), 'partial');
});

test('re-importing the same rows is idempotent: nothing is inserted or duplicated', () => {
  const prepared = prepareImportFile(fixture('batch-001-demo-success.csv'));
  const existing = new Map();
  for (const item of planImport(prepared).accepted) existing.set(item.key, { row_hash: item.hash });
  const second = planImport(prepared, { existingRows: existing });
  assert.equal(second.counts.inserted, 0);
  assert.equal(second.counts.updated, 0);
  assert.equal(second.counts.unchanged, 23);
  assert.equal(second.accepted.length, 23);
});

test('recovery batch-004 adds the missing DEMO0003 course and leaves other rows unchanged', () => {
  const first = prepareImportFile(fixture('batch-001-demo-success.csv'));
  const existing = new Map(planImport(first).accepted.map((item) => [item.key, { row_hash: item.hash }]));
  const recovery = planImport(prepareImportFile(fixture('batch-004-demo-recovery.csv')), { existingRows: existing });
  assert.equal(recovery.counts.inserted, 1);
  assert.equal(recovery.counts.unchanged, 23);
  assert.equal(recovery.counts.rejected, 0);
});

test('a changed grade for the same key is an update, not a duplicate row', () => {
  const base = 'studentId,curriculumId,academicYear,semester,courseCode,credits,grade,sourceBatchId,exportedAt\n';
  const meta = ',DEMO-BATCH-X,2026-10-28T08:00:00+07:00';
  const prepared = prepareImportFile(`${base}DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,B${meta}\n`);
  const existingKey = gradeKey({ studentId: 'DEMO0001', curriculumId: 'DEMO-GRAD-V4', academicYear: 2025, semester: 1, courseCode: 'DEMO100' });
  const plan = planImport(prepared, { existingRows: new Map([[existingKey, { row_hash: 'different' }]]) });
  assert.equal(plan.counts.updated, 1);
  assert.equal(plan.counts.inserted, 0);
});

test('same key twice in one file: identical rows collapse, conflicting rows are rejected', () => {
  const base = 'studentId,curriculumId,academicYear,semester,courseCode,credits,grade,sourceBatchId,exportedAt\n';
  const meta = ',DEMO-BATCH-X,2026-10-28T08:00:00+07:00';
  const plan = planImport(prepareImportFile(
    `${base}DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,A${meta}\nDEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,A${meta}\nDEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,B${meta}\n`,
  ));
  assert.equal(plan.counts.inserted, 1);
  assert.equal(plan.counts.unchanged, 1);
  assert.equal(plan.errorSummary.E_DUPLICATE_CONFLICT, 1);
});

test('rows with different sourceBatchId in one file reject the whole file', () => {
  const text = 'studentId,curriculumId,academicYear,semester,courseCode,credits,grade,sourceBatchId,exportedAt\n'
    + 'DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,A,BATCH-A,2026-10-28T08:00:00+07:00\n'
    + 'DEMO0001,DEMO-GRAD-V4,2025,1,DEMO101,3,A,BATCH-B,2026-10-28T08:00:00+07:00\n';
  assert.throws(() => prepareImportFile(text), (error) => error.code === 'E_BATCH_MIXED');
});

test('each cell is checked against the contract', () => {
  const header = 'studentId,curriculumId,academicYear,semester,courseCode,credits,grade,sourceBatchId,exportedAt';
  const bad = [
    ['studentId', 'E_STUDENT_ID', 'DE MO,DEMO-GRAD-V4,2025,1,DEMO100,3,A,B1,2026-10-28T08:00:00+07:00'],
    ['academicYear', 'E_ACADEMIC_YEAR', 'DEMO0001,DEMO-GRAD-V4,25,1,DEMO100,3,A,B1,2026-10-28T08:00:00+07:00'],
    ['semester', 'E_SEMESTER', 'DEMO0001,DEMO-GRAD-V4,2025,4,DEMO100,3,A,B1,2026-10-28T08:00:00+07:00'],
    ['credits', 'E_CREDITS', 'DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3.25,A,B1,2026-10-28T08:00:00+07:00'],
    ['grade', 'E_GRADE', 'DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,X,B1,2026-10-28T08:00:00+07:00'],
    ['exportedAt', 'E_EXPORTED_AT', 'DEMO0001,DEMO-GRAD-V4,2025,1,DEMO100,3,A,B1,28/10/2026'],
  ];
  for (const [label, code, line] of bad) {
    const table = readCsvTable(`${header}\n${line}\n`);
    const result = validateRow(table.rows[0], table.headers.length);
    assert.ok(result.errors.includes(code), `${label} should produce ${code}, got ${result.errors}`);
    assert.equal(result.record, null);
  }
});

test('a curriculum missing from the database rejects the row', () => {
  const plan = planImport(prepareImportFile(fixture('batch-001-demo-success.csv')), { knownCurriculumIds: new Set() });
  assert.equal(plan.errorSummary.E_CURRICULUM_UNKNOWN, 23);
  assert.equal(batchStatus(plan.counts), 'failed');
});

// ---------- Evaluation: TC1 and TC2 scenarios ----------

test('DEMO0001 passes every computable condition but stays inconclusive (no rule for conditions 1 and 4)', () => {
  const result = evaluateGraduation({
    conditions: DEMO_CONDITIONS,
    rules: DEMO_RULES,
    records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0001'),
    dataSource: ok('ok'),
  });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(statusOf(result, 1).reason, 'no_rule');
  assert.equal(statusOf(result, 2).status, 'passed');
  assert.equal(statusOf(result, 3).status, 'passed');
  assert.equal(statusOf(result, 5).status, 'passed');
  assert.equal(statusOf(result, 6).status, 'passed');
  assert.equal(result.totals.earnedCredits, 24);
});

test('TC1: DEMO0002 is shown the conditions it has not passed (GPA, C in DEMO101, average)', () => {
  const result = evaluateGraduation({
    conditions: DEMO_CONDITIONS,
    rules: DEMO_RULES,
    records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0002'),
    dataSource: ok('ok'),
  });
  assert.equal(result.verdict, 'not_met');
  assert.equal(statusOf(result, 2).status, 'passed');
  assert.equal(statusOf(result, 3).status, 'not_passed');
  assert.equal(statusOf(result, 3).details.gpa, 1.13);
  assert.deepEqual(statusOf(result, 5).details.belowMinimum, ['DEMO101', 'DEMO102']);
  assert.equal(statusOf(result, 6).status, 'incomplete');
  assert.equal(statusOf(result, 6).reason, 'missing_courses');
});

test('TC2: DEMO0003 with batch-001 only is missing DEMO102, so conditions 5 and 6 are incomplete', () => {
  const result = evaluateGraduation({
    conditions: DEMO_CONDITIONS,
    rules: DEMO_RULES,
    records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0003'),
    dataSource: ok('ok'),
  });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(statusOf(result, 5).status, 'incomplete');
  assert.equal(statusOf(result, 5).reason, 'missing_courses');
  assert.deepEqual(statusOf(result, 5).details.missing, ['DEMO102']);
  assert.equal(statusOf(result, 6).reason, 'missing_courses');
});

test('a pass-only grade cannot be treated as meeting a minimum letter-grade requirement', () => {
  const result = evaluateGraduation({
    conditions: [{ order: 1, text: 'DEMO letter-grade requirement' }],
    rules: [{ condition_order: 1, rule_type: 'min_grade_each', params: { courses: ['DEMO101'], min_grade: 'C' } }],
    records: [{ student_id: 'DEMO0001', curriculum_id: 'DEMO-GRAD-V4', academic_year: 2025, semester: 1, course_code: 'DEMO101', credits: 3, grade: 'S' }],
    dataSource: ok('ok'),
  });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(statusOf(result, 1).reason, 'non_comparable_grade');
});

test('stale snapshot: no pass or fail is reported and computed values are hidden', () => {
  const stale = resolveDataSource({ latestBatch: batch(), asOf: new Date('2026-08-01T00:00:00Z'), now: new Date('2026-10-28T00:00:00Z') });
  assert.equal(stale.status, 'stale');
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0002'), dataSource: stale });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.totals, null);
  for (const item of result.conditions) {
    assert.equal(item.status, 'incomplete');
    assert.equal(item.reason, 'data_stale');
    assert.deepEqual(item.details, {});
  }
});

test('failed latest import: even fully passing data is inconclusive', () => {
  const failed = resolveDataSource({ latestBatch: batch({ status: 'failed' }), asOf: new Date('2026-10-27T01:00:00Z'), now: new Date('2026-10-28T02:00:00Z') });
  assert.equal(failed.status, 'import_failed');
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0001'), dataSource: failed });
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(statusOf(result, 2).reason, 'data_import_failed');
});

test('partial import with a rejected row for this student blocks that student only', () => {
  const partial = batch({ status: 'partial', row_rejected: 1 });
  const affected = resolveDataSource({ latestBatch: partial, studentRejectedInLatest: 1, asOf: new Date('2026-10-28T01:00:00Z'), now: new Date('2026-10-28T02:00:00Z') });
  const unaffected = resolveDataSource({ latestBatch: partial, studentRejectedInLatest: 0, asOf: new Date('2026-10-28T01:00:00Z'), now: new Date('2026-10-28T02:00:00Z') });
  assert.equal(affected.status, 'student_rows_rejected');
  assert.equal(unaffected.status, 'ok');
});

test('partial import with an unidentifiable rejected row blocks every student', () => {
  const status = resolveDataSource({ latestBatch: batch({ status: 'partial' }), unidentifiedRejectedInLatest: 1, asOf: new Date(), now: new Date() });
  assert.equal(status.status, 'import_partial');
});

test('no rule for any condition never produces a met verdict', () => {
  const result = evaluateGraduation({
    conditions: DEMO_CONDITIONS,
    rules: [],
    records: recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0001'),
    dataSource: ok('ok'),
  });
  assert.notEqual(result.verdict, 'met');
  assert.equal(result.verdict, 'inconclusive');
});

test('no grade records: verdict is no_data, not pass or fail', () => {
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: [], dataSource: ok('ok') });
  assert.equal(result.verdict, 'no_data');
});

test('GPA comparison uses the unrounded value, so 1.996 does not pass a 2.00 minimum', () => {
  // Synthetic boundary case (credits above the contract maximum of 12 on purpose).
  // 249.5 credits at C (2.0) and 0.5 credits at F (0.0) give GPA 499 / 250 = 1.996.
  const records = [
    { student_id: 'X', curriculum_id: 'C', academic_year: 2025, semester: 1, course_code: 'A1', credits: 249.5, grade: 'C' },
    { student_id: 'X', curriculum_id: 'C', academic_year: 2025, semester: 1, course_code: 'A2', credits: 0.5, grade: 'F' },
  ];
  const result = evaluateGraduation({
    conditions: [{ order: 1, text: 'gpa' }],
    rules: [{ condition_order: 1, rule_type: 'min_gpa', params: { min: 2 } }],
    records,
    dataSource: ok('ok'),
  });
  assert.equal(statusOf(result, 1).status, 'not_passed');
});

// ---------- Source and verification: unverified data must never count ----------

const gradeRow = (course, grade, overrides = {}) => ({
  student_id: 'DEMO0004',
  curriculum_id: 'DEMO-GRAD-V4',
  academic_year: 2025,
  semester: 1,
  course_code: course,
  credits: 3,
  grade,
  ...overrides,
});

test('partition: rows from a database without migration 015 count as verified imports', () => {
  const { counted, pending, rejected, inProgress } = partitionGradeRecords([gradeRow('DEMO100', 'A')]);
  assert.equal(counted.length, 1);
  assert.equal(pending.length + rejected.length + inProgress.length, 0);
});

test('partition: a self-reported unverified row is pending, never counted', () => {
  const row = gradeRow('DEMO100', 'A', { source: 'self_reported', verification_status: 'unverified', is_in_progress: 0 });
  const result = partitionGradeRecords([row]);
  assert.deepEqual([result.counted.length, result.pending.length], [0, 1]);
});

test('partition: a self-reported row counts only after staff verify it', () => {
  const row = gradeRow('DEMO100', 'A', { source: 'self_reported', verification_status: 'verified', is_in_progress: 0 });
  assert.equal(partitionGradeRecords([row]).counted.length, 1);
});

test('partition: a rejected row is never counted', () => {
  const row = gradeRow('DEMO100', 'A', { source: 'self_reported', verification_status: 'rejected', is_in_progress: 0 });
  const result = partitionGradeRecords([row]);
  assert.deepEqual([result.counted.length, result.rejected.length], [0, 1]);
});

test('partition: an in-progress course is separate even when it is imported and verified', () => {
  const row = gradeRow('DEMO100', 'A', { source: 'imported', verification_status: 'verified', is_in_progress: 1 });
  const result = partitionGradeRecords([row]);
  assert.deepEqual([result.counted.length, result.inProgress.length], [0, 1]);
});

test('partition: is_in_progress wins over a rejected status, so the row lands in one group only', () => {
  const row = gradeRow('DEMO100', 'A', { source: 'self_reported', verification_status: 'rejected', is_in_progress: 1 });
  const result = partitionGradeRecords([row]);
  assert.equal(result.counted.length + result.pending.length + result.rejected.length + result.inProgress.length, 1);
  assert.equal(result.inProgress.length, 1);
});

test('student-entered passing grades alone cannot reach a met or passed result', () => {
  // Every grade here would pass all computable DEMO rules if it were counted.
  const typed = ['DEMO100', 'DEMO101', 'DEMO102', 'DEMO111'].map((code) =>
    gradeRow(code, 'A', { source: 'self_reported', verification_status: 'unverified', is_in_progress: 0 }));
  const { counted } = partitionGradeRecords(typed);
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: counted, dataSource: ok('ok') });
  assert.equal(result.verdict, 'no_data');
  assert.equal(result.totals, null);
  assert.ok(result.conditions.every((item) => item.status !== 'passed'));
});

test('an unverified row does not change the totals of a student who has verified rows', () => {
  const verified = recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0001');
  const extra = gradeRow('DEMO999', 'A', { student_id: 'DEMO0001', source: 'self_reported', verification_status: 'unverified', is_in_progress: 0 });
  const withExtra = partitionGradeRecords([...verified, extra]).counted;
  const baseline = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: verified, dataSource: ok('ok') });
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: withExtra, dataSource: ok('ok') });
  assert.equal(result.totals.earnedCredits, baseline.totals.earnedCredits);
  assert.equal(result.totals.gpa, baseline.totals.gpa);
});

test('an in-progress F does not drag down a student GPA', () => {
  const verified = recordsFromCsv(fixture('batch-001-demo-success.csv'), 'DEMO0001');
  const ongoing = gradeRow('DEMO888', 'F', { student_id: 'DEMO0001', source: 'imported', verification_status: 'verified', is_in_progress: 1 });
  const counted = partitionGradeRecords([...verified, ongoing]).counted;
  const baseline = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: verified, dataSource: ok('ok') });
  const result = evaluateGraduation({ conditions: DEMO_CONDITIONS, rules: DEMO_RULES, records: counted, dataSource: ok('ok') });
  assert.equal(result.totals.gpa, baseline.totals.gpa);
});

// ---------- Access control ----------

test('access: students see only their own record', () => {
  const student = { authenticated: true, role: 'student', username: 'DEMO0001' };
  assert.deepEqual(canViewGraduation(student, 'DEMO0001', new Set()), { allowed: true, own: true });
  assert.equal(canViewGraduation(student, 'DEMO0002', new Set()).allowed, false);
});

test('access: instructor and staff see only assigned students', () => {
  const instructor = { authenticated: true, role: 'instructor', username: 'instructor' };
  const staff = { authenticated: true, role: 'staff', username: 'staff' };
  const assigned = new Set(['DEMO0001', 'DEMO0002']);
  assert.equal(canViewGraduation(instructor, 'DEMO0001', assigned).allowed, true);
  assert.equal(canViewGraduation(instructor, 'DEMO0003', assigned).allowed, false);
  assert.equal(canViewGraduation(staff, 'DEMO0003', assigned).allowed, false);
});

test('access: curriculum_admin, anonymous users, and unknown roles see nothing', () => {
  const everyone = new Set(['DEMO0001']);
  assert.equal(canViewGraduation({ authenticated: true, role: 'curriculum_admin', username: 'a' }, 'DEMO0001', everyone).allowed, false);
  assert.equal(canViewGraduation({ authenticated: false, role: 'public', username: 'anonymous' }, 'DEMO0001', everyone).allowed, false);
  assert.equal(canViewGraduation(undefined, 'DEMO0001', everyone).allowed, false);
});

// ---------- HTTP handler: denied paths that return before any database call ----------

process.env.JWT_SECRET = 'test-secret-not-for-deployment';
process.env.JWT_ISSUER = 'cs361-curriculum-api';
const { handler } = await import('../src/api.mjs');
const tokenFor = (role, username) => jwt.sign({ sub: username, role, name: username }, process.env.JWT_SECRET, {
  expiresIn: '5m', issuer: 'cs361-curriculum-api', audience: 'cs361-frontend', algorithm: 'HS256',
});
const httpEvent = (routeKey, { token, pathParameters } = {}) => ({
  routeKey,
  requestContext: { http: { method: routeKey.split(' ')[0], sourceIp: '127.0.0.1' } },
  headers: token ? { authorization: `Bearer ${token}` } : {},
  pathParameters,
});

test('HTTP: anonymous request to a graduation route gets 401', async () => {
  const res = await handler(httpEvent('GET /api/graduation/me'));
  assert.equal(res.statusCode, 401);
});

test('HTTP: a student cannot open another student record (403, no database access)', async () => {
  const res = await handler(httpEvent('GET /api/graduation/students/{studentId}', {
    token: tokenFor('student', 'DEMO0001'),
    pathParameters: { studentId: 'DEMO0002' },
  }));
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).data, undefined);
});

test('HTTP: curriculum_admin cannot read any graduation record (403)', async () => {
  const res = await handler(httpEvent('GET /api/graduation/students/{studentId}', {
    token: tokenFor('curriculum_admin', 'admin'),
    pathParameters: { studentId: 'DEMO0001' },
  }));
  assert.equal(res.statusCode, 403);
});

test('HTTP: instructor cannot use the student-only /me route (403)', async () => {
  const res = await handler(httpEvent('GET /api/graduation/me', { token: tokenFor('instructor', 'instructor') }));
  assert.equal(res.statusCode, 403);
});

test('HTTP: only staff can read import history (instructor gets 403)', async () => {
  const res = await handler(httpEvent('GET /api/graduation/import-batches', { token: tokenFor('instructor', 'instructor') }));
  assert.equal(res.statusCode, 403);
});

test('HTTP: an invalid studentId is rejected before any lookup', async () => {
  const res = await handler(httpEvent('GET /api/graduation/students/{studentId}', {
    token: tokenFor('staff', 'staff'),
    pathParameters: { studentId: "x' OR 1=1--" },
  }));
  assert.equal(res.statusCode, 400);
});
