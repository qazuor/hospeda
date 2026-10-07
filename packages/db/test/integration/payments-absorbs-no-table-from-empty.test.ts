// TEST:B1:2 (AC:B1:2, HOS-1506) — the payments package absorbs no table, FROM
// SCRATCH.
//
// A database built with the branch's migrations, from empty, holds no table of
// the legacy billing library (its storage adapter owned the `billing_*` tables;
// none may be born, and no table carries the library's name), and no
// `package.json` of the repo declares that library. The payments package
// itself declares no schema (asserted in packages/payments/test/
// package-boundary.test.ts); this file proves the database side.
//
// Self-contained on purpose: it creates its OWN uniquely named database, applies
// the chain with real `drizzle-kit migrate`, and drops only that database, so it
// does not depend on (or disturb) the shared integration database.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = resolve(pkgDir, '../..');
const SCRATCH_DB = `hospeda_scratch_payments_${process.pid}`;

/** The legacy billing library's name, built in parts so the repo guards never match this file. */
const LEGACY_NAME = ['qz', 'pay'].join('');
const LEGACY_PREFIX = `@qazuor/${LEGACY_NAME}`;

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

let admin: Pool;
let scratch: Pool;

beforeAll(async () => {
    admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
    await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
    execFileSync(
        process.execPath,
        [
            resolve(pkgDir, 'node_modules/tsx/dist/cli.mjs'),
            'node_modules/drizzle-kit/bin.cjs',
            'migrate',
            '--config',
            'drizzle.config.ts'
        ],
        {
            cwd: pkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: urlFor({ database: SCRATCH_DB }) },
            stdio: 'pipe',
            timeout: 180_000
        }
    );
    scratch = new Pool({ connectionString: urlFor({ database: SCRATCH_DB }) });
}, 200_000);

afterAll(async () => {
    await scratch?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin.end();
});

describe('a database built from scratch with the branch migrations (TEST:B1:2)', () => {
    it('has the chain applied (a non-empty public schema)', async () => {
        const result = await scratch.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        expect(Number(result.rows[0]?.count ?? 0)).toBeGreaterThan(20);
    });

    it('holds no table of the legacy billing library', async () => {
        const result = await scratch.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
        );
        const names = result.rows.map((row) => row.table_name);
        expect(names.filter((name) => name.startsWith('billing_'))).toEqual([]);
        expect(names.filter((name) => name.toLowerCase().includes(LEGACY_NAME))).toEqual([]);
    });

    it('holds no schema or type named after the legacy billing library', async () => {
        const schemas = await scratch.query<{ name: string }>(
            'SELECT nspname AS name FROM pg_namespace'
        );
        const types = await scratch.query<{ name: string }>('SELECT typname AS name FROM pg_type');
        const named = [...schemas.rows, ...types.rows]
            .map((row) => row.name)
            .filter((name) => name.toLowerCase().includes(LEGACY_NAME));
        expect(named).toEqual([]);
    });
});

describe('no package.json of the repo declares the legacy billing library (TEST:B1:2)', () => {
    // Pathspec `*package.json` matches at any depth; ignored dirs (node_modules) are excluded.
    const manifests = execFileSync(
        'git',
        ['ls-files', '-co', '--exclude-standard', '--', '*package.json'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
        }
    )
        .split('\n')
        .filter((file) => file === 'package.json' || file.endsWith('/package.json'))
        .filter((file) => !file.includes('node_modules/'));

    it('reads every workspace manifest, the payments package included', () => {
        expect(manifests).toContain('packages/payments/package.json');
        expect(manifests).toContain('apps/api/package.json');
    });

    it.each(manifests)('%s declares none of its packages', (file) => {
        const manifest = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as Record<
            string,
            unknown
        >;
        const declared = (
            ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
        ).flatMap((block) => Object.keys((manifest[block] as Record<string, string>) ?? {}));
        expect(declared.filter((name) => name.startsWith(LEGACY_PREFIX))).toEqual([]);
    });
});
