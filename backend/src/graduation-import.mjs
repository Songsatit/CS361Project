// CLI for importing V4 graduation grade CSV files (demo mode only).
//
// Usage (from backend/):
//   node src/graduation-import.mjs --file fixtures/v4-demo/batch-001-demo-success.csv --mode demo --dry-run
//   node src/graduation-import.mjs --file fixtures/v4-demo/batch-001-demo-success.csv --mode demo
//
// Connects to whatever DB_* variables point to. Use a local scratch MySQL only.
// Never point this at the deployed RDS instance during development.
// Exit codes: 0 imported, 2 imported with rejected rows, 1 failed or error.

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {
  ImportFileError,
  batchStatus,
  gradeKey,
  planImport,
  prepareImportFile,
  sha256Hex,
} from './graduation/adapter.mjs';

const SOURCE_KEY = 'registrar-demo';
const SUPPORTED_MODES = new Set(['demo']);
const EMPTY_COUNTS = { rowTotal: 0, inserted: 0, updated: 0, unchanged: 0, rejected: 0 };

function parseArgs(argv) {
  const options = { file: null, source: SOURCE_KEY, mode: 'demo', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') options.file = argv[++i];
    else if (arg === '--source') options.source = argv[++i];
    else if (arg === '--mode') options.mode = argv[++i];
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.file) throw new Error('--file is required');
  if (options.source !== SOURCE_KEY) throw new Error(`Only source "${SOURCE_KEY}" is configured`);
  if (!SUPPORTED_MODES.has(options.mode)) {
    throw new Error('Only --mode demo is enabled. Live registrar import needs an approved data contract and access.');
  }
  return options;
}

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

function connect() {
  return mysql.createConnection({
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    ...(process.env.DB_TLS === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

const placeholders = (items) => items.map(() => '?').join(',');

async function loadKnownCurricula(db, ids) {
  if (!ids.length) return new Set();
  const [rows] = await db.execute(`SELECT curriculum_id FROM curriculum WHERE curriculum_id IN (${placeholders(ids)})`, ids);
  return new Set(rows.map((row) => row.curriculum_id));
}

async function loadExistingGradeRows(db, studentIds) {
  const existing = new Map();
  for (let start = 0; start < studentIds.length; start += 500) {
    const chunk = studentIds.slice(start, start + 500);
    const [rows] = await db.execute(
      `SELECT student_id, curriculum_id, academic_year, semester, course_code, row_hash
         FROM graduation_grade_record
        WHERE student_id IN (${placeholders(chunk)})`,
      chunk,
    );
    for (const row of rows) {
      const key = gradeKey({
        studentId: row.student_id,
        curriculumId: row.curriculum_id,
        academicYear: row.academic_year,
        semester: row.semester,
        courseCode: row.course_code,
      });
      existing.set(key, { row_hash: row.row_hash });
    }
  }
  return existing;
}

// Writes the batch record, rejected rows, and accepted grades in one transaction.
async function writeBatch(db, { fileSha256, sourceBatchId, exportedAt, plan, status }) {
  await db.beginTransaction();
  try {
    const [result] = await db.execute(
      `INSERT INTO graduation_import_batch
        (source_key, data_mode, source_batch_id, file_sha256, exported_at, status,
         row_total, row_inserted, row_updated, row_unchanged, row_rejected, error_summary,
         imported_by, finished_at)
       VALUES (?, 'demo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        SOURCE_KEY,
        sourceBatchId,
        fileSha256,
        exportedAt,
        status,
        plan.counts.rowTotal,
        plan.counts.inserted,
        plan.counts.updated,
        plan.counts.unchanged,
        plan.counts.rejected,
        JSON.stringify(plan.errorSummary),
        process.env.IMPORTED_BY ?? 'cli',
      ],
    );
    const batchId = Number(result.insertId);

    for (const error of plan.errorRows) {
      await db.execute(
        'INSERT INTO graduation_import_error (batch_id, line_no, student_id, error_code) VALUES (?, ?, ?, ?)',
        [batchId, error.lineNo, error.studentId, error.errorCode],
      );
    }

    // ON DUPLICATE KEY keeps re-imports idempotent: the same key updates in place.
    for (const item of plan.accepted) {
      const { record } = item;
      await db.execute(
        `INSERT INTO graduation_grade_record
          (student_id, curriculum_id, academic_year, semester, course_code, credits, grade, row_hash, batch_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          credits = VALUES(credits), grade = VALUES(grade),
          row_hash = VALUES(row_hash), batch_id = VALUES(batch_id)`,
        [record.studentId, record.curriculumId, record.academicYear, record.semester, record.courseCode,
          record.credits, record.grade, item.hash, batchId],
      );
    }

    await db.commit();
    return batchId;
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

function report({ result, batchId = null, status, sourceBatchId = null, exportedAt = null, plan = null, dryRun = false, extra = {} }) {
  const output = {
    result,
    dryRun,
    batchId,
    status,
    sourceKey: SOURCE_KEY,
    dataMode: 'demo',
    sourceBatchId,
    exportedAt: exportedAt ? exportedAt.toISOString() : null,
    counts: plan?.counts ?? EMPTY_COUNTS,
    errorSummary: plan?.errorSummary ?? {},
    // Line numbers and error codes only. Row values are never printed.
    errors: (plan?.errorRows ?? []).map((row) => ({ line: row.lineNo, code: row.errorCode })),
    ...extra,
  };
  console.log(JSON.stringify(output, null, 2));
}

function fileFailurePlan(error) {
  return {
    counts: { ...EMPTY_COUNTS },
    accepted: [],
    errorRows: [{ lineNo: 0, studentId: null, errorCode: error.code }],
    errorSummary: { [error.code]: 1 },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const buffer = await readFile(options.file);
  const fileSha256 = sha256Hex(buffer);

  let prepared;
  try {
    prepared = prepareImportFile(buffer.toString('utf8'));
  } catch (error) {
    if (!(error instanceof ImportFileError)) throw error;
    const plan = fileFailurePlan(error);
    if (options.dryRun) {
      report({ result: 'failed', status: 'failed', plan, dryRun: true });
      process.exitCode = 1;
      return;
    }
    const db = await connect();
    try {
      const batchId = await writeBatch(db, { fileSha256, sourceBatchId: null, exportedAt: null, plan, status: 'failed' });
      report({ result: 'failed', batchId, status: 'failed', plan });
      process.exitCode = 1;
    } finally {
      await db.end();
    }
    return;
  }

  if (options.dryRun) {
    const plan = planImport(prepared);
    const status = batchStatus(plan.counts);
    report({
      result: 'dry_run',
      status,
      sourceBatchId: prepared.sourceBatchId,
      exportedAt: prepared.exportedAt,
      plan,
      dryRun: true,
      extra: { note: 'Curricula and existing rows were not checked against the database.' },
    });
    process.exitCode = status === 'failed' ? 1 : 0;
    return;
  }

  const db = await connect();
  try {
    const [duplicate] = await db.execute(
      `SELECT batch_id, status FROM graduation_import_batch
        WHERE source_key = ? AND file_sha256 = ? AND status IN ('success', 'partial')
        LIMIT 1`,
      [SOURCE_KEY, fileSha256],
    );
    if (duplicate.length) {
      report({ result: 'already_imported', batchId: Number(duplicate[0].batch_id), status: duplicate[0].status });
      return;
    }

    const validRecords = prepared.validated.filter((item) => item.record).map((item) => item.record);
    const knownCurriculumIds = await loadKnownCurricula(db, [...new Set(validRecords.map((record) => record.curriculumId))]);
    const existingRows = await loadExistingGradeRows(db, [...new Set(validRecords.map((record) => record.studentId))]);
    const plan = planImport(prepared, { knownCurriculumIds, existingRows });
    const status = batchStatus(plan.counts);

    const batchId = await writeBatch(db, {
      fileSha256,
      sourceBatchId: prepared.sourceBatchId,
      exportedAt: prepared.exportedAt,
      plan,
      status,
    });
    const result = { success: 'imported', partial: 'imported_with_rejections', failed: 'failed' }[status];
    report({ result, batchId, status, sourceBatchId: prepared.sourceBatchId, exportedAt: prepared.exportedAt, plan });
    process.exitCode = { success: 0, partial: 2, failed: 1 }[status];
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  // Print the message only. Stack traces could include row data.
  console.error(`Import stopped: ${error.message}`);
  process.exitCode = 1;
});
