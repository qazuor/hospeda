import { createLogger } from '@repo/logger';
import { CloudflareRevalidationAdapter } from './cloudflare-revalidation.adapter.js';
import { NoOpRevalidationAdapter } from './noop-revalidation.adapter.js';
import type { RevalidationAdapter } from './revalidation.adapter.js';

const logger = createLogger('revalidation-adapter-factory');

/**
 * Parameters for {@link createRevalidationAdapter}.
 */
export interface AdapterFactoryParams {
    /** Node.js environment (e.g. 'production', 'staging', 'development', 'test') */
    readonly nodeEnv: string;
    /**
     * Revalidation shared secret — required to activate the Cloudflare adapter.
     * When absent or empty, the no-op adapter is returned regardless of environment.
     * Must match `HOSPEDA_REVALIDATION_SECRET` on the web app.
     */
    readonly revalidationSecret?: string;
    /** Base site URL forwarded to the adapter (e.g. `https://hospeda.com.ar`) */
    readonly siteUrl: string;
}

/**
 * Creates the appropriate {@link RevalidationAdapter} based on environment.
 *
 * Returns {@link CloudflareRevalidationAdapter} when:
 *  - `revalidationSecret` is non-empty, AND
 *  - `nodeEnv` is NOT `'development'` or `'test'` (works in staging and production)
 *
 * Returns {@link NoOpRevalidationAdapter} in all other cases
 * (development, test, or missing secret).
 *
 * @param params - Factory configuration including environment, secret, and site URL
 * @returns The adapter appropriate for the current environment
 *
 * @example
 * ```ts
 * const adapter = createRevalidationAdapter({
 *   nodeEnv: process.env.NODE_ENV,
 *   revalidationSecret: process.env.HOSPEDA_REVALIDATION_SECRET,
 *   siteUrl: process.env.HOSPEDA_SITE_URL,
 * });
 * ```
 */
export function createRevalidationAdapter(params: AdapterFactoryParams): RevalidationAdapter {
    const { nodeEnv, revalidationSecret, siteUrl } = params;

    const isNonLocalEnv = nodeEnv !== 'development' && nodeEnv !== 'test';
    const hasSecret = Boolean(revalidationSecret);

    if (isNonLocalEnv && hasSecret) {
        return new CloudflareRevalidationAdapter({
            secret: revalidationSecret as string,
            siteUrl
        });
    }

    if (isNonLocalEnv && !hasSecret) {
        logger.warn('Cache revalidation DISABLED: missing HOSPEDA_REVALIDATION_SECRET');
    }

    return new NoOpRevalidationAdapter();
}
