/**
 * Social-automation Sentry feature tag middleware — SPEC-254 T-052.
 *
 * Tags every request handled by a social-automation route with
 * `feature: 'social-automation'`, so errors captured by the global
 * {@link sentryMiddleware} are grouped under a single searchable feature in
 * Sentry. The tag is applied at the social route mount-point prefixes (admin,
 * AI ingestion, Make callbacks) rather than on each of the 60+ route files,
 * keeping a single source of truth and following the existing middleware-based
 * tagging pattern (see `request_id` tagging in {@link sentryMiddleware}).
 *
 * @module middlewares/social-feature-tag
 */

import type { Context, Next } from 'hono';
import { Sentry } from '../lib/sentry';

/**
 * Creates the social-automation feature-tag middleware.
 *
 * Sets `Sentry.setTag('feature', 'social-automation')` on the active scope
 * before the route handler runs, so any exception captured downstream carries
 * the tag. No-op when Sentry is disabled.
 *
 * @returns A Hono middleware that tags the request scope.
 */
export function socialFeatureTagMiddleware() {
    return async (_c: Context, next: Next) => {
        if (Sentry.isEnabled()) {
            Sentry.setTag('feature', 'social-automation');
        }
        await next();
    };
}
