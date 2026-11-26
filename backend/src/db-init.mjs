// One-off database bootstrap, run inside the VPC as a Lambda so no bastion host is needed.
//
// Invoke from CloudShell (never from the API):
//   aws lambda invoke --function-name <stack>-dbinit --cli-binary-format raw-in-base64-out \
//     --payload '{"masterUser":"admin","masterPassword":"...","appUser":"cs361_app","appPassword":"..."}' out.json
//
// What it does, in order, and it is safe to run again:
//   1. CREATE DATABASE curriculum (utf8mb4 / utf8mb4_unicode_ci) if it does not exist
//   2. Import fixtures/curriculum-full-29-10.sanitized.sql ONLY when the course table is missing.
//      Pass {"force": true} to import again (the dump has no DROP TABLE, so drop the database first)
//   3. Create schema_migrations, record the baseline import, then apply migrations numbered above
//      BASELINE_THROUGH (015-018) once each in order and record them. A migration that fails stops the run
//      and is not recorded, so read the error before running again (ALTER statements are not transactional)
//   4. Create the app user with DML-only rights on curriculum.*
//   5. Optional: {"grantRoles":[{"username":"b65xxxxxxx","role":"staff"}]} adds rows to role_allowlist
//      so a real TU account can be given a staff role in this test environment
//   6. Return row counts so the caller can compare them with the source
//
// Credentials arrive in the invoke payload, not in environment variables, so they are not stored on the function.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const DB_NAME = 'curriculum';
const DUMP_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'curriculum-full-29-10.sanitized.sql',
);
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
// The 2026-10-30 dump already contains the schema of migrations 001-014 (checked by looking for
// their columns and tables: display_name, title_th, plan_name_th, role_allowlist). It does NOT contain
// 015 (grade source columns), 016 (student_contact), 017 (graduation_user_directory) or 018 (rules).
// Those are applied below, in order, once each, and recorded in schema_migrations.
const BASELINE_THROUGH = 14;
const COUNT_TABLES = ['faculty', 'department', 'curriculum', 'course', 'prerequisite', 'graduation_rule', 'role_allowlist'];
const IDENT = /^[A-Za-z0-9_]{1,32}$/;
const TU_USER = /^[A-Za-z0-9._-]{1,100}$/;
const GRANTABLE_ROLES = new Set(['instructor', 'staff', 'curriculum_admin']);

export async function handler(event = {}) {
  const { masterUser, masterPassword, appUser = 'cs361_app', appPassword, force = false, grantRoles = [] } = event;
  if (!masterUser || !masterPassword || !appPassword) {
    throw new Error('payload needs masterUser, masterPassword and appPassword');
  }
  if (!IDENT.test(appUser)) throw new Error('appUser may only contain letters, digits and underscore');
  if (appPassword.length < 12) throw new Error('appPassword must be at least 12 characters');

  for (const grant of grantRoles) {
    if (!TU_USER.test(String(grant?.username ?? '')) || !GRANTABLE_ROLES.has(grant?.role)) {
      throw new Error('grantRoles items need a valid TU username and a role of instructor, staff or curriculum_admin');
    }
  }

  const host = process.env.DB_DIRECT_HOST;
  if (!host) throw new Error('DB_DIRECT_HOST is not set');

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    user: masterUser,
    password: masterPassword,
    multipleStatements: true,
    ...(process.env.DB_TLS === 'false' ? {} : { ssl: { rejectUnauthorized: false } }),
    connectTimeout: 10000,
  });

  const log = [];
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${DB_NAME}\``);

    const [existing] = await conn.query(
      'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      [DB_NAME, 'course'],
    );
    if (existing[0].n > 0 && !force) {
      log.push('course table already exists: import skipped');
    } else {
      const sql = await readFile(DUMP_FILE, 'utf8');
      const started = Date.now();
      await conn.query(sql);
      log.push(`imported dump (${sql.length} bytes) in ${Date.now() - started} ms`);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note VARCHAR(500) NULL,
        UNIQUE KEY uq_schema_migrations_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await conn.query(
      `INSERT IGNORE INTO schema_migrations (name, note) VALUES (?, ?)`,
      ['baseline-curriculum-full-29-10', 'Snapshot import of the sanitized dump. Migrations 001-018 are not individually recorded'],
    );

    const [doneRows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(doneRows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => /^\d{3}_.+\.sql$/.test(file))
      .sort();
    const applied = [];
    for (const file of files) {
      const number = Number(file.slice(0, 3));
      if (number <= BASELINE_THROUGH || done.has(file)) continue;
      await conn.query(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name, note) VALUES (?, ?)', [file, 'applied by db-init']);
      applied.push(file);
    }
    log.push(applied.length ? `applied migrations: ${applied.join(', ')}` : 'no pending migrations');

    const quotedPassword = mysql.escape(appPassword);
    await conn.query(`CREATE USER IF NOT EXISTS '${appUser}'@'%' IDENTIFIED BY ${quotedPassword}`);
    // MySQL prefers an exact host account over '%'. Older runs could therefore leave
    // cs361_app@<lambda-ip> with a stale password while the '%' account was updated.
    // Reset every existing host entry so all Lambda ENIs authenticate consistently.
    const [appAccounts] = await conn.query('SELECT Host FROM mysql.user WHERE User = ?', [appUser]);
    for (const account of appAccounts) {
      const escapedUser = mysql.escapeId(appUser);
      const escapedHost = mysql.escapeId(account.Host);
      await conn.query(`ALTER USER ${escapedUser}@${escapedHost} IDENTIFIED BY ${quotedPassword}`);
      await conn.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO ${escapedUser}@${escapedHost}`);
    }
    log.push(`app user ${appUser} has SELECT, INSERT, UPDATE, DELETE on ${DB_NAME}.*`);

    for (const grant of grantRoles) {
      await conn.query(
        `INSERT INTO role_allowlist (tu_username, role, granted_by) VALUES (?, ?, 'db-init')
         ON DUPLICATE KEY UPDATE role = VALUES(role), granted_by = VALUES(granted_by)`,
        [String(grant.username).trim().toLowerCase(), grant.role],
      );
    }
    if (grantRoles.length) log.push(`role_allowlist rows set: ${grantRoles.length}`);

    const counts = {};
    for (const table of COUNT_TABLES) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
        counts[table] = rows[0].n;
      } catch (error) {
        counts[table] = `error: ${error.code ?? error.message}`;
      }
    }
    return { ok: true, log, counts };
  } finally {
    await conn.end();
  }
}
