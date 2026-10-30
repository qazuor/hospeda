/**
 * Pure core of `hops cutover-verify` (HOS-1957 G5 + G8).
 *
 * Wraps the read-only API script `apps/api/scripts/cutover-v6-verify.ts`:
 * the journal check of cutover step 3 (AC:CORTE:7) and the catalog
 * verification of step 3a (AC:CORTE:8). Like `cutover-step-3-core.ts`, every
 * effect is injected so the ordering is testable without Docker or a process.
 * Nothing here writes to the database, so there is no typed confirmation.
 */

import { checkDeployedSha } from './cutover-step-3-core.ts';
import { buildStep3ChildEnv, resolveDeployedSha } from './cutover-step-3-env.ts';
import type { Runner } from './runner.ts';

/** Normalised options of `hops cutover-verify`. */
export interface ParsedCutoverVerifyArgs {
    readonly journal: boolean;
    readonly catalog: boolean;
    readonly allowShaMismatch: boolean;
}

/** Result of {@link parseCutoverVerifyArgs}. */
export type ParseCutoverVerifyArgsResult =
    | { readonly ok: true; readonly value: ParsedCutoverVerifyArgs }
    | { readonly ok: false; readonly reason: string };

const KNOWN_FLAGS = new Set(['--journal', '--catalog', '--allow-sha-mismatch']);

/**
 * Parse the command argv. At least one of `--journal` / `--catalog` is
 * required; unknown, repeated or value-bearing flags are refused (exit 2).
 *
 * @param argv - Command argv with the command name and `--target` stripped.
 * @returns The options or the refusal reason.
 */
export function parseCutoverVerifyArgs(argv: ReadonlyArray<string>): ParseCutoverVerifyArgsResult {
    const seen = new Set<string>();
    for (const arg of argv) {
        if (!KNOWN_FLAGS.has(arg)) return { ok: false, reason: `Unknown flag: ${arg}` };
        if (seen.has(arg)) return { ok: false, reason: `Repeated flag: ${arg}` };
        seen.add(arg);
    }
    if (!seen.has('--journal') && !seen.has('--catalog')) {
        return { ok: false, reason: 'Refusing to run: pass --journal, --catalog or both.' };
    }
    return {
        ok: true,
        value: {
            journal: seen.has('--journal'),
            catalog: seen.has('--catalog'),
            allowShaMismatch: seen.has('--allow-sha-mismatch')
        }
    };
}

/** Input for {@link runCutoverVerify}. */
export interface RunCutoverVerifyInput {
    readonly runner: Runner;
    readonly repoRoot: string;
    readonly options: ParsedCutoverVerifyArgs;
    /** Pre-built child env (see `buildStep3ChildEnv`). */
    readonly env: Readonly<Record<string, string>>;
}

/**
 * Run the wrapped script and return its exit code unchanged (0 every check
 * passed, 1 a check failed or an error, 2 refused arguments). Stdio is
 * inherited so the script's JSON verdicts are the operator's output.
 *
 * @param input - Runner, checkout root, options and child env.
 * @returns The child exit code.
 */
export async function runCutoverVerify(input: RunCutoverVerifyInput): Promise<number> {
    const result = await input.runner.run(
        [
            'pnpm',
            '--dir',
            'apps/api',
            'exec',
            'tsx',
            'scripts/cutover-v6-verify.ts',
            ...(input.options.journal ? ['--journal'] : []),
            ...(input.options.catalog ? ['--catalog'] : [])
        ],
        { cwd: input.repoRoot, inherit: true, inheritEnv: false, env: input.env }
    );
    return result.exitCode;
}

/** Input for {@link executeCutoverVerify}. Every effect is injected. */
export interface ExecuteCutoverVerifyInput {
    readonly runner: Runner;
    readonly repoRoot: string;
    readonly options: ParsedCutoverVerifyArgs;
    /** `Config.Env` entries from the target's api container. */
    readonly containerEnv: ReadonlyArray<string>;
    /** Host-reachable Postgres URL of the target. */
    readonly databaseUrl: string;
    readonly hostEnv: Readonly<Record<string, string | undefined>>;
    readonly readCheckoutSha: (input: { readonly repoRoot: string }) => Promise<string>;
    readonly log: { info(message: string): void; warn(message: string): void };
}

/** Result of {@link executeCutoverVerify}. */
export type ExecuteCutoverVerifyResult =
    | { readonly ok: true; readonly exitCode: number }
    | { readonly ok: false; readonly message: string };

/**
 * Orchestrate one run: the checkout must be the deployed commit (so the
 * journal read is the image's journal), then the script runs with the api
 * container's environment. The script runs only after the SHA guard passes.
 *
 * @param input - Injected effects and parsed options.
 * @returns The script exit code, or the guard's refusal message.
 */
export async function executeCutoverVerify(
    input: ExecuteCutoverVerifyInput
): Promise<ExecuteCutoverVerifyResult> {
    const deployedSha = resolveDeployedSha({ containerEnv: input.containerEnv });
    const checkoutSha = await input.readCheckoutSha({ repoRoot: input.repoRoot });
    const shaCheck = checkDeployedSha({
        checkoutSha,
        deployedSha,
        allowMismatch: input.options.allowShaMismatch
    });
    if (!shaCheck.ok) return { ok: false, message: shaCheck.message };
    if (shaCheck.warning !== undefined) input.log.warn(shaCheck.warning);

    const env = buildStep3ChildEnv({
        containerEnv: input.containerEnv,
        databaseUrl: input.databaseUrl,
        hostEnv: input.hostEnv
    });
    const checks = [input.options.journal && 'journal', input.options.catalog && 'catalog']
        .filter(Boolean)
        .join(', ');
    input.log.info(`Checks  : ${checks}`);
    input.log.info(`Env     : ${Object.keys(env).length} env vars passed`);
    const exitCode = await runCutoverVerify({
        runner: input.runner,
        repoRoot: input.repoRoot,
        options: input.options,
        env
    });
    return { ok: true, exitCode };
}
