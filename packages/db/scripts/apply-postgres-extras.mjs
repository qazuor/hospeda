#!/usr/bin/env node
// =============================================================================
// apply-postgres-extras.mjs
//
// Node-based equivalent of apply-postgres-extras.sh. Use when `psql` is
// unavailable, hangs (IPv6/SCRAM channel-binding edge cases on Neon, etc.),
// or when you want consistent behavior across local dev and CI without
// requiring the postgres client tools to be installed.
//
// Applies every *.sql file under packages/db/src/migrations/extras/ in
// lexical order (NNN-name.kind.sql), skipping *_down.sql reversal scripts.
// These are the idempotent Drizzle-invisible extras (matview, triggers,
// CHECK constraints, special indexes) that run AFTER drizzle-kit migrate
// (SPEC-178: the legacy manual/ dir was consolidated into extras/).
//
// Usage:
//   HOSPEDA_DATABASE_URL='postgresql://...' node packages/db/scripts/apply-postgres-extras.mjs
//   node packages/db/scripts/apply-postgres-extras.mjs 'postgresql://user:pass@host:5432/db'
// =============================================================================
import 'dotenv/config';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTRAS_DIR = resolve(__dirname, '..', 'src', 'migrations', 'extras');
const API_ENV_LOCAL = resolve(__dirname, '..', '..', '..', 'apps', 'api', '.env.local');

/**
 * Resolve the database URL, mirroring the legacy .sh behavior:
 *   1. First CLI argument
 *   2. HOSPEDA_DATABASE_URL or DATABASE_URL from the environment
 *   3. HOSPEDA_DATABASE_URL from apps/api/.env.local (canonical per SPEC-035)
 */
function resolveDatabaseUrl() {
    if (process.argv[2]) return process.argv[2];
    if (process.env.HOSPEDA_DATABASE_URL) return process.env.HOSPEDA_DATABASE_URL;
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

    if (existsSync(API_ENV_LOCAL)) {
        const contents = readFileSync(API_ENV_LOCAL, 'utf8');
        for (const line of contents.split('\n')) {
            const match = line.match(/^\s*HOSPEDA_DATABASE_URL\s*=\s*(.+?)\s*$/);
            if (match) {
                return match[1].replace(/^["']|["']$/g, '');
            }
        }
    }

    return undefined;
}

async function main() {
    const url = resolveDatabaseUrl();
    if (!url) {
        console.error(
            'ERROR: No database URL provided.\n' +
                '  Set HOSPEDA_DATABASE_URL or DATABASE_URL in your environment,\n' +
                '  define it in apps/api/.env.local,\n' +
                '  or pass the URL as the first CLI argument.'
        );
        process.exit(1);
    }

    const files = readdirSync(EXTRAS_DIR)
        .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
        .sort();

    if (files.length === 0) {
        console.error(`ERROR: No SQL files found in ${EXTRAS_DIR}`);
        process.exit(1);
    }

    const client = new Client({ connectionString: url });
    await client.connect();

    console.info('============================================================');
    console.info(' apply-postgres-extras.mjs');
    console.info(` Target: ${url.replace(/:[^:@]+@/, ':***@')}`);
    console.info(` Files: ${files.length}`);
    console.info('============================================================');

    let ok = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = join(EXTRAS_DIR, file);
        const sql = readFileSync(path, 'utf8');
        process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
        try {
            await client.query(sql);
            console.info('OK');
            ok++;
        } catch (err) {
            console.info('FAIL');
            console.error(`  Error: ${err.message}`);
            if (err.detail) console.error(`  Detail: ${err.detail}`);
            if (err.hint) console.error(`  Hint: ${err.hint}`);
            await client.end();
            process.exit(1);
        }
    }

    await client.end();
    console.info('============================================================');
    console.info(` All ${ok} migrations applied successfully.`);
    console.info('============================================================');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
