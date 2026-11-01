/**
 * Pure core shared by the HOS-1957 G7 cutover wrappers
 * (`hops cutover-step-3b`, `hops cutover-step-4c`, `hops cutover-step-5b`).
 *
 * It is the generic form of `cutover-step-3-core.ts` and reuses its building
 * blocks unchanged: the deployed-SHA guard ({@link checkDeployedSha}), the
 * checkout SHA reader, and the child environment ({@link buildStep3ChildEnv}:
 * the api container's `HOSPEDA_*`/`API_*`/`NODE_ENV`/`PORT`, a host-reachable
 * database URL, and nothing else from the host). What differs per wrapper is
 * declared in `cutover-wrapper-specs.ts`.
 *
 * No function here reads `process.env`, prints, or calls `process.exit`: every
 * effect is injected so the ordering (refusal → SHA guard → typed prod
 * confirmation → script) can be tested with a fake `Runner`.
 *
 * @module lib/cutover-wrapper-core
 */

import { isAbsolute, resolve } from 'node:path';
import type { CommandArgvSpec } from './cli-flags.ts';
import { checkDeployedSha } from './cutover-step-3-core.ts';
import { buildStep3ChildEnv, resolveDeployedSha } from './cutover-step-3-env.ts';
import type { CutoverWrapperSpec } from './cutover-wrapper-specs.ts';
import type { Runner } from './runner.ts';
import type { Target } from './target.ts';
import { CONFIRM_PHRASE_FLAG } from './typed-confirmation.ts';

/** Which mode the wrapped script runs in. `dry-run` is the default of every wrapper. */
export type CutoverWrapperMode = 'dry-run' | 'write';

const COMMON_BOOLEAN_FLAGS = ['--dry-run', '--allow-sha-mismatch', '--yes'] as const;

/**
 * Build the argv surface the central flag validator checks before the command runs.
 *
 * @param spec - The wrapper declaration.
 * @returns The command's declared booleans and `--name=value` pass-through flags.
 */
export function cutoverWrapperArgvSpec(spec: CutoverWrapperSpec): CommandArgvSpec {
    return {
        booleanFlags: [
            ...COMMON_BOOLEAN_FLAGS,
            spec.writeFlag,
            ...spec.dryRunAliases,
            '--help',
            '-h'
        ],
        valueFlags: [
            ...spec.passThrough.map((flag) => ({ name: flag.name, syntax: 'equals' as const })),
            { name: CONFIRM_PHRASE_FLAG, syntax: 'equals' as const }
        ]
    };
}

/** Normalised options of one wrapper run. */
export interface ParsedCutoverWrapperArgs {
    /** `dry-run` unless the spec's write flag was passed. */
    readonly mode: CutoverWrapperMode;
    /** `--allow-sha-mismatch`: accept a checkout that is not the deployed SHA. */
    readonly allowShaMismatch: boolean;
    /** `--yes`: parsed for symmetry; never skips the typed prod guard. */
    readonly yes: boolean;
    /** Value of `--confirm-phrase=<phrase>`, when present (HOS-1963). Never forwarded. */
    readonly confirmPhrase?: string;
    /** Pass-through flags, in input order, as `--name=value` (paths made absolute). */
    readonly forwarded: readonly string[];
}

/** Result of {@link parseCutoverWrapperArgs}. */
export type ParseCutoverWrapperArgsResult =
    | { readonly ok: true; readonly value: ParsedCutoverWrapperArgs }
    | { readonly ok: false; readonly reason: string };

/** Input for {@link parseCutoverWrapperArgs}. */
export interface ParseCutoverWrapperArgsInput {
    readonly spec: CutoverWrapperSpec;
    /** The command's argv, with the command name and `--target` already stripped. */
    readonly argv: readonly string[];
    /** Directory relative `path` values are resolved against (the operator's cwd). */
    readonly cwd: string;
    /** Existence check for `path` values; injected so tests touch no file system. */
    readonly fileExists: (path: string) => boolean;
}

/**
 * Parse a wrapper's argv. Refuses unknown, repeated or malformed flags, both
 * modes at once, a pass-through flag over its occurrence limit, and a `path`
 * value that does not exist. The wrapped script still validates the VALUES of
 * what is forwarded (UUIDs, booleans, file contents) and exits 2 on refusal.
 *
 * @param input - Spec, argv, cwd and the injected existence check.
 * @returns `{ ok: true, value }` or `{ ok: false, reason }` (the command exits 2).
 */
export function parseCutoverWrapperArgs(
    input: ParseCutoverWrapperArgsInput
): ParseCutoverWrapperArgsResult {
    const { spec } = input;
    const dryRunFlags = new Set<string>(['--dry-run', ...spec.dryRunAliases]);
    const booleans = new Set<string>([
        ...COMMON_BOOLEAN_FLAGS,
        spec.writeFlag,
        ...spec.dryRunAliases
    ]);
    const passThrough = new Map(spec.passThrough.map((flag) => [flag.name, flag]));
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    const forwarded: string[] = [];
    let confirmPhrase: string | undefined;

    for (const arg of input.argv) {
        const separator = arg.indexOf('=');
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        if (flag === CONFIRM_PHRASE_FLAG) {
            if (confirmPhrase !== undefined) return { ok: false, reason: `Repeated flag: ${flag}` };
            const value = separator < 0 ? '' : arg.slice(separator + 1);
            if (value.length === 0)
                return {
                    ok: false,
                    reason: `${flag} requires a non-empty value in ${flag}=<phrase> form.`
                };
            confirmPhrase = value;
            continue;
        }
        const pass = passThrough.get(flag);
        if (pass !== undefined) {
            const value = separator < 0 ? '' : arg.slice(separator + 1);
            if (value.length === 0)
                return {
                    ok: false,
                    reason: `${flag} requires a non-empty value in ${flag}=<value> form.`
                };
            const count = (counts.get(flag) ?? 0) + 1;
            if (count > pass.maxOccurrences)
                return {
                    ok: false,
                    reason: `Repeated flag: ${flag} (maximum ${pass.maxOccurrences}).`
                };
            counts.set(flag, count);
            if (pass.kind === 'path') {
                const absolute = isAbsolute(value) ? value : resolve(input.cwd, value);
                if (!input.fileExists(absolute))
                    return { ok: false, reason: `${flag}: file not found: ${absolute}` };
                forwarded.push(`${flag}=${absolute}`);
            } else {
                forwarded.push(arg);
            }
            continue;
        }
        if (!booleans.has(flag)) return { ok: false, reason: `Unknown flag: ${arg}` };
        if (separator >= 0) return { ok: false, reason: `Malformed flag: ${flag} takes no value.` };
        if (seen.has(flag)) return { ok: false, reason: `Repeated flag: ${flag}` };
        seen.add(flag);
    }

    const dryRun = [...seen].some((flag) => dryRunFlags.has(flag));
    const write = seen.has(spec.writeFlag);
    if (dryRun && write) {
        const dryRunSpelling = [...dryRunFlags].join(' / ');
        return {
            ok: false,
            reason: `Refusing to run: pass exactly one of ${dryRunSpelling} or ${spec.writeFlag}.`
        };
    }

    return {
        ok: true,
        value: {
            mode: write ? 'write' : 'dry-run',
            allowShaMismatch: seen.has('--allow-sha-mismatch'),
            yes: seen.has('--yes'),
            ...(confirmPhrase === undefined ? {} : { confirmPhrase }),
            forwarded
        }
    };
}

/**
 * Refuse a mode the target must never run, before any repo, container or
 * database lookup. Today only `cutover-step-5b --execute` on staging.
 *
 * @param input - Spec, target and mode.
 * @returns The refusal reason, or `undefined` when the run may proceed.
 */
export function cutoverWrapperTargetRefusal(input: {
    readonly spec: CutoverWrapperSpec;
    readonly target: Target;
    readonly mode: CutoverWrapperMode;
}): string | undefined {
    if (input.mode !== 'write' || !input.spec.writeRefusedOn.includes(input.target))
        return undefined;
    return (
        input.spec.writeRefusalReason ??
        `${input.spec.writeFlag} is refused on ${input.target} for ${input.spec.name}.`
    );
}

/**
 * Decide whether the operator must type the spec's prod phrase. Same policy as
 * `hops cutover-step-3`: a prod write always asks; a prod dry-run asks only
 * when `--allow-sha-mismatch` overrides the version guard; staging never asks.
 * `--yes` is accepted and deliberately ignored — it can never skip this guard.
 *
 * @param input - Target, mode, the SHA-override flag and `--yes`.
 * @returns `true` when the prompt is required.
 */
export function shouldPromptForWrapperConfirmation(input: {
    readonly target: Target;
    readonly mode: CutoverWrapperMode;
    readonly allowShaMismatch: boolean;
    readonly yes: boolean;
}): boolean {
    if (input.target !== 'prod') return false;
    return input.mode === 'write' || input.allowShaMismatch;
}

/**
 * Check the typed confirmation: the exact phrase of THIS wrapper, no trimming,
 * no case folding, so another step's phrase or a stale paste cannot satisfy it.
 *
 * @param input - The spec and the raw typed text.
 * @returns `true` when it matches the spec's prod phrase exactly.
 */
export function isWrapperPhraseValid(input: {
    readonly spec: CutoverWrapperSpec;
    readonly typed: string;
}): boolean {
    return input.typed === input.spec.prodPhrase;
}

/** Input for {@link runCutoverWrapperScript}. */
export interface RunCutoverWrapperScriptInput {
    readonly runner: Runner;
    readonly repoRoot: string;
    readonly spec: CutoverWrapperSpec;
    readonly mode: CutoverWrapperMode;
    /** Validated pass-through flags. */
    readonly forwarded: readonly string[];
    /** The child's entire environment (the runner gets `inheritEnv: false`). */
    readonly env: Readonly<Record<string, string>>;
}

/**
 * Run the wrapped script and return its exit code unchanged, so the runbook
 * can key on the script's own exits. Stdio is inherited: the script's JSON
 * result is the operator's output.
 *
 * @param input - Runner, checkout, spec, mode, forwarded flags and child env.
 * @returns The child process exit code.
 */
export async function runCutoverWrapperScript(
    input: RunCutoverWrapperScriptInput
): Promise<number> {
    const modeFlag = input.mode === 'write' ? input.spec.childWriteFlag : '--dry-run';
    const result = await input.runner.run(
        [
            'pnpm',
            '--dir',
            'apps/api',
            'exec',
            'tsx',
            input.spec.script,
            modeFlag,
            ...input.forwarded
        ],
        { cwd: input.repoRoot, inherit: true, inheritEnv: false, env: input.env }
    );
    return result.exitCode;
}

/** The logging surface the orchestration needs; `log` from `./log.ts` satisfies it. */
export interface CutoverWrapperLogger {
    info(message: string): void;
    warn(message: string): void;
}

/** Prompt for the prod phrase; expected to THROW when the typed text does not match. */
export type ConfirmWrapperProdFn = (input: {
    readonly spec: CutoverWrapperSpec;
    readonly target: Target;
    readonly mode: CutoverWrapperMode;
}) => Promise<void>;

/** Input for {@link executeCutoverWrapper}. Every effect is injected. */
export interface ExecuteCutoverWrapperInput {
    readonly spec: CutoverWrapperSpec;
    readonly runner: Runner;
    readonly repoRoot: string;
    readonly target: Target;
    readonly options: ParsedCutoverWrapperArgs;
    /** `Config.Env` entries from the target's api container. */
    readonly containerEnv: ReadonlyArray<string>;
    /** Host-reachable Postgres URL built from the target's Postgres container. */
    readonly databaseUrl: string;
    /** Host process environment; only the step-3 allowlist is forwarded. */
    readonly hostEnv: Readonly<Record<string, string | undefined>>;
    readonly readCheckoutSha: (input: { readonly repoRoot: string }) => Promise<string>;
    readonly confirmProd: ConfirmWrapperProdFn;
    readonly log: CutoverWrapperLogger;
}

/** Result of {@link executeCutoverWrapper}. */
export type ExecuteCutoverWrapperResult =
    | { readonly ok: true; readonly exitCode: number }
    | {
          readonly ok: false;
          readonly reason: 'sha-guard' | 'confirmation-rejected';
          readonly message: string;
      };

/**
 * Orchestrate one wrapper run: version guard, typed prod confirmation, child
 * environment and script execution, in that order. The script runs only after
 * the guard passes and the confirmation (when required) resolves.
 *
 * @param input - Injected effects, the spec and parsed options.
 * @returns The script's exit code, or the guard that stopped the run.
 */
export async function executeCutoverWrapper(
    input: ExecuteCutoverWrapperInput
): Promise<ExecuteCutoverWrapperResult> {
    const deployedSha = resolveDeployedSha({ containerEnv: input.containerEnv });
    const checkoutSha = await input.readCheckoutSha({ repoRoot: input.repoRoot });
    const shaCheck = checkDeployedSha({
        checkoutSha,
        deployedSha,
        allowMismatch: input.options.allowShaMismatch
    });
    if (!shaCheck.ok) return { ok: false, reason: 'sha-guard', message: shaCheck.message };
    if (shaCheck.warning !== undefined) input.log.warn(shaCheck.warning);

    if (
        shouldPromptForWrapperConfirmation({
            target: input.target,
            mode: input.options.mode,
            allowShaMismatch: input.options.allowShaMismatch,
            yes: input.options.yes
        })
    ) {
        try {
            await input.confirmProd({
                spec: input.spec,
                target: input.target,
                mode: input.options.mode
            });
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
    input.log.info(`Script  : apps/api/${input.spec.script}`);
    input.log.info(
        `Mode    : ${input.options.mode === 'write' ? input.spec.writeFlag : 'dry-run'}`
    );
    input.log.info(`Env     : ${Object.keys(childEnv).length} env vars passed`);
    for (const flag of input.options.forwarded) input.log.info(`Forward : ${flag}`);

    const exitCode = await runCutoverWrapperScript({
        runner: input.runner,
        repoRoot: input.repoRoot,
        spec: input.spec,
        mode: input.options.mode,
        forwarded: input.options.forwarded,
        env: childEnv
    });
    return { ok: true, exitCode };
}
