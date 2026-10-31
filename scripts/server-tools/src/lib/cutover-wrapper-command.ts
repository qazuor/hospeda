/**
 * I/O wiring shared by the HOS-1957 G7 cutover wrappers. Mirrors
 * `src/commands/cutover-step-3.ts`: resolve the target, refuse what the target
 * must never run, locate the checkout and both containers, then hand
 * everything to {@link executeCutoverWrapper} and exit with the script's code.
 *
 * The child environment is held in memory only and never printed.
 *
 * @module lib/cutover-wrapper-command
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveApiEnv } from './api-env-source.ts';
import { findContainer, getActiveTarget } from './container-lookup.ts';
import { createCoolifyClient } from './coolify.ts';
import { readCheckoutSha } from './cutover-step-3-core.ts';
import {
    cutoverWrapperTargetRefusal,
    executeCutoverWrapper,
    isWrapperPhraseValid,
    parseCutoverWrapperArgs
} from './cutover-wrapper-core.ts';
import type { CutoverWrapperSpec } from './cutover-wrapper-specs.ts';
import { dockerInspectEnv } from './docker.ts';
import { die, log } from './log.ts';
import { buildPostgresUrl } from './postgres.ts';
import { promptText } from './prompt.ts';
import { resolveRepoRoot } from './repo-root.ts';
import { runner } from './runner.ts';
import { getAppResourceName, getDbCredentials } from './target.ts';

/**
 * Run one cutover wrapper command end to end.
 *
 * @param input - The wrapper spec, its help text and the command argv
 * (command name and `--target` already stripped).
 */
export async function runCutoverWrapperCommand(input: {
    readonly spec: CutoverWrapperSpec;
    readonly help: string;
    readonly argv: ReadonlyArray<string>;
}): Promise<void> {
    const { spec } = input;
    if (input.argv.includes('--help') || input.argv.includes('-h')) {
        process.stdout.write(`${input.help}\n`);
        return;
    }

    const parsed = parseCutoverWrapperArgs({
        spec,
        argv: input.argv,
        cwd: process.cwd(),
        fileExists: existsSync
    });
    if (!parsed.ok) die(parsed.reason, 2);
    const options = parsed.value;

    const target = getActiveTarget();
    const refusal = cutoverWrapperTargetRefusal({ spec, target, mode: options.mode });
    if (refusal !== undefined) die(refusal, 2);

    const repoRoot = resolveRepoRoot();
    if (!existsSync(repoRoot)) {
        die(
            `Repo root '${repoRoot}' not found. Set HOPS_REPO_ROOT in the hops config or clone the repo at ~/hospeda.`
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

    const result = await executeCutoverWrapper({
        spec,
        runner,
        repoRoot,
        target,
        options,
        containerEnv,
        databaseUrl,
        hostEnv: process.env,
        readCheckoutSha: ({ repoRoot: checkoutRoot }) =>
            readCheckoutSha({ runner, repoRoot: checkoutRoot }),
        confirmProd: async ({ spec: confirmSpec, mode }) => {
            log.warn(
                mode === 'write'
                    ? confirmSpec.writeDescription
                    : 'This run OVERRIDES the deployed-SHA guard against PRODUCTION.'
            );
            const typed = await promptText({
                message: `Type '${confirmSpec.prodPhrase}' to confirm`,
                placeholder: confirmSpec.prodPhrase
            });
            if (!isWrapperPhraseValid({ spec: confirmSpec, typed })) {
                log.warn('Aborted: typed confirmation did not match.');
                throw new Error('Aborted: typed confirmation did not match.');
            }
        },
        log
    });

    if (result.ok) process.exit(result.exitCode);
    if (result.reason === 'sha-guard') die(result.message);
    process.exit(1);
}
