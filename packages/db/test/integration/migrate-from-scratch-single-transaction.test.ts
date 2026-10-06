// Regression: drizzle-kit applies every pending migration in ONE transaction on a
// clean database. A migration that uses an enum value added by an earlier
// ALTER TYPE ... ADD VALUE (uncommitted in that same transaction) fails with
// "unsafe use of new value". The sibling from-empty test cannot see this because
// the global setup has already migrated its database.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH_DB = `hospeda_scratch_migrate_${process.pid}`;

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

let admin: Pool;

beforeAll(async () => {
    admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
    await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
});

afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin.end();
});

describe('db:migrate on a freshly created empty database', () => {
    it('applies the whole chain in one run without an unsafe enum-value use', () => {
        const run = () =>
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
        expect(run).not.toThrow();
    }, 200_000);

    it('leaves no retired role value behind', async () => {
        const scratch = new Pool({ connectionString: urlFor({ database: SCRATCH_DB }) });
        try {
            const res = await scratch.query<{ enumlabel: string }>(
                `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'role_enum'`
            );
            expect(res.rows.length).toBeGreaterThan(0);
            expect(res.rows.map((r) => r.enumlabel)).not.toContain(['COMM', 'ERCE_OWNER'].join(''));
        } finally {
            await scratch.end();
        }
    });
});
