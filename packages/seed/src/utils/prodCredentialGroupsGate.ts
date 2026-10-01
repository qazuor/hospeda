/**
 * Environment snapshot consumed by {@link evaluateProdCredentialGroupsGate}.
 * Narrowed to the one key the gate reads so tests can pass a minimal object.
 */
export interface ProdCredentialGroupsGateEnv {
    /** Current `NODE_ENV`. The gate only activates when this is `'production'`. */
    readonly NODE_ENV?: string;
}

/** Arguments accepted by {@link evaluateProdCredentialGroupsGate}. */
export interface EvaluateProdCredentialGroupsGateArgs {
    /** Environment snapshot to evaluate. */
    readonly env: ProdCredentialGroupsGateEnv;
    /** Whether the `--example` group was requested. */
    readonly example?: boolean;
    /** Whether the `--test-users` group was requested. */
    readonly testUsers?: boolean;
}

/** Result of {@link evaluateProdCredentialGroupsGate}. */
export interface ProdCredentialGroupsGateResult {
    /** Whether the requested groups may run. */
    readonly allowed: boolean;
    /** Human-readable reason when {@link allowed} is `false`. */
    readonly reason?: string;
    /** The credential-bearing groups that were refused. */
    readonly refusedGroups: readonly string[];
}

/**
 * HOS-564: decides whether the credential-bearing seed groups (`--example`,
 * `--test-users`) may run. Both create `*@local.test` accounts with a
 * well-known password committed in the repository, so in `NODE_ENV=production`
 * they are refused UNCONDITIONALLY: no env var or flag overrides it, because
 * running them in production is never intentional.
 *
 * Pure: reads no ambient state. `hops db-seed --target=prod` injects
 * `NODE_ENV=production`, so this also covers the hops path.
 *
 * @param args - See {@link EvaluateProdCredentialGroupsGateArgs}.
 * @returns The decision.
 */
export function evaluateProdCredentialGroupsGate(
    args: EvaluateProdCredentialGroupsGateArgs
): ProdCredentialGroupsGateResult {
    const { env, example = false, testUsers = false } = args;
    const refusedGroups = [example ? '--example' : null, testUsers ? '--test-users' : null].filter(
        (group): group is string => group !== null
    );

    if (env.NODE_ENV !== 'production' || refusedGroups.length === 0) {
        return { allowed: true, refusedGroups: [] };
    }

    return {
        allowed: false,
        reason: `Refusing to run ${refusedGroups.join(' and ')} in production: these groups create accounts with a well-known password committed in the repository. This is not overridable by any env var or flag. Use --required (and --poi-catalog) for production.`,
        refusedGroups
    };
}

/**
 * Throwing wrapper over {@link evaluateProdCredentialGroupsGate}, called at
 * the seed entrypoint so every path (hops, `pnpm seed`, library callers)
 * aborts by code before touching the database.
 *
 * @param args - See {@link EvaluateProdCredentialGroupsGateArgs}.
 * @throws {Error} When the gate refuses.
 */
export function assertCredentialGroupsAllowed(args: EvaluateProdCredentialGroupsGateArgs): void {
    const result = evaluateProdCredentialGroupsGate(args);
    if (!result.allowed) {
        throw new Error(result.reason);
    }
}
