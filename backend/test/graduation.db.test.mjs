// Integration tests for V4 graduation verification against a LOCAL scratch MySQL.
// Skipped unless V4_TEST_DB_HOST is set. Run from backend/: npm run test:db
//
// Required env: V4_TEST_DB_HOST (must be localhost or 127.0.0.1), V4_TEST_DB_PORT,
// V4_TEST_DB_USER, V4_TEST_DB_PASSWORD. The database is always named "curriculum"
// because migrations 003, 005-010 contain "USE curriculum;".
//
// Safety guards: refuses non-local hosts, anything that looks like RDS, and a
// database that already contains tables. It never drops anything.
//
// Applies test/fixtures/base-schema-stub.sql (a stub, NOT production schema), then
// migrations 001-010 in order, then fixtures/v4-demo/seed-demo.sql, then runs the CLI and API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readBackend = (...parts) => readFileSync(path.join(backendDir, ...parts), 'utf8');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const enabled = Boolean(process.env.V4_TEST_DB_HOST);
const DB_NAME = 'curriculum';
const JWT_SECRET = 'db-test-secret-not-for-deployment';

const MIGRATIONS = [
  '001_curriculum_graduation_conditions.sql',
  '002_course_catalog_details.sql',
  '003_audit_log.sql',
  '004_curriculum_workflow.sql',
  '005_curriculum_change_requests.sql',
  '006_curriculum_draft_versions.sql',
  '007_curriculum_visibility.sql',
  '008_create_course_draft_action.sql',
  '009_login_attempts.sql',
  '010_graduation_verification.sql',
];

let conn;
let cliRuns = {};

function assertSafeTarget() {
  const host = process.env.V4_TEST_DB_HOST;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`Refusing non-local DB host "${host}". Use localhost or 127.0.0.1.`);
  if (/rds\.amazonaws\.com|amazonaws/i.test(host)) throw new Error('Refusing: host looks like AWS RDS.');
}

function runCli(args) {
  const result = spawnSync(process.execPath, ['src/graduation-import.mjs', ...args], {
    cwd: backendDir,
    env: process.env,
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = null;
  }
  return { code: result.status, json, stderr: result.stderr };
}

const fixtureArgs = (name) => ['--file', path.join('fixtures', 'v4-demo', name), '--mode', 'demo'];

async function scalar(sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return Number(Object.values(rows[0])[0]);
}

// Calls the Lambda handler directly. The DB env vars point at the scratch database.
let handler;
async function call(routeKey, { role, username, studentId } = {}) {
  const event = {
    routeKey,
    requestContext: { http: { method: routeKey.split(' ')[0], sourceIp: '127.0.0.1' } },
    headers: role
      ? { authorization: `Bearer ${jwt.sign({ sub: username, role, name: username }, JWT_SECRET, {
          expiresIn: '5m', issuer: 'cs361-curriculum-api', audience: 'cs361-frontend', algorithm: 'HS256',
        })}` }
      : {},
    pathParameters: studentId ? { studentId } : undefined,
  };
  const res = await handler(event);
  return { status: res.statusCode, body: res.statusCode === 204 ? null : JSON.parse(res.body) };
}

before(async () => {
  if (!enabled) return;
  assertSafeTarget();
  const port = Number(process.env.V4_TEST_DB_PORT ?? 3306);
  const admin = await mysql.createConnection({
    host: process.env.V4_TEST_DB_HOST,
    port,
    user: process.env.V4_TEST_DB_USER,
    password: process.env.V4_TEST_DB_PASSWORD,
    multipleStatements: true,
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE ${DB_NAME}`);
  const [tables] = await admin.query('SHOW TABLES');
  if (tables.length) throw new Error(`Refusing: scratch database "${DB_NAME}" already has ${tables.length} table(s).`);

  await admin.query(readBackend('test', 'fixtures', 'base-schema-stub.sql'));
  for (const file of MIGRATIONS) await admin.query(readBackend('migrations', file));
  await admin.query(readBackend('fixtures', 'v4-demo', 'seed-demo.sql'));
  conn = admin;

  Object.assign(process.env, {
    DB_HOST: process.env.V4_TEST_DB_HOST,
    DB_PORT: String(port),
    DB_NAME,
    DB_USER: process.env.V4_TEST_DB_USER,
    DB_PASSWORD: process.env.V4_TEST_DB_PASSWORD,
    JWT_SECRET,
    JWT_ISSUER: 'cs361-curriculum-api',
    ENABLE_DEMO_LOGIN: 'false',
  });
  ({ handler } = await import('../src/api.mjs'));
});

after(async () => {
  if (conn) await conn.end();
});

test('migrations 001-010 apply in order on a scratch database and create the V4 tables', { skip: !enabled }, async () => {
  for (const table of ['graduation_import_batch', 'graduation_import_error', 'graduation_grade_record', 'graduation_rule', 'graduation_student_assignment']) {
    assert.equal(await scalar('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [DB_NAME, table]), 1, table);
  }
  // Migration 001 seeds six conditions for BSC-CS-2566 when that curriculum row exists.
  assert.equal(await scalar("SELECT COUNT(*) FROM curriculum_graduation_condition WHERE curriculum_id = 'BSC-CS-2566'"), 6);
});

test('migration 010 can be re-run safely (CREATE ... IF NOT EXISTS)', { skip: !enabled }, async () => {
  await conn.query(readBackend('migrations', '010_graduation_verification.sql'));
});

test('import batch-001 succeeds with 23 grade rows', { skip: !enabled }, async () => {
  cliRuns.first = runCli(fixtureArgs('batch-001-demo-success.csv'));
  assert.equal(cliRuns.first.code, 0, cliRuns.first.stderr);
  assert.equal(cliRuns.first.json.status, 'success');
  assert.equal(cliRuns.first.json.counts.inserted, 23);
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_grade_record'), 23);
});

test('re-running the same file is refused as already imported and writes nothing', { skip: !enabled }, async () => {
  const rerun = runCli(fixtureArgs('batch-001-demo-success.csv'));
  assert.equal(rerun.code, 0);
  assert.equal(rerun.json.result, 'already_imported');
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_grade_record'), 23);
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_import_batch'), 1);
});

test('batch-002 imports partially: one DEMO0003 row rejected and recorded with its student ID', { skip: !enabled }, async () => {
  const run = runCli(fixtureArgs('batch-002-demo-partial.csv'));
  assert.equal(run.code, 2, run.stderr);
  assert.equal(run.json.status, 'partial');
  const [errors] = await conn.execute('SELECT student_id, error_code FROM graduation_import_error ORDER BY error_id');
  assert.deepEqual(errors.map((row) => [row.student_id, row.error_code]), [['DEMO0003', 'E_GRADE']]);
});

test('API after batch-002: DEMO0003 is blocked by a rejected row, DEMO0001 is not', { skip: !enabled }, async () => {
  const blocked = await call('GET /api/graduation/students/{studentId}', { role: 'staff', username: 'staff', studentId: 'DEMO0003' });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.body.data.dataSource.status, 'student_rows_rejected');
  assert.equal(blocked.body.data.verdict, 'inconclusive');
  assert.equal(blocked.body.data.totals, null);

  const unaffected = await call('GET /api/graduation/me', { role: 'student', username: 'DEMO0001' });
  assert.equal(unaffected.status, 200);
  assert.equal(unaffected.body.data.dataSource.status, 'ok');
  assert.equal(unaffected.body.data.dataMode, 'demo');
  assert.equal(unaffected.body.data.verdict, 'inconclusive');
  assert.equal(unaffected.body.data.conditions.find((c) => c.order === 2).status, 'passed');
});

test('batch-003 (header missing) fails: no grade rows change and every student is inconclusive', { skip: !enabled }, async () => {
  const before = await scalar('SELECT COUNT(*) FROM graduation_grade_record');
  const run = runCli(fixtureArgs('batch-003-demo-header-missing.csv'));
  assert.equal(run.code, 1);
  assert.equal(run.json.status, 'failed');
  assert.equal(run.json.errorSummary.E_HEADER_MISSING, 1);
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_grade_record'), before);

  const result = await call('GET /api/graduation/me', { role: 'student', username: 'DEMO0001' });
  assert.equal(result.body.data.dataSource.status, 'import_failed');
  assert.equal(result.body.data.dataSource.lastImport.status, 'failed');
  assert.equal(result.body.data.verdict, 'inconclusive');
  assert.equal(result.body.data.conditions.find((c) => c.order === 2).reason, 'data_import_failed');
});

test('batch-004 recovers: adds the missing DEMO0003 course, no duplicate rows, and the snapshot is current', { skip: !enabled }, async () => {
  const run = runCli(fixtureArgs('batch-004-demo-recovery.csv'));
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.json.counts.inserted, 1);
  assert.equal(run.json.counts.unchanged, 23);
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_grade_record'), 24);
  assert.equal(await scalar('SELECT COUNT(*) FROM (SELECT student_id, curriculum_id, academic_year, semester, course_code FROM graduation_grade_record GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1) d'), 0);
  assert.equal(await scalar('SELECT COUNT(*) FROM graduation_import_batch'), 4);
});

test('TC1: DEMO0001 sees their own record and the conditions not yet passed', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/me', { role: 'student', username: 'DEMO0001' });
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.equal(data.studentId, 'DEMO0001');
  assert.equal(data.dataSource.status, 'ok');
  assert.equal(data.verdict, 'inconclusive');
  assert.equal(data.conditions.find((c) => c.order === 1).reason, 'no_rule');
  assert.equal(data.conditions.find((c) => c.order === 3).status, 'passed');
});

test('TC1: a student cannot read another student record (403) and no grade data is returned', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students/{studentId}', { role: 'student', username: 'DEMO0001', studentId: 'DEMO0002' });
  assert.equal(res.status, 403);
  assert.equal(res.body.data, undefined);
});

test('TC1: a student who is not in the demo data gets no_data, not a verdict', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/me', { role: 'student', username: 'DEMO9999' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.verdict, 'no_data');
  assert.deepEqual(res.body.data.conditions, []);
});

test('TC2: staff sees DEMO0002 failing conditions with a clear verdict and the snapshot time', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students/{studentId}', { role: 'staff', username: 'staff', studentId: 'DEMO0002' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.verdict, 'not_met');
  assert.equal(res.body.data.conditions.find((c) => c.order === 3).status, 'not_passed');
  assert.ok(res.body.data.dataSource.asOf);
});

test('TC2: instructor is denied a student who is not assigned to them (403)', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students/{studentId}', { role: 'instructor', username: 'instructor', studentId: 'DEMO0003' });
  assert.equal(res.status, 403);
});

test('TC2: instructor sees an assigned student and the view is written to the audit log without grade values', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students/{studentId}', { role: 'instructor', username: 'instructor', studentId: 'DEMO0001' });
  assert.equal(res.status, 200);
  const [logs] = await conn.execute(
    "SELECT action, entity_id, new_value FROM audit_log WHERE action = 'graduation_viewed' AND entity_id = 'DEMO0001'",
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0].new_value, null);
});

test('TC2: curriculum_admin cannot read any graduation record (403)', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students/{studentId}', { role: 'curriculum_admin', username: 'admin', studentId: 'DEMO0001' });
  assert.equal(res.status, 403);
});

test('TC2: staff lists import history without personal data', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/import-batches', { role: 'staff', username: 'staff' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((row) => row.status), ['success', 'failed', 'partial', 'success']);
  const serialized = JSON.stringify(res.body.data);
  assert.ok(!serialized.includes('DEMO0001'), 'import history must not contain student IDs');
});

test('instructor assignment list shows only assigned students', { skip: !enabled }, async () => {
  const res = await call('GET /api/graduation/students', { role: 'instructor', username: 'instructor' });
  assert.deepEqual(res.body.data.map((row) => row.studentId), ['DEMO0001', 'DEMO0002']);
});
