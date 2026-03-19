import { createLogger } from '@repo/logger';
import { createRevalidationAdapter } from './adapters/adapter-factory.js';
import { RevalidationService } from './revalidation.service.js';
import type { EntityResolver, RevalidationServiceConfig } from './revalidation.service.js';

const logger = createLogger('revalidation-init');

let _instance: RevalidationService | undefined;

/** Parameters for initializing the revalidation service singleton */
export interface InitRevalidationParams {
    /** Node.js environment (e.g. 'production', 'staging', 'development', 'test') */
    readonly nodeEnv?: string;
    /**
     * Revalidation bypass token (HOSPEDA_ISR_BYPASS_TOKEN).
     * Required to activate the Vercel adapter in non-local environments.
     */
    readonly revalidationSecret?: string;
    /**
     * Base site URL (e.g. `https://hospeda.com.ar`).
     * Used by the Vercel adapter to build revalidation request URLs.
     */
    readonly siteUrl: string;
    /**
     * Debounce window in milliseconds for hook-triggered revalidations.
     * Overridden per-entity-type by the `revalidation_config` DB table.
     * Defaults to 30000 ms (30 seconds).
     */
    readonly debounceMs?: number;
    /**
     * Supported locales for URL path generation.
     * Used by getAffectedPaths to generate locale-prefixed paths.
     * Should match the locales supported by the web app.
     */
    readonly locales: ReadonlyArray<string>;
    /**
     * Maximum number of entity types to revalidate per cron job run.
     * Prevents runaway revalidation in large deployments.
     * Defaults to 500.
     */
    readonly maxCronRevalidations?: number;
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
 *   revalidationSecret: process.env.HOSPEDA_ISR_BYPASS_TOKEN,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
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

    const adapter = createRevalidationAdapter({
        nodeEnv: params.nodeEnv ?? '',
        revalidationSecret: params.revalidationSecret,
        siteUrl: params.siteUrl
    });

    const config: RevalidationServiceConfig = {
        adapter,
        debounceMs: params.debounceMs,
        locales: params.locales,
        maxCronRevalidations: params.maxCronRevalidations,
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
