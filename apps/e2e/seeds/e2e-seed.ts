/**
 * E2E suite seed runner (SPEC-092 T-037).
 *
 * Reuses `@repo/seed` to populate the E2E database with required data
 * (roles, destinations hierarchy, plans, super-admin) plus example data
 * (25+ accommodations across types and price ranges, events, posts,
 * reviews, etc.). Idempotent via `reset: true` — every E2E suite run
 * starts from a clean database.
 *
 * Run via:
 *   pnpm --filter hospeda-e2e e2e:seed
 *
 * Required env (read by @repo/seed indirectly via the global pool):
 *   HOSPEDA_E2E_DATABASE_URL — Postgres URL pointing to the E2E database
 *                              (defaults to localhost:15433/hospeda_e2e).
 *
 * Optional:
 *   HOSPEDA_CLOUDINARY_*  — when set, the seed will upload images to the
 *                           configured cloud account. We force folderRoot
 *                           to `hospeda/e2e/seed/` so test uploads stay
 *                           isolated from production assets.
 *
 * Safety:
 *   The script refuses to run when the resolved database URL does NOT
 *   contain `e2e` in the database name. This protects against accidental
 *   wipes of `hospeda_dev` or `hospeda` (production) by a misconfigured
 *   environment.
 */

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { exit } from 'node:process';

/**
 * Default DB URL precedence:
 *   1. HOSPEDA_E2E_DATABASE_URL — explicit CI / wt:up override
 *   2. HOSPEDA_DATABASE_URL     — what the API server already uses
 *   3. Hardcoded fallback       — E2E dedicated postgres port 15433 (defined
 *                                 in apps/e2e/.env.e2e — the SSOT for E2E ports;
 *                                 docker-compose.e2e.yml defaults to 15433 for
 *                                 the standalone E2E container).
 */
const DEFAULT_E2E_DB_URL = 'postgresql://hospeda_user:hospeda_pass@localhost:15433/hospeda_e2e';

const dbUrl = process.env.HOSPEDA_E2E_DATABASE_URL ?? DEFAULT_E2E_DB_URL;

if (!/[/]hospeda[_-]?e2e\b/.test(dbUrl)) {
    console.error(
        `Refusing to seed: HOSPEDA_E2E_DATABASE_URL '${dbUrl}' does not target the E2E database.\nExpected database name to match /hospeda[_-]?e2e\\b/`
    );
    exit(2);
}

// IMPORTANT: must override BEFORE importing @repo/seed because the package
// reads HOSPEDA_DATABASE_URL at module-init time when initializing the pool.
process.env.HOSPEDA_DATABASE_URL = dbUrl;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

// When Cloudinary creds are present, ensure the seed uploads land in
// the E2E folder so the cleanup cron (T-038) can remove them safely.
// We don't fail if they're absent — seed gracefully falls back to
// keeping the original image URLs.
if (
    process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME &&
    process.env.HOSPEDA_CLOUDINARY_API_KEY &&
    process.env.HOSPEDA_CLOUDINARY_API_SECRET
) {
    process.env.HOSPEDA_CLOUDINARY_FOLDER_ROOT =
        process.env.HOSPEDA_CLOUDINARY_FOLDER_ROOT ?? 'hospeda/e2e/seed/';
}

// @repo/seed resolves its `src/data/**` fixtures with `path.resolve('src/data/...')`,
// i.e. relative to process.cwd(). It normally runs with cwd = packages/seed, but
// this runner executes from apps/e2e, so point cwd at the @repo/seed package root
// before seeding. `exports` does not expose package.json, so resolve via the entry
// (packages/seed/src/index.ts) and step up one level to the package root.
const seedRequire = createRequire(import.meta.url);
const seedPackageRoot = resolve(dirname(seedRequire.resolve('@repo/seed')), '..');
process.chdir(seedPackageRoot);

const { runSeed } = await import('@repo/seed');

async function main(): Promise<void> {
    console.info(`[e2e-seed] Resetting + seeding ${dbUrl}`);
    await runSeed({
        reset: true,
        required: true,
        example: true,
        continueOnError: false,
        rollbackOnError: false,
        // The example seed creates a known admin user. Allowed in E2E
        // because the database is ephemeral.
        exclude: []
    });
    console.info('[e2e-seed] Done.');
}

main().catch((error: unknown) => {
    console.error('[e2e-seed] FAILED:', error);
    exit(1);
});
