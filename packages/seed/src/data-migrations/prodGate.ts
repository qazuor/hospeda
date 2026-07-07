import type { SeedMigrationMeta } from './types.js';

/**
 * Environment snapshot consumed by {@link evaluateProdDataMigrationGate}.
 * Deliberately narrowed to the two keys the gate actually reads (rather than
 * accepting the full `NodeJS.ProcessEnv`) so tests can pass a minimal object
 * without stubbing the entire process environment.
 */
export interface ProdDataMigrationGateEnv {
    /** Current `NODE_ENV`. Gate only activates when this is `'production'`. */
    readonly NODE_ENV?: string;

    /**
     * Explicit opt-in required to run destructive data-migrations in
     * production. Must be exactly `'true'` — any other value (including
     * unset, `'1'`, `'yes'`) is treated as "not opted in".
     */
    readonly HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION?: string;
}

/**
 * Arguments accepted by {@link evaluateProdDataMigrationGate}.
 */
export interface EvaluateProdDataMigrationGateArgs {
    /** Environment snapshot to evaluate. See {@link ProdDataMigrationGateEnv}. */
    readonly env: ProdDataMigrationGateEnv;

    /**
     * The set of data-migrations pending execution in this run, whose
     * static {@link SeedMigrationMeta} the gate inspects for `destructive`.
     */
    readonly pendingMeta: readonly SeedMigrationMeta[];

    /**
     * Whether the CLI's `--allow-destructive` flag was passed (wired by
     * T-017). An alternative, equivalent opt-in to
     * `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true`.
     *
     * @default false
     */
    readonly allowDestructiveFlag?: boolean;
}

/**
 * Result of evaluating the production safety gate for destructive versioned
 * seed data-migrations, and for `example`-group migrations in production.
 */
export interface ProdDataMigrationGateResult {
    /** Whether the pending migrations are allowed to run. */
    readonly allowed: boolean;

    /** Human-readable reason when {@link allowed} is `false`. */
    readonly reason?: string;

    /** Names of pending migrations flagged `meta.destructive === true`. */
    readonly destructiveNames: readonly string[];

    /**
     * Names of pending migrations flagged `meta.group === 'example'`. Always
     * computed (even outside production, and even when {@link allowed} is
     * `true`), mirroring {@link destructiveNames}.
     */
    readonly exampleGroupNames: readonly string[];
}

/**
 * Pure helper that decides whether a batch of pending data-migrations is
 * allowed to run, given a snapshot of the relevant environment variables and
 * the batch's static metadata.
 *
 * HOS-25 T-011: mirrors the shape of `evaluateProdCleanupGate`
 * (`packages/seed/src/cli.ts`) for `pnpm seed --clean-images`. In any
 * production-like environment (`NODE_ENV=production`), any pending migration
 * with `meta.destructive === true` requires an explicit opt-in — either
 * `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` in the environment, or the CLI's
 * `--allow-destructive` flag (T-017) via {@link EvaluateProdDataMigrationGateArgs.allowDestructiveFlag}.
 * Non-destructive migrations are always allowed, in every environment.
 *
 * HOS-25 review finding M1: `example`-group migrations are documented (see
 * `SeedMigrationGroup` in `types.ts`) as dev/staging-only, but nothing
 * enforced that — `runMigrations` with no `group` filter runs both groups,
 * and this gate previously only ever looked at `meta.destructive`. This gate
 * now ALSO refuses, in production, any pending migration with `meta.group
 * === 'example'`. Unlike the destructive check, this refusal is
 * UNCONDITIONAL: there is no env var or flag opt-in, because an
 * `example`-group migration running in production is never intentional (it
 * is always a misconfiguration), whereas a destructive `required` migration
 * sometimes legitimately needs to run in production. This check is
 * evaluated BEFORE the destructive check, so an example-group migration is
 * refused regardless of its own `destructive` flag or any destructive
 * opt-in.
 *
 * This function performs no I/O and reads no ambient state (it does not
 * touch `process.env` itself) — callers pass in the environment snapshot,
 * keeping it trivially unit-testable.
 *
 * @param args - See {@link EvaluateProdDataMigrationGateArgs}.
 * @returns A {@link ProdDataMigrationGateResult} describing the decision.
 *
 * @example
 * ```ts
 * const result = evaluateProdDataMigrationGate({
 *   env: process.env,
 *   pendingMeta: [{ name: '0003-remove-legacy-feature', group: 'required', destructive: true }],
 * });
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * ```
 */
export function evaluateProdDataMigrationGate(
    args: EvaluateProdDataMigrationGateArgs
): ProdDataMigrationGateResult {
    const { env, pendingMeta, allowDestructiveFlag = false } = args;

    const destructiveNames = pendingMeta
        .filter((meta) => meta.destructive === true)
        .map((meta) => meta.name);

    const exampleGroupNames = pendingMeta
        .filter((meta) => meta.group === 'example')
        .map((meta) => meta.name);

    const isProd = env.NODE_ENV === 'production';
    if (!isProd) {
        return { allowed: true, destructiveNames, exampleGroupNames };
    }

    if (exampleGroupNames.length > 0) {
        return {
            allowed: false,
            reason: `Refusing to run ${exampleGroupNames.length} "example"-group data-migration(s) in production (${exampleGroupNames.join(', ')}). Example-group migrations never run in production — this is not overridable by any env var or flag.`,
            destructiveNames,
            exampleGroupNames
        };
    }

    if (destructiveNames.length === 0) {
        return { allowed: true, destructiveNames, exampleGroupNames };
    }

    const isOptedIn =
        env.HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION === 'true' || allowDestructiveFlag === true;
    if (isOptedIn) {
        return { allowed: true, destructiveNames, exampleGroupNames };
    }

    return {
        allowed: false,
        reason: `Refusing to run ${destructiveNames.length} destructive data-migration(s) in production (${destructiveNames.join(', ')}). Set HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true or pass --allow-destructive to override.`,
        destructiveNames,
        exampleGroupNames
    };
}
