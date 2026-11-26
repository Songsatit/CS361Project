# Category backfill dry-run

This is a read-only report against a staging copy. It does not update rows unless `--apply` is explicitly passed; do not pass that flag for the approved dry-run.

## Prepare staging

1. Create a fresh staging database from an approved backup/snapshot. Do not point this at the production RDS endpoint.
2. Confirm the staging connection is read-only or that the staging user has only `SELECT` privileges.
3. Pull the same commit as the application code and apply migration 020 to staging. Migration 020 only adds nullable columns; it does not alter grade, attempt, or source values.
4. Set connection variables in the staging shell without committing them:

```bash
export V4_TEST_DB_HOST='staging-host'
export DB_PORT='3306'
export DB_USER='staging_readonly'
read -s DB_PASSWORD
export DB_PASSWORD
```

## Run the read-only report

From `backend/`:

```bash
node src/graduation/category-backfill.mjs
```

The JSON report contains:

- `scanned`: grade rows whose category is still empty
- `categoryCounts`: number of rows assigned to each category code
- `uncategorizedCount`: rows that could not be mapped safely
- `uncategorizedCourseCodes`: distinct course codes needing review

Save the JSON output as evidence. Do not run `--apply` until the report is reviewed and separately approved. The backfill is idempotent: after an approved apply, a second report should show `scanned: 0` for already-filled rows.
