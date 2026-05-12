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
 *
 * Output flags (apply to all modes that capture output):
 *   - -x / --expanded : one column per line (great for wide tables)
 *   - --csv           : comma-separated output with a header row
 *   - --json          : json output (psql 12+, one JSON object per row)
 *   - -t              : tuples only (no headers, no `(N rows)` footer)
 *   - --limit N       : wrap an inline SELECT in `LIMIT N` for safety
 */

import { readFileSync } from 'node:fs';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops psql                     Open an interactive psql session.
hops psql '<sql>'             Run a single statement (psql -c).
hops psql -f <path>           Run a SQL file from disk.
hops psql --stdin             Read SQL from stdin (heredoc-friendly).

Output formatting flags:
  -x, --expanded     One column per line (psql \\x toggle). Use this for
                     wide tables like users where 25+ columns get cut off.
  --csv              Output CSV (with headers). Pipe to a file for Excel.
  --json             Output JSON (one object per row, psql 12+).
  -t                 Tuples only — strip headers and the (N rows) footer.
  --limit N          Wrap inline SELECT in 'LIMIT N'. Defensive cap when
                     querying large tables. Ignored for non-SELECT.

Other flags:
  -f <path>          Read SQL from the given file.
  --stdin            Read SQL from stdin until EOF.
  --help, -h         Show this help.

Defaults (per --target):
  prod    → user=postgres, db=postgres (override with PG_USER / PG_DB
            or HOPS_PROD_PG_USER / HOPS_PROD_PG_DB).
  staging → user=hospeda_staging_user, db=hospeda_staging (override with
            HOPS_STAGING_PG_USER / HOPS_STAGING_PG_DB).

Examples:
  hops psql 'SELECT count(*) FROM users;'
  hops psql -x 'SELECT * FROM users LIMIT 3'
  hops psql --csv 'SELECT email, role FROM users' > users.csv
  hops psql --json 'SELECT email, role FROM users' | jq '.[] | .email'
  hops psql --limit 50 'SELECT * FROM accommodations'
  hops psql -t 'SELECT email FROM users' | xargs -n1 echo found:
  hops psql -f scripts/db/cleanup-test-users.sql

Notes:
  Inline / -f / --stdin are mutually exclusive. Without any of them,
  drops into an interactive psql session.
`.trim();

/**
 * Wrap an inline statement in LIMIT N when it's a SELECT that doesn't
 * already cap rows. Keeps non-SELECT statements untouched.
 */
function applyLimit(sql: string, limit: number): string {
    const trimmed = sql.trim().replace(/;\s*$/, '');
    if (!/^select\b/i.test(trimmed)) return sql;
    if (/\blimit\s+\d+/i.test(trimmed)) return sql;
    return `${trimmed} LIMIT ${limit}`;
}

/**
 * Build the psql formatting flags from the parsed options. The result
 * is appended to the base `psql -U <user> -d <db>` argv.
 */
function buildFormatFlags(opts: {
    expanded: boolean;
    csv: boolean;
    json: boolean;
    tuplesOnly: boolean;
}): string[] {
    const flags: string[] = [];
    if (opts.expanded) flags.push('-x');
    if (opts.tuplesOnly) flags.push('-t');
    // CSV and JSON are mutually exclusive output modes; CSV wins if both
    // are passed (matches psql's own precedence with --csv overriding
    // explicit format flags).
    if (opts.csv) flags.push('--csv');
    else if (opts.json) {
        // psql supports `--format=json` (alias) in modern builds; older
        // builds also accept `\pset format json` via inline command. We
        // use the long form so the shell history is self-documenting.
        flags.push('--pset=format=json');
    }
    return flags;
}

/**
 * Extract the value for `--limit N` from argv. Returns the limit and
 * the argv with the flag stripped. Throws if the value is missing or
 * not a positive integer.
 */
function extractLimit(argv: ReadonlyArray<string>): {
    limit: number | null;
    remainder: string[];
} {
    const idx = argv.indexOf('--limit');
    if (idx < 0) return { limit: null, remainder: [...argv] };
    const raw = argv[idx + 1];
    if (raw === undefined) {
        die('--limit requires a positive integer.');
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) {
        die(`--limit must be a positive integer, got '${raw}'.`);
    }
    return {
        limit: value,
        remainder: [...argv.slice(0, idx), ...argv.slice(idx + 2)]
    };
}

export async function psql(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(getActiveTarget());
    const user = credentials.user;
    const db = credentials.database;

    // ── Parse formatting flags + strip them from argv ─────────────────────
    const expanded = argv.includes('-x') || argv.includes('--expanded');
    const csv = argv.includes('--csv');
    const json = argv.includes('--json');
    const tuplesOnly = argv.includes('-t');
    const { limit, remainder: argvAfterLimit } = extractLimit(argv);
    const formatFlags = buildFormatFlags({ expanded, csv, json, tuplesOnly });

    const positional = argvAfterLimit.filter(
        (a) => !['-x', '--expanded', '--csv', '--json', '-t'].includes(a)
    );

    const baseArgv = ['psql', '-U', user, '-d', db, ...formatFlags];

    // ── -f <path> ─────────────────────────────────────────────────────────
    const fIdx = positional.indexOf('-f');
    if (fIdx >= 0) {
        const path = positional[fIdx + 1];
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
        const result = await runInContainer({ container, argv: baseArgv, input: sql });
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) {
            process.stderr.write(result.stderr);
            process.exit(result.exitCode);
        }
        return;
    }

    // ── --stdin ───────────────────────────────────────────────────────────
    if (positional.includes('--stdin')) {
        const chunks: Array<Buffer> = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
        }
        const sql = Buffer.concat(chunks).toString('utf-8');
        const result = await runInContainer({ container, argv: baseArgv, input: sql });
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) {
            process.stderr.write(result.stderr);
            process.exit(result.exitCode);
        }
        return;
    }

    // ── Interactive session (no positional args) ──────────────────────────
    if (positional.length === 0) {
        log.info(`psql connected to ${db} as ${user} on ${container}`);
        log.hint('(\\q to exit)');
        await runInContainer({
            container,
            argv: baseArgv,
            tty: true,
            inherit: true
        });
        return;
    }

    // ── Inline SQL ────────────────────────────────────────────────────────
    let inlineSql = positional.join(' ');
    if (limit !== null) {
        inlineSql = applyLimit(inlineSql, limit);
    }
    const result = await runInContainer({
        container,
        argv: [...baseArgv, '-c', inlineSql]
    });
    process.stdout.write(result.stdout);
    if (result.exitCode !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.exitCode);
    }
}
