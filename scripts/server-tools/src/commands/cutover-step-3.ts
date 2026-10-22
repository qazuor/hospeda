/**
 * `hops cutover-step-3` — run the V6 cutover step 3 script (writes the five
 * cutover trials) against the target environment's database, from the VPS host.
 *
 * Why this command exists: the api image ships `apps/api/scripts/cutover-v6-step-3.ts`
 * but has neither `tsx` nor `pnpm` (exit 127), and the `~/hospeda` checkout has
 * pnpm but not the database URL or the `HOSPEDA_*` surface `validateApiEnv()`
 * requires. Running the script by hand therefore has no working path on the
 * VPS. This command supplies both halves:
 *
 *   1. the api container's own environment (only `HOSPEDA_*` + `NODE_ENV`), so
 *      `validateApiEnv()` passes, and
 *   2. a host-reachable Postgres URL built exactly the way `hops db-migrate`
 *      / `hops db-seed-migrate` build theirs, replacing the container's
 *      internal `HOSPEDA_DATABASE_URL`.
 *
 * The environment is held in memory only. It is never printed and never
 * written to disk; the log reports how many variables were passed, not which.
 *
 * Safety:
 *   - `--dry-run` is the default. `--confirm-write-trials` is explicit.
 *   - On prod, a write requires typing `write-trials-prod`. `--yes` never
 *     skips that typed guard.
 *   - Before running, the checkout's `HEAD` must match the deployed commit
 *     (`HOSPEDA_COMMIT_SHA` in the api container), compared by its 10-char
 *     prefix. `--allow-sha-mismatch` overrides it (and then requires the typed
 *     guard on prod even for a dry-run).
 *   - The script's exit code is propagated unchanged (0, 1 or 2).
 *   - Nothing here runs `git pull` or `pnpm install`: the SHA guard replaces
 *     the pull, and the operator aligns the checkout by hand.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandArgvSpec } from '../lib/cli-flags.ts';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import {
    buildStep3ChildEnv,
    type CutoverStep3Mode,
    checkDeployedSha,
    isTypedConfirmationValid,
    parseCutoverStep3Args,
    readCheckoutSha,
    readContainerEnvValue,
    runCutoverStep3,
    shouldPromptForTypedConfirmation,
    WRITE_TRIALS_PROD_PHRASE
} from '../lib/cutover-step-3-core.ts';
import { dockerInspectEnv } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { buildPostgresUrl } from '../lib/postgres.ts';
import { promptText } from '../lib/prompt.ts';
import { resolveRepoRoot } from '../lib/repo-root.ts';
import { runner } from '../lib/runner.ts';
import { getDbCredentials, type Target } from '../lib/target.ts';

const HELP_FLAGS = ['--help', '-h'] as const;

/** Declared argv surface of this command, used by the central flag validator. */
export const CUTOVER_STEP_3_ARGV: CommandArgvSpec = {
    booleanFlags: [
        '--dry-run',
        '--confirm-write-trials',
        '--allow-sha-mismatch',
        '--yes',
        ...HELP_FLAGS
    ],
    valueFlags: []
};

const HELP = `
hops cutover-step-3 --target=prod|staging [--dry-run | --confirm-write-trials]
                    [--allow-sha-mismatch]
                    [--yes]

Run the V6 cutover step 3 script (writes the five cutover trials) against the
target database, from the VPS host.

The script runs as:
  pnpm --filter hospeda-api exec tsx scripts/cutover-v6-step-3.ts <mode>

with the target api container's environment (only HOSPEDA_* and NODE_ENV) and
a host-reachable HOSPEDA_DATABASE_URL. The environment is never printed.

Modes:
  --dry-run               Plan only, write nothing. THE DEFAULT.
  --confirm-write-trials  Write the five trials. On prod this requires typing
                          '${WRITE_TRIALS_PROD_PHRASE}'. Passing both mode flags is refused.

Version guard:
  The checkout's HEAD must match the deployed SHA (HOSPEDA_COMMIT_SHA in the
  api container, 10-char prefix). A mismatch stops with exit 1. The command
  NEVER pulls: align the checkout with git before running.

Flags:
  --allow-sha-mismatch    Run even when the checkout is not the deployed
                          commit. On prod this also requires the typed
                          confirmation, even for a dry-run.
  --yes                   Accepted for symmetry with other destructive
                          commands. It does NOT skip the typed prod guard.
  --help, -h              Show this help.

Exit codes (propagated from the script, unchanged):
  0  dry_run, completed or already_done
  1  nothing_planned, a guard failure, or an error
  2  refused arguments

Runbook order: dry-run, inspect the five planned rows by hand, then run again
with --confirm-write-trials.

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID    Coolify Postgres service UUID.
  HOPS_REPO_ROOT (optional)      Path to the hospeda checkout. Default ~/hospeda.
`.trim();

/**
 * Prompt for the prod typed confirmation and stop the command when it does
 * not match. Returns normally only when the operator typed the exact phrase.
 */
async function confirmProd(input: {
    readonly target: Target;
    readonly mode: CutoverStep3Mode;
}): Promise<void> {
    if (input.mode === 'write') {
        log.warn('This run WRITES the five cutover trials to the PRODUCTION database.');
    } else {
        log.warn('This run OVERRIDES the deployed-SHA guard against PRODUCTION.');
    }
    const typed = await promptText({
        message: `Type '${WRITE_TRIALS_PROD_PHRASE}' to confirm`,
        placeholder: WRITE_TRIALS_PROD_PHRASE
    });
    if (!isTypedConfirmationValid({ typed })) {
        log.warn('Aborted: typed confirmation did not match.');
        process.exit(1);
    }
}

/**
 * Command entrypoint. Resolves the target, the checkout and both containers,
 * enforces the version guard and the typed confirmation, then hands the child
 * environment to the wrapped script and propagates its exit code.
 *
 * @param argv - Command argv, with the command name and global `--target` stripped.
 */
export async function cutoverStep3(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseCutoverStep3Args(argv);
    if (!parsed.ok) {
        die(parsed.reason, 2);
    }
    const options = parsed.value;

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

    const apiContainer = await findContainer('api');
    const containerEnv = await dockerInspectEnv(apiContainer);
    const postgresContainer = await findContainer('postgres');
    const credentials = getDbCredentials(target);
    const databaseUrl = await buildPostgresUrl({
        container: postgresContainer,
        user: credentials.user,
        db: credentials.database
    });

    const deployedSha = readContainerEnvValue({
        containerEnv,
        key: 'HOSPEDA_COMMIT_SHA'
    });
    const checkoutSha = await readCheckoutSha({ runner, repoRoot });
    const shaCheck = checkDeployedSha({
        checkoutSha,
        deployedSha,
        allowMismatch: options.allowShaMismatch
    });
    if (!shaCheck.ok) {
        die(shaCheck.message);
    }
    if (shaCheck.warning !== undefined) {
        log.warn(shaCheck.warning);
    }

    if (
        shouldPromptForTypedConfirmation({
            target,
            mode: options.mode,
            allowShaMismatch: options.allowShaMismatch,
            yes: options.yes
        })
    ) {
        await confirmProd({ target, mode: options.mode });
    }

    const childEnv = buildStep3ChildEnv({ containerEnv, databaseUrl, hostEnv: process.env });

    log.info(`Target  : ${target}`);
    log.info(`Repo    : ${repoRoot}`);
    log.info(`Mode    : ${options.mode === 'write' ? 'write trials' : 'dry-run'}`);
    log.info(`Env     : ${Object.keys(childEnv).length} env vars passed`);

    const exitCode = await runCutoverStep3({
        runner,
        repoRoot,
        mode: options.mode,
        env: childEnv
    });
    process.exit(exitCode);
}
