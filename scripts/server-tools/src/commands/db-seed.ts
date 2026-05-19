/**
 * `hops db-seed` — run `pnpm --filter @repo/seed seed ...` against the
 * target environment's Postgres database, optionally pulling the latest
 * seed data from git first.
 *
 * Equivalent to typing by hand on the VPS:
 *   cd ~/hospeda && git pull
 *   pnpm --filter @repo/seed seed --reset --required --example
 *
 * Architecture notes (V1):
 *   - hops runs ON the VPS, so the "pull" step is a LOCAL git pull in
 *     the repo at `$HOPS_REPO_ROOT` (default `~/hospeda`). No SSH.
 *   - The seed runs from the VPS host, NOT inside a container. This
 *     keeps the data path simple: `git pull` updates JSON fixtures
 *     under `packages/seed/src/data/` and the next `pnpm seed`
 *     invocation reads them directly. Running inside the API container
 *     would require either a bind mount of the repo or a redeploy on
 *     every seed-data change — neither is set up in the current Coolify
 *     deploy.
 *   - The Postgres URL is DERIVED at runtime by inspecting the target's
 *     Postgres container: user/db come from {@link getDbCredentials}
 *     (the same source `hops psql` uses), POSTGRES_PASSWORD is read
 *     from the container's env, and host:port comes from `docker port`.
 *     No new secret lives in `.env.local`. The container's 5432 MUST be
 *     published to the host — the seed connects via the published port,
 *     not via the docker network.
 *
 * Safety:
 *   - `--target=prod` (the default) prompts with a destructive
 *     confirmation before running. `--yes` skips it. The combination
 *     `--reset --example` wipes the database and loads Faker-generated
 *     demo content including the well-known `admin@hospeda.com`
 *     credentials — never silently. See `packages/seed/CLAUDE.md`.
 *   - `--target=staging` does not require an extra confirmation (it is
 *     designed to be reseeded freely). The `--pull` prompt still runs
 *     unless `--pull` / `--no-pull` is passed.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { get } from '../lib/env.ts';
import { die, log } from '../lib/log.ts';
import { buildPostgresUrl } from '../lib/postgres.ts';
import { confirm } from '../lib/prompt.ts';
import { runner } from '../lib/runner.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-seed [--target=prod|staging]
             [--pull | --no-pull]
             [--no-reset] [--no-required] [--no-example]
             [--clean-images]
             [--no-build]
             [--yes]

Run \`pnpm --filter @repo/seed seed\` against the target environment.

Default behaviour:
  --reset, --required, --example, --build are ON. --clean-images is
  OFF. The default invocation:
    1. (optional) git pull \$HOPS_REPO_ROOT
    2. pnpm turbo run build --filter=@repo/seed^...   (turbo-cached)
    3. pnpm --filter @repo/seed seed --reset --required --example

  Step 2 is required because the seed's workspace deps (@repo/db,
  @repo/billing, etc.) export from \`./dist/index.js\`. Without it,
  the seed crashes with ERR_MODULE_NOT_FOUND on the first import.
  Turbo caches outputs, so subsequent runs are ~1-2s.

  NODE_ENV is set to 'production' for --target=prod (billing seeds
  use livemode: true) and 'development' for --target=staging.

  Cloudinary assets under hospeda/<env>/seed/ are preserved by
  default. Pass \`--clean-images\` to opt into remote deletion.

Flags:
  --no-reset          Skip the database reset step (population only).
                      May fail on UNIQUE violations if rows already exist.
  --no-required       Skip the --required step (rare; tests / partial seeds).
  --no-example        Skip the --example step (required-only seed).
  --clean-images      Opt INTO Cloudinary cleanup. Forwards the
                      HOSPEDA_CLOUDINARY_* creds to the seed so it
                      deletes every asset under hospeda/<env>/seed/
                      before reseeding. Slow but produces a fully
                      consistent state (no orphan assets pointing at
                      rows that no longer exist).
  --no-build          Skip the turbo build step. Only use when the
                      workspace deps' dist/ outputs are already up to
                      date (e.g. CI just built them). Without it, the
                      seed will likely crash with ERR_MODULE_NOT_FOUND.
  --pull              Always git pull \$HOPS_REPO_ROOT before seeding.
                      Mutually exclusive with --no-pull.
  --no-pull           Never git pull. Mutually exclusive with --pull.
  --yes               Skip the destructive-action confirm. Does NOT skip
                      the pull prompt — combine with --pull / --no-pull
                      for full unattended operation.
  --help, -h          Show this help.

Without --pull / --no-pull the command asks interactively:
  "Pull latest seed data from git first? (Y/n)"

Unattended examples:
  hops db-seed --target=staging --no-pull --yes
  hops db-seed --target=prod --pull --yes
  hops db-seed --target=staging --no-pull --yes --no-example   # required only

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID         Coolify Postgres service UUID for the target.
  HOPS_REPO_ROOT (optional)           Path to the hospeda checkout. Default ~/hospeda.

When passing --clean-images, also set these three:
  HOSPEDA_CLOUDINARY_CLOUD_NAME       Cloudinary cloud name.
  HOSPEDA_CLOUDINARY_API_KEY          Cloudinary API key.
  HOSPEDA_CLOUDINARY_API_SECRET       Cloudinary API secret.

Without --clean-images these three are NOT read.

The Postgres URL is derived automatically by inspecting the target's
Postgres container (password from its env, host:port from \`docker port\`).
The container's port 5432 MUST be published to the host — the seed runs
on the host, not inside the docker network.

Notes:
  This command WIPES the target database by default (--reset is on).
  It is the same workflow as the dev-only \`pnpm db:seed\` script — the
  --example pass loads Faker-generated content with the well-known
  admin@hospeda.com credentials. Read packages/seed/CLAUDE.md before
  using against any environment that holds real data.
`.trim();

export interface ParsedArgs {
    readonly reset: boolean;
    readonly required: boolean;
    readonly example: boolean;
    readonly cleanImages: boolean;
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
        reset: !args.includes('--no-reset'),
        required: !args.includes('--no-required'),
        example: !args.includes('--no-example'),
        cleanImages: args.includes('--clean-images'),
        build: !args.includes('--no-build'),
        pull: wantsPull ? 'on' : skipsPull ? 'off' : 'ask',
        skipConfirm: args.includes('--yes')
    };
}

export function resolveRepoRoot(): string {
    const explicit = get('HOPS_REPO_ROOT');
    if (explicit) return explicit;
    return join(homedir(), 'hospeda');
}

export function buildSeedArgs(parsed: ParsedArgs): ReadonlyArray<string> {
    const flags: string[] = [];
    if (parsed.reset) flags.push('--reset');
    if (parsed.required) flags.push('--required');
    if (parsed.example) flags.push('--example');
    return ['--filter', '@repo/seed', 'seed', ...flags];
}

export function formatFlagSummary(parsed: ParsedArgs): string {
    const on: string[] = [];
    const off: string[] = [];
    (parsed.reset ? on : off).push('reset');
    (parsed.required ? on : off).push('required');
    (parsed.example ? on : off).push('example');
    (parsed.cleanImages ? on : off).push('clean-images');
    (parsed.build ? on : off).push('build');
    const onPart = on.length > 0 ? `+${on.join(' +')}` : '';
    const offPart = off.length > 0 ? `-${off.join(' -')}` : '';
    return [onPart, offPart].filter((s) => s.length > 0).join(' ');
}

/**
 * Collect the env vars the seed needs to do Cloudinary cleanup. Returns
 * an empty object when `cleanImages` is false, so the seed will skip
 * Cloudinary deletion (it logs an informational message and continues).
 *
 * We forward the vars from the toolkit's `.env.local` rather than the
 * project's `apps/api/.env.local` so the seed runs even when the
 * project env file is not present on the host — operators only need
 * to maintain the values in one place (the toolkit's local config).
 *
 * Logs a warning when `cleanImages` is opt-in (true) but the vars are
 * missing — the operator clearly asked for cleanup but the values
 * aren't set up; without this warning the seed would silently skip
 * the deletion and leave orphan assets, which is exactly what
 * `--clean-images` is supposed to prevent.
 */
export function collectCloudinaryEnv(cleanImages: boolean): Readonly<Record<string, string>> {
    if (!cleanImages) return {};
    const cloudName = get('HOSPEDA_CLOUDINARY_CLOUD_NAME');
    const apiKey = get('HOSPEDA_CLOUDINARY_API_KEY');
    const apiSecret = get('HOSPEDA_CLOUDINARY_API_SECRET');
    const env: Record<string, string> = {};
    if (cloudName) env.HOSPEDA_CLOUDINARY_CLOUD_NAME = cloudName;
    if (apiKey) env.HOSPEDA_CLOUDINARY_API_KEY = apiKey;
    if (apiSecret) env.HOSPEDA_CLOUDINARY_API_SECRET = apiSecret;
    if (!cloudName || !apiKey || !apiSecret) {
        log.warn(
            '--clean-images requested but HOSPEDA_CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are not all set in scripts/server-tools/.env.local. The seed will skip remote asset deletion (the local cache is still cleaned).'
        );
    }
    return env;
}

async function gitPullRepo(repoRoot: string): Promise<void> {
    log.info(`git pull in ${repoRoot}`);
    const result = await runner.run(['git', '-C', repoRoot, 'pull'], { inherit: true });
    if (result.exitCode !== 0) {
        die(`git pull failed (exit ${result.exitCode}). Resolve manually before retrying.`);
    }
    log.ok('Repo updated.');
}

/**
 * Build the workspace dependencies of `@repo/seed` via turbo so the
 * tsx-driven seed can resolve them at runtime.
 *
 * Why this is needed: every `@repo/*` workspace dep of the seed
 * (billing, config, db, logger, media, schemas, service-core, utils)
 * declares its `exports."."` as `./dist/index.js`. The seed itself
 * runs from `./src/index.ts` via `tsx`, but Node still resolves the
 * deps through their declared exports — pointing at `dist/`. Without
 * a build those files don't exist and the seed crashes with
 * `ERR_MODULE_NOT_FOUND`.
 *
 * Turbo handles the dependency order (`^build`) and caches outputs,
 * so subsequent runs are ~1-2s (just hash checks). The first run on
 * a fresh VPS host takes ~30-60s.
 *
 * Filter syntax: `@repo/seed^...` builds every dependency of `@repo/seed`
 * but NOT `@repo/seed` itself (the seed has no build script — its
 * package.json points directly at `./src/index.ts`).
 */
async function buildSeedDependencies(repoRoot: string): Promise<void> {
    log.info('Building workspace dependencies of @repo/seed (turbo, cached)...');
    const result = await runner.run(
        ['pnpm', 'turbo', 'run', 'build', '--filter=@repo/seed^...'],
        {
            cwd: repoRoot,
            inherit: true
        }
    );
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
    readonly cloudinaryEnv: Readonly<Record<string, string>>;
    readonly nodeEnv: 'production' | 'development';
}): Promise<void> {
    log.info(`Running: pnpm ${params.seedArgs.join(' ')}`);
    log.hint(`cwd: ${params.repoRoot}  NODE_ENV: ${params.nodeEnv}`);
    const result = await runner.run(['pnpm', ...params.seedArgs], {
        cwd: params.repoRoot,
        inherit: true,
        env: {
            HOSPEDA_DATABASE_URL: params.databaseUrl,
            NODE_ENV: params.nodeEnv,
            ...params.cloudinaryEnv
        }
    });
    if (result.exitCode !== 0) {
        die(`Seed failed (exit ${result.exitCode}). Inspect the output above.`);
    }
}

export async function dbSeed(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseArgs(argv);
    const target = getActiveTarget();

    if (!parsed.reset && !parsed.required && !parsed.example) {
        die('Nothing to do: --no-reset --no-required --no-example were all passed.');
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
    const seedArgs = buildSeedArgs(parsed);

    log.info(`Target  : ${target}`);
    log.info(`Repo    : ${repoRoot}`);
    log.info(`DB      : ${credentials.user}@${container} → ${credentials.database}`);
    log.info(`Flags   : ${formatFlagSummary(parsed)}`);

    // ── Pull step ────────────────────────────────────────────────────
    // Resolution: explicit --pull / --no-pull wins; otherwise ask.
    let shouldPull: boolean;
    if (parsed.pull === 'on') {
        shouldPull = true;
    } else if (parsed.pull === 'off') {
        shouldPull = false;
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

    // ── Build workspace deps ─────────────────────────────────────────
    // The seed runs from `./src/index.ts` via tsx, but its workspace
    // deps (`@repo/billing`, `@repo/db`, …) declare their exports as
    // `./dist/index.js` — they must be built first. Turbo caches the
    // output, so subsequent runs are essentially free.
    if (parsed.build) {
        await buildSeedDependencies(repoRoot);
    } else {
        log.hint('Skipping build (--no-build).');
    }

    // ── Destructive confirmation (prod only by default) ──────────────
    // --reset is the destructive flag — drops every row before the run.
    // Confirm in prod unless --yes was passed. Staging is designed to be
    // reseeded freely, so no extra prompt there.
    if (target === 'prod' && parsed.reset && !parsed.skipConfirm) {
        log.warn('THIS WILL WIPE THE PRODUCTION DATABASE.');
        log.warn('--reset drops every row before reseeding.');
        if (parsed.example) {
            log.warn(
                '--example loads Faker-generated demo data including the well-known admin@hospeda.com credentials.'
            );
        }
        if (parsed.cleanImages) {
            log.warn(
                '--clean-images deletes Cloudinary assets under hospeda/<env>/seed/ before reseeding.'
            );
        }
        const ok = await confirm(`Type yes to PROCEED with db-seed against PRODUCTION`, {
            defaultValue: false
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    } else if (target === 'prod' && !parsed.reset && !parsed.skipConfirm) {
        // Non-reset prod run is non-destructive but still worth a heads-up.
        const ok = await confirm(`Run db-seed (no --reset) against PRODUCTION?`, {
            defaultValue: false
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // ── Seed ─────────────────────────────────────────────────────────
    // NODE_ENV controls billing seeds' `livemode`. For prod target we
    // want livemode: true (real MercadoPago plans); for staging we
    // want livemode: false (test mode plans the sandbox accepts).
    const cloudinaryEnv = collectCloudinaryEnv(parsed.cleanImages);
    const nodeEnv: 'production' | 'development' =
        target === 'prod' ? 'production' : 'development';
    await runSeed({ repoRoot, databaseUrl, seedArgs, cloudinaryEnv, nodeEnv });

    log.ok(`db-seed completed against ${target}.`);
    log.hint('Verify with `hops db-counts`.');
}
