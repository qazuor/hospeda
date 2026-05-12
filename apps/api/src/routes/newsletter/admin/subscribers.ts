/**
 * @file admin/subscribers.ts
 *
 * Admin subscriber endpoints (SPEC-101 T-101-26).
 *
 *   GET /api/v1/admin/newsletter/subscribers
 *       Paginated list of newsletter subscribers with status / locale /
 *       source / channel filters and email substring search (safeIlike at
 *       the service layer — never raw ilike).
 *
 *   GET /api/v1/admin/newsletter/subscribers/stats
 *       Aggregated counts per lifecycle status. Used by the admin
 *       dashboard tile so the admin sees the funnel at a glance.
 *
 * Both require the `NEWSLETTER_SUBSCRIBER_VIEW` permission.
 *
 * The list endpoint piggy-backs on `createAdminListRoute` which already
 * auto-merges `PaginationQuerySchema` and rejects unknown query params.
 * Service-side soft-cap for query: 255-character `emailSearch`.
 */

import {
    NewsletterSubscriberAdminSearchSchema,
    NewsletterSubscriberSchema,
    NewsletterSubscriberStatsResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import type { NewsletterSubscriberAdminSearch } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { getDefaultNewsletterService } from '../protected/_singletons';

/**
 * GET /api/v1/admin/newsletter/subscribers
 * Paginated admin list with filters.
 */
export const adminListSubscribersRoute = createAdminListRoute({
    method: 'get',
    path: '/subscribers',
    summary: 'List newsletter subscribers (admin)',
    description:
        'Paginated list of newsletter subscribers. Supports filters by status, locale, channel, source, and partial-email substring search. Email search uses safeIlike at the service layer so the user-supplied pattern cannot inject LIKE metacharacters.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW],
    requestQuery: NewsletterSubscriberAdminSearchSchema.omit({
        page: true,
        pageSize: true
    }).shape,
    responseSchema: NewsletterSubscriberSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Parse through Zod so every base-search default (sort, status,
        // includeDeleted) is materialised before the service receives it.
        const validated: NewsletterSubscriberAdminSearch =
            NewsletterSubscriberAdminSearchSchema.parse({
                ...(query ?? {}),
                page,
                pageSize
            });

        const result = await getDefaultNewsletterService().adminList(actor, validated);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});

/**
 * GET /api/v1/admin/newsletter/subscribers/stats
 * Aggregated counts per lifecycle status.
 */
export const adminSubscribersStatsRoute = createAdminRoute({
    method: 'get',
    path: '/subscribers/stats',
    summary: 'Newsletter subscribers stats (admin)',
    description:
        'Returns a single object with the count of subscribers per lifecycle status: totalActive, totalPending, totalUnsubscribed, totalBounced, totalComplained. One COUNT(*) FILTER query under the hood — cheap to call.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW],
    responseSchema: NewsletterSubscriberStatsResponseSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);
        const result = await getDefaultNewsletterService().getStats(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
