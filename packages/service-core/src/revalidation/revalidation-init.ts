import { createLogger } from '@repo/logger';
import { createRevalidationAdapter } from './adapters/adapter-factory.js';
import { RevalidationService } from './revalidation.service.js';
import type { RevalidationServiceConfig } from './revalidation.service.js';

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
     * Defaults to 5000 ms.
     */
    readonly debounceMs?: number;
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
        debounceMs: params.debounceMs
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
