/**
 * `hops psql [sql] [-f file] [--stdin]` — Postgres helper that runs
 * one-shot SQL against the Coolify-managed DB without typing the
 * `docker exec -it $PG psql -U postgres -d postgres` chain by hand.
 *
 * Modes (mutually exclusive):
 *   - inline  : `hops psql 'SELECT count(*) FROM users;'`
 *   - file    : `hops psql -f path/to/script.sql`
 *   - stdin   : `hops psql --stdin <<EOF ... EOF`
 *   - shell   : `hops psql` (no args) → interactive psql session
 */

import { readFileSync } from 'node:fs';
import { findContainer } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { get } from '../lib/env.ts';
import { die, log } from '../lib/log.ts';

const HELP = `
hops psql                     Open an interactive psql session.
hops psql '<sql>'             Run a single statement (psql -c).
hops psql -f <path>           Run a SQL file from disk.
hops psql --stdin             Read SQL from stdin (heredoc-friendly).

Flags:
  -f <path>       Read SQL from the given file.
  --stdin         Read SQL from stdin until EOF.
  --help, -h      Show this help.

Defaults:
  user = $PG_USER  (env var; defaults to 'postgres')
  db   = $PG_DB    (env var; defaults to 'postgres')

Examples:
  hops psql 'SELECT count(*) FROM users;'
  hops psql -f scripts/db/cleanup-test-users.sql
  hops psql --stdin <<EOF
BEGIN;
DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '90 days';
COMMIT;
EOF

Notes:
  Inline / -f / --stdin are mutually exclusive. Without any of them,
  drops into an interactive psql session.
`.trim();

export async function psql(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const container = await findContainer('postgres');
    const user = get('PG_USER') ?? 'postgres';
    const db = get('PG_DB') ?? 'postgres';

    // -f <path>
    const fIdx = argv.indexOf('-f');
    if (fIdx >= 0) {
        const path = argv[fIdx + 1];
        if (!path) {
            die('-f requires a file path.');
        }
        let sql: string;
        try {
            sql = readFileSync(path, 'utf-8');
        } catch (err) {
            die(
                `Cannot read SQL file '${path}': ${err instanceof Error ? err.message : String(err)}`
            );
        }
        const result = await runInContainer({
            container,
            argv: ['psql', '-U', user, '-d', db],
            input: sql
        });
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) {
            process.stderr.write(result.stderr);
            process.exit(result.exitCode);
        }
        return;
    }

    // --stdin
    if (argv.includes('--stdin')) {
        // Drain process.stdin into a string, then feed it to psql.
        const chunks: Array<Buffer> = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
        }
        const sql = Buffer.concat(chunks).toString('utf-8');
        const result = await runInContainer({
            container,
            argv: ['psql', '-U', user, '-d', db],
            input: sql
        });
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) {
            process.stderr.write(result.stderr);
            process.exit(result.exitCode);
        }
        return;
    }

    // Interactive (no args)
    if (argv.length === 0) {
        log.info(`psql connected to ${db} as ${user} on ${container}`);
        log.hint('(\\q to exit)');
        await runInContainer({
            container,
            argv: ['psql', '-U', user, '-d', db],
            tty: true,
            inherit: true
        });
        return;
    }

    // Inline SQL — everything else goes as a single -c argument.
    const inlineSql = argv.join(' ');
    const result = await runInContainer({
        container,
        argv: ['psql', '-U', user, '-d', db, '-c', inlineSql]
    });
    process.stdout.write(result.stdout);
    if (result.exitCode !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.exitCode);
    }
}
