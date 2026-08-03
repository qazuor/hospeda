import type { CacheTagEnvironment } from '@repo/cache-tags';
import { resolveCacheTagEnvironment } from '@repo/cache-tags';
import { createLogger } from '@repo/logger';
import { createRevalidationAdapter } from './adapters/adapter-factory.js';
import { NoOpRevalidationAdapter } from './adapters/noop-revalidation.adapter.js';
import type { EntityResolver, RevalidationServiceConfig } from './revalidation.service.js';
import { RevalidationService } from './revalidation.service.js';

const logger = createLogger('revalidation-init');

let _instance: RevalidationService | undefined;

/** Parameters for initializing the revalidation service singleton */
export interface InitRevalidationParams {
    /** Node.js environment (e.g. 'production', 'staging', 'development', 'test') */
    readonly nodeEnv?: string;
    /**
     * Revalidation shared secret (HOSPEDA_REVALIDATION_SECRET).
     * Required to activate the Cloudflare cache-purge adapter in non-local
     * environments. Must match the secret configured on the web app.
     */
    readonly revalidationSecret?: string;
    /**
     * Base site URL (e.g. `https://hospeda.com.ar`).
     * Used to build the cache-purge request URL (`${siteUrl}/api/revalidate`).
     */
    readonly siteUrl: string;
    /**
     * Debounce window in milliseconds for hook-triggered revalidations.
     * Overridden per-entity-type by the `revalidation_config` DB table.
     * Defaults to 30000 ms (30 seconds).
     */
    readonly debounceMs?: number;
    /**
     * Number of days to retain revalidation log entries before cleanup.
     * Used by the cron job to delete old log entries.
     * Defaults to 30.
     */
    readonly logRetentionDays?: number;
    /**
     * Optional entity resolver for looking up published entities from the database.
     * When provided, enables entity-level revalidation that queries individual
     * entity detail pages instead of only generic listing pages.
     * Typically created in the API layer using {@link createEntityResolver}.
     */
    readonly entityResolver?: EntityResolver;
    /**
     * Raw `HOSPEDA_DEPLOY_ENV` — the deployment identity every purged cache tag
     * is namespaced by (HOS-369 W1-2).
     *
     * Passed as the RAW string rather than a resolved value on purpose: the
     * resolution rules (including which fallbacks are refused) live in
     * `resolveCacheTagEnvironment`, the single function the web app also calls.
     * Two copies of those rules is exactly the divergence that makes a purge
     * evict nothing while reporting success.
     */
    readonly deployEnv?: string;
}

/**
 * Initialize the {@link RevalidationService} singleton.
 *
 * Call once at API startup. If the singleton already exists, a warning is logged
 * and the existing instance is returned without applying new parameters.
 *
 * @param params - Initialization parameters including environment, secret, and site URL
 * @returns The initialized RevalidationService instance
 *
 * @example
 * ```ts
 * const service = initializeRevalidationService({
 *   nodeEnv: process.env.NODE_ENV,
 *   revalidationSecret: process.env.HOSPEDA_REVALIDATION_SECRET,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 *   deployEnv: process.env.HOSPEDA_DEPLOY_ENV,
 * });
 * ```
 */
export function initializeRevalidationService(params: InitRevalidationParams): RevalidationService {
    if (_instance !== undefined) {
        logger.warn(
            `[RevalidationService] Already initialized — ignoring new params (siteUrl: ${params.siteUrl})`
        );
        return _instance;
    }

    // Resolved BEFORE the adapter is chosen. A deployment that cannot name
    // itself must not be given a live Cloudflare adapter: staging and
    // production share one zone, so an unnamespaced or mis-namespaced purge is
    // not a degraded purge, it is a purge of the wrong environment. Fail closed
    // — same shape as the missing-secret path in `createRevalidationAdapter`,
    // which also disables invalidation rather than guessing (HOS-369 W1-2).
    let cacheTagEnvironment: CacheTagEnvironment | undefined;
    try {
        cacheTagEnvironment = resolveCacheTagEnvironment({
            deployEnv: params.deployEnv,
            nodeEnv: params.nodeEnv
        });
    } catch (error) {
        logger.error(
            `Cache revalidation DISABLED: cannot resolve the cache-tag namespace. ${error instanceof Error ? error.message : String(error)}`
        );
    }

    const adapter =
        cacheTagEnvironment === undefined
            ? new NoOpRevalidationAdapter()
            : createRevalidationAdapter({
                  nodeEnv: params.nodeEnv ?? '',
                  revalidationSecret: params.revalidationSecret,
                  siteUrl: params.siteUrl
              });

    const config: RevalidationServiceConfig = {
        adapter,
        cacheTagEnvironment,
        debounceMs: params.debounceMs,
        logRetentionDays: params.logRetentionDays,
        entityResolver: params.entityResolver
    };

    _instance = new RevalidationService(config);
    return _instance;
}

/**
 * Returns the initialized {@link RevalidationService} singleton.
 * Returns `undefined` if {@link initializeRevalidationService} has not been called yet.
 *
 * @returns The RevalidationService singleton or undefined
 */
export function getRevalidationService(): RevalidationService | undefined {
    return _instance;
}

/**
 * Resets the singleton. Use only in tests for isolation between test cases.
 *
 * @internal Use only in tests
 */
export function _resetRevalidationService(): void {
    _instance = undefined;
}
