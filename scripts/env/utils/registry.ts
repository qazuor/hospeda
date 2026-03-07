/**
 * Registry utilities for environment variable lookup and filtering.
 *
 * Re-exports `ENV_REGISTRY` from `@repo/config` and provides helper
 * functions to query the registry by variable name or app target.
 *
 * @module scripts/env/utils/registry
 */

import type { AppId, EnvVarDefinition } from '@repo/config';
import { ENV_REGISTRY } from '@repo/config';

export type { AppId, EnvVarDefinition };
export { ENV_REGISTRY };

/**
 * Returns the human-readable description for a registered environment variable.
 *
 * Falls back to `'No description available'` when the variable is not in
 * the registry (e.g. a framework-injected or undocumented var).
 *
 * @param name - Environment variable name (e.g. `HOSPEDA_API_URL`).
 * @returns Description string from the registry entry, or a fallback.
 *
 * @example
 * ```ts
 * getVarDescription('HOSPEDA_API_URL');
 * // 'API base URL'
 *
 * getVarDescription('UNKNOWN_VAR');
 * // 'No description available'
 * ```
 */
export function getVarDescription(name: string): string {
    const entry = ENV_REGISTRY.find((v) => v.name === name);
    return entry?.description ?? 'No description available';
}

/**
 * Returns all registry entries that are consumed by the given app.
 *
 * Filters `ENV_REGISTRY` to only those variables whose `apps` array
 * includes the provided `app` identifier.
 *
 * @param app - App identifier to filter by (e.g. `'api'`, `'web'`, `'admin'`).
 * @returns Readonly array of matching `EnvVarDefinition` entries.
 *
 * @example
 * ```ts
 * const apiVars = getVarsForApp('api');
 * apiVars.forEach(v => console.log(v.name));
 * ```
 */
export function getVarsForApp(app: AppId): readonly EnvVarDefinition[] {
    return ENV_REGISTRY.filter((v) => v.apps.includes(app));
}

/**
 * Returns the registry entry for the given variable name, or `undefined`.
 *
 * @param name - Environment variable name to look up.
 * @returns The matching `EnvVarDefinition`, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const def = findVar('HOSPEDA_DATABASE_URL');
 * if (def?.secret) {
 *   console.log('This is a secret variable');
 * }
 * ```
 */
export function findVar(name: string): EnvVarDefinition | undefined {
    return ENV_REGISTRY.find((v) => v.name === name);
}

/**
 * Returns all variable names that are required for the given app.
 *
 * @param app - App identifier to filter by.
 * @returns Array of required variable name strings.
 *
 * @example
 * ```ts
 * const required = getRequiredVarNamesForApp('api');
 * ```
 */
export function getRequiredVarNamesForApp(app: AppId): readonly string[] {
    return getVarsForApp(app)
        .filter((v) => v.required)
        .map((v) => v.name);
}
