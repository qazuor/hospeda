/**
 * `hops db-seed-test-users` — additively seed the SPEC-143 test-user matrix
 * (13 dev-only accounts covering role × plan combinations, e.g.
 * `host-pro@local.test` / `Password123!`, HOST role with an active
 * `owner-pro` subscription) against the target Postgres database.
 *
 * Equivalent to typing by hand on the VPS:
 *   cd ~/hospeda && git pull
 *   pnpm --filter @repo/seed seed --test-users
 *
 * Why this exists as its own command instead of a `db-seed` flag: the
 * `--test-users` group is deliberately excluded from `--required`/`--example`
 * (see packages/seed/CLAUDE.md) so it never runs as a side effect of the
 * destructive `hops db-seed` default (`--reset --required --example`).
 * Giving it a dedicated command makes that separation visible at the CLI
 * level too — there is no `--reset` flag here at all, this command can only
 * ADD rows, never wipe them.
 *
 * Prerequisite: the target DB must already have required system data (roles,
 * etc.) seeded — run `hops db-seed --target=staging --no-reset --no-example`
 * first if seeding a brand-new/empty staging DB.
 *
 * Safety:
 *   - Rejected outright on `--target=prod`. These are dev-only accounts with
 *     a well-known password (`Password123!`) — there is no legitimate case
 *     for creating them in a production database. Mirrors the same guard on
 *     `billing-test-reset` (see that file for the precedent).
 *   - The Postgres URL is DERIVED at runtime the same way `hops db-seed`
 *     does — via {@link getDbCredentials} + `docker port`, no new secret.
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
hops db-seed-test-users [--target=staging]
                         [--pull | --no-pull]
                         [--build]
                         [--yes]

Additively seed the 13 SPEC-143 test-user accounts (role × plan matrix,
password Password123!, ready to log in immediately — no onboarding
friction). ADD-ONLY: never resets or wipes the target database.

  1. (optional) git pull $HOPS_REPO_ROOT
  2. pnpm --filter @repo/seed seed --test-users

Rejected outright on --target=prod (see the file's module doc for why).

Flags:
  --build             Force a turbo build of @repo/seed's workspace deps
                      first. Off by default — the seed resolves deps from
                      src/ via tsconfig paths, no build needed.
  --pull              Always git pull $HOPS_REPO_ROOT before seeding.
                      Mutually exclusive with --no-pull.
  --no-pull           Never git pull. Mutually exclusive with --pull.
  --yes               Skip the pull prompt (defaults to "yes, pull").
  --help, -h          Show this help.

Without --pull / --no-pull the command asks interactively:
  "Pull latest seed data from git first? (Y/n)"

Unattended example:
  hops db-seed-test-users --target=staging --no-pull --yes

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_STAGING_POSTGRES_UUID     Coolify Postgres service UUID for staging.
  HOPS_REPO_ROOT (optional)      Path to the hospeda checkout. Default ~/hospeda.

Prerequisite: the target DB must already have required system data (roles,
etc.). For a brand-new/empty staging DB, run this first:
  hops db-seed --target=staging --no-reset --no-example

Full account matrix: packages/seed/CLAUDE.md#test-users-for-billing-spec-143-block-1
`.trim();

export interface ParsedArgs {
    readonly build: boolean;
    readonly pull: 'on' | 'off' | 'ask';
    readonly skipConfirm: boolean;
}

export function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
    const args = [...argv];

    const wantsPull = args.includes('--pull');
    const skipsPull = args.includes('--no-pull');
    if (wantsPull && skipsPull) {
        die('--pull and --no-pull are mutually exclusive.');
    }

    return {
        build: args.includes('--build'),
        pull: wantsPull ? 'on' : skipsPull ? 'off' : 'ask',
        skipConfirm: args.includes('--yes')
    };
}

export function buildSeedArgs(): ReadonlyArray<string> {
    return ['--filter', '@repo/seed', 'seed', '--test-users'];
}

async function gitPullRepo(repoRoot: string): Promise<void> {
    log.info(`git pull in ${repoRoot}`);
    const result = await runner.run(['git', '-C', repoRoot, 'pull'], { inherit: true });
    if (result.exitCode !== 0) {
        die(`git pull failed (exit ${result.exitCode}). Resolve manually before retrying.`);
    }
    log.ok('Repo updated.');
}

async function buildSeedDependencies(repoRoot: string): Promise<void> {
    log.info('Building workspace dependencies of @repo/seed (turbo, cached)...');
    const result = await runner.run(['pnpm', 'turbo', 'run', 'build', '--filter=@repo/seed^...'], {
        cwd: repoRoot,
        inherit: true
    });
    if (result.exitCode !== 0) {
        die(
            `Build failed (exit ${result.exitCode}). The seed cannot run without dist/ files for its workspace deps. Inspect the output above; if the issue is transient, pass --no-build to skip.`
        );
    }
    log.ok('Dependencies built.');
}

async function runSeed(params: {
    readonly repoRoot: string;
    readonly databaseUrl: string;
    readonly seedArgs: ReadonlyArray<string>;
}): Promise<void> {
    log.info(`Running: pnpm ${params.seedArgs.join(' ')}`);
    log.hint(`cwd: ${params.repoRoot}  NODE_ENV: development`);
    const result = await runner.run(['pnpm', ...params.seedArgs], {
        cwd: params.repoRoot,
        inherit: true,
        env: {
            HOSPEDA_DATABASE_URL: params.databaseUrl,
            // Test-user billing rows use livemode: false (staging-only target,
            // enforced below) so the MP sandbox accepts them.
            NODE_ENV: 'development'
        }
    });
    if (result.exitCode !== 0) {
        die(`Seed failed (exit ${result.exitCode}). Inspect the output above.`);
    }
}

export async function dbSeedTestUsers(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseArgs(argv);
    const target = getActiveTarget();

    if (target === 'prod') {
        die(
            'db-seed-test-users is disabled for --target=prod. These are dev-only accounts with a well-known password (Password123!) — there is no legitimate case for creating them in a production database.'
        );
        return;
    }

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
    const seedArgs = buildSeedArgs();

    log.info(`Target  : ${target}`);
    log.info(`Repo    : ${repoRoot}`);
    log.info(`DB      : ${credentials.user}@${container} → ${credentials.database}`);

    // ── Pull step ────────────────────────────────────────────────────
    let shouldPull: boolean;
    if (parsed.pull === 'on') {
        shouldPull = true;
    } else if (parsed.pull === 'off') {
        shouldPull = false;
    } else if (parsed.skipConfirm) {
        shouldPull = true;
    } else {
        shouldPull = await confirm('Pull latest seed data from git first?', {
            defaultValue: true
        });
    }

    if (shouldPull) {
        await gitPullRepo(repoRoot);
    } else {
        log.hint('Skipping git pull.');
    }

    if (parsed.build) {
        await buildSeedDependencies(repoRoot);
    } else {
        log.hint('Skipping build (default). Seed resolves deps from src/ via tsconfig paths.');
    }

    await runSeed({ repoRoot, databaseUrl, seedArgs });

    log.ok(`db-seed-test-users completed against ${target}.`);
    log.hint(
        'Login with any account from packages/seed/CLAUDE.md#test-users-for-billing-spec-143-block-1 — e.g. host-pro@local.test / Password123!. Verify row counts with `hops db-counts`.'
    );
}
