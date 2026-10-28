import 'dotenv/config';
import mysql from 'mysql2/promise';

const args = new Set(process.argv.slice(2));
const confirmDelete = args.has('--confirm');
const ownerApproved = args.has('--owner-approved');

function usage() {
  console.log(`Usage:
  node src/draft-cleanup.mjs                 # dry-run (default)
  node src/draft-cleanup.mjs --confirm --owner-approved

Duplicate definition: same created_by, title, type, and status=draft.
The oldest request ID is kept; newer drafts are candidates for cleanup.
`);
}

if (args.has('--help')) {
  usage();
  process.exit(0);
}

if (confirmDelete && !ownerApproved) {
  console.error('Refusing to delete: both --confirm and --owner-approved are required.');
  process.exit(2);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'curriculum',
});

try {
  const [groups] = await connection.execute(
    `SELECT created_by, title, type, COUNT(*) AS duplicate_count,
            MIN(id) AS keep_id, GROUP_CONCAT(id ORDER BY id) AS request_ids
       FROM change_requests
      WHERE status = 'draft'
      GROUP BY created_by, title, type
     HAVING COUNT(*) > 1
      ORDER BY created_by, title, type`,
  );

  const candidates = [];
  for (const group of groups) {
    const [rows] = await connection.execute(
      `SELECT id, created_by, title, type, status, created_at
         FROM change_requests
        WHERE status = 'draft'
          AND created_by = ? AND title = ? AND type = ?
        ORDER BY id`,
      [group.created_by, group.title, group.type],
    );
    candidates.push(...rows.slice(1).map(row => ({ ...row, keep_id: rows[0].id })));
  }

  console.log(JSON.stringify({
    mode: confirmDelete ? 'confirm' : 'dry-run',
    duplicateGroups: groups,
    candidates,
  }, null, 2));

  if (!confirmDelete || !candidates.length) process.exit(0);

  await connection.beginTransaction();
  let deleted = 0;
  let skippedReferenced = 0;
  for (const candidate of candidates) {
    const [versions] = await connection.execute(
      'SELECT id FROM curriculum_versions WHERE based_on_request_id = ? LIMIT 1 FOR UPDATE',
      [candidate.id],
    );
    if (versions.length) {
      skippedReferenced += 1;
      continue;
    }
    await connection.execute('DELETE FROM change_items WHERE request_id = ?', [candidate.id]);
    const [result] = await connection.execute(
      'DELETE FROM change_requests WHERE id = ? AND status = \'draft\' AND created_by = ?',
      [candidate.id, candidate.created_by],
    );
    if (result.affectedRows !== 1) continue;
    await connection.execute(
      `INSERT INTO audit_log
        (actor_username, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        candidate.created_by,
        'cleanup_tool',
        'change_request_deleted_duplicate_cleanup',
        'change_request',
        String(candidate.id),
        JSON.stringify(candidate),
        JSON.stringify({ kept_request_id: candidate.keep_id }),
      ],
    );
    deleted += 1;
  }
  await connection.commit();
  console.log(JSON.stringify({ deleted, skippedReferenced }, null, 2));
} catch (error) {
  try { await connection.rollback(); } catch { /* no active transaction */ }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
