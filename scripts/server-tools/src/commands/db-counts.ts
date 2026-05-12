/**
 * `hops db-counts` — snapshot of approximate row counts for every user
 * table in the Coolify-managed Postgres.
 *
 * Reads `pg_stat_user_tables.n_live_tup`, which is updated by autovacuum
 * and is "close enough" for an at-a-glance health check. Tables under
 * heavy write traffic can drift between snapshots — for exact counts
 * the operator can fall back to `hops psql 'SELECT count(*) FROM ...'`.
 */

import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die } from '../lib/log.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-counts [--include-empty]

Approximate row counts for every user table in the Postgres container.

Flags:
  --include-empty    Include tables with 0 rows (hidden by default).
  --help, -h         Show this help.

Examples:
  hops db-counts
  hops db-counts --include-empty

Notes:
  Counts come from pg_stat_user_tables (n_live_tup) and may drift
  between autovacuum runs. For exact counts run:
    hops psql 'SELECT count(*) FROM <table>;'
`.trim();

const QUERY_NON_EMPTY = `
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY relname;
`.trim();

const QUERY_ALL = `
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY relname;
`.trim();

export async function dbCounts(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const includeEmpty = argv.includes('--include-empty');
    const sql = includeEmpty ? QUERY_ALL : QUERY_NON_EMPTY;

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(getActiveTarget());
    const user = credentials.user;
    const db = credentials.database;

    const result = await runInContainer({
        container,
        argv: ['psql', '-U', user, '-d', db, '-c', sql]
    });

    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `exit ${result.exitCode}`);
    }

    const out = result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`;
    process.stdout.write(out);
}
