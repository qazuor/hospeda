/**
 * `hops db-migrate` — apply versioned Drizzle migrations + extras against
 * the target environment's Postgres database.
 *
 * This is the ONLY correct way to migrate staging/prod schema. `drizzle-kit
 * push` is dev-only and MUST NEVER run on VPS targets.
 *
 * Default behaviour (no flags):
 *   1. (optional) git pull in $HOPS_REPO_ROOT
 *   2. build @repo/db dependencies (turbo-cached)
 *   3. take a pre-migrate pg_dump backup (uploaded to R2)
 *   4. run `pnpm --filter @repo/db db:migrate`  (drizzle-kit migrate)
 *   5. run `pnpm db:apply-extras`               (triggers / extras)
 *
 * With --reset (DESTRUCTIVE):
 *   After the backup (step 3) and before migrate (step 4): apply
 *   packages/db/scripts/reset/000-reset-schema.sql and 001-extensions.sql
 *   against the Postgres container. On prod, --reset requires an explicit
 *   typed confirmation. Order: backup -> reset -> migrate -> apply-extras.
 *
 * Architecture notes:
 *   - Runs on the VPS host (same model as db-seed): pnpm/turbo available on
 *     the host; Postgres reached via the published port.
 *   - Migration and extras are the same sequence as migrate-production.sh but
 *     now fully managed through hops.
 *   - Non-zero exit on ANY step failure — no silent fallback.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { get } from '../lib/env.ts';
import { ENCRYPTED_SUFFIX, gpgSymmetricEncrypt } from '../lib/gpg.ts';
import { die, log } from '../lib/log.ts';
import { buildDbDependencies, runMigrateSequence } from '../lib/migrate-core.ts';
import { buildPostgresUrl, pgDumpToBuffer } from '../lib/postgres.ts';
import { confirm } from '../lib/prompt.ts';
import { createR2Client, humanSize, utcBackupTimestamp } from '../lib/r2.ts';
import { runner } from '../lib/runner.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-migrate [--target=prod|staging]
                [--pull | --no-pull]
                [--no-build]
                [--no-backup]
                [--no-apply-extras]
                [--reset]
                [--yes]

Apply versioned Drizzle migrations against the target database.

IMPORTANT: This command uses \`drizzle-kit migrate\` (the versioned carril),
NOT \`drizzle-kit push\`. Never use push on staging or production.

Default behaviour:
  1. (optional) git pull \\$HOPS_REPO_ROOT
  2. pnpm turbo run build --filter=@repo/db        (turbo-cached)
  3. pg_dump backup → R2 manual/ prefix
  4. pnpm --filter @repo/db db:migrate             (drizzle-kit migrate)
  5. pnpm db:apply-extras                          (triggers / extras)

With --reset (applied AFTER the backup, before migrate):
  - Run packages/db/scripts/reset/000-reset-schema.sql
  - Run packages/db/scripts/reset/001-extensions.sql
  These wipe the public schema and re-install extensions. The backup is
  always taken first so it captures the data being dropped. On prod,
  --reset requires an explicit typed confirmation even when --yes is set.

Flags:
  --reset             Wipe and rebuild the schema before migrating.
                      DESTRUCTIVE. Requires typed confirmation on prod.
  --pull              Always git pull \\$HOPS_REPO_ROOT first.
                      Mutually exclusive with --no-pull.
  --no-pull           Never git pull. Mutually exclusive with --pull.
  --no-build          Skip the turbo build step. Only use when @repo/db
                      dist/ outputs are already up to date.
  --no-backup         Skip the pre-migrate pg_dump. Only use when you are
                      confident about the state (e.g. just restored a
                      backup). The default ON behaviour is safe-by-default.
  --no-apply-extras   Skip applying triggers / matviews / JSONB CHECK
                      constraints after migration. The default is ON and
                      idempotent.
  --yes               Skip the prod confirmation prompts (except --reset
                      on prod, which ALWAYS requires explicit typed input).
  --help, -h          Show this help.

Without --pull / --no-pull the command asks interactively.

Unattended examples:
  hops db-migrate --target=staging --no-pull --yes
  hops db-migrate --target=prod --pull --yes
  hops db-migrate --target=staging --reset --no-pull --yes
  hops db-migrate --target=prod --no-backup --no-pull --yes

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID    Coolify Postgres service UUID.
  HOPS_REPO_ROOT (optional)      Path to the hospeda checkout. Default ~/hospeda.

For --backup (default ON), also requires:
  R2_* / R2_STAGING_*            R2 credentials for the target environment.
`.trim();

/** Minimum acceptable dump size for the pre-migrate backup. */
const MIN_BACKUP_SIZE = 100 * 1024;

export interface ParsedMigrateArgs {
    readonly reset: boolean;
    readonly build: boolean;
    readonly backup: boolean;
    readonly applyExtras: boolean;
    readonly pull: 'on' | 'off' | 'ask';
    readonly skipConfirm: boolean;
}

export function parseMigrateArgs(argv: ReadonlyArray<string>): ParsedMigrateArgs {
    const args = [...argv];

    const wantsPull = args.includes('--pull');
    const skipsPull = args.includes('--no-pull');
    if (wantsPull && skipsPull) {
        die('--pull and --no-pull are mutually exclusive.');
    }

    return {
        reset: args.includes('--reset'),
        build: !args.includes('--no-build'),
        backup: !args.includes('--no-backup'),
        applyExtras: !args.includes('--no-apply-extras'),
        pull: wantsPull ? 'on' : skipsPull ? 'off' : 'ask',
        skipConfirm: args.includes('--yes')
    };
}

export function resolveRepoRoot(): string {
    const explicit = get('HOPS_REPO_ROOT');
    if (explicit) return explicit;
    return join(homedir(), 'hospeda');
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
 * Take a pre-migrate pg_dump backup and upload to R2 under manual/ prefix.
 * Re-uses the same pattern as db-backup-now.
 */
async function takePreMigrateBackup(params: {
    readonly container: string;
    readonly user: string;
    readonly db: string;
    readonly target: ReturnType<typeof getActiveTarget>;
}): Promise<void> {
    log.info('Taking pre-migrate pg_dump backup...');

    const r2 = createR2Client(params.target);
    const timestamp = utcBackupTimestamp();

    const passphrase = get('BACKUP_PASSPHRASE');
    const encrypt = passphrase !== undefined && passphrase.length > 0;
    const key = encrypt
        ? `manual/pre-migrate-${timestamp}.dump${ENCRYPTED_SUFFIX}`
        : `manual/pre-migrate-${timestamp}.dump`;

    log.info(`Backup target: s3://${r2.bucket}/${key}`);

    const result = await pgDumpToBuffer({
        container: params.container,
        user: params.user,
        db: params.db
    });

    if (result.exitCode !== 0) {
        die(
            `pg_dump failed (exit ${result.exitCode}): ${result.stderr.trim() || '<empty stderr>'}. Migration aborted. Use --no-backup to skip the backup (unsafe).`
        );
    }

    const rawSize = result.stdout.length;
    if (rawSize < MIN_BACKUP_SIZE) {
        die(
            `pg_dump produced a suspiciously small file (${rawSize} bytes < ${MIN_BACKUP_SIZE}). Aborting to avoid uploading a corrupt backup. Use --no-backup to skip (unsafe).`
        );
    }

    log.ok(`pg_dump produced ${humanSize(rawSize)}.`);

    let uploadBuffer: Buffer = result.stdout;
    if (encrypt && passphrase) {
        log.info('Encrypting backup with GPG symmetric AES256...');
        uploadBuffer = await gpgSymmetricEncrypt(result.stdout, passphrase);
        log.ok(`Encrypted: ${humanSize(uploadBuffer.length)}.`);
    }

    await r2.putBuffer(key, uploadBuffer);
    log.ok(`Pre-migrate backup uploaded: s3://${r2.bucket}/${key}`);
    log.hint('If migration fails, restore with `hops db-restore`.');
}

export async function dbMigrate(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseMigrateArgs(argv);
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

    log.info(`Target  : ${target}`);
    log.info(`Repo    : ${repoRoot}`);
    log.info(`DB      : ${credentials.user}@${container} → ${credentials.database}`);
    log.info(
        `Flags   : ${[
            parsed.reset ? '+reset' : '',
            parsed.build ? '+build' : '-build',
            parsed.backup ? '+backup' : '-backup',
            parsed.applyExtras ? '+apply-extras' : '-apply-extras'
        ]
            .filter(Boolean)
            .join(' ')}`
    );

    // ── Pull step ────────────────────────────────────────────────────
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
    } else {
        log.hint('Skipping git pull.');
    }

    // ── Build workspace deps ─────────────────────────────────────────
    if (parsed.build) {
        await buildDbDependencies(repoRoot);
    } else {
        log.hint('Skipping build (--no-build).');
    }

    // ── Prod confirmation ────────────────────────────────────────────
    // --reset on prod ALWAYS requires explicit typed input even when
    // --yes is set — this is the nuclear option and must never be
    // accidental. A plain migrate on prod prompts unless --yes is passed.
    if (target === 'prod') {
        if (parsed.reset) {
            log.warn('THIS WILL WIPE THE PRODUCTION DATABASE SCHEMA.');
            log.warn('--reset drops every table, view, function, type and sequence.');
            log.warn('A backup is taken FIRST (before the reset), capturing the current data.');
            const ok = await confirm('Type yes to PROCEED with --reset against PRODUCTION', {
                defaultValue: false
            });
            if (!ok) {
                log.warn('Aborted.');
                return;
            }
        } else if (!parsed.skipConfirm) {
            const ok = await confirm('Run db-migrate against PRODUCTION?', {
                defaultValue: false
            });
            if (!ok) {
                log.warn('Aborted.');
                return;
            }
        }
    }

    // ── Migration sequence ───────────────────────────────────────────
    // Order: [backup] -> [reset] -> migrate -> [apply-extras]
    const backupFn = parsed.backup
        ? async (): Promise<void> => {
              await takePreMigrateBackup({
                  container,
                  user: credentials.user,
                  db: credentials.database,
                  target
              });
          }
        : undefined;

    await runMigrateSequence({
        repoRoot,
        databaseUrl,
        target,
        reset: parsed.reset,
        applyExtras: parsed.applyExtras,
        backup: backupFn
    });

    log.ok(`db-migrate completed against ${target}.`);
    log.hint('Verify schema with `hops db-counts` or `hops psql`.');
}
