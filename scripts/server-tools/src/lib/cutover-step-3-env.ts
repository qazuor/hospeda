/**
 * Child environment and deployed-SHA resolution for `hops cutover-step-3`.
 *
 * The wrapped cutover script runs on the VPS host but validates the api's full
 * runtime environment, so its child env is rebuilt from the api container's
 * `Config.Env` entries. This module owns that filter and the fallback that
 * reads the deployed commit from either `HOSPEDA_COMMIT_SHA` or Coolify's
 * `SOURCE_COMMIT`. Everything here is pure: no process, no Docker, no I/O.
 */

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
 * else from the host is forwarded — in particular no `HOSPEDA_*` or `API_*`
 * key, so a host value can never shadow the container's.
 */
export const STEP3_HOST_ENV_ALLOWLIST = ['PATH', 'HOME', 'LANG'] as const;

/**
 * Container key prefixes that are forwarded to the child.
 *
 * `API_*` carries the api's validated surface (`API_CORS_ORIGINS` and friends);
 * `HOSPEDA_*` carries its database and auth secrets. Without the `API_*` half
 * the schema falls back to a localhost CORS origin, which the api rejects
 * whenever `NODE_ENV=production`.
 */
export const STEP3_CONTAINER_ENV_PREFIXES = ['API_', 'HOSPEDA_'] as const;

/**
 * Exact container keys that are forwarded to the child.
 *
 * `NODE_ENV` selects the api's production checks and `PORT` is part of the
 * container's runtime surface the owner asked to keep; both are matched
 * exactly, so near-misses such as `PORTAL` or `PORT_X` never pass.
 */
export const STEP3_CONTAINER_ENV_EXACT_KEYS = ['NODE_ENV', 'PORT'] as const;

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
 * `NODE_VERSION`, `SOURCE_COMMIT`, image-specific values) must never leak:
 * overriding `PATH` with the container's would point the host process at the
 * container's filesystem. The container contributes exactly
 * {@link STEP3_CONTAINER_ENV_EXACT_KEYS} and every key starting with one of
 * {@link STEP3_CONTAINER_ENV_PREFIXES} — the `API_*` half is required because
 * the api's `API_CORS_ORIGINS` default points at localhost, which its env
 * validation rejects in production. The closed host allowlist in
 * {@link STEP3_HOST_ENV_ALLOWLIST} lets `pnpm`/`node` start; a host
 * `HOSPEDA_*` or `API_*` never enters — the container value always wins — and
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
        const exact = STEP3_CONTAINER_ENV_EXACT_KEYS.some((candidate) => candidate === key);
        const prefixed = STEP3_CONTAINER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
        if (!exact && !prefixed) continue;
        env[key] = entry.slice(separator + 1);
    }
    for (const key of STEP3_HOST_ENV_ALLOWLIST) {
        const value = input.hostEnv[key];
        if (value !== undefined) env[key] = value;
    }
    env.HOSPEDA_DATABASE_URL = input.databaseUrl;
    return env;
}

/** Input for {@link resolveDeployedSha}. */
export interface ResolveDeployedShaInput {
    /** `Config.Env` entries from the target's api container. */
    readonly containerEnv: ReadonlyArray<string>;
}

/**
 * A value is usable only when it is not blank and not the api schema's
 * `unknown` default (matched case-insensitively).
 *
 * @param value - Raw environment value, when the key exists.
 * @returns `true` when the value identifies a commit.
 */
function isUsableSha(value: string | undefined): value is string {
    if (value === undefined) return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.toLowerCase() !== 'unknown';
}

/**
 * Resolve the commit the target api container is actually running.
 *
 * `HOSPEDA_COMMIT_SHA` is authoritative: a usable value always wins, even
 * when `SOURCE_COMMIT` is also set. Staging ships the variable defined but
 * EMPTY, so the guard falls back to Coolify's `SOURCE_COMMIT` — the same SHA
 * the image bakes into `HOSPEDA_SENTRY_RELEASE`. Values that are blank, only
 * whitespace or `unknown` are not usable; when neither variable is usable the
 * result is `undefined` and the caller must refuse the run.
 *
 * @param input - `Config.Env` entries from the target's api container.
 * @returns The deployed SHA, trimmed, or `undefined` when unverifiable.
 */
export function resolveDeployedSha(input: ResolveDeployedShaInput): string | undefined {
    const candidates = [
        readContainerEnvValue({ containerEnv: input.containerEnv, key: 'HOSPEDA_COMMIT_SHA' }),
        readContainerEnvValue({ containerEnv: input.containerEnv, key: 'SOURCE_COMMIT' })
    ];
    const found = candidates.find((value) => isUsableSha(value));
    return found === undefined ? undefined : found.trim();
}
