/**
 * Target environment resolution for `hops`.
 *
 * The toolkit runs the same commands against two environments: `prod` and
 * `staging`. Each environment has its own set of Coolify resources
 * (Postgres, Redis, api/web/admin apps). The target is resolved in this
 * order, first hit wins:
 *
 *   1. Global `--target=<env>` flag on the command line.
 *   2. `HOPS_DEFAULT_TARGET` env var in `.env.local`.
 *   3. Default: `prod` (keeps pre-split behaviour for commands that didn't
 *      pass a flag).
 *
 * Note: `HOPS_DEFAULT_TARGET` is intentionally distinct from `HOPS_TARGET`
 * (the latter is consumed by `install.sh` for the binary install path).
 *
 * Resource name resolution per (target, kind):
 *
 *   App containers (`api`, `web`, `admin`) use `coolify.resourceName`
 *   labels that follow `hospeda-<kind>-<target>` — stable, hardcoded.
 *
 *   Database containers (`postgres`, `redis`) use Coolify-generated UUIDs
 *   in their `coolify.resourceName` labels (`postgresql-database-<UUID>`
 *   / `redis-database-<UUID>`). UUIDs are stable per service but cannot
 *   be hardcoded since they differ between deployments. The operator
 *   provides them via env vars in `.env.local`:
 *
 *     HOPS_PROD_POSTGRES_UUID=yhhqnorqbtw2aslbxy64kjzd
 *     HOPS_STAGING_POSTGRES_UUID=qqwydyilhgifup0wsb2v27uq
 *     HOPS_PROD_REDIS_UUID=<...>
 *     HOPS_STAGING_REDIS_UUID=<...>
 */

import { get } from './env.ts';

/** Supported target environments. */
export type Target = 'prod' | 'staging';

const VALID_TARGETS: ReadonlyArray<Target> = ['prod', 'staging'];

/**
 * Hardcoded `coolify.resourceName` values for application containers.
 * App names are stable across deployments — the operator names them
 * once in Coolify UI when creating the app.
 */
const APP_RESOURCE_NAMES: Readonly<
    Record<Target, Readonly<Record<'api' | 'web' | 'admin', string>>>
> = {
    prod: {
        api: 'hospeda-api-prod',
        web: 'hospeda-web-prod',
        admin: 'hospeda-admin-prod'
    },
    staging: {
        api: 'hospeda-api-staging',
        web: 'hospeda-web-staging',
        admin: 'hospeda-admin-staging'
    }
};

/**
 * Result of parsing `--target=<env>` from argv. Returns the resolved
 * target plus argv with the flag stripped so commands see a clean argv.
 */
export interface TargetParseResult {
    readonly target: Target;
    readonly remainingArgv: ReadonlyArray<string>;
}

/**
 * Parse the global `--target=<env>` flag from argv and resolve the
 * effective target using the order documented at the top of this file.
 *
 * Accepted forms:
 *   --target=staging      (preferred — single token)
 *   --target staging      (two tokens)
 *
 * @throws when the value is present but not one of {@link VALID_TARGETS}.
 */
export function resolveTarget(argv: ReadonlyArray<string>): TargetParseResult {
    const remaining: string[] = [];
    let flagValue: string | undefined;

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--target') {
            flagValue = argv[i + 1];
            i += 1; // skip the value token
            continue;
        }
        if (token?.startsWith('--target=')) {
            flagValue = token.slice('--target='.length);
            continue;
        }
        if (token !== undefined) remaining.push(token);
    }

    const candidate = flagValue ?? get('HOPS_DEFAULT_TARGET') ?? 'prod';
    if (!isValidTarget(candidate)) {
        throw new Error(
            `Invalid target '${candidate}'. Valid values: ${VALID_TARGETS.join(', ')}. Set via --target=<env> or HOPS_DEFAULT_TARGET in .env.local.`
        );
    }
    return { target: candidate, remainingArgv: remaining };
}

/**
 * Type guard for {@link Target}.
 */
export function isValidTarget(value: string): value is Target {
    return (VALID_TARGETS as ReadonlyArray<string>).includes(value);
}

/**
 * Resolve the `coolify.resourceName` label value for an application
 * container of the given target. Stable across deployments.
 */
export function getAppResourceName(target: Target, kind: 'api' | 'web' | 'admin'): string {
    return APP_RESOURCE_NAMES[target][kind];
}

/**
 * Resolve the `coolify.resourceName` label value for a database
 * container of the given target. Reads the UUID from `.env.local`:
 *
 *   HOPS_<TARGET>_<KIND>_UUID  (e.g. HOPS_STAGING_POSTGRES_UUID)
 *
 * Returns the full Coolify resourceName: `<kind>-database-<UUID>`.
 *
 * @throws when the operator hasn't set the matching env var.
 */
export function getDbResourceName(target: Target, kind: 'postgres' | 'redis'): string {
    const envKey = `HOPS_${target.toUpperCase()}_${kind.toUpperCase()}_UUID`;
    const uuid = get(envKey);
    if (!uuid) {
        throw new Error(
            `${envKey} is not set in .env.local. Find the UUID in Coolify (the ${kind} service's container suffix or resourceName label) and add it. Example value shape: '${'x'.repeat(24)}'.`
        );
    }
    const prefix = kind === 'postgres' ? 'postgresql-database' : 'redis-database';
    return `${prefix}-${uuid}`;
}

/**
 * Default Postgres role + database name per target. The defaults match
 * how each environment was provisioned in Coolify:
 *
 *   prod    — bare-bones Postgres service with the built-in `postgres`
 *             superuser and `postgres` database (no custom values set
 *             when the service was first created).
 *   staging — created later with explicit user/db `hospeda_staging_user`
 *             / `hospeda_staging` to clarify which env is being used.
 *
 * Operators can override per target via env vars
 *   HOPS_<TARGET>_PG_USER / HOPS_<TARGET>_PG_DB
 * in `.env.local`. The legacy `PG_USER` / `PG_DB` env vars (without
 * target prefix) are also honoured for backwards compatibility but only
 * for prod.
 */
const DB_CREDENTIAL_DEFAULTS: Readonly<
    Record<Target, Readonly<{ user: string; database: string }>>
> = {
    prod: { user: 'postgres', database: 'postgres' },
    staging: { user: 'hospeda_staging_user', database: 'hospeda_staging' }
};

/**
 * Resolved Postgres credentials for a given target.
 */
export interface DbCredentials {
    readonly user: string;
    readonly database: string;
}

/**
 * Resolve the Postgres role + database name for the given target. Reads
 * env var overrides first, then falls back to the defaults documented in
 * {@link DB_CREDENTIAL_DEFAULTS}.
 */
export function getDbCredentials(target: Target): DbCredentials {
    const upper = target.toUpperCase();
    const targetedUser = get(`HOPS_${upper}_PG_USER`);
    const targetedDb = get(`HOPS_${upper}_PG_DB`);

    // Legacy PG_USER / PG_DB only apply to prod (back-compat with the
    // pre-target-flag world where there was a single environment).
    const legacyUser = target === 'prod' ? get('PG_USER') : undefined;
    const legacyDb = target === 'prod' ? get('PG_DB') : undefined;

    return {
        user: targetedUser ?? legacyUser ?? DB_CREDENTIAL_DEFAULTS[target].user,
        database: targetedDb ?? legacyDb ?? DB_CREDENTIAL_DEFAULTS[target].database
    };
}
