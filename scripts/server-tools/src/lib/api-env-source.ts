/**
 * Where the cutover wrappers read the api environment from (HOS-1962).
 *
 * `hops cutover-verify` and the step 3 / 3b / 4c / 5b wrappers need the
 * target api's `HOSPEDA_*` / `API_*` surface. The api container is the
 * natural source, but the cutover deliberately passes through a window with
 * the api STOPPED (Coolify removes the container), and the wrappers must keep
 * working then. When no running container belongs to the target, the same
 * variables are read from the Coolify API instead, where the container's
 * environment comes from in the first place.
 *
 * Only the "nothing running for this target" case falls back. Ambiguity
 * (2+ containers for one label) and every other docker failure still abort:
 * the fallback must never paper over a state that needs a human.
 *
 * Everything here talks to injected ports, so it is unit-testable without a
 * docker daemon or network. Values are held in memory and never logged.
 *
 * @module lib/api-env-source
 */

import { ContainerNotRunningError } from './container-lookup.ts';
import type { CoolifyApplication, CoolifyEnvVar } from './coolify.ts';

/** Narrow view of the Coolify client the env source needs. */
export interface CoolifyEnvPort {
    readonly listApplications: () => Promise<ReadonlyArray<CoolifyApplication>>;
    readonly listEnvVars: (applicationUuid: string) => Promise<ReadonlyArray<CoolifyEnvVar>>;
}

/**
 * Resolve a Coolify application UUID by its exact name, WITHOUT looking at
 * any container. The name is the `coolify.resourceName` the toolkit already
 * uses to identify the target's app (`hospeda-api-prod`, ...).
 *
 * @throws when no application, or more than one, carries that name.
 */
export async function resolveAppUuidByName(input: {
    readonly coolify: Pick<CoolifyEnvPort, 'listApplications'>;
    readonly resourceName: string;
}): Promise<string> {
    const apps = await input.coolify.listApplications();
    const matches = apps.filter((app) => app.name === input.resourceName);
    const [only, ...others] = matches;
    if (only === undefined) {
        throw new Error(
            `Coolify has no application named '${input.resourceName}'. Check the app name in Coolify matches the toolkit's resource name.`
        );
    }
    if (others.length > 0) {
        throw new Error(
            `Coolify has ${matches.length} applications named '${input.resourceName}', refusing to pick one: ${matches.map((m) => m.uuid).join(', ')}.`
        );
    }
    return only.uuid;
}

/**
 * Convert Coolify env-var rows to `KEY=VALUE` entries, the same shape as a
 * container's `Config.Env`. Only the production (non-preview) slot is read;
 * rows without a value (empty, or hidden because the token lacks
 * `read:sensitive`) are skipped.
 */
export function coolifyEnvToEntries(vars: ReadonlyArray<CoolifyEnvVar>): ReadonlyArray<string> {
    const byKey = new Map<string, string>();
    for (const row of vars) {
        if (row.is_preview) continue;
        if (typeof row.value !== 'string' || row.value === '') continue;
        byKey.set(row.key, row.value);
    }
    return [...byKey].map(([key, value]) => `${key}=${value}`);
}

/** Outcome of {@link resolveApiEnv}. */
export interface ResolvedApiEnv {
    /** `KEY=VALUE` entries of the api environment. */
    readonly entries: ReadonlyArray<string>;
    /** Where they came from. `coolify` means the api container is not running. */
    readonly source: 'container' | 'coolify';
}

/**
 * Read the target api's environment: from the running container when there
 * is one, from the Coolify API when none is running for the target.
 *
 * @param input - `readFromContainer` resolves the container and inspects its
 * env (throwing {@link ContainerNotRunningError} when none runs for the
 * target); `coolify` and `resourceName` drive the fallback.
 * @throws on ambiguity, on any non-"not running" failure, and when the
 * fallback yields no variables at all (token without `read:sensitive`).
 */
export async function resolveApiEnv(input: {
    readonly readFromContainer: () => Promise<ReadonlyArray<string>>;
    readonly coolify: () => CoolifyEnvPort;
    readonly resourceName: string;
    readonly warn: (message: string) => void;
}): Promise<ResolvedApiEnv> {
    try {
        return { entries: await input.readFromContainer(), source: 'container' };
    } catch (err) {
        if (!(err instanceof ContainerNotRunningError)) throw err;
        input.warn(
            `The api container of '${input.resourceName}' is not running; reading its environment from Coolify instead.`
        );
    }

    const coolify = input.coolify();
    const uuid = await resolveAppUuidByName({ coolify, resourceName: input.resourceName });
    const entries = coolifyEnvToEntries(await coolify.listEnvVars(uuid));
    if (entries.length === 0) {
        throw new Error(
            `Coolify returned no environment values for '${input.resourceName}'. The API token needs the read:sensitive scope to read them.`
        );
    }
    return { entries, source: 'coolify' };
}
