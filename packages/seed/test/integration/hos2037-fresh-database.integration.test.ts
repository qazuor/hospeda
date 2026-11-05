/**
 * HOS-2037: the fresh-database path (what `db:fresh` runs:
 * versioned migrate, `db:apply-extras`, `seed --required --poi-catalog`, then
 * `seed --data-migrate --baseline-stamp`) must end with
 * `owner-basico` granting `can_embed_video`, a trial version with zero entitlement
 * rows, and the baseline Pro/Premium grants, all through the REAL runner (so a
 * `contentOnly` regression, i.e. baseline-stamping 0133, fails here).
 *
 * Builds its own scratch database (`hospeda_it_hos2037_fresh`, dropped afterwards) so
 * that the shared integration database stays untouched by the runner.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const baseUrl =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';
const database = 'hospeda_it_hos2037_fresh';
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${database}`;
const admin = new Pool({ connectionString: adminUrl.toString() });
let scratch: Pool | undefined;

const run = (cwd: string, args: readonly string[], timeout: number) =>
    execFileSync('pnpm', [...args], {
        cwd,
        stdio: 'pipe',
        timeout,
        maxBuffer: 256 * 1024 * 1024,
        env: {
            ...process.env,
            CI: 'true',
            HOSPEDA_DATABASE_URL: scratchUrl.toString(),
            HOSPEDA_CLOUDINARY_CLOUD_NAME: '',
            HOSPEDA_CLOUDINARY_API_KEY: '',
            HOSPEDA_CLOUDINARY_API_SECRET: ''
        }
    });

beforeAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
    const bootstrap = new Pool({ connectionString: scratchUrl.toString() });
    for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent'])
        await bootstrap.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    await bootstrap.end();
    run(
        resolve(repoRoot, 'packages/db'),
        ['run', 'drizzle-kit', 'migrate', '--config', 'drizzle.config.ts'],
        180_000
    );
    // db:apply-extras, then the db:fresh seed steps (minus --example, which cannot affect the
    // plan catalog), then the db:fresh data-migration step: stamp the historical migrations,
    // run the `contentOnly` ones for real.
    execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', scratchUrl.toString()], {
        cwd: repoRoot,
        stdio: 'pipe',
        timeout: 120_000,
        maxBuffer: 256 * 1024 * 1024
    });
    run(repoRoot, ['--filter', '@repo/seed', 'seed', '--required', '--poi-catalog'], 300_000);
    run(
        repoRoot,
        ['--filter', '@repo/seed', 'seed', '--data-migrate', '--baseline-stamp'],
        300_000
    );
    scratch = new Pool({ connectionString: scratchUrl.toString() });
}, 900_000);

afterAll(async () => {
    await scratch?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
});

describe('HOS-2037 fresh database (migrate, seed, data-migrate)', () => {
    it('ends with Basic, Pro and Premium granting video and the trial deriving it', async () => {
        if (!scratch) throw new Error('scratch database was not initialized');
        const grants = await scratch.query<{ slug: string; role: string | null; grants: string }>(
            `SELECT p.slug, p.role,
                    count(e.id) FILTER (WHERE e.key = 'can_embed_video')::text AS grants
               FROM plan p
               JOIN plan_version v ON v.plan_id = p.id AND v.current
          LEFT JOIN plan_version_entitlement e ON e.plan_version_id = v.id
              WHERE p.vertical = 'accommodation'
           GROUP BY p.slug, p.role`
        );
        const bySlug = new Map(grants.rows.map((row) => [row.slug, row]));
        for (const slug of ['owner-basico', 'owner-pro', 'owner-premium'])
            expect(bySlug.get(slug)?.grants, slug).toBe('1');
        const trialRows = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM plan_version_entitlement e
               JOIN plan_version v ON v.id = e.plan_version_id
               JOIN plan p ON p.id = v.plan_id
              WHERE p.vertical = 'accommodation' AND p.role = 'trial'`
        );
        expect(trialRows.rows[0]?.n).toBe('0');
        const ledger = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM seed_migrations WHERE name = '0133-hos-2037-video-link-all-plans'`
        );
        expect(ledger.rows[0]?.n).toBe('1');
    }, 60_000);
});
