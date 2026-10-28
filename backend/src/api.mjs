import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  DEFAULT_SNAPSHOT_MAX_AGE_DAYS,
  canViewGraduation,
  evaluateGraduation,
  pickCurriculum,
  resolveDataSource,
} from './graduation/evaluate.mjs';

const allowedRoles = new Set(['student', 'instructor', 'curriculum_admin', 'staff']);
const jwtIssuer = 'cs361-curriculum-api';
const jwtAudience = 'cs361-frontend';

// Name of the HttpOnly cookie that carries the access token.
const AUTH_COOKIE_NAME = 'token';
// Access token lifetime in seconds. Must match signAccessToken's expiresIn (15m).
const AUTH_COOKIE_MAX_AGE = 15 * 60;
// Custom header the frontend sends on every state-changing request. Because a cross-site
// attacker cannot set a custom header on a simple form/img request, requiring it blocks CSRF.
const CSRF_HEADER = 'x-cs361-csrf';

// SameSite=Lax is safe here: the frontend is served same-origin with the API through the
// Amplify /api/* rewrite, so the cookie travels with same-site requests. Secure keeps it
// HTTPS-only; HttpOnly hides it from JavaScript so XSS cannot read the token.
export function authCookie(token, maxAgeSeconds) {
  return `${AUTH_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
export { AUTH_COOKIE_MAX_AGE };

// Reads the access token from the request cookies, or null when it is absent.
function cookieToken(normalizedHeaders) {
  const raw = normalizedHeaders.cookie;
  if (!raw) return null;
  for (const part of String(raw).split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === AUTH_COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 2,
  queueLimit: 0,
  ...(process.env.DB_TLS === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
});

const response = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'https://main.d3dm5h9pinlgfm.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-cs361-csrf',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const queryRows = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

function signAccessToken(user) {
  const secret = String(process.env.JWT_SECRET ?? '');
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    {
      sub: user.username,
      role: user.role,
      name: user.displayNameTh || user.displayNameEn || user.username,
      jti: crypto.randomUUID(),
    },
    secret,
    { expiresIn: '15m', issuer: jwtIssuer, audience: jwtAudience, algorithm: 'HS256' },
  );
}

const demoAccounts = {
  teacher: { passwordHash: process.env.DEMO_TEACHER_PASSWORD_HASH, role: 'instructor', roleLabel: 'อาจารย์ผู้สอน', name: 'ผู้ใช้งานอาจารย์' },
  instructor: { passwordHash: process.env.DEMO_INSTRUCTOR_PASSWORD_HASH, role: 'instructor', roleLabel: 'อาจารย์ผู้สอน', name: 'ผู้ใช้งานอาจารย์' },
  staff: { passwordHash: process.env.DEMO_STAFF_PASSWORD_HASH, role: 'staff', roleLabel: 'เจ้าหน้าที่', name: 'ผู้ใช้งานเจ้าหน้าที่' },
  curriculumadmin: { passwordHash: process.env.DEMO_ADMIN_PASSWORD_HASH, role: 'curriculum_admin', roleLabel: 'ผู้ดูแลข้อมูลหลักสูตร', name: 'ผู้ดูแลข้อมูลหลักสูตร' },
  // V4 demo students. studentId must match the synthetic IDs in backend/fixtures/v4-demo.
  demostudent01: { passwordHash: process.env.DEMO_STUDENT_01_PASSWORD_HASH, role: 'student', roleLabel: 'นักศึกษา (Demo)', name: 'นักศึกษาทดลอง 1', studentId: 'DEMO0001' },
  demostudent02: { passwordHash: process.env.DEMO_STUDENT_02_PASSWORD_HASH, role: 'student', roleLabel: 'นักศึกษา (Demo)', name: 'นักศึกษาทดลอง 2', studentId: 'DEMO0002' },
  demostudent03: { passwordHash: process.env.DEMO_STUDENT_01_PASSWORD_HASH, role: 'student', roleLabel: 'นักศึกษา (Demo)', name: 'นักศึกษาทดลอง 3', studentId: 'DEMO0003' },
  demostudent04: { passwordHash: process.env.DEMO_STUDENT_01_PASSWORD_HASH, role: 'student', roleLabel: 'นักศึกษา (Demo)', name: 'นักศึกษาทดลอง 4', studentId: 'DEMO0004' },
};
const demoUsernames = new Set(Object.keys(demoAccounts));
const invalidLoginResponse = () => response(401, { error: 'Invalid username or password' });

function verifyPassword(password, encodedHash) {
  const [algorithm, saltHex, digestHex] = String(encodedHash ?? '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !digestHex || !/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(digestHex)) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(digestHex, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function demoLogin(username, password) {
  if (process.env.ENABLE_DEMO_LOGIN !== 'true') return null;
  const key = username.trim().toLowerCase();
  const account = demoAccounts[key];
  if (!account?.passwordHash || !verifyPassword(password, account.passwordHash)) return null;
  return { username: account.studentId ?? key, displayNameTh: account.name, displayNameEn: '', email: '', type: 'demo', role: account.role, roleLabel: account.roleLabel };
}

const loginWindowMs = 15 * 60 * 1000;
const loginMaxFailures = 5;

function requestIp(event) {
  return String(event.requestContext?.http?.sourceIp ?? event.requestContext?.identity?.sourceIp ?? 'unknown').slice(0, 64);
}

function loginAttemptKey(username, ip) {
  return `${username.trim().toLowerCase()}|${ip}`.slice(0, 255);
}

async function isLoginLocked(event, username) {
  const key = loginAttemptKey(username, requestIp(event));
  const rows = await queryRows('SELECT locked_until FROM login_attempts WHERE attempt_key = ?', [key]);
  if (!rows.length || !rows[0].locked_until) return 0;
  const remaining = Math.ceil((new Date(rows[0].locked_until).getTime() - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

async function recordLoginFailure(event, username) {
  const key = loginAttemptKey(username, requestIp(event));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT failed_count, window_started_at, locked_until FROM login_attempts WHERE attempt_key = ? FOR UPDATE',
      [key],
    );
    const current = rows[0];
    const windowExpired = !current || (Date.now() - new Date(current.window_started_at).getTime()) >= loginWindowMs;
    const failedCount = windowExpired ? 1 : Number(current.failed_count) + 1;
    const locked = failedCount >= loginMaxFailures;
    await connection.execute(
      `INSERT INTO login_attempts
        (attempt_key, username, ip_address, failed_count, window_started_at, locked_until, last_attempt_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ${locked ? 'DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)' : 'NULL'}, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
        failed_count = VALUES(failed_count),
        window_started_at = IF(VALUES(failed_count) = 1, CURRENT_TIMESTAMP, window_started_at),
        locked_until = VALUES(locked_until),
        last_attempt_at = CURRENT_TIMESTAMP`,
      [key, username.slice(0, 100), requestIp(event), failedCount],
    );
    await connection.commit();
    return { locked, retryAfter: locked ? 15 * 60 : 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function resetLoginAttempts(event, username) {
  await pool.execute('DELETE FROM login_attempts WHERE attempt_key = ?', [loginAttemptKey(username, requestIp(event))]);
}

async function safeLoginAudit({ username, action, event, newValue = null }) {
  try {
    await writeAuditLog({
      username: username.slice(0, 100) || 'unknown',
      role: 'anonymous',
      action,
      entityType: 'authentication',
      entityId: username.slice(0, 100) || 'unknown',
      newValue: newValue == null ? { ip: requestIp(event) } : { ...newValue, ip: requestIp(event) },
    });
  } catch (error) {
    console.error('Login audit write failed', error);
  }
}

async function failedLogin(event, username) {
  const result = await recordLoginFailure(event, username);
  await safeLoginAudit({ username, action: result.locked ? 'login_locked' : 'login_failed', event, newValue: { locked: result.locked } });
  if (result.locked) return response(429, { error: 'Too many failed login attempts. Try again later.' }, { 'Retry-After': String(result.retryAfter) });
  return invalidLoginResponse();
}

async function tuLogin(event) {
  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response(400, { error: 'Request body must be valid JSON' });
  }

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) {
    return response(400, { error: 'username and password are required' });
  }
  const retryAfter = await isLoginLocked(event, username);
  if (retryAfter > 0) {
    await safeLoginAudit({ username, action: 'login_locked', event, newValue: { locked: true } });
    return response(429, { error: 'Too many failed login attempts. Try again later.' }, { 'Retry-After': String(retryAfter) });
  }
  const demoUser = demoLogin(username, password);
  if (demoUser) {
    try {
      await resetLoginAttempts(event, username);
      const token = signAccessToken(demoUser);
      await safeLoginAudit({ username, action: 'login_success', event, newValue: { role: demoUser.role } });
      // Token is set as an HttpOnly cookie. It stays in the body too for the transition.
      return response(200, { token, user: demoUser }, { 'Set-Cookie': authCookie(token, AUTH_COOKIE_MAX_AGE) });
    } catch (error) {
      console.error('JWT signing failed for demo login', error);
      return response(503, { error: 'JWT authentication is not configured' });
    }
  }
  if (demoUsernames.has(username.toLowerCase())) return failedLogin(event, username);

  if (!process.env.TU_APPLICATION_KEY) {
    console.error('TU_APPLICATION_KEY is not configured');
    return response(503, { error: 'TU authentication is not configured' });
  }

  const authResponse = await fetch(
    process.env.TU_AUTH_URL ?? 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify2',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Application-Key': process.env.TU_APPLICATION_KEY,
      },
      body: JSON.stringify({ UserName: username, PassWord: password }),
    },
  );
  const payload = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || payload.status !== true) {
    return failedLogin(event, username);
  }

  const user = {
      username: payload.username ?? username,
      displayNameTh: payload.displayname_th ?? '',
      displayNameEn: payload.displayname_en ?? '',
      email: payload.email ?? '',
      type: payload.type ?? 'student',
      role: payload.type === 'student' ? 'student' : 'staff',
      roleLabel: payload.type === 'student' ? 'นักศึกษา' : 'เจ้าหน้าที่',
      tuStatus: payload.tu_status ?? null,
      statusId: payload.statusid ?? null,
      department: payload.department ?? null,
      faculty: payload.faculty ?? null,
      organization: payload.organization ?? null,
  };

  try {
    await resetLoginAttempts(event, username);
    const token = signAccessToken(user);
    await safeLoginAudit({ username, action: 'login_success', event, newValue: { role: user.role } });
    // Token is set as an HttpOnly cookie. It stays in the body too for the transition.
    return response(200, { token, user }, { 'Set-Cookie': authCookie(token, AUTH_COOKIE_MAX_AGE) });
  } catch (error) {
    console.error('JWT signing failed', error);
    return response(503, { error: 'JWT authentication is not configured' });
  }
}

async function getStudentProfile(event) {
  const actor = actorFromRequest(event);
  if (actor.authError) return response(actor.forbidden ? 403 : 401, { error: 'Unauthorized' });
  if (!actor.authenticated || actor.role !== 'student') return response(403, { error: 'Forbidden' });
  const studentId = actor.username;
  if (!process.env.TU_APPLICATION_KEY) {
    console.error('TU_APPLICATION_KEY is not configured');
    return response(503, { error: 'TU profile API is not configured' });
  }

  const profileResponse = await fetch(
    `https://restapi.tu.ac.th/api/v2/profile/std/info/?id=${encodeURIComponent(studentId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Application-Key': process.env.TU_APPLICATION_KEY,
      },
    },
  );
  const payload = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok) {
    return response(profileResponse.status, { error: payload.message ?? 'Unable to load student profile' });
  }

  const profile = payload.data ?? payload;

  return response(200, {
    data: {
      studentId: profile.userName ?? profile.username ?? profile.studentid ?? studentId,
      displayNameTh: profile.displayname_th ?? '',
      displayNameEn: profile.displayname_en ?? '',
      statusId: profile.statusid ?? profile.statsid ?? null,
      statusName: profile.statusname ?? '',
      levelName: profile.level_name ?? '',
      faculty: profile.faculty ?? '',
      department: profile.department ?? '',
      email: profile.email ?? '',
    },
  });
}

export const authHandler = async (event) => {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    if (method === 'GET') return await getStudentProfile(event);
    return await tuLogin(event);
  } catch (error) {
    console.error('TU authentication request failed', error);
    return response(502, { error: 'Unable to reach TU Authentication API' });
  }
};

// Clears the auth cookie. Returns 200 regardless of whether a valid session existed.
function logout() {
  return response(200, { data: { loggedOut: true } }, { 'Set-Cookie': authCookie('', 0) });
}

const roleLabels = {
  student: 'นักศึกษา',
  instructor: 'อาจารย์ผู้สอน',
  staff: 'เจ้าหน้าที่',
  curriculum_admin: 'ผู้ดูแลข้อมูลหลักสูตร',
};

// Reports the current session. Used by the frontend on page load instead of reading
// the token from storage, since the HttpOnly cookie is invisible to JavaScript. The
// shape mirrors the login user object, filled from the JWT claims available after a
// refresh (TU-only fields such as faculty are not in the token and come back empty).
function me(event) {
  const actor = actorFromRequest(event);
  if (!actor.authenticated) return response(401, { error: 'Unauthorized' });
  return response(200, {
    data: {
      user: {
        username: actor.username,
        role: actor.role,
        roleLabel: roleLabels[actor.role] ?? '',
        displayNameTh: actor.name ?? '',
        displayNameEn: '',
      },
    },
  });
}

export async function writeAuditLog({
  username,
  role,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
}) {
  await pool.execute(
    `INSERT INTO audit_log
      (actor_username, actor_role, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      role,
      action,
      entityType,
      entityId,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
    ],
  );
}

function pathParameter(event, name) {
  return event.pathParameters?.[name] ?? event.pathParameters?.[name.toLowerCase()];
}

async function listCourses(event) {
  const query = event.queryStringParameters ?? {};
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  const includeUnplaced = query.includeUnplaced === '1'
    && ['staff', 'curriculum_admin'].includes(actor.role);
  const conditions = ['c.active = 1'];
  const params = [];

  if (query.curriculumId) {
    conditions.push('cc.curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.pathwayId) {
    conditions.push('cc.pathway_id = ?');
    params.push(query.pathwayId);
  }
  if (query.q) {
    conditions.push('(c.course_code LIKE ? OR c.course_code_th LIKE ? OR c.title_th LIKE ? OR c.title_en LIKE ?)');
    const term = `%${query.q}%`;
    params.push(term, term, term, term);
  }

  const limit = Math.max(1, Math.min(Number.parseInt(query.limit ?? '100', 10) || 100, 500));
  const offset = Math.max(0, Number.parseInt(query.offset ?? '0', 10) || 0);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const placements = await queryRows(
    `SELECT c.course_id, c.course_code, c.course_code_th, c.title_th, c.title_en,
            c.credits_total, c.status, c.active, cc.curriculum_course_id,
            cc.curriculum_id, cur.academic_year, cc.pathway_id, cc.course_group,
            cc.requirement_type
       FROM course c
       ${includeUnplaced ? 'LEFT JOIN curriculum_course cc ON cc.course_id = c.course_id\n       LEFT JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id AND cur.active = 1' : 'JOIN curriculum_course cc ON cc.course_id = c.course_id\n       JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id AND cur.active = 1'}
       ${where}
      ORDER BY c.course_code, cc.curriculum_id, cc.pathway_id
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  await addClassifications(placements);
  return response(200, { data: placements, pagination: { limit, offset, count: placements.length } });
}

async function addClassifications(placements) {
  if (!placements.length) return;
  const ids = [...new Set(placements.map((item) => item.curriculum_course_id))];
  const marks = ids.map(() => '?').join(',');
  const rows = await queryRows(
    `SELECT cl.curriculum_course_id, cl.course_type_code, cl.course_type_label_th,
            cl.other_detail, sc.subcategory_code, sc.label_th AS subcategory_label_th,
            sc.detail AS subcategory_detail
       FROM course_classification cl
       LEFT JOIN course_subcategory sc ON sc.curriculum_course_id = cl.curriculum_course_id
      WHERE cl.curriculum_course_id IN (${marks})
      ORDER BY sc.subcategory_code`,
    ids,
  );
  const byPlacement = new Map();
  for (const row of rows) {
    let classification = byPlacement.get(row.curriculum_course_id);
    if (!classification) {
      classification = {
        course_type: { code: row.course_type_code, label_th: row.course_type_label_th },
        other_detail: row.other_detail,
        subcategories: [],
      };
      byPlacement.set(row.curriculum_course_id, classification);
    }
    if (row.subcategory_code) {
      classification.subcategories.push({
        code: row.subcategory_code,
        label_th: row.subcategory_label_th,
        detail: row.subcategory_detail,
      });
    }
  }
  for (const placement of placements) {
    placement.classification = byPlacement.get(placement.curriculum_course_id) ?? null;
  }
}

async function getCourse(event) {
  const courseId = pathParameter(event, 'courseId') ?? pathParameter(event, 'courseCode');
  if (!courseId) return response(400, { error: 'courseId is required' });

  const courses = await queryRows(
    `SELECT c.course_id, c.course_code, c.course_code_th, c.title_th, c.title_en,
            c.credits_total, c.status, c.active, cc.curriculum_course_id,
            cc.curriculum_id, cur.academic_year, cc.pathway_id, cc.course_group,
            cc.requirement_type
       FROM course c
       LEFT JOIN curriculum_course cc ON cc.course_id = c.course_id
       LEFT JOIN curriculum cur ON cur.curriculum_id = cc.curriculum_id
      WHERE c.course_id = ?
         OR c.course_code = ?
         OR REPLACE(c.course_code, ' ', '') = REPLACE(?, ' ', '')
      ORDER BY cc.curriculum_id, cc.pathway_id`,
    [courseId, courseId, courseId],
  );
  if (!courses.length) return response(404, { error: 'Course not found' });

  await addClassifications(courses);
  const prerequisites = await getPrerequisiteChain(courses[0].course_id);
  const dependents = await getDependentCourses(courses[0].course_id);
  let detail = null;
  try {
    const details = await queryRows(
      `SELECT description_th, description_en, contact_hours_json, raw_json
         FROM course_detail
        WHERE course_id = ?`,
      [courses[0].course_id],
    );
    detail = details[0] ?? null;
  } catch (error) {
    // Keep the existing course endpoint usable until migration 002 is applied.
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return response(200, {
    data: { ...courses[0], placements: courses, prerequisites, dependents, detail },
  });
}

async function deleteCourse(event) {
  const courseCode = pathParameter(event, 'courseCode') ?? pathParameter(event, 'courseId');
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  if (!courseCode) return response(400, { error: 'courseCode is required' });
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can delete courses' });
  const courses = await queryRows(
    `SELECT c.course_id, c.course_code
       FROM course c
      WHERE c.course_code = ? OR REPLACE(c.course_code, ' ', '') = REPLACE(?, ' ', '')
      LIMIT 1`,
    [courseCode, courseCode],
  );
  if (!courses.length) return response(404, { error: 'Course not found' });
  const placements = await queryRows('SELECT curriculum_course_id FROM curriculum_course WHERE course_id = ?', [courses[0].course_id]);
  if (placements.length) return response(409, { error: 'Course is already used by a curriculum' });
  await pool.execute('UPDATE course SET active = 0, status = \'inactive\' WHERE course_id = ?', [courses[0].course_id]);
  await writeAuditLog({ username: actor.username, role: actor.role, action: 'course_deleted', entityType: 'course', entityId: courses[0].course_id, oldValue: courses[0], newValue: { active: 0 } });
  return response(200, { data: { ...courses[0], active: 0 } });
}

async function getPrerequisiteChain(courseId) {
  const visited = new Set([courseId]);
  let frontier = [{ courseId, depth: 0 }];
  const chain = [];

  while (frontier.length && frontier[0].depth < 20) {
    const sourceIds = frontier.map((item) => item.courseId);
    const nextRows = await queryRows(
      `SELECT p.course_id, p.prerequisite_course_id, required.course_code,
              required.course_code_th, required.title_th, required.title_en
         FROM prerequisite p
         JOIN course required ON required.course_id = p.prerequisite_course_id
        WHERE p.course_id IN (${sourceIds.map(() => '?').join(',')})
        ORDER BY required.course_code`,
      sourceIds,
    );
    const nextFrontier = [];
    for (const row of nextRows) {
      const depth = (frontier.find((item) => item.courseId === row.course_id)?.depth ?? 0) + 1;
      chain.push({ ...row, depth, completed: false });
      if (!visited.has(row.prerequisite_course_id)) {
        visited.add(row.prerequisite_course_id);
        nextFrontier.push({ courseId: row.prerequisite_course_id, depth });
      }
    }
    frontier = nextFrontier;
  }
  return chain;
}

async function getDependentCourses(courseId) {
  return queryRows(
    `SELECT dependent.course_id, dependent.course_code, dependent.course_code_th,
            dependent.title_th, dependent.title_en
       FROM prerequisite p
       JOIN course dependent ON dependent.course_id = p.course_id
      WHERE p.prerequisite_course_id = ?
      ORDER BY dependent.course_code`,
    [courseId],
  );
}

async function listPrerequisites(event) {
  const courseId = pathParameter(event, 'courseId') ?? pathParameter(event, 'courseCode');
  if (!courseId) return response(400, { error: 'courseId is required' });

  const matches = await queryRows(
    `SELECT course_id
       FROM course
      WHERE course_id = ?
         OR course_code = ?
         OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
      LIMIT 1`,
    [courseId, courseId, courseId],
  );
  if (!matches.length) return response(404, { error: 'Course not found' });
  const data = await getPrerequisiteChain(matches[0].course_id);
  return response(200, { data: { courseId: matches[0].course_id, prerequisites: data } });
}

async function listGraduationConditions(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const data = await queryRows(
    `SELECT condition_id, curriculum_id, display_order, condition_text
       FROM curriculum_graduation_condition
      WHERE curriculum_id = ?
      ORDER BY display_order, condition_id`,
    [curriculumId],
  );
  return response(200, { data });
}

async function listStudyPlans(event) {
  const query = event.queryStringParameters ?? {};
  const conditions = [];
  const params = [];
  if (query.curriculumId) {
    conditions.push('sp.curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.pathwayId) {
    conditions.push('sp.pathway_id = ?');
    params.push(query.pathwayId);
  }
  if (query.active !== undefined) {
    conditions.push('sp.active = ?');
    params.push(query.active === 'false' ? 0 : 1);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const data = await queryRows(
    `SELECT sp.study_plan_id, sp.curriculum_id, sp.pathway_id, sp.plan_name,
            sp.plan_name_th, sp.plan_name_en, sp.active
       FROM study_plan sp
       JOIN curriculum cur ON cur.curriculum_id = sp.curriculum_id AND cur.active = 1
       ${where}
      ORDER BY sp.curriculum_id, sp.pathway_id, sp.study_plan_id`,
    params,
  );
  return response(200, { data });
}

async function getStudyPlan(event) {
  const studyPlanId = event.queryStringParameters?.studyPlanId ?? pathParameter(event, 'studyPlanId');
  if (!studyPlanId) return response(400, { error: 'studyPlanId is required' });
  const plans = await queryRows(
    `SELECT sp.study_plan_id, sp.curriculum_id, sp.pathway_id, sp.plan_name,
            sp.plan_name_th, sp.plan_name_en, sp.active
       FROM study_plan sp
       JOIN curriculum cur ON cur.curriculum_id = sp.curriculum_id AND cur.active = 1
      WHERE sp.study_plan_id = ?`,
    [studyPlanId],
  );
  if (!plans.length) return response(404, { error: 'Study plan not found' });
  const query = event.queryStringParameters ?? {};
  const conditions = ['spi.study_plan_id = ?'];
  const params = [studyPlanId];
  if (query.studyYear) {
    conditions.push('spi.study_year = ?');
    params.push(Number.parseInt(query.studyYear, 10));
  }
  if (query.semester) {
    conditions.push('spi.semester = ?');
    params.push(Number.parseInt(query.semester, 10));
  }
  const items = await queryRows(
    `SELECT spi.study_year, spi.semester, spi.item_order, spi.course_id,
            c.course_code, c.title_th, c.title_en, spi.requirement_text, spi.credits
       FROM study_plan_item spi
       LEFT JOIN course c ON c.course_id = spi.course_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY spi.study_year, spi.semester, spi.item_order`,
    params,
  );
  return response(200, { data: { ...plans[0], items } });
}

async function listFaculties() {
  const data = await queryRows(
    `SELECT faculty_id, faculty_th, faculty_en
       FROM faculty
      ORDER BY faculty_th`,
  );
  return response(200, { data });
}

async function listCurricula(event) {
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  const includeInactive = event.queryStringParameters?.includeInactive === '1'
    && ['staff', 'curriculum_admin'].includes(actor.role);
  const data = await queryRows(
    `SELECT curriculum_id, title_th, title_en, academic_year, active
       FROM curriculum
      ${includeInactive ? '' : 'WHERE active = 1'}
      ORDER BY academic_year DESC, curriculum_id`,
  );
  return response(200, { data });
}

async function listDepartments(event) {
  const facultyId = event.queryStringParameters?.facultyId;
  const data = await queryRows(
    `SELECT department_code, faculty_id, department_name_th, department_name_en
       FROM department
       ${facultyId ? 'WHERE faculty_id = ?' : ''}
      ORDER BY department_name_th`,
    facultyId ? [facultyId] : [],
  );
  return response(200, { data });
}

async function listAuditLogs(event) {
  const actor = actorFromRequest(event);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can view audit logs' });
  const query = event.queryStringParameters ?? {};
  const limit = Math.max(1, Math.min(Number.parseInt(query.limit ?? '100', 10) || 100, 500));
  const data = await queryRows(
    `SELECT audit_id, actor_username, actor_role, action,
            entity_type, entity_id, old_value, new_value, created_at
       FROM audit_log
      ORDER BY created_at DESC, audit_id DESC
      LIMIT ?`,
    [limit],
  );
  return response(200, { data });
}

function requestBody(event) {
  if (!event.body) return {};
  const text = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function actorFromRequest(event, body = {}) {
  const headers = event.headers ?? {};
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  // Prefer the HttpOnly cookie. Bearer stays as a fallback during the transition so
  // existing clients keep working until they switch to the cookie flow.
  const authorization = String(normalized.authorization ?? '');
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = cookieToken(normalized) ?? bearer;
  if (token && process.env.JWT_SECRET) {
    try {
      const claims = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: jwtIssuer,
        audience: jwtAudience,
      });
      if (claims && typeof claims === 'object') {
        if (!allowedRoles.has(String(claims.role))) return { username: '', role: '', authenticated: false, authError: true, forbidden: true };
        return {
          username: String(claims.sub ?? '').slice(0, 100),
          role: String(claims.role ?? '').slice(0, 30),
          name: String(claims.name ?? '').slice(0, 200),
          authenticated: true,
        };
      }
    } catch {
      return { username: '', role: '', authenticated: false, authError: true };
    }
  }

  return { username: 'anonymous', role: 'public', authenticated: false };
}

const draftEditorRoles = new Set(['staff', 'curriculum_admin']);
const changeItemActions = new Set([
  'ADD_COURSE',
  'REMOVE_COURSE',
  'MOVE_COURSE',
  'EDIT_FIELD',
  'ADD_PREREQ',
  'REMOVE_PREREQ',
  'CREATE_CURRICULUM',
  'CREATE_COURSE',
]);

function normalizeChangeTerm(value) {
  if (value === null || value === undefined || value === '') return null;
  const term = String(value).trim().toUpperCase();
  if (term === '3' || term === 'S' || term === 'SUM' || term === 'SUMMER' || term === 'ภาคฤดูร้อน') return 'S';
  return term;
}

function canEditDraft(actor) {
  return draftEditorRoles.has(actor.role);
}

function parseJsonValue(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeChangeRequest(row) {
  if (!row) return null;
  return {
    ...row,
    base_version_id: row.base_version_id == null ? null : Number(row.base_version_id),
    payload: parseJsonValue(row.payload),
  };
}

function normalizeChangeItem(row) {
  if (!row) return null;
  return {
    ...row,
    old_value: parseJsonValue(row.old_value),
    new_value: parseJsonValue(row.new_value),
  };
}

async function createDraftChangeRequest(event) {
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can create drafts' });

  const type = String(body.type ?? '').trim();
  const curriculumId = String(body.curriculumId ?? '').trim() || null;
  const sourceCurriculumId = String(body.sourceCurriculumId ?? '').trim() || null;
  const title = String(body.title ?? '').trim();
  const note = String(body.note ?? '').trim() || null;
  const baseVersionId = body.baseVersionId == null || body.baseVersionId === ''
    ? null
    : Number(body.baseVersionId);
  if (!['add_curriculum', 'edit_structure', 'edit_course'].includes(type) || !title) {
    return response(400, { error: 'type and title are required' });
  }
  if (baseVersionId !== null && !Number.isInteger(baseVersionId)) {
    return response(400, { error: 'baseVersionId must be an integer' });
  }
  if (type === 'edit_structure' && !curriculumId) {
    return response(400, { error: 'curriculumId is required for this draft type' });
  }
  if (curriculumId) {
    const curriculum = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
    if (!curriculum.length) return response(404, { error: 'Curriculum not found' });
  }
  if (sourceCurriculumId) {
    const source = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [sourceCurriculumId]);
    if (!source.length) return response(404, { error: 'Source curriculum not found' });
  }
  if (baseVersionId !== null) {
    const version = await queryRows('SELECT id, curriculum_id FROM curriculum_versions WHERE id = ?', [baseVersionId]);
    if (!version.length) return response(404, { error: 'Base version not found' });
    if (curriculumId && version[0].curriculum_id !== curriculumId) {
      return response(400, { error: 'Base version does not belong to curriculum' });
    }
  }

  const [result] = await pool.execute(
    `INSERT INTO change_requests
      (curriculum_id, type, status, base_version_id, source_curriculum_id, title, note, created_by)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [curriculumId, type, baseVersionId, sourceCurriculumId, title, note, actor.username],
  );
  const rows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [result.insertId]);
  const data = normalizeChangeRequest(rows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_request_created',
    entityType: 'change_request',
    entityId: String(result.insertId),
    newValue: data,
  });
  return response(201, { data });
}

async function saveDraftChangeItems(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can edit drafts' });
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items) return response(400, { error: 'items must be an array' });

  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.status !== 'draft') return response(409, { error: 'Only draft requests can be edited' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the draft owner can edit this request' });

  const normalized = items.map((item, index) => ({
    action: String(item.action ?? '').trim().toUpperCase(),
    courseCode: String(item.courseCode ?? item.course_code ?? '').trim() || null,
    studyYear: item.studyYear ?? item.study_year ?? null,
    term: normalizeChangeTerm(item.term ?? item.semester),
    oldValue: item.oldValue ?? item.old_value ?? null,
    newValue: item.newValue ?? item.new_value ?? null,
    sortOrder: Number.isInteger(Number(item.sortOrder ?? item.sort_order))
      ? Number(item.sortOrder ?? item.sort_order)
      : index,
  }));
  for (const item of normalized) {
    if (!changeItemActions.has(item.action)) return response(400, { error: `Unsupported item action: ${item.action}` });
    if (item.courseCode && item.courseCode.length > 30) return response(400, { error: 'courseCode is too long' });
    if (item.studyYear !== null && (!Number.isInteger(Number(item.studyYear)) || Number(item.studyYear) < 1)) {
      return response(400, { error: 'studyYear must be a positive integer' });
    }
    if (item.term !== null && !['1', '2', 'S', 1, 2].includes(item.term)) {
      return response(400, { error: 'term must be 1, 2, or S' });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM change_items WHERE request_id = ?', [requestId]);
    for (const item of normalized) {
      await connection.execute(
        `INSERT INTO change_items
          (request_id, action, course_code, study_year, term, old_value, new_value, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          item.action,
          item.courseCode,
          item.studyYear === null ? null : Number(item.studyYear),
          item.term === null ? null : String(item.term),
          item.oldValue == null ? null : JSON.stringify(item.oldValue),
          item.newValue == null ? null : JSON.stringify(item.newValue),
          item.sortOrder,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const savedItems = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_items_saved',
    entityType: 'change_request',
    entityId: String(requestId),
    newValue: { itemCount: savedItems.length },
  });
  return response(200, { data: { requestId, items: savedItems.map(normalizeChangeItem) } });
}

async function submitDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can submit drafts' });
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the draft owner can submit this request' });
  if (request.status !== 'draft') return response(409, { error: 'Only draft requests can be submitted' });
  const items = await queryRows('SELECT id FROM change_items WHERE request_id = ?', [requestId]);
  if (!items.length) return response(400, { error: 'Add at least one change item before submitting' });
  await pool.execute(`UPDATE change_requests SET status = 'pending', submitted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`, [requestId]);
  const updatedRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const data = normalizeChangeRequest(updatedRows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'change_request_submitted',
    entityType: 'change_request',
    entityId: String(requestId),
    oldValue: request,
    newValue: data,
  });
  return response(200, { data });
}

async function deleteDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  if (!Number.isInteger(requestId)) return response(400, { error: 'requestId is required' });
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the draft owner can delete this request' });
  if (request.status !== 'draft') return response(409, { error: 'Only draft requests can be deleted' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [versions] = await connection.execute(
      'SELECT id FROM curriculum_versions WHERE based_on_request_id = ? LIMIT 1 FOR UPDATE',
      [requestId],
    );
    if (versions.length) {
      await connection.rollback();
      return response(409, { error: 'This draft is referenced by a curriculum version and cannot be deleted' });
    }
    await connection.execute('DELETE FROM change_items WHERE request_id = ?', [requestId]);
    await connection.execute('DELETE FROM change_requests WHERE id = ? AND status = \'draft\' AND created_by = ?', [requestId, actor.username]);
    await connection.execute(
      `INSERT INTO audit_log
        (actor_username, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actor.username, actor.role, 'change_request_deleted', 'change_request', String(requestId), JSON.stringify(request), null],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return response(200, { data: { requestId, status: 'deleted' } });
}

async function cancelDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  if (!Number.isInteger(requestId)) return response(400, { error: 'requestId is required' });
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const actor = actorFromRequest(event, body);
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.created_by !== actor.username) return response(403, { error: 'Only the request owner can cancel this request' });
  if (request.status !== 'pending') return response(409, { error: 'Only pending requests can be cancelled' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE change_requests
          SET status = 'draft', submitted_at = NULL,
              reviewed_by = NULL, reviewed_at = NULL, reject_reason = NULL
        WHERE id = ? AND status = 'pending' AND created_by = ?`,
      [requestId, actor.username],
    );
    const [updatedRows] = await connection.execute('SELECT * FROM change_requests WHERE id = ?', [requestId]);
    const updated = normalizeChangeRequest(updatedRows[0]);
    await connection.execute(
      `INSERT INTO audit_log
        (actor_username, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actor.username, actor.role, 'change_request_cancelled', 'change_request', String(requestId), JSON.stringify(request), JSON.stringify(updated)],
    );
    await connection.commit();
    return response(200, { data: updated });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function decideDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  const body = requestBody(event);
  if (!Number.isInteger(requestId) || !body) return response(400, { error: 'requestId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can approve or reject change requests' });
  const action = String(body.action ?? '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) return response(400, { error: 'action must be approve or reject' });
  const requestRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requestRows[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (request.created_by === actor.username) return response(403, { error: 'Request owner cannot review their own request' });
  if (request.status !== 'pending') return response(409, { error: 'Only pending requests can be reviewed' });
  const note = String(body.note ?? '').trim() || null;
  if (action === 'reject' && !note) return response(400, { error: 'A rejection reason is required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const items = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
    if (action === 'approve' && request.type === 'add_curriculum') {
      const createItem = items.map(normalizeChangeItem).find(item => item.action === 'CREATE_CURRICULUM');
      const value = createItem?.new_value ?? {};
      const curriculumId = String(value.curriculumId ?? request.curriculum_id ?? '').trim();
      const academicYear = Number(value.academicYear);
      const titleTh = String(value.titleTh ?? value.title ?? '').trim() || curriculumId;
      const titleEn = String(value.titleEn ?? '').trim() || null;
      if (!curriculumId || !Number.isInteger(academicYear)) throw new Error('New curriculum details are incomplete');
      await connection.execute(
        `INSERT INTO curriculum (curriculum_id, title_th, academic_year, active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE title_th = VALUES(title_th), academic_year = VALUES(academic_year), active = 1`,
        [curriculumId, titleTh, academicYear],
      );
      await connection.execute(
        'UPDATE curriculum SET title_en = ? WHERE curriculum_id = ?',
        [titleEn, curriculumId],
      );
      const studyPlanId = `${curriculumId}-MAIN`;
      await connection.execute(
        `INSERT INTO study_plan (study_plan_id, curriculum_id, plan_name, plan_name_th, plan_name_en, active)
         VALUES (?, ?, 'แผนหลัก', 'แผนหลัก', 'Main Plan', 1)
         ON DUPLICATE KEY UPDATE active = 1`,
        [studyPlanId, curriculumId],
      );
      const orderByTerm = new Map();
      for (const item of items.map(normalizeChangeItem).filter(item => item.action === 'ADD_COURSE')) {
        const year = Number(item.study_year);
        const semester = String(item.term ?? '1') === 'S' ? 3 : Number(item.term);
        if (!Number.isInteger(year) || !Number.isInteger(semester)) continue;
        const itemOrder = orderByTerm.get(`${year}-${semester}`) ?? 0;
        orderByTerm.set(`${year}-${semester}`, itemOrder + 1);
        let courseId = null;
        if (item.course_code) {
          const courseRows = await queryRows(
            'SELECT course_id FROM course WHERE course_code = ? OR REPLACE(course_code, \' \', \'\') = REPLACE(?, \' \', \'\') LIMIT 1',
            [item.course_code, item.course_code],
          );
          courseId = courseRows[0]?.course_id ?? null;
        }
        const value = item.new_value ?? {};
        if (courseId) {
          await connection.execute(
            `INSERT IGNORE INTO curriculum_course
              (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
             VALUES (?, ?, NULL, ?, ?, ?)` ,
            [
              `${curriculumId}-${item.id}`.slice(0, 100),
              curriculumId,
              courseId,
              value.courseGroup ?? null,
              value.requirementType ?? 'required',
            ],
          );
        }
        await connection.execute(
          `INSERT IGNORE INTO study_plan_item
            (study_plan_id, study_year, semester, item_order, course_id, requirement_text, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [studyPlanId, year, semester, itemOrder, courseId, value.requirementText ?? null, value.credits == null ? null : Number(value.credits)],
        );
      }
    } else if (action === 'approve' && request.type === 'edit_structure') {
      const activePlans = await queryRows(
        `SELECT study_plan_id, pathway_id
           FROM study_plan
          WHERE curriculum_id = ? AND active = 1
          ORDER BY study_plan_id`,
        [request.curriculum_id],
      );
      const createdCourseIds = new Map();
      for (const rawItem of items) {
        const item = normalizeChangeItem(rawItem);
        if (item.action !== 'CREATE_COURSE') continue;
        const value = item.new_value ?? {};
        const courseCode = String(item.course_code ?? value.code ?? '').trim();
        const courseId = `COURSE-${requestId}-${item.id}`.slice(0, 80);
        if (!courseCode || !value.name) throw new Error('New course details are incomplete');
        await connection.execute(
          `INSERT INTO course
            (course_id, course_code, course_code_th, title_th, title_en, credits_total, status, active)
           VALUES (?, ?, ?, ?, ?, ?, 'active', 1)`,
          [courseId, courseCode, value.codeTh ?? null, value.name, value.nameEn ?? null, Number(value.credits ?? 0)],
        );
        createdCourseIds.set(courseCode.replace(/\s+/g, '').toUpperCase(), courseId);
      }
      for (const rawItem of items) {
        const item = normalizeChangeItem(rawItem);
        if (item.action !== 'ADD_COURSE' || !item.course_code) continue;
        const value = item.new_value ?? {};
        const selectedPlan = activePlans.find(plan => plan.study_plan_id === value.planId) ?? activePlans[0];
        if (!selectedPlan) throw new Error('Active study plan not found');
        const createdCourseId = createdCourseIds.get(item.course_code.replace(/\s+/g, '').toUpperCase());
        const courseRows = createdCourseId ? [{ course_id: createdCourseId, credits_total: null }] : await queryRows(
          'SELECT course_id, credits_total FROM course WHERE course_code = ? OR REPLACE(course_code, \' \', \'\') = REPLACE(?, \' \', \'\') LIMIT 1',
          [item.course_code, item.course_code],
        );
        if (!courseRows.length) throw new Error(`Course not found: ${item.course_code}`);
        const courseId = courseRows[0].course_id;
        const year = Number(item.study_year);
        const semester = String(item.term ?? '1') === 'S' ? 3 : Number(item.term);
        if (!Number.isInteger(year) || !Number.isInteger(semester)) continue;
        const orderRows = await queryRows(
          'SELECT COALESCE(MAX(item_order), -1) AS max_order FROM study_plan_item WHERE study_plan_id = ? AND study_year = ? AND semester = ?',
          [selectedPlan.study_plan_id, year, semester],
        );
        const itemOrder = Number(orderRows[0]?.max_order ?? -1) + 1;
        await connection.execute(
          `INSERT IGNORE INTO study_plan_item
            (study_plan_id, study_year, semester, item_order, course_id, requirement_text, credits)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [selectedPlan.study_plan_id, year, semester, itemOrder, courseId, value.credits == null ? courseRows[0].credits_total : Number(value.credits)],
        );
        const existingPlacement = await queryRows(
          'SELECT curriculum_course_id FROM curriculum_course WHERE curriculum_id = ? AND course_id = ? AND (pathway_id <=> ?)',
          [request.curriculum_id, courseId, selectedPlan.pathway_id ?? null],
        );
        if (!existingPlacement.length) {
          await connection.execute(
            `INSERT INTO curriculum_course
              (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              `${request.curriculum_id}-${requestId}-${item.id}`.slice(0, 100),
              request.curriculum_id,
              selectedPlan.pathway_id ?? null,
              courseId,
              value.courseGroup ?? null,
              value.requirementType ?? 'required',
            ],
          );
        }
      }
    } else if (action === 'approve' && request.type === 'edit_course') {
      for (const rawItem of items) {
        const item = normalizeChangeItem(rawItem);
        if (item.action === 'CREATE_COURSE') {
          const value = item.new_value ?? {};
          const courseCode = String(item.course_code ?? value.code ?? '').trim();
          if (!courseCode || !value.name) throw new Error('New course details are incomplete');
          const courseId = `COURSE-${requestId}-${item.id}`.slice(0, 80);
          await connection.execute(
            `INSERT INTO course
              (course_id, course_code, course_code_th, title_th, title_en, credits_total, status, active)
             VALUES (?, ?, ?, ?, ?, ?, 'active', 1)`,
            [courseId, courseCode, value.codeTh ?? null, value.name, value.nameEn ?? null, Number(value.credits ?? 0)],
          );
          continue;
        }
        if (item.action !== 'EDIT_FIELD' || !item.course_code) continue;
        const value = item.new_value ?? {};
        const courseRows = await queryRows(
          'SELECT course_id FROM course WHERE course_code = ? OR REPLACE(course_code, \' \', \'\') = REPLACE(?, \' \', \'\') LIMIT 1',
          [item.course_code, item.course_code],
        );
        if (!courseRows.length) throw new Error(`Course not found: ${item.course_code}`);
        await connection.execute(
          `UPDATE course
              SET title_th = COALESCE(?, title_th),
                  title_en = COALESCE(?, title_en),
                  credits_total = COALESCE(?, credits_total)
            WHERE course_id = ?`,
          [value.name ?? null, value.nameEn ?? null, value.credits == null ? null : Number(value.credits), courseRows[0].course_id],
        );
      }
    }
    await connection.execute(
      `UPDATE change_requests
          SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ?
        WHERE id = ? AND status = 'pending'`,
      [action === 'approve' ? 'approved' : 'rejected', actor.username, note, requestId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const updatedRows = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const data = normalizeChangeRequest(updatedRows[0]);
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: action === 'approve' ? 'change_request_approved' : 'change_request_rejected',
    entityType: 'change_request',
    entityId: String(requestId),
    oldValue: request,
    newValue: data,
  });
  return response(200, { data });
}

async function getDraftChangeRequest(event) {
  const requestId = Number(pathParameter(event, 'requestId'));
  if (!Number.isInteger(requestId)) return response(400, { error: 'requestId is required' });
  const body = requestBody(event) ?? {};
  const actor = actorFromRequest(event, body);
  const requests = await queryRows('SELECT * FROM change_requests WHERE id = ?', [requestId]);
  const request = normalizeChangeRequest(requests[0]);
  if (!request) return response(404, { error: 'Change request not found' });
  if (!canEditDraft(actor) && request.created_by !== actor.username) {
    return response(403, { error: 'You are not allowed to view this request' });
  }
  const items = await queryRows('SELECT * FROM change_items WHERE request_id = ? ORDER BY sort_order, id', [requestId]);
  return response(200, { data: { request, items: items.map(normalizeChangeItem) } });
}

async function listDraftChangeRequests(event) {
  const query = event.queryStringParameters ?? {};
  const body = requestBody(event) ?? {};
  const actor = actorFromRequest(event, body);
  const status = String(query.status ?? '').trim();
  const conditions = [];
  const params = [];
  if (status) {
    if (!['draft', 'pending', 'approved', 'rejected'].includes(status)) return response(400, { error: 'Invalid status' });
    conditions.push('cr.status = ?');
    params.push(status);
  }
  if (!canEditDraft(actor)) {
    conditions.push('cr.created_by = ?');
    params.push(actor.username);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryRows(
    `SELECT cr.*, COUNT(ci.id) AS item_count
       FROM change_requests cr
       LEFT JOIN change_items ci ON ci.request_id = cr.id
       ${where}
      GROUP BY cr.id
      ORDER BY cr.created_at DESC, cr.id DESC`,
    params,
  );
  return response(200, { data: rows.map((row) => ({ ...normalizeChangeRequest(row), item_count: Number(row.item_count) })) });
}

async function getActivePlanForDraft(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  if (!canEditDraft(actor)) return response(403, { error: 'Only staff or curriculum admin can load an active plan for editing' });
  const query = event.queryStringParameters ?? {};
  const conditions = ['sp.curriculum_id = ?', 'sp.active = 1'];
  const params = [curriculumId];
  if (query.studyYear) {
    conditions.push('spi.study_year = ?');
    params.push(Number.parseInt(query.studyYear, 10));
  }
  if (query.term) {
    conditions.push('spi.semester = ?');
    params.push(Number.parseInt(query.term, 10));
  }
  const plans = await queryRows(
    `SELECT sp.study_plan_id, sp.curriculum_id, sp.pathway_id, sp.plan_name,
            sp.plan_name_th, sp.plan_name_en, sp.active
       FROM study_plan sp
      WHERE sp.curriculum_id = ? AND sp.active = 1
      ORDER BY sp.study_plan_id`,
    [curriculumId],
  );
  if (!plans.length) return response(404, { error: 'Active study plan not found' });
  const items = await queryRows(
    `SELECT spi.study_year, spi.semester, spi.item_order, spi.course_id,
            c.course_code, c.title_th, c.title_en, spi.requirement_text, spi.credits
       FROM study_plan_item spi
       JOIN study_plan sp ON sp.study_plan_id = spi.study_plan_id AND sp.active = 1
       LEFT JOIN course c ON c.course_id = spi.course_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY spi.study_year, spi.semester, spi.item_order`,
    params,
  );
  return response(200, { data: { plans, items } });
}

async function getCurriculumWorkflow(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  const rows = await queryRows(
    `SELECT curriculum_id, status, updated_by, updated_role, updated_at
       FROM curriculum_workflow
      WHERE curriculum_id = ?`,
    [curriculumId],
  );
  return response(200, { data: rows[0] ?? { curriculum_id: curriculumId, status: 'draft' } });
}

async function setCurriculumVisibility(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  const body = requestBody(event);
  if (!curriculumId || !body) return response(400, { error: 'curriculumId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can change curriculum visibility' });
  if (typeof body.active !== 'boolean') return response(400, { error: 'active must be boolean' });
  const protectedCurriculumIds = new Set(['BSC-CS-2566', 'BSC-CNC-2568']);
  if (body.active === false && body.operation === 'delete' && protectedCurriculumIds.has(curriculumId)) {
    return response(409, { error: 'Core curricula cannot be deleted' });
  }
  const current = await queryRows('SELECT curriculum_id, academic_year, active FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
  if (!current.length) return response(404, { error: 'Curriculum not found' });
  await pool.execute(
    `UPDATE curriculum
        SET active = ?, archived_at = ?, archived_by = ?
      WHERE curriculum_id = ?`,
    [body.active ? 1 : 0, body.active ? null : new Date(), body.active ? null : actor.username, curriculumId],
  );
  const updated = { ...current[0], active: body.active ? 1 : 0, archived_by: body.active ? null : actor.username };
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: body.active
      ? 'curriculum_shown'
      : body.operation === 'delete' ? 'curriculum_deleted' : 'curriculum_hidden',
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue: current[0],
    newValue: updated,
  });
  return response(200, { data: updated });
}

async function deleteCurriculum(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  const actor = actorFromRequest(event, requestBody(event) ?? {});
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can delete curricula' });
  if (new Set(['BSC-CS-2566', 'BSC-CNC-2568']).has(curriculumId)) {
    return response(409, { error: 'Core curricula cannot be deleted' });
  }

  const current = await queryRows('SELECT curriculum_id, academic_year, active FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
  if (!current.length) return response(404, { error: 'Curriculum not found' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const placements = await queryRows('SELECT curriculum_course_id FROM curriculum_course WHERE curriculum_id = ?', [curriculumId]);
    const placementIds = placements.map(item => item.curriculum_course_id).filter(Boolean);
    if (placementIds.length) {
      const marks = placementIds.map(() => '?').join(',');
      await connection.execute(`DELETE FROM course_subcategory WHERE curriculum_course_id IN (${marks})`, placementIds);
      await connection.execute(`DELETE FROM course_classification WHERE curriculum_course_id IN (${marks})`, placementIds);
    }
    await connection.execute('DELETE FROM curriculum_course WHERE curriculum_id = ?', [curriculumId]);
    await connection.execute('DELETE FROM curriculum_graduation_condition WHERE curriculum_id = ?', [curriculumId]);
    await connection.execute('DELETE FROM curriculum_department WHERE curriculum_id = ?', [curriculumId]);
    await connection.execute('UPDATE curriculum_change_request SET curriculum_id = NULL WHERE curriculum_id = ?', [curriculumId]);
    await connection.execute('UPDATE change_requests SET curriculum_id = NULL WHERE curriculum_id = ?', [curriculumId]);
    await connection.execute('UPDATE change_requests SET source_curriculum_id = NULL WHERE source_curriculum_id = ?', [curriculumId]);
    await connection.execute('DELETE FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'curriculum_deleted',
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue: current[0],
    newValue: { curriculum_id: curriculumId, deleted: true },
  });
  return response(200, { data: { curriculum_id: curriculumId, deleted: true } });
}

async function updateCurriculumWorkflow(event) {
  const curriculumId = pathParameter(event, 'curriculumId');
  const body = requestBody(event);
  if (!curriculumId) return response(400, { error: 'curriculumId is required' });
  if (!body) return response(400, { error: 'Request body must be valid JSON' });

  const action = String(body.action ?? '').toLowerCase();
  const nextStatus = {
    submit: 'review',
    review: 'review',
    approve: 'approved',
    reject: 'rejected',
    reset: 'draft',
  }[action];
  if (!nextStatus) {
    return response(400, { error: 'action must be submit, approve, reject, or reset' });
  }

  const actor = actorFromRequest(event, body);
  if (actor.role !== 'staff') {
    return response(403, { error: 'Only staff can update curriculum workflow' });
  }

  const current = await queryRows(
    `SELECT curriculum_id, status, updated_by, updated_role, updated_at
       FROM curriculum_workflow
      WHERE curriculum_id = ?`,
    [curriculumId],
  );
  const oldValue = current[0] ?? { curriculum_id: curriculumId, status: 'draft' };
  await pool.execute(
    `INSERT INTO curriculum_workflow
      (curriculum_id, status, updated_by, updated_role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by),
       updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
    [curriculumId, nextStatus, actor.username, actor.role],
  );
  const newValue = {
    curriculum_id: curriculumId,
    status: nextStatus,
    updated_by: actor.username,
    updated_role: actor.role,
  };
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: `workflow_${action}`,
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue,
    newValue,
  });
  return response(200, { data: newValue });
}

function parseChangePayload(row) {
  if (!row) return row;
  return { ...row, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload };
}

async function listCurriculumChanges(event) {
  const query = event.queryStringParameters ?? {};
  const conditions = [];
  const params = [];
  if (query.curriculumId) {
    conditions.push('curriculum_id = ?');
    params.push(query.curriculumId);
  }
  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryRows(
    `SELECT change_id, curriculum_id, operation, payload, status,
            requested_by, requested_role, reviewed_by, reviewed_role,
            review_note, created_at, reviewed_at
       FROM curriculum_change_request
       ${where}
      ORDER BY created_at DESC, change_id DESC`,
    params,
  );
  return response(200, { data: rows.map(parseChangePayload) });
}

async function createCurriculumChange(event) {
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'curriculum_admin') {
    return response(403, { error: 'Only curriculum admin can create curriculum changes' });
  }
  const operation = String(body.operation ?? 'update').toLowerCase();
  const curriculumId = String(body.curriculumId ?? '').trim();
  const payload = { ...(body.payload ?? {}) };
  if (!['create', 'update'].includes(operation) || !curriculumId) {
    return response(400, { error: 'curriculumId and operation are required' });
  }
  const changeType = String(body.changeType ?? payload.changeType ?? 'academic_year');
  payload.changeType = changeType;
  if (changeType === 'academic_year' && !Number.isInteger(Number(payload.academicYear))) {
    return response(400, { error: 'payload.academicYear must be an integer' });
  }
  if (['course_replace', 'course_remove'].includes(changeType) && !payload.curriculumCourseId) {
    return response(400, { error: `${changeType} requires curriculumCourseId` });
  }
  if (['course_replace', 'course_add'].includes(changeType) && !payload.newCourseCode) {
    return response(400, { error: `${changeType} requires newCourseCode` });
  }
  if (!['academic_year', 'course_replace', 'course_add', 'course_remove'].includes(changeType)) {
    return response(400, { error: 'Unsupported curriculum change type' });
  }
  if (operation === 'update') {
    const existing = await queryRows('SELECT curriculum_id FROM curriculum WHERE curriculum_id = ?', [curriculumId]);
    if (!existing.length) return response(404, { error: 'Curriculum not found' });
  }
  if (['course_replace', 'course_remove'].includes(changeType)) {
    const existingCourse = await queryRows(
      `SELECT cc.curriculum_course_id, c.course_code, c.title_th, c.credits_total
         FROM curriculum_course cc
         JOIN course c ON c.course_id = cc.course_id
        WHERE cc.curriculum_course_id = ? AND cc.curriculum_id = ?
        LIMIT 1`,
      [payload.curriculumCourseId, curriculumId],
    );
    if (!existingCourse.length) return response(404, { error: 'Existing curriculum course not found' });
    payload.oldCourse = existingCourse[0];
  }
  if (['course_replace', 'course_add'].includes(changeType)) {
    const newCourse = await queryRows(
      `SELECT course_id, course_code, title_th, credits_total
         FROM course
        WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
        LIMIT 1`,
      [payload.newCourseCode, payload.newCourseCode],
    );
    if (!newCourse.length) return response(404, { error: 'New course not found' });
    payload.newCourse = newCourse[0];
  }
  const currentWorkflow = await queryRows(
    'SELECT status FROM curriculum_workflow WHERE curriculum_id = ?',
    [curriculumId],
  );
  const previousWorkflowStatus = currentWorkflow[0]?.status ?? 'draft';
  const [result] = await pool.execute(
    `INSERT INTO curriculum_change_request
      (curriculum_id, operation, payload, requested_by, requested_role)
     VALUES (?, ?, ?, ?, ?)`,
    [curriculumId, operation, JSON.stringify({
      ...payload,
      previousWorkflowStatus,
      ...(changeType === 'academic_year' ? { academicYear: Number(payload.academicYear) } : {}),
    }), actor.username, actor.role],
  );
  if (operation === 'update') {
    await pool.execute(
      `INSERT INTO curriculum_workflow (curriculum_id, status, updated_by, updated_role)
       VALUES (?, 'review', ?, ?)
       ON DUPLICATE KEY UPDATE status = 'review', updated_by = VALUES(updated_by),
         updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
      [curriculumId, actor.username, actor.role],
    );
  }
  const data = {
    change_id: result.insertId,
    curriculum_id: curriculumId,
    operation,
    payload,
    status: 'pending',
    requested_by: actor.username,
    requested_role: actor.role,
  };
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'curriculum_change_requested',
    entityType: 'curriculum',
    entityId: curriculumId,
    oldValue: null,
    newValue: data,
  });
  return response(201, { data });
}

async function decideCurriculumChange(event) {
  const changeId = pathParameter(event, 'changeId');
  const body = requestBody(event);
  if (!changeId || !body) return response(400, { error: 'changeId and valid JSON body are required' });
  const actor = actorFromRequest(event, body);
  if (actor.role !== 'staff') {
    return response(403, { error: 'Only staff can review changes' });
  }
  const action = String(body.action ?? '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) return response(400, { error: 'action must be approve or reject' });
  const rows = await queryRows('SELECT * FROM curriculum_change_request WHERE change_id = ?', [changeId]);
  const change = parseChangePayload(rows[0]);
  if (!change) return response(404, { error: 'Change request not found' });
  if (change.requested_by === actor.username) return response(403, { error: 'Request owner cannot review their own request' });
  if (change.status !== 'pending') return response(409, { error: 'Change request has already been reviewed' });

  if (action === 'approve') {
    if (change.payload?.changeType === 'course_replace') {
      const replacement = await queryRows(
        `SELECT course_id FROM course
          WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
          LIMIT 1`,
        [change.payload.newCourseCode, change.payload.newCourseCode],
      );
      if (!replacement.length) return response(404, { error: 'Replacement course not found' });
      await pool.execute(
        `UPDATE curriculum_course
            SET course_id = ?
          WHERE curriculum_course_id = ? AND curriculum_id = ?`,
        [replacement[0].course_id, change.payload.curriculumCourseId, change.curriculum_id],
      );
    } else if (change.payload?.changeType === 'course_remove') {
      await pool.execute('DELETE FROM course_subcategory WHERE curriculum_course_id = ?', [change.payload.curriculumCourseId]);
      await pool.execute('DELETE FROM course_classification WHERE curriculum_course_id = ?', [change.payload.curriculumCourseId]);
      await pool.execute(
        'DELETE FROM curriculum_course WHERE curriculum_course_id = ? AND curriculum_id = ?',
        [change.payload.curriculumCourseId, change.curriculum_id],
      );
    } else if (change.payload?.changeType === 'course_add') {
      const newCourse = await queryRows(
        `SELECT course_id, course_code FROM course
          WHERE course_code = ? OR REPLACE(course_code, ' ', '') = REPLACE(?, ' ', '')
          LIMIT 1`,
        [change.payload.newCourseCode, change.payload.newCourseCode],
      );
      if (!newCourse.length) return response(404, { error: 'New course not found' });
      const curriculumCourseId = change.payload.curriculumCourseId ||
        `${change.curriculum_id}-${String(change.payload.newCourseCode).replace(/\s+/g, '')}`;
      await pool.execute(
        `INSERT INTO curriculum_course
          (curriculum_course_id, curriculum_id, pathway_id, course_id, course_group, requirement_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          curriculumCourseId,
          change.curriculum_id,
          change.payload.pathwayId ?? null,
          newCourse[0].course_id,
          change.payload.courseGroup ?? 'วิชาเฉพาะ',
          change.payload.requirementType ?? 'required',
        ],
      );
    } else if (change.operation === 'create') {
      await pool.execute(
        'INSERT INTO curriculum (curriculum_id, academic_year) VALUES (?, ?)',
        [change.curriculum_id, Number(change.payload?.academicYear)],
      );
    } else {
      await pool.execute(
        'UPDATE curriculum SET academic_year = ? WHERE curriculum_id = ?',
        [Number(change.payload?.academicYear), change.curriculum_id],
      );
    }
  }
  await pool.execute(
    `UPDATE curriculum_change_request
        SET status = ?, reviewed_by = ?, reviewed_role = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE change_id = ?`,
    [action === 'approve' ? 'approved' : 'rejected', actor.username, actor.role, body.note ?? null, changeId],
  );
  const nextWorkflowStatus = action === 'approve'
    ? 'approved'
    : (change.payload?.previousWorkflowStatus ?? 'draft');
  await pool.execute(
    `INSERT INTO curriculum_workflow (curriculum_id, status, updated_by, updated_role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by),
       updated_role = VALUES(updated_role), updated_at = CURRENT_TIMESTAMP`,
    [change.curriculum_id, nextWorkflowStatus, actor.username, actor.role],
  );
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: `curriculum_change_${action}`,
    entityType: 'curriculum',
    entityId: change.curriculum_id,
    oldValue: change,
    newValue: { ...change, status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.username },
  });
  return response(200, { data: { ...change, status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: actor.username } });
}

// ---- V4 graduation verification ----
// Reads only. Grade data is written by the CLI import, never through this API.
const GRADUATION_SOURCE_KEY = 'registrar-demo';
const graduationStudentIdPattern = /^[A-Za-z0-9]{1,20}$/;

async function buildGraduationResult(studentId) {
  const records = await queryRows(
    `SELECT g.student_id, g.curriculum_id, g.academic_year, g.semester, g.course_code,
            g.credits, g.grade, b.batch_id, b.data_mode, b.exported_at,
            (SELECT c.title_th FROM course c
              WHERE c.course_code = g.course_code
                 OR REPLACE(c.course_code, ' ', '') = REPLACE(g.course_code, ' ', '')
              ORDER BY c.active DESC, c.course_id LIMIT 1) AS course_name_th,
            (SELECT c.title_en FROM course c
              WHERE c.course_code = g.course_code
                 OR REPLACE(c.course_code, ' ', '') = REPLACE(g.course_code, ' ', '')
              ORDER BY c.active DESC, c.course_id LIMIT 1) AS course_name_en
       FROM graduation_grade_record g
       JOIN graduation_import_batch b ON b.batch_id = g.batch_id
      WHERE g.student_id = ?`,
    [studentId],
  );
  const [latestBatch = null] = await queryRows(
    `SELECT batch_id, status, source_batch_id, exported_at, finished_at, row_rejected
       FROM graduation_import_batch
      WHERE source_key = ? AND finished_at IS NOT NULL
      ORDER BY finished_at DESC, batch_id DESC
      LIMIT 1`,
    [GRADUATION_SOURCE_KEY],
  );

  let studentRejected = 0;
  let unidentifiedRejected = 0;
  if (latestBatch) {
    const [counts] = await queryRows(
      `SELECT COALESCE(SUM(student_id = ?), 0) AS mine,
              COALESCE(SUM(student_id IS NULL), 0) AS unidentified
         FROM graduation_import_error
        WHERE batch_id = ?`,
      [studentId, latestBatch.batch_id],
    );
    studentRejected = Number(counts?.mine ?? 0);
    unidentifiedRejected = Number(counts?.unidentified ?? 0);
  }

  const asOf = records.reduce((latest, record) => {
    const value = new Date(record.exported_at);
    return !latest || value > latest ? value : latest;
  }, null);
  const dataSource = resolveDataSource({
    latestBatch,
    studentRejectedInLatest: studentRejected,
    unidentifiedRejectedInLatest: unidentifiedRejected,
    asOf,
    now: new Date(),
    maxAgeDays: Number(process.env.GRADUATION_SNAPSHOT_MAX_AGE_DAYS ?? DEFAULT_SNAPSHOT_MAX_AGE_DAYS),
  });

  if (!records.length) {
    return {
      studentId,
      dataMode: latestBatch ? 'demo' : null,
      curriculum: null,
      verdict: 'no_data',
      dataSource,
      totals: null,
      conditions: [],
    };
  }

  const curriculumId = pickCurriculum(records);
  const curriculumRecords = records.filter((record) => record.curriculum_id === curriculumId);
  const [studentMeta = {}] = await queryRows(
    `SELECT student_id, display_name, student_year
       FROM graduation_student_assignment
      WHERE student_id = ?
      ORDER BY student_year DESC, assignment_id
      LIMIT 1`,
    [studentId],
  );
  const conditions = await queryRows(
    `SELECT display_order, condition_text
       FROM curriculum_graduation_condition
      WHERE curriculum_id = ?
      ORDER BY display_order`,
    [curriculumId],
  );
  const rules = await queryRows(
    `SELECT condition_order, rule_type, params
       FROM graduation_rule
      WHERE curriculum_id = ?`,
    [curriculumId],
  );

  const evaluation = evaluateGraduation({
    conditions: conditions.map((row) => ({ order: Number(row.display_order), text: row.condition_text })),
    rules: rules.map((row) => ({
      condition_order: Number(row.condition_order),
      rule_type: row.rule_type,
      params: parseJsonValue(row.params, {}),
    })),
    records: curriculumRecords,
    dataSource,
  });

  const [studyPlan = null] = await queryRows(
    `SELECT study_plan_id, plan_name, plan_name_th, plan_name_en, pathway_id
       FROM study_plan
      WHERE curriculum_id = ? AND active = 1
      ORDER BY pathway_id IS NOT NULL, study_plan_id
      LIMIT 1`,
    [curriculumId],
  );
  let plan = [];
  if (studyPlan) {
    plan = await queryRows(
      `SELECT spi.study_year, spi.semester, spi.item_order, spi.credits,
              c.course_code, c.title_th AS course_name_th, c.title_en AS course_name_en
         FROM study_plan_item spi
         LEFT JOIN course c ON c.course_id = spi.course_id
        WHERE spi.study_plan_id = ?
        ORDER BY spi.study_year, spi.semester, spi.item_order`,
      [studyPlan.study_plan_id],
    );
  }
  const latestByCourse = new Map();
  for (const record of curriculumRecords) {
    const code = String(record.course_code ?? '').replace(/\s+/g, '').toUpperCase();
    const current = latestByCourse.get(code);
    const attempt = Number(record.academic_year) * 10 + Number(record.semester);
    if (!current || attempt > current.attempt) latestByCourse.set(code, { ...record, attempt });
  }
  const progressPlan = plan.map((item) => {
    const code = String(item.course_code ?? '').replace(/\s+/g, '').toUpperCase();
    const taken = latestByCourse.get(code);
    return {
      studyYear: Number(item.study_year),
      semester: Number(item.semester),
      itemOrder: Number(item.item_order ?? 0),
      courseCode: item.course_code ?? null,
      courseNameTh: item.course_name_th ?? null,
      courseNameEn: item.course_name_en ?? null,
      credits: item.credits == null ? null : Number(item.credits),
      status: taken ? (['F', 'U', 'W', 'I'].includes(String(taken.grade)) ? 'failed_or_incomplete' : 'completed') : 'not_taken',
      grade: taken?.grade ?? null,
      takenAcademicYear: taken?.academic_year ?? null,
      takenSemester: taken?.semester ?? null,
    };
  });

  return {
    studentId,
    student: {
      studentId,
      displayName: studentMeta.display_name ?? null,
      studyYear: studentMeta.student_year == null ? null : Number(studentMeta.student_year),
    },
    dataMode: records.some((record) => record.data_mode === 'demo') ? 'demo' : 'live',
    curriculum: { curriculumId },
    verdict: evaluation.verdict,
    dataSource,
    totals: evaluation.totals,
    conditions: evaluation.conditions,
    records: curriculumRecords.map((record) => ({
      courseCode: record.course_code,
      courseNameTh: record.course_name_th ?? null,
      courseNameEn: record.course_name_en ?? null,
      academicYear: Number(record.academic_year),
      semester: Number(record.semester),
      credits: Number(record.credits),
      grade: record.grade,
      dataMode: record.data_mode,
    })),
    plan: progressPlan,
  };
}

async function assignedGraduationStudentIds(username) {
  const rows = await queryRows(
    'SELECT student_id FROM graduation_student_assignment WHERE assignee_username = ?',
    [username],
  );
  return new Set(rows.map((row) => row.student_id));
}

async function graduationForStudent(event) {
  const actor = actorFromRequest(event);
  if (actor.role !== 'student') return response(403, { error: 'Only students can open their own graduation check' });
  return response(200, { data: await buildGraduationResult(actor.username) });
}

async function graduationForStudentId(event) {
  const actor = actorFromRequest(event);
  const studentId = String(pathParameter(event, 'studentId') ?? '').trim();
  if (!graduationStudentIdPattern.test(studentId)) return response(400, { error: 'studentId is invalid' });

  const assigned = ['instructor', 'staff'].includes(actor.role)
    ? await assignedGraduationStudentIds(actor.username)
    : new Set();
  const decision = canViewGraduation(actor, studentId, assigned);
  if (!decision.allowed) return response(403, { error: 'Forbidden' });

  if (!decision.own) {
    // Record who viewed another person's record. The log holds no grade values.
    await writeAuditLog({
      username: actor.username,
      role: actor.role,
      action: 'graduation_viewed',
      entityType: 'student_graduation',
      entityId: studentId,
    });
  }
  return response(200, { data: await buildGraduationResult(studentId) });
}

async function listAssignedGraduationStudents(event) {
  const actor = actorFromRequest(event);
  if (!['instructor', 'staff'].includes(actor.role)) return response(403, { error: 'Forbidden' });
  const rows = await queryRows(
    `SELECT a.student_id, a.display_name, a.student_year,
            EXISTS (SELECT 1 FROM graduation_grade_record g WHERE g.student_id = a.student_id) AS has_data
       FROM graduation_student_assignment a
      WHERE a.assignee_username = ?
      ORDER BY a.student_id`,
    [actor.username],
  );
  return response(200, { data: rows.map((row) => ({
    studentId: row.student_id,
    displayName: row.display_name ?? null,
    studyYear: row.student_year == null ? null : Number(row.student_year),
    hasData: Boolean(row.has_data),
  })) });
}

async function assignGraduationStudent(event) {
  const actor = actorFromRequest(event);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can assign students' });
  const body = requestBody(event);
  if (!body) return response(400, { error: 'Request body must be valid JSON' });
  const studentId = String(body.studentId ?? '').trim();
  const displayName = String(body.displayName ?? '').trim().slice(0, 255) || null;
  const studentYear = Number(body.studentYear);
  if (!graduationStudentIdPattern.test(studentId)) return response(400, { error: 'studentId is invalid' });
  if (!Number.isInteger(studentYear) || studentYear < 1 || studentYear > 4) return response(400, { error: 'studentYear must be 1, 2, 3, or 4' });
  await pool.execute(
    `INSERT INTO graduation_student_assignment
      (assignee_username, student_id, assigned_by, display_name, student_year)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), student_year = VALUES(student_year)`,
    [actor.username, studentId, actor.username, displayName, studentYear],
  );
  await writeAuditLog({
    username: actor.username,
    role: actor.role,
    action: 'graduation_student_assigned',
    entityType: 'student_graduation',
    entityId: studentId,
    newValue: { studentYear },
  });
  return response(201, { data: { studentId, displayName, studyYear: studentYear, assigneeUsername: actor.username } });
}

async function listGraduationImportBatches(event) {
  const actor = actorFromRequest(event);
  if (actor.role !== 'staff') return response(403, { error: 'Only staff can view import history' });
  const rows = await queryRows(
    `SELECT batch_id, source_key, data_mode, source_batch_id, status, exported_at, started_at, finished_at,
            row_total, row_inserted, row_updated, row_unchanged, row_rejected, error_summary, imported_by
       FROM graduation_import_batch
      ORDER BY batch_id DESC
      LIMIT 50`,
  );
  return response(200, { data: rows.map((row) => ({ ...row, error_summary: parseJsonValue(row.error_summary, {}) })) });
}

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method ?? event.httpMethod;
    const route = event.routeKey ?? `${method} ${event.rawPath ?? event.path ?? ''}`;

    if (route === 'POST /api/auth/login') return await tuLogin(event);
    if (method === 'OPTIONS') return response(204, null);

    // CSRF defense for the cookie flow: every state-changing request must carry the custom
    // header. Login is exempt (it has no cookie yet and sets one). A cross-site attacker
    // cannot add this header on a simple request, so its presence proves a same-origin caller.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfHeader = Object.fromEntries(
        Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
      )[CSRF_HEADER];
      if (String(csrfHeader ?? '') !== '1') return response(403, { error: 'Missing CSRF header' });
    }

    if (route === 'POST /api/auth/logout') return logout();
    if (route === 'GET /api/auth/me') return me(event);

    const publicRoutes = new Set([
      'GET /api/courses',
      'GET /api/curricula',
      'GET /api/faculties',
      'GET /api/departments',
      'GET /api/study-plans',
      'GET /api/study-plans/{studyPlanId}',
    ]);
    const isPublic = publicRoutes.has(route)
      || (method === 'GET' && route.startsWith('GET /api/courses/'))
      || route === 'GET /api/curricula/{curriculumId}/graduation-conditions'
      || route === 'GET /api/curricula/{curriculumId}/workflow';
    if (!isPublic) {
      const actor = actorFromRequest(event);
      if (actor.authError) return response(actor.forbidden ? 403 : 401, { error: actor.forbidden ? 'Forbidden' : 'Unauthorized' });
      if (!actor.authenticated) return response(401, { error: 'Unauthorized' });
    }
    if (route === 'POST /api/change-requests') return await createDraftChangeRequest(event);
    if (route === 'PUT /api/change-requests/{requestId}/items') return await saveDraftChangeItems(event);
    if (route === 'POST /api/change-requests/{requestId}/submit') return await submitDraftChangeRequest(event);
    if (route === 'DELETE /api/change-requests/{requestId}') return await deleteDraftChangeRequest(event);
    if (route === 'POST /api/change-requests/{requestId}/cancel') return await cancelDraftChangeRequest(event);
    if (route === 'POST /api/change-requests/{requestId}/decision') return await decideDraftChangeRequest(event);
    if (route === 'POST /api/curriculum-changes') return await createCurriculumChange(event);
    if (route === 'POST /api/curriculum-changes/{changeId}/decision') return await decideCurriculumChange(event);
    if (route === 'PATCH /api/curricula/{curriculumId}/visibility') return await setCurriculumVisibility(event);
    if (route === 'DELETE /api/curricula/{curriculumId}') return await deleteCurriculum(event);
    if (route === 'DELETE /api/courses/{courseCode}') return await deleteCourse(event);
    if (route === 'POST /api/curricula/{curriculumId}/workflow') return await updateCurriculumWorkflow(event);
    if (route === 'POST /api/graduation/assignments') return await assignGraduationStudent(event);
    if (method !== 'GET') return response(405, { error: 'Method not allowed' });
    if (route === 'GET /api/courses') return await listCourses(event);
    if (route.endsWith('/prerequisites') && route.startsWith('GET /api/courses/')) return await listPrerequisites(event);
    if (route === 'GET /api/courses/{courseCode}' || route.startsWith('GET /api/courses/')) return await getCourse(event);
    if (route === 'GET /api/curricula/{curriculumId}/graduation-conditions') return await listGraduationConditions(event);
    if (route === 'GET /api/curricula/{curriculumId}/workflow') return await getCurriculumWorkflow(event);
    if (route === 'GET /api/curricula/{curriculumId}/active-plan') return await getActivePlanForDraft(event);
    if (route === 'GET /api/change-requests') return await listDraftChangeRequests(event);
    if (route === 'GET /api/change-requests/{requestId}') return await getDraftChangeRequest(event);
    if (route === 'GET /api/study-plans') return await listStudyPlans(event);
    if (route === 'GET /api/study-plans/{studyPlanId}') return await getStudyPlan(event);
    if (route === 'GET /api/curricula') return await listCurricula(event);
    if (route === 'GET /api/faculties') return await listFaculties();
    if (route === 'GET /api/departments') return await listDepartments(event);
    if (route === 'GET /api/audit-logs') return await listAuditLogs(event);
    if (route === 'GET /api/curriculum-changes') return await listCurriculumChanges(event);
    if (route === 'GET /api/graduation/me') return await graduationForStudent(event);
    if (route === 'GET /api/graduation/students') return await listAssignedGraduationStudents(event);
    if (route === 'GET /api/graduation/students/{studentId}') return await graduationForStudentId(event);
    if (route === 'GET /api/graduation/import-batches') return await listGraduationImportBatches(event);
    return response(404, { error: 'Route not found' });
  } catch (error) {
    console.error('API request failed', error);
    return response(500, { error: 'Internal server error' });
  }
};
