/**
 * @fileoverview
 * Chooses the IndexNow adapter for the current deployment (HOS-585 G-1).
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import { createLogger } from '@repo/logger';
import { HttpIndexNowAdapter } from './http-indexnow.adapter.js';
import type { IndexNowAdapter } from './indexnow.adapter.js';
import { NoOpIndexNowAdapter } from './noop-indexnow.adapter.js';

const logger = createLogger('indexnow-adapter-factory');

/** Parameters for {@link createIndexNowAdapter}. */
export interface IndexNowAdapterFactoryParams {
    /**
     * The resolved deployment environment. Only `'prod'` gets a live adapter.
     */
    readonly cacheTagEnvironment?: CacheTagEnvironment;
    /** Shared secret matching `HOSPEDA_REVALIDATION_SECRET` on the web app. */
    readonly revalidationSecret?: string;
    /** Base site URL forwarded to the adapter. */
    readonly siteUrl?: string;
}

/**
 * Create the {@link IndexNowAdapter} appropriate for this deployment.
 *
 * Returns a live adapter ONLY when the environment resolves to `'prod'` and
 * both the secret and site URL are configured. Everything else gets the no-op.
 *
 * **This gate is deliberately stricter than the revalidation one.** That factory
 * activates on staging too, correctly — staging has its own Cloudflare cache
 * that genuinely needs purging. Notifying search engines is different in kind:
 * staging serves `Disallow: /`, so a submission from there would advertise URLs
 * the same deployment tells crawlers to ignore. There is no "degraded but
 * useful" version of that, so anything short of production sends nothing.
 *
 * The web endpoint enforces the same rule independently by refusing on any
 * noindex host. Two gates, because this one depends on an env var being set
 * correctly and the other does not.
 *
 * @param params - Environment and connection configuration.
 * @returns The adapter appropriate for this deployment.
 */
export function createIndexNowAdapter(params: IndexNowAdapterFactoryParams): IndexNowAdapter {
    const { cacheTagEnvironment, revalidationSecret, siteUrl } = params;

    if (cacheTagEnvironment !== 'prod') {
        return new NoOpIndexNowAdapter();
    }

    if (!revalidationSecret || !siteUrl) {
        logger.warn(
            'IndexNow notification DISABLED in production: missing HOSPEDA_REVALIDATION_SECRET or HOSPEDA_SITE_URL'
        );
        return new NoOpIndexNowAdapter();
    }

    return new HttpIndexNowAdapter({ secret: revalidationSecret, siteUrl });
}
