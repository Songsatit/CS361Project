import 'dotenv/config';
import mysql from 'mysql2/promise';

const args = new Set(process.argv.slice(2));
const host = String(process.env.DB_HOST ?? '').trim();
const database = String(process.env.LOADTEST_DB_NAME ?? '').trim();
const databasePattern = /^cs361_loadtest_[a-z0-9_]+$/;
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

function usage() {
  console.log(`Usage:
  node src/load-test-cleanup.mjs                 # dry-run (default)
  node src/load-test-cleanup.mjs --confirm       # drop isolated load-test DB

Required environment: DB_HOST, DB_USER, DB_PASSWORD, LOADTEST_DB_NAME.
LOADTEST_DB_NAME must match cs361_loadtest_<lowercase-run-id>.
`);
}

if (args.has('--help')) {
  usage();
  process.exit(0);
}
if (!localHosts.has(host)) {
  throw new Error('Refusing cleanup: DB_HOST must be loopback. Use the approved snapshot/stack runbook for RDS.');
}
if (!databasePattern.test(database)) {
  throw new Error('Refusing cleanup: LOADTEST_DB_NAME must match cs361_loadtest_<lowercase-run-id>.');
}
if (!args.has('--confirm')) {
  console.log(JSON.stringify({ mode: 'dry-run', host, database, action: 'DROP DATABASE', requires: '--confirm' }, null, 2));
  process.exit(0);
}

const connection = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
try {
  await connection.query('DROP DATABASE ??', [database]);
  console.log(JSON.stringify({ mode: 'deleted', host, database }, null, 2));
} finally {
  await connection.end();
}

