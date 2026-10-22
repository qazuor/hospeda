/**
 * Pure core of `hops cutover-step-3`.
 *
 * The command wrapper in `src/commands/cutover-step-3.ts` owns the I/O
 * (Docker inspection, repo-root resolution, prompts); everything that can be
 * decided without touching a process lives here so it can be unit-tested with
 * a fake `Runner`. No function in this module reads `process.env`, prints, or
 * calls `process.exit`: {@link executeCutoverStep3} receives every effect as
 * an injected dependency and returns a typed result the command translates.
 */

import type { Runner } from './runner.ts';
import type { Target } from './target.ts';

/** Which mode the wrapped script runs in. */
export type CutoverStep3Mode = 'dry-run' | 'write';

/** The exact phrase an operator must type to confirm a prod write. */
export const WRITE_TRIALS_PROD_PHRASE = 'write-trials-prod';

/** Normalised command-line options for `hops cutover-step-3`. */
export interface ParsedCutoverStep3Args {
    /** Dry-run unless `--confirm-write-trials` was passed. */
    readonly mode: CutoverStep3Mode;
    /** `--allow-sha-mismatch`: accept a checkout that is not the deployed SHA. */
    readonly allowShaMismatch: boolean;
    /** `--yes`: parsed for symmetry with other destructive commands; never skips the typed guard. */
    readonly yes: boolean;
}

/** Result of parsing the command's own argv. */
export type ParseCutoverStep3ArgsResult =
    | { readonly ok: true; readonly value: ParsedCutoverStep3Args }
    | { readonly ok: false; readonly reason: string };

const KNOWN_FLAGS = new Set([
    '--dry-run',
    '--confirm-write-trials',
    '--allow-sha-mismatch',
    '--yes'
]);

/**
 * Parse the command's argv into a normalised option set.
 *
 * The wrapped script has no default: `hops` supplies `--dry-run` when neither
 * mode flag is present. Passing both modes, or any token outside the declared
 * surface, is refused with a reason the caller can print before exiting 2 —
 * the same exit code the script uses for refused arguments.
 *
 * @param argv - The command's argv, with the command name and `--target` already stripped.
 * @returns `{ ok: true, value }` or `{ ok: false, reason }`.
 */
export function parseCutoverStep3Args(argv: ReadonlyArray<string>): ParseCutoverStep3ArgsResult {
    const unknown = argv.find((arg) => !KNOWN_FLAGS.has(arg));
    if (unknown !== undefined) {
        return { ok: false, reason: `Unknown flag: ${unknown}` };
    }

    const dryRun = argv.includes('--dry-run');
    const write = argv.includes('--confirm-write-trials');
    if (dryRun && write) {
        return {
            ok: false,
            reason: 'Refusing to run: pass exactly one of --dry-run or --confirm-write-trials.'
        };
    }

    return {
        ok: true,
        value: {
            mode: write ? 'write' : 'dry-run',
            allowShaMismatch: argv.includes('--allow-sha-mismatch'),
            yes: argv.includes('--yes')
        }
    };
}

/** Input for {@link requiresTypedConfirmation}. */
export interface RequiresTypedConfirmationInput {
    readonly target: Target;
    readonly mode: CutoverStep3Mode;
    readonly allowShaMismatch: boolean;
}

/**
 * Decide whether the operator must type {@link WRITE_TRIALS_PROD_PHRASE}.
 *
 * Against prod, a write always asks for the phrase. A dry-run normally does
 * not — it writes nothing — except when `--allow-sha-mismatch` overrides the
 * version guard, because that means running an unverified checkout against
 * the production database. Staging never asks. `--yes` is deliberately not an
 * input: it can never skip this guard.
 *
 * @param input - Target, mode and the SHA-override flag.
 * @returns `true` when the typed phrase is required.
 */
export function requiresTypedConfirmation(input: RequiresTypedConfirmationInput): boolean {
    if (input.target !== 'prod') return false;
    if (input.mode === 'write') return true;
    return input.allowShaMismatch;
}

/** Input for {@link shouldPromptForTypedConfirmation}. */
export interface ShouldPromptForTypedConfirmationInput extends RequiresTypedConfirmationInput {
    /**
     * `--yes` as parsed. Accepted so the call site forwards the whole parsed
     * option set; deliberately ignored by the decision below.
     */
    readonly yes: boolean;
}

/**
 * Decide whether the command must actually prompt for the typed phrase.
 *
 * This is the single place the prompt decision is made, so a test can cover
 * the `--yes` case directly. `--yes` is accepted but never consulted: it
 * cannot skip the prod guard. The command's call site must call this function
 * and nothing else — never add `&& !options.yes` (or any other condition)
 * around it.
 *
 * @param input - Target, mode, the SHA-override flag and `--yes`.
 * @returns `true` when the operator must type {@link WRITE_TRIALS_PROD_PHRASE}.
 */
export function shouldPromptForTypedConfirmation(
    input: ShouldPromptForTypedConfirmationInput
): boolean {
    return requiresTypedConfirmation({
        target: input.target,
        mode: input.mode,
        allowShaMismatch: input.allowShaMismatch
    });
}

/** Input for {@link isTypedConfirmationValid}. */
export interface IsTypedConfirmationValidInput {
    /** The raw text the operator typed. */
    readonly typed: string;
}

/**
 * Check the prod typed confirmation. Only the exact phrase is accepted — no
 * trimming, no case folding, so a paste from a stale run cannot satisfy it.
 *
 * @param input - The typed text.
 * @returns `true` when it matches {@link WRITE_TRIALS_PROD_PHRASE} exactly.
 */
export function isTypedConfirmationValid(input: IsTypedConfirmationValidInput): boolean {
    return input.typed === WRITE_TRIALS_PROD_PHRASE;
}

/**
 * Read one value out of a `docker inspect .Config.Env` entry list.
 *
 * Entries are `KEY=VALUE`; the split happens on the FIRST `=`, so values that
 * contain `=` survive intact. Malformed entries are ignored.
 *
 * @param input - Env entry list and the key to look up.
 * @returns The value, or `undefined` when the key is absent.
 */
export function readContainerEnvValue(input: {
    readonly containerEnv: ReadonlyArray<string>;
    readonly key: string;
}): string | undefined {
    const prefix = `${input.key}=`;
    const entry = input.containerEnv.find((line) => line.startsWith(prefix));
    return entry === undefined ? undefined : entry.slice(prefix.length);
}

/**
 * The only host variables the child gets.
 *
 * The wrapped script is launched through `pnpm` and `node`, so it needs the
 * host's `PATH` (container paths point at the container filesystem), `HOME`
 * (package-manager caches and config) and `LANG` (a sane locale). Nothing
 * else from the host is forwarded — in particular no `HOSPEDA_*` key, so a
 * host value can never shadow the container's.
 */
export const STEP3_HOST_ENV_ALLOWLIST = ['PATH', 'HOME', 'LANG'] as const;

/** Input for {@link buildStep3ChildEnv}. */
export interface BuildStep3ChildEnvInput {
    /** `Config.Env` entries from the target's api container. */
    readonly containerEnv: ReadonlyArray<string>;
    /** Host-reachable Postgres URL built from the target's Postgres container. */
    readonly databaseUrl: string;
    /** Host process environment; only {@link STEP3_HOST_ENV_ALLOWLIST} is read. */
    readonly hostEnv: Readonly<Record<string, string | undefined>>;
}

/**
 * Build the child environment for the wrapped script.
 *
 * The api container's own environment is the only source of the full
 * `validateApiEnv()` surface, but the system entries (`PATH`, `HOME`,
 * `NODE_VERSION`, image-specific values) must never leak: overriding `PATH`
 * with the container's would point the host process at the container's
 * filesystem. Only `NODE_ENV` and `HOSPEDA_*` keys are taken from the
 * container, plus the closed host allowlist in
 * {@link STEP3_HOST_ENV_ALLOWLIST} so `pnpm`/`node` can start. A host
 * `HOSPEDA_*` never enters — the container value always wins — and
 * `HOSPEDA_DATABASE_URL` is replaced with the URL reachable from the host.
 * The caller passes the result to the runner with `inheritEnv: false`, so this
 * object is the child's entire environment. It stays in memory — callers must
 * never log it.
 *
 * @param input - Container env entries, the host DB URL and the host env.
 * @returns A new env object with only the allowed keys.
 */
export function buildStep3ChildEnv(
    input: BuildStep3ChildEnvInput
): Readonly<Record<string, string>> {
    const env: Record<string, string> = {};
    for (const entry of input.containerEnv) {
        const separator = entry.indexOf('=');
        if (separator <= 0) continue;
        const key = entry.slice(0, separator);
        if (key !== 'NODE_ENV' && !key.startsWith('HOSPEDA_')) continue;
        env[key] = entry.slice(separator + 1);
    }
    for (const key of STEP3_HOST_ENV_ALLOWLIST) {
        const value = input.hostEnv[key];
        if (value !== undefined) env[key] = value;
    }
    env.HOSPEDA_DATABASE_URL = input.databaseUrl;
    return env;
}

/** Result of {@link checkDeployedSha}. */
export type ShaCheckResult =
    | { readonly ok: true; readonly warning?: string }
    | { readonly ok: false; readonly message: string };

/** Input for {@link checkDeployedSha}. */
export interface CheckDeployedShaInput {
    /** `git -C <repoRoot> rev-parse HEAD` in the checkout that will run the script. */
    readonly checkoutSha: string;
    /** `HOSPEDA_COMMIT_SHA` from the target's api container, when present. */
    readonly deployedSha: string | undefined;
    /** `--allow-sha-mismatch` in effect. */
    readonly allowMismatch: boolean;
}

/**
 * Compare the checkout's HEAD with the SHA the target is actually running.
 *
 * Short SHAs are compared by their first 10 characters: the container exposes
 * an abbreviated SHA while `git rev-parse HEAD` returns the full one. A missing
 * or `unknown` deployed SHA is treated like a mismatch — the guard cannot prove
 * the checkout is the deployed code, which is the whole point. Mismatches (and
 * an unverifiable SHA) are refused unless `--allow-sha-mismatch` was passed, in
 * which case the caller logs the returned warning and continues.
 *
 * @param input - Checkout SHA, deployed SHA and the override flag.
 * @returns `{ ok: true }` (optionally with a warning), or `{ ok: false, message }`.
 */
export function checkDeployedSha(input: CheckDeployedShaInput): ShaCheckResult {
    const checkout = input.checkoutSha.trim();
    const deployed = input.deployedSha?.trim();
    const allow = input.allowMismatch;

    if (deployed === undefined || deployed.length === 0 || deployed.toLowerCase() === 'unknown') {
        if (allow) {
            return {
                ok: true,
                warning: `Deployed SHA is unknown for the target; proceeding because --allow-sha-mismatch was passed. Checkout HEAD is ${checkout}.`
            };
        }
        return {
            ok: false,
            message: `Cannot verify the deployed SHA: the api container exposes no HOSPEDA_COMMIT_SHA. Checkout HEAD is ${checkout}. Refusing to run; pass --allow-sha-mismatch only if you accept an unverified checkout.`
        };
    }

    if (checkout.slice(0, 10) === deployed.slice(0, 10)) {
        return { ok: true };
    }

    const mismatch = `Deployed SHA ${deployed} does not match checkout HEAD ${checkout}.`;
    if (allow) {
        return {
            ok: true,
            warning: `${mismatch} Proceeding because --allow-sha-mismatch was passed.`
        };
    }
    return {
        ok: false,
        message: `${mismatch} Align the checkout to the deployed commit before running the cutover, or pass --allow-sha-mismatch if you accept the risk.`
    };
}

/**
 * Read the checkout's HEAD SHA.
 *
 * @param input - Injected runner and the repo checkout root.
 * @returns The full SHA printed by `git rev-parse HEAD`.
 * @throws when git fails, so the command stops before touching the database.
 */
export async function readCheckoutSha(input: {
    readonly runner: Runner;
    readonly repoRoot: string;
}): Promise<string> {
    const result = await input.runner.run(['git', '-C', input.repoRoot, 'rev-parse', 'HEAD']);
    if (result.exitCode !== 0) {
        throw new Error(
            `git rev-parse HEAD failed in '${input.repoRoot}' (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`
        );
    }
    return result.stdout.trim();
}

/** Input for {@link runCutoverStep3}. */
export interface RunCutoverStep3Input {
    /** Injected runner — `LocalRunner` in production, a fake in tests. */
    readonly runner: Runner;
    readonly repoRoot: string;
    readonly mode: CutoverStep3Mode;
    /** Pre-built child env (see {@link buildStep3ChildEnv}). */
    readonly env: Readonly<Record<string, string>>;
}

/**
 * Run the wrapped script and return its exit code unchanged.
 *
 * This is deliberately NOT wrapped in `die()`: the script's exits (0 success,
 * 1 nothing planned/error, 2 refused arguments) are the command's exits, so
 * the cutover runbook can key on them. Stdio is inherited so the script's own
 * sanitized JSON result is the operator's output. The runner receives
 * `inheritEnv: false`, so `input.env` is the child's entire environment and no
 * host variable leaks in.
 *
 * @param input - Runner, checkout root, mode and child env.
 * @returns The child process exit code.
 */
export async function runCutoverStep3(input: RunCutoverStep3Input): Promise<number> {
    const modeFlag = input.mode === 'write' ? '--confirm-write-trials' : '--dry-run';
    const result = await input.runner.run(
        [
            'pnpm',
            '--filter',
            'hospeda-api',
            'exec',
            'tsx',
            'scripts/cutover-v6-step-3.ts',
            modeFlag
        ],
        { cwd: input.repoRoot, inherit: true, inheritEnv: false, env: input.env }
    );
    return result.exitCode;
}

/** The logging surface the orchestration needs; `log` from `./log.ts` satisfies it. */
export interface CutoverStep3Logger {
    info(message: string): void;
    warn(message: string): void;
}

/**
 * Ask the operator for the prod typed confirmation.
 *
 * The injected implementation is expected to stop the run (by throwing) when
 * the typed phrase does not match, so the orchestration can report the abort
 * without calling `process.exit` itself.
 */
export type ConfirmProdFn = (input: {
    readonly target: Target;
    readonly mode: CutoverStep3Mode;
}) => Promise<void>;

/** Read the checkout's HEAD SHA; the command wires the runner-backed reader. */
export type ReadCheckoutShaFn = (input: { readonly repoRoot: string }) => Promise<string>;

/** Input for {@link executeCutoverStep3}. Every effect is injected. */
export interface ExecuteCutoverStep3Input {
    /** Injected runner, used only for the wrapped script. */
    readonly runner: Runner;
    /** Checkout that will run the script. */
    readonly repoRoot: string;
    /** Resolved target environment. */
    readonly target: Target;
    /** Parsed command-line options. */
    readonly options: ParsedCutoverStep3Args;
    /** `Config.Env` entries from the target's api container. */
    readonly containerEnv: ReadonlyArray<string>;
    /** Host-reachable Postgres URL built from the target's Postgres container. */
    readonly databaseUrl: string;
    /** Host process environment; only the allowlist is forwarded. */
    readonly hostEnv: Readonly<Record<string, string | undefined>>;
    /** Reader for the checkout SHA. */
    readonly readCheckoutSha: ReadCheckoutShaFn;
    /** Prod confirmation prompt. */
    readonly confirmProd: ConfirmProdFn;
    /** Destination for the operator-facing status lines. */
    readonly log: CutoverStep3Logger;
}

/**
 * Result of {@link executeCutoverStep3}.
 *
 * `sha-guard` carries a message the command must print; `confirmation-rejected`
 * was already reported by `confirmProd`, so the command only exits 1.
 */
export type ExecuteCutoverStep3Result =
    | { readonly ok: true; readonly exitCode: number }
    | {
          readonly ok: false;
          readonly reason: 'sha-guard' | 'confirmation-rejected';
          readonly message: string;
      };

/**
 * Orchestrate one `hops cutover-step-3` run: version guard, prod confirmation,
 * child environment and script execution.
 *
 * This is the call site the command wrapper delegates to, extracted so its
 * ordering can be tested without Docker, a prompt or a child process. The
 * confirmation decision comes from {@link shouldPromptForTypedConfirmation}
 * and nothing else; in particular `--yes` is forwarded but never consulted
 * here, so this function never skips the prod prompt. The wrapped script runs
 * only after the guard passes and the confirmation (when required) resolves.
 *
 * @param input - Injected effects and parsed options.
 * @returns `{ ok: true, exitCode }` with the script's exit code, or
 * `{ ok: false, reason, message }` when a guard or the confirmation stopped
 * the run before the script.
 */
export async function executeCutoverStep3(
    input: ExecuteCutoverStep3Input
): Promise<ExecuteCutoverStep3Result> {
    const deployedSha = readContainerEnvValue({
        containerEnv: input.containerEnv,
        key: 'HOSPEDA_COMMIT_SHA'
    });
    const checkoutSha = await input.readCheckoutSha({ repoRoot: input.repoRoot });
    const shaCheck = checkDeployedSha({
        checkoutSha,
        deployedSha,
        allowMismatch: input.options.allowShaMismatch
    });
    if (!shaCheck.ok) {
        return { ok: false, reason: 'sha-guard', message: shaCheck.message };
    }
    if (shaCheck.warning !== undefined) {
        input.log.warn(shaCheck.warning);
    }

    if (
        shouldPromptForTypedConfirmation({
            target: input.target,
            mode: input.options.mode,
            allowShaMismatch: input.options.allowShaMismatch,
            yes: input.options.yes
        })
    ) {
        try {
            await input.confirmProd({ target: input.target, mode: input.options.mode });
        } catch (error) {
            return {
                ok: false,
                reason: 'confirmation-rejected',
                message: error instanceof Error ? error.message : String(error)
            };
        }
    }

    const childEnv = buildStep3ChildEnv({
        containerEnv: input.containerEnv,
        databaseUrl: input.databaseUrl,
        hostEnv: input.hostEnv
    });

    input.log.info(`Target  : ${input.target}`);
    input.log.info(`Repo    : ${input.repoRoot}`);
    input.log.info(`Mode    : ${input.options.mode === 'write' ? 'write trials' : 'dry-run'}`);
    input.log.info(`Env     : ${Object.keys(childEnv).length} env vars passed`);

    const exitCode = await runCutoverStep3({
        runner: input.runner,
        repoRoot: input.repoRoot,
        mode: input.options.mode,
        env: childEnv
    });
    return { ok: true, exitCode };
}
