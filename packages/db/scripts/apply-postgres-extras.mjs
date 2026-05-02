#!/usr/bin/env node
// =============================================================================
// apply-postgres-extras.mjs
//
// Node-based equivalent of apply-postgres-extras.sh. Use when `psql` is
// unavailable, hangs (IPv6/SCRAM channel-binding edge cases on Neon, etc.),
// or when you want consistent behavior across local dev and CI without
// requiring the postgres client tools to be installed.
//
// Applies every *.sql file under packages/db/src/migrations/manual/ in
// lexical order, skipping *_down.sql reversal scripts.
//
// Usage:
//   HOSPEDA_DATABASE_URL='postgresql://...' node packages/db/scripts/apply-postgres-extras.mjs
// =============================================================================
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANUAL_DIR = resolve(__dirname, '..', 'src', 'migrations', 'manual');

async function main() {
    const url = process.env.HOSPEDA_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) {
        console.error('ERROR: HOSPEDA_DATABASE_URL or DATABASE_URL must be set');
        process.exit(1);
    }

    const files = readdirSync(MANUAL_DIR)
        .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
        .sort();

    if (files.length === 0) {
        console.error(`ERROR: No SQL files found in ${MANUAL_DIR}`);
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
        const path = join(MANUAL_DIR, file);
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
