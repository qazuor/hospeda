/**
 * Resolves the database URL used by the V6 cutover step 3 script (HOS-1745).
 *
 * `src/utils/env.ts` exposes `env` as an `export let` that is assigned inside
 * `validateApiEnv()`. Destructuring `env` out of the dynamic import captures the
 * `undefined` it holds at import time, so reading `env.HOSPEDA_DATABASE_URL`
 * afterwards throws. This module keeps the env module namespace whole and reads
 * `env` only after `validateApiEnv()` has populated it.
 */

/** The subset of the API env module this helper depends on. */
export interface Step3EnvModule {
    /** Validates the environment and populates the module's `env` binding. */
    readonly validateApiEnv: () => void;
    /** The validated environment, `undefined` until `validateApiEnv()` runs. */
    readonly env: { readonly HOSPEDA_DATABASE_URL: string } | undefined;
}

/** Input for {@link resolveStep3DatabaseUrl}. */
export interface ResolveStep3DatabaseUrlInput {
    /** Loads the API env module namespace, never a destructured copy of `env`. */
    readonly loadEnvModule: () => Promise<Step3EnvModule>;
}

/** Result of {@link resolveStep3DatabaseUrl}. */
export interface ResolveStep3DatabaseUrlResult {
    readonly databaseUrl: string;
}

/**
 * Validates the API environment and returns its database URL.
 * @remarks
 * The namespace is deliberately not destructured before validation: `env` is an
 * `export let` live binding, so a copy taken beforehand stays `undefined`.
 * Reading `envModule.env` after `validateApiEnv()` observes the value the
 * validator just assigned.
 * @throws Error when validation leaves `HOSPEDA_DATABASE_URL` unset.
 */
export async function resolveStep3DatabaseUrl(
    input: ResolveStep3DatabaseUrlInput
): Promise<ResolveStep3DatabaseUrlResult> {
    const envModule = await input.loadEnvModule();
    envModule.validateApiEnv();
    const databaseUrl = envModule.env?.HOSPEDA_DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('HOSPEDA_DATABASE_URL is not set after validateApiEnv()');
    }
    return { databaseUrl };
}
