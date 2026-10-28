// CSV adapter for V4 graduation grade data (draft contract v4-draft-1, see docs/v4-data-contract.md).
// Pure functions only: no database or network access. The CLI in src/graduation-import.mjs
// performs the writes.

import { createHash } from 'node:crypto';
import { ACCEPTED_GRADES } from './evaluate.mjs';

export const CONTRACT_VERSION = 'v4-draft-1';
export const REQUIRED_COLUMNS = Object.freeze([
  'studentId',
  'curriculumId',
  'academicYear',
  'semester',
  'courseCode',
  'credits',
  'grade',
  'sourceBatchId',
  'exportedAt',
]);

// File-level errors stop the whole import. Row-level errors reject only that row.
export class ImportFileError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ImportFileError';
    this.code = code;
    this.details = details;
  }
}

const STUDENT_ID = /^[A-Za-z0-9]{1,20}$/;
const CURRICULUM_ID = /^[A-Za-z0-9-]{1,50}$/;
const COURSE_CODE = /^[\p{L}\p{N}.-]{1,30}$/u;
const CREDITS = /^\d{1,2}(\.\d)?$/;
const SOURCE_BATCH_ID = /^[A-Za-z0-9._-]{1,100}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

// RFC 4180 style parser: quoted fields, doubled quotes, CRLF or LF. Blank lines are skipped.
// Each returned row keeps the physical line number where it starts.
export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;

  const endRow = () => {
    const blank = row.length === 1 && row[0] === '';
    if (!blank) rows.push({ lineNo: rowStart, values: row });
    row = [];
    rowStart = line;
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      line += 1;
      endRow();
    } else {
      field += ch;
    }
  }

  if (inQuotes) throw new ImportFileError('E_CSV_UNTERMINATED_QUOTE', 'CSV has an unterminated quoted field');
  if (field !== '' || row.length) {
    row.push(field);
    endRow();
  }
  return rows;
}

export function readCsvTable(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new ImportFileError('E_EMPTY_FILE', 'File has no rows');

  const headers = rows[0].values.map((header) => header.trim());
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) throw new ImportFileError('E_HEADER_MISSING', 'Required columns are missing', { missing });
  const duplicated = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicated) throw new ImportFileError('E_HEADER_DUPLICATE', 'A column appears more than once', { column: duplicated });

  const body = rows.slice(1).map((item) => ({
    lineNo: item.lineNo,
    columnCount: item.values.length,
    cells: Object.fromEntries(headers.map((header, index) => [header, item.values[index] ?? ''])),
  }));
  return { headers, rows: body };
}

// Checks one row against the contract. Returns normalized values when valid.
export function validateRow({ lineNo, columnCount, cells }, headerCount) {
  if (columnCount !== headerCount) return { lineNo, errors: ['E_COLUMN_COUNT'], studentId: null, record: null };

  const value = {
    studentId: cells.studentId.trim(),
    curriculumId: cells.curriculumId.trim(),
    academicYear: cells.academicYear.trim(),
    semester: cells.semester.trim(),
    courseCode: cells.courseCode.replace(/\s+/g, ''),
    credits: cells.credits.trim(),
    grade: cells.grade.trim().toUpperCase(),
    sourceBatchId: cells.sourceBatchId.trim(),
    exportedAt: cells.exportedAt.trim(),
  };

  const errors = [];
  if (!STUDENT_ID.test(value.studentId)) errors.push('E_STUDENT_ID');
  if (!CURRICULUM_ID.test(value.curriculumId)) errors.push('E_CURRICULUM_ID');
  const year = /^\d{4}$/.test(value.academicYear) ? Number(value.academicYear) : NaN;
  if (!(year >= 2000 && year <= 2100)) errors.push('E_ACADEMIC_YEAR');
  if (!['1', '2', '3'].includes(value.semester)) errors.push('E_SEMESTER');
  if (!COURSE_CODE.test(value.courseCode)) errors.push('E_COURSE_CODE');
  const credits = CREDITS.test(value.credits) ? Number(value.credits) : NaN;
  if (!(credits >= 0 && credits <= 12 && Number.isInteger(credits * 2))) errors.push('E_CREDITS');
  if (!ACCEPTED_GRADES.has(value.grade)) errors.push('E_GRADE');
  if (!SOURCE_BATCH_ID.test(value.sourceBatchId)) errors.push('E_SOURCE_BATCH_ID');
  if (!isIsoDateTime(value.exportedAt)) errors.push('E_EXPORTED_AT');

  const studentId = STUDENT_ID.test(value.studentId) ? value.studentId : null;
  if (errors.length) return { lineNo, errors, studentId, record: null };

  return {
    lineNo,
    errors: [],
    studentId,
    record: {
      studentId: value.studentId,
      curriculumId: value.curriculumId,
      academicYear: year,
      semester: Number(value.semester),
      courseCode: value.courseCode,
      credits,
      grade: value.grade,
      sourceBatchId: value.sourceBatchId,
      exportedAt: new Date(value.exportedAt),
    },
  };
}

function isIsoDateTime(value) {
  return ISO_DATETIME.test(value) && !Number.isNaN(Date.parse(value));
}

// Reads a whole file. Throws ImportFileError for problems that affect every row.
export function prepareImportFile(text) {
  const table = readCsvTable(text);
  if (!table.rows.length) throw new ImportFileError('E_EMPTY_FILE', 'File has no data rows');

  // One file is one export batch: every row must carry the same sourceBatchId and exportedAt.
  const batchIds = new Set(table.rows.map((row) => row.cells.sourceBatchId.trim()));
  const exportedValues = new Set(table.rows.map((row) => row.cells.exportedAt.trim()));
  if (batchIds.size !== 1 || exportedValues.size !== 1) {
    throw new ImportFileError('E_BATCH_MIXED', 'Every row must share one sourceBatchId and one exportedAt');
  }
  const [sourceBatchId] = batchIds;
  const [exportedAt] = exportedValues;
  if (!SOURCE_BATCH_ID.test(sourceBatchId) || !isIsoDateTime(exportedAt)) {
    throw new ImportFileError('E_BATCH_METADATA', 'sourceBatchId or exportedAt is invalid');
  }

  const validated = table.rows.map((row) => validateRow(row, table.headers.length));
  return { sourceBatchId, exportedAt: new Date(exportedAt), validated };
}

export const gradeKey = (record) =>
  `${record.studentId}|${record.curriculumId}|${record.academicYear}|${record.semester}|${record.courseCode}`;

// Only the values that can change a grade decide "unchanged". Batch id is always refreshed.
export const gradeHash = (record) => sha256Hex(`${record.credits}|${record.grade}`);

// Decides insert, update, unchanged, or reject for each row. Writes nothing.
// existingRows: Map of gradeKey -> { row_hash } from the database.
export function planImport(prepared, { knownCurriculumIds = null, existingRows = new Map() } = {}) {
  const seen = new Map();
  const accepted = [];
  const errorRows = [];
  const counts = { rowTotal: prepared.validated.length, inserted: 0, updated: 0, unchanged: 0, rejected: 0 };

  for (const item of prepared.validated) {
    let errors = [...item.errors];
    let record = item.record;
    if (record && knownCurriculumIds && !knownCurriculumIds.has(record.curriculumId)) {
      errors = ['E_CURRICULUM_UNKNOWN'];
      record = null;
    }
    if (!record) {
      counts.rejected += 1;
      for (const code of errors) errorRows.push({ lineNo: item.lineNo, studentId: item.studentId, errorCode: code });
      continue;
    }

    const key = gradeKey(record);
    const hash = gradeHash(record);
    if (seen.has(key)) {
      if (seen.get(key) === hash) {
        // Same attempt repeated in the same file: ignored, counted as unchanged.
        counts.unchanged += 1;
      } else {
        counts.rejected += 1;
        errorRows.push({ lineNo: item.lineNo, studentId: item.studentId, errorCode: 'E_DUPLICATE_CONFLICT' });
      }
      continue;
    }
    seen.set(key, hash);

    const existing = existingRows.get(key);
    let action = 'insert';
    if (existing) action = existing.row_hash === hash ? 'unchanged' : 'update';
    if (action === 'insert') counts.inserted += 1;
    else if (action === 'update') counts.updated += 1;
    else counts.unchanged += 1;

    accepted.push({ action, key, hash, record });
  }

  const errorSummary = {};
  for (const row of errorRows) errorSummary[row.errorCode] = (errorSummary[row.errorCode] ?? 0) + 1;
  return { accepted, errorRows, counts, errorSummary };
}

// success: every row accepted. partial: some rows rejected. failed: nothing accepted.
export function batchStatus(counts) {
  const accepted = counts.rowTotal - counts.rejected;
  if (accepted <= 0) return 'failed';
  if (counts.rejected > 0) return 'partial';
  return 'success';
}
