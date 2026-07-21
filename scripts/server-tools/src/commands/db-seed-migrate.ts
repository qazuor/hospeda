/**
 * `hops db-seed-migrate` — apply pending SEED DATA-migrations (HOS-25) against
 * the target environment's Postgres database, from the VPS host.
 *
 * This is the DATA counterpart to `hops db-migrate` (which runs the schema
 * carril: `drizzle-kit migrate` + extras). It runs the versioned seed
 * data-migration carril — the numbered modules under
 * `packages/seed/src/data-migrations/NNNN-*.ts`, tracked exactly-once per
 * environment in the `seed_migrations` ledger table.
 *
 * It resolves and injects the target DB URL exactly the way `hops db-migrate`
 * / `hops db-seed` do (Postgres container inspection → published host port),
 * because the seed CLI run by hand on the VPS cannot resolve it on its own
 * (`apps/api/.env.local` is dotenvx-encrypted, so the seed sees zero env vars).
 *
 * It NEVER runs a full reseed and NEVER wipes: unlike `hops db-seed`, it only
 * ever invokes the `--data-migrate` path, which applies pending migrations and
 * records them in the ledger. A second run is a no-op.
 *
 * Default behaviour (no flags):
 *   1. (optional) git pull in $HOPS_REPO_ROOT — so the latest migration files
 *      are present before applying.
 *   2. (after pull) pnpm install --frozen-lockfile
 *   3. run `pnpm db:seed:migrate` against the target DB
 *      (root alias → `pnpm --filter @repo/seed seed --data-migrate`)
 *
 * With --status (READ-ONLY): skips pull/install and just runs
 *   `pnpm db:seed:migrate:status` against the target DB, printing applied /
 *   pending per migration. No repo or DB writes.
 *
 * Architecture notes:
 *   - Runs on the VPS host (same model as db-migrate / db-seed): pnpm/tsx
 *     available on the host; Postgres reached via the published port. The seed
 *     resolves workspace deps from their `src/` dirs via tsconfig paths
 *     (SPEC-189), so no build step is required.
 *   - NODE_ENV is 'production' for --target=prod (activates the seed
 *     data-migration prod gate in packages/seed/src/data-migrations/prodGate.ts)
 *     and 'development' for --target=staging.
 *   - Non-zero exit on ANY step failure — no silent fallback.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { die, log } from '../lib/log.ts';
import { buildPostgresUrl } from '../lib/postgres.ts';
import { confirm } from '../lib/prompt.ts';
import { resolveRepoRoot } from '../lib/repo-root.ts';
import { runner } from '../lib/runner.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-seed-migrate [--target=prod|staging]
                     [--status]
                     [--pull | --no-pull]
                     [--no-install]
                     [--allow-destructive]
                     [--yes]

Apply pending SEED DATA-migrations (HOS-25) against the target database.

This is the DATA counterpart to \`hops db-migrate\` (schema). It runs the
versioned seed data-migration carril (packages/seed/src/data-migrations/NNNN-*.ts,
tracked in the \`seed_migrations\` ledger). It NEVER runs a full reseed and NEVER
wipes — it only applies pending migrations, exactly-once per environment. A
second run is a no-op.

Run \`hops db-migrate\` FIRST if the schema (incl. the \`seed_migrations\` table)
is not yet migrated on the target.

Default behaviour:
  1. (optional) git pull \\$HOPS_REPO_ROOT   (so the latest migration files exist)
  2. (after pull) pnpm install --frozen-lockfile
  3. pnpm db:seed:migrate                    (→ pnpm --filter @repo/seed seed --data-migrate)

With --status (READ-ONLY):
  Skips pull/install and runs \`pnpm db:seed:migrate:status\` — prints applied /
  pending per migration for the target. No repo or DB writes.

Flags:
  --status            Read-only: show applied/pending migrations, apply nothing.
  --pull              Always git pull \\$HOPS_REPO_ROOT first (write path only).
                      Mutually exclusive with --no-pull.
  --no-pull           Never git pull. Mutually exclusive with --pull.
  --no-install        Skip \`pnpm install --frozen-lockfile\` after the pull.
                      Only use when the pulled commits added no dependency.
                      Has no effect when no pull happens.
  --allow-destructive Permit migrations flagged \`destructive: true\` to run
                      against prod. Forwarded to the seed prod gate as
                      HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true. Required whenever
                      a pending migration soft-deletes/removes rows; harmless
                      otherwise. No effect with --status.
  --yes               Skip the prod confirmation prompt (write path only).
  --help, -h          Show this help.

Without --pull / --no-pull the write path asks interactively.

Unattended examples:
  hops db-seed-migrate --target=staging --status
  hops db-seed-migrate --target=staging --no-pull --yes
  hops db-seed-migrate --target=prod --pull --yes
  hops db-seed-migrate --target=prod --pull --allow-destructive --yes

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID    Coolify Postgres service UUID.
  HOPS_REPO_ROOT (optional)      Path to the hospeda checkout. Default ~/hospeda.
`.trim();

export interface ParsedSeedMigrateArgs {
    /** Read-only status mode — apply nothing. */
    readonly status: boolean;
    readonly install: boolean;
    readonly pull: 'on' | 'off' | 'ask';
    readonly skipConfirm: boolean;
    /**
     * Opt-in to run migrations flagged `destructive: true` against prod. The
     * seed CLI's own prod gate (`packages/seed/src/data-migrations/prodGate.ts`)
     * refuses destructive migrations under `NODE_ENV=production` unless it sees
     * either its own `--allow-destructive` argv flag OR the
     * `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` env var. Because `hops` invokes
     * the seed via the `pnpm db:seed:migrate` alias (which does not forward
     * trailing argv reliably through the nested `--filter` run), this flag is
     * propagated as the env var instead — see {@link runSeedDataMigrate}.
     */
    readonly allowDestructive: boolean;
}

export function parseSeedMigrateArgs(argv: ReadonlyArray<string>): ParsedSeedMigrateArgs {
    const args = [...argv];

    const wantsPull = args.includes('--pull');
    const skipsPull = args.includes('--no-pull');
    if (wantsPull && skipsPull) {
        die('--pull and --no-pull are mutually exclusive.');
    }

    return {
        status: args.includes('--status'),
        install: !args.includes('--no-install'),
        pull: wantsPull ? 'on' : skipsPull ? 'off' : 'ask',
        skipConfirm: args.includes('--yes'),
        allowDestructive: args.includes('--allow-destructive')
    };
}

async function gitPullRepo(repoRoot: string): Promise<void> {
    log.info(`git pull in ${repoRoot}`);
    const result = await runner.run(['git', '-C', repoRoot, 'pull'], { inherit: true });
    if (result.exitCode !== 0) {
        die(`git pull failed (exit ${result.exitCode}). Resolve manually before retrying.`);
    }
    log.ok('Repo updated.');
}

async function installDeps(repoRoot: string): Promise<void> {
    log.info(`pnpm install --frozen-lockfile in ${repoRoot}`);
    const result = await runner.run(['pnpm', 'install', '--frozen-lockfile'], {
        cwd: repoRoot,
        inherit: true
    });
    if (result.exitCode !== 0) {
        die(
            `pnpm install failed (exit ${result.exitCode}). Resolve dependency state before retrying, or pass --no-install to skip.`
        );
    }
    log.ok('Dependencies installed.');
}

/**
 * Run the seed data-migration runner (or its read-only status view) against the
 * target DB. `script` is a root package.json alias: `db:seed:migrate` applies
 * pending migrations; `db:seed:migrate:status` only reports.
 */
async function runSeedDataMigrate(params: {
    readonly repoRoot: string;
    readonly databaseUrl: string;
    readonly script: 'db:seed:migrate' | 'db:seed:migrate:status';
    readonly nodeEnv: 'production' | 'development';
    /**
     * When true, inject `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` so the seed
     * prod gate permits migrations flagged `destructive: true`. The child seed
     * process reads it from `process.env`; dotenvx only injects keys present in
     * `.env.local`, so this key (absent there) is never overridden.
     */
    readonly allowDestructive?: boolean;
}): Promise<void> {
    log.info(`Running: pnpm ${params.script}`);
    log.hint(`cwd: ${params.repoRoot}  NODE_ENV: ${params.nodeEnv}`);
    const result = await runner.run(['pnpm', params.script], {
        cwd: params.repoRoot,
        inherit: true,
        env: {
            HOSPEDA_DATABASE_URL: params.databaseUrl,
            NODE_ENV: params.nodeEnv,
            ...(params.allowDestructive ? { HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION: 'true' } : {})
        }
    });
    if (result.exitCode !== 0) {
        die(`Seed data-migration failed (exit ${result.exitCode}). Inspect the output above.`);
    }
}

export async function dbSeedMigrate(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseSeedMigrateArgs(argv);
    const target = getActiveTarget();

    const repoRoot = resolveRepoRoot();
    if (!existsSync(repoRoot)) {
        die(
            `Repo root '${repoRoot}' not found. Set HOPS_REPO_ROOT in .env.local or clone the repo at ~/hospeda.`
        );
    }
    if (!existsSync(join(repoRoot, '.git'))) {
        die(`'${repoRoot}' is not a git repository.`);
    }

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(target);
    const databaseUrl = await buildPostgresUrl({
        container,
        user: credentials.user,
        db: credentials.database
    });

    const nodeEnv: 'production' | 'development' = target === 'prod' ? 'production' : 'development';

    log.info(`Target  : ${target}`);
    log.info(`Repo    : ${repoRoot}`);
    log.info(`DB      : ${credentials.user}@${container} → ${credentials.database}`);
    log.info(`Mode    : ${parsed.status ? 'status (read-only)' : 'apply pending'}`);

    // ── Status mode: read-only, no pull/install, no confirmation ─────────
    if (parsed.status) {
        await runSeedDataMigrate({
            repoRoot,
            databaseUrl,
            script: 'db:seed:migrate:status',
            nodeEnv
        });
        log.ok(`db-seed-migrate --status completed against ${target}.`);
        return;
    }

    // ── Pull step (write path only) ──────────────────────────────────────
    let shouldPull: boolean;
    if (parsed.pull === 'on') {
        shouldPull = true;
    } else if (parsed.pull === 'off') {
        shouldPull = false;
    } else {
        shouldPull = await confirm('Pull latest code from git first?', { defaultValue: true });
    }

    if (shouldPull) {
        await gitPullRepo(repoRoot);
        // A pulled commit may add a dependency; install so a stale node_modules
        // doesn't break the tsx run (mirrors db-migrate BETA-102).
        if (parsed.install) {
            await installDeps(repoRoot);
        } else {
            log.hint('Skipping pnpm install (--no-install).');
        }
    } else {
        log.hint('Skipping git pull.');
    }

    // ── Prod confirmation ────────────────────────────────────────────────
    // Applying data-migrations never reseeds and is ledger-guarded, but it IS
    // a write against prod (and, with --allow-destructive, may soft-delete or
    // remove rows) — confirm unless --yes.
    if (target === 'prod' && parsed.allowDestructive) {
        log.warn(
            'DESTRUCTIVE mode: --allow-destructive will let migrations flagged destructive run against PRODUCTION.'
        );
    }
    if (target === 'prod' && !parsed.skipConfirm) {
        const ok = await confirm('Apply pending seed data-migrations against PRODUCTION?', {
            defaultValue: false
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // ── Apply pending seed data-migrations ───────────────────────────────
    await runSeedDataMigrate({
        repoRoot,
        databaseUrl,
        script: 'db:seed:migrate',
        nodeEnv,
        allowDestructive: parsed.allowDestructive
    });

    log.ok(`db-seed-migrate completed against ${target}.`);
}
