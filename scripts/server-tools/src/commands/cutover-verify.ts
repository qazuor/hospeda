/**
 * `hops cutover-verify` — read-only cutover verifications against the target
 * database, from the VPS host (HOS-1957).
 *
 *   --journal  G5 / AC:CORTE:7: every migration of the image's Drizzle journal
 *              is recorded in `drizzle.__drizzle_migrations`. Run after
 *              `hops db-migrate`; a missing entry means the cut does not go on.
 *   --catalog  G8 / AC:CORTE:8 (paso 3a): the production catalog satisfies the
 *              panel validations (G-R3 included), prices, add-ons, promo codes
 *              in force, version 1 deadlines and the vertical enum mirror.
 *
 * Same plumbing as `hops cutover-step-3` (api container env, host-reachable
 * Postgres URL, deployed-SHA guard) but it never writes, so it asks for no
 * confirmation, even on prod. The script's exit code is propagated unchanged.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveApiEnv } from '../lib/api-env-source.ts';
import type { CommandArgvSpec } from '../lib/cli-flags.ts';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { createCoolifyClient } from '../lib/coolify.ts';
import { readCheckoutSha } from '../lib/cutover-step-3-core.ts';
import { executeCutoverVerify, parseCutoverVerifyArgs } from '../lib/cutover-verify-core.ts';
import { dockerInspectEnv } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { buildPostgresUrl } from '../lib/postgres.ts';
import { resolveRepoRoot } from '../lib/repo-root.ts';
import { runner } from '../lib/runner.ts';
import { getAppResourceName, getDbCredentials } from '../lib/target.ts';

const HELP_FLAGS = ['--help', '-h'] as const;

/** Declared argv surface of this command, used by the central flag validator. */
export const CUTOVER_VERIFY_ARGV: CommandArgvSpec = {
    booleanFlags: ['--journal', '--catalog', '--allow-sha-mismatch', ...HELP_FLAGS],
    valueFlags: []
};

const HELP = `
hops cutover-verify --target=prod|staging (--journal | --catalog | --journal --catalog)
                    [--allow-sha-mismatch]

Read-only cutover verifications against the target database. Writes nothing.

  --journal   Every migration of the image's Drizzle journal must be recorded in
              drizzle.__drizzle_migrations (AC:CORTE:7, after 'hops db-migrate').
              Compared by file hash, not by count: a skipped older migration shows.
  --catalog   Step 3a (AC:CORTE:8): G-R3 and the panel validations, plan roles and
              current versions, prices, add-ons, promo codes in force, version 1
              deadlines and the vertical enum mirror. Also prints the price table.

Version guard: the checkout's HEAD must match the deployed SHA (as in
'hops cutover-step-3'), so the journal read is the image's journal.
  --allow-sha-mismatch  Run anyway; the journal is then NOT proven to be the image's.

Exit codes (propagated from the script):
  0  every requested check passed
  1  a check failed (the cut does not continue), the guard refused, or an error
  2  refused arguments

Required: HOPS_<TARGET>_POSTGRES_UUID; HOPS_REPO_ROOT (optional, default ~/hospeda).
`.trim();

/**
 * Command entrypoint.
 *
 * @param argv - Command argv with the command name and global `--target` stripped.
 */
export async function cutoverVerify(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }
    const parsed = parseCutoverVerifyArgs(argv);
    if (!parsed.ok) die(parsed.reason, 2);
    const options = parsed.value;

    const target = getActiveTarget();
    const repoRoot = resolveRepoRoot();
    if (!existsSync(repoRoot)) {
        die(
            `Repo root '${repoRoot}' not found. Set HOPS_REPO_ROOT or clone the repo at ~/hospeda.`
        );
    }
    if (!existsSync(join(repoRoot, '.git'))) die(`'${repoRoot}' is not a git repository.`);

    const { entries: containerEnv } = await resolveApiEnv({
        readFromContainer: async () => dockerInspectEnv(await findContainer('api')),
        coolify: createCoolifyClient,
        resourceName: getAppResourceName(target, 'api'),
        warn: (message) => log.warn(message)
    });
    const postgresContainer = await findContainer('postgres');
    const credentials = getDbCredentials(target);
    const databaseUrl = await buildPostgresUrl({
        container: postgresContainer,
        user: credentials.user,
        db: credentials.database
    });

    const result = await executeCutoverVerify({
        runner,
        repoRoot,
        options,
        containerEnv,
        databaseUrl,
        hostEnv: process.env,
        readCheckoutSha: ({ repoRoot: checkoutRoot }) =>
            readCheckoutSha({ runner, repoRoot: checkoutRoot }),
        log
    });
    if (result.ok) process.exit(result.exitCode);
    die(result.message);
}
