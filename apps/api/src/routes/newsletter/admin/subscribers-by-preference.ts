/**
 * @file admin/subscribers-by-preference.ts
 *
 * Admin newsletter subscriber preference stats endpoint — SPEC-155 T-007.
 *
 *   GET /api/v1/admin/newsletter/subscribers/by-preference
 *       Returns a fixed-shape JSON object with the count of ACTIVE
 *       (non-deleted) newsletter subscribers that have each content-type
 *       preference opt-in set to `true` in the JSONB
 *       `newsletter_subscribers.preferences` column.
 *
 *       Response shape:
 *         { OFFERS: number, EVENTS: number, GUIDES: number, PRODUCT_NEWS: number }
 *
 *       Keys use UPPER_SNAKE naming matching the `NewsletterContentTypeEnum`
 *       member names so clients can reference them without a mapping table.
 *
 * Requires `NEWSLETTER_SUBSCRIBER_VIEW` permission.
 *
 * The endpoint is intentionally cheap to call — a single SQL query with four
 * independent `COUNT(*) FILTER` clauses (one per preference key) runs as a
 * single round-trip at the service layer.
 *
 * @module routes/newsletter/admin/subscribers-by-preference
 * @see SPEC-155 T-007
 */

import { NewsletterSubscribersByPreferenceSchema, PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from '../protected/_singletons';

/** Lazy singleton for the newsletter subscriber service. */
const newsletterService = (() => {
    let instance: ReturnType<typeof getDefaultNewsletterService> | null = null;
    return () => {
        if (!instance) {
            instance = getDefaultNewsletterService();
        }
        return instance;
    };
})();

/**
 * GET /api/v1/admin/newsletter/subscribers/by-preference
 *
 * Aggregated per-content-preference opt-in counts for ACTIVE subscribers.
 *
 * Returns a single fixed-shape object (not paginated). Gated on
 * `NEWSLETTER_SUBSCRIBER_VIEW`. Cheap to call — one DB round-trip.
 */
export const adminSubscribersByPreferenceRoute = createAdminRoute({
    method: 'get',
    path: '/subscribers/by-preference',
    summary: 'Newsletter subscribers by content preference (admin)',
    description:
        'Returns the count of ACTIVE (non-deleted) subscribers with each content-type ' +
        'preference opt-in set to true: OFFERS, EVENTS, GUIDES, PRODUCT_NEWS. ' +
        'Counts are independent — a subscriber is included for every preference they ' +
        'have enabled. One SQL query, no pagination.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW],
    responseSchema: NewsletterSubscribersByPreferenceSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await newsletterService().getStatsByPreference(actor);

        if (result.error) {
            apiLogger.error('getStatsByPreference failed', result.error);
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
