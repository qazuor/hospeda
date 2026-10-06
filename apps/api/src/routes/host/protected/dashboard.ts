/**
 * Host Dashboard Protected Endpoint
 *
 * Single aggregation endpoint returning property counts, null plan info,
 * and unread conversation count for the authenticated host user.
 *
 * Dashboard reads run without the former stats plan entitlement during the billing transition.
 *
 * GET /api/v1/protected/host/dashboard
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { AccommodationService, ConversationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';

/**
 * Host dashboard aggregated response schema.
 * Property counts, plan info, and unread conversation count.
 */
export const HostDashboardResponseSchema = z.object({
    properties: z.object({
        total: z.number().int().min(0),
        published: z.number().int().min(0),
        draft: z.number().int().min(0),
        archived: z.number().int().min(0)
    }),
    plan: z
        .object({
            slug: z.string(),
            name: z.string(),
            status: z.enum(['active', 'trial', 'cancelled', 'expired', 'past_due']),
            isTrial: z.boolean()
        })
        .nullable(),
    unreadConversations: z.number().int().min(0)
});

export type HostDashboardResponse = z.infer<typeof HostDashboardResponseSchema>;

/** Plan info sub-shape of the dashboard response. */
type HostDashboardPlan = NonNullable<HostDashboardResponse['plan']>;

/** Property counts sub-shape of the dashboard response. */
type HostDashboardProperties = HostDashboardResponse['properties'];

/** Zeroed property counts used as the safe degradation default. */
const ZERO_PROPERTIES: HostDashboardProperties = {
    total: 0,
    published: 0,
    draft: 0,
    archived: 0
};

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Resolve property counts for the given owner, grouped by lifecycle state.
 *
 * FAIL-SAFE: any service failure degrades to zeroed counts (the dashboard
 * must never 500 on a sub-service hiccup). The returned `accommodationIds`
 * feed the unread-conversations lookup.
 *
 * @param input - `{ actor }` whose `id` is the ownerId to scope by.
 * @returns `{ properties, accommodationIds }`.
 */
async function resolveProperties(input: {
    actor: Actor;
}): Promise<{ properties: HostDashboardProperties; accommodationIds: string[] }> {
    const { actor } = input;
    try {
        const result = await accommodationService.getByOwner({ ownerId: actor.id }, actor);

        if (result.error || !result.data) {
            apiLogger.warn(
                { actorId: actor.id, error: result.error?.code },
                'Host dashboard: getByOwner returned an error — degrading properties to zero'
            );
            return { properties: ZERO_PROPERTIES, accommodationIds: [] };
        }

        const list = result.data.accommodations;
        const accommodationIds = list.map((item) => item.id);

        const published = list.filter(
            (item) => item.lifecycleState === LifecycleStatusEnum.ACTIVE
        ).length;
        const draft = list.filter(
            (item) => item.lifecycleState === LifecycleStatusEnum.DRAFT
        ).length;
        const archived = list.filter(
            (item) => item.lifecycleState === LifecycleStatusEnum.ARCHIVED
        ).length;

        return {
            // INACTIVE is counted in `total` but has no dedicated field.
            properties: { total: list.length, published, draft, archived },
            accommodationIds
        };
    } catch (error) {
        apiLogger.warn(
            { actorId: actor.id, error: String(error) },
            'Host dashboard: getByOwner threw — degrading properties to zero'
        );
        return { properties: ZERO_PROPERTIES, accommodationIds: [] };
    }
}

/**
 * The plan section was removed with the legacy billing system (HOS-1416);
 * the response field stays (nullable) so the client contract does not break
 * and always reads null now.
 */
const DASHBOARD_PLAN: HostDashboardPlan | null = null;

/**
 * Resolve the coarse unread-conversations count for the owner.
 *
 * FAIL-SAFE: any failure or an empty accommodation set resolves to `0`.
 *
 * NOTE: `getUnreadCount` is a documented "coarse" count — it counts
 * conversations with any activity, not strictly conversations where
 * `lastReadAt < lastActivityAt`. This is an accepted approximation for
 * the dashboard badge (see ConversationService.getUnreadCount JSDoc).
 *
 * @param input - `{ actor, accommodationIds }`.
 * @returns The unread conversation count (>= 0).
 */
async function resolveUnreadConversations(input: {
    actor: Actor;
    accommodationIds: string[];
}): Promise<number> {
    const { actor, accommodationIds } = input;
    if (accommodationIds.length === 0) {
        return 0;
    }
    try {
        const conversationService = new ConversationService(
            { logger: apiLogger },
            {
                authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
                siteUrl: env.HOSPEDA_SITE_URL
            }
        );

        const result = await conversationService.getUnreadCount(actor, {
            actorId: actor.id,
            actorSide: 'OWNER',
            accommodationIds
        });

        if (result.error || !result.data) {
            apiLogger.warn(
                { actorId: actor.id, error: result.error?.code },
                'Host dashboard: getUnreadCount returned an error — degrading to zero'
            );
            return 0;
        }

        return result.data.count;
    } catch (error) {
        apiLogger.warn(
            { actorId: actor.id, error: String(error) },
            'Host dashboard: getUnreadCount threw — degrading to zero'
        );
        return 0;
    }
}

/**
 * GET /api/v1/protected/host/dashboard
 *
 * Returns aggregated host dashboard data:
 * - Property counts (total, published, draft, archived) scoped to the owner
 * - Plan info: always null since HOS-1416 (legacy billing removed)
 * - Unread conversations count (coarse approximation)
 *
 * Robustness: each of the three sections is independently guarded and
 * degrades to safe defaults rather than failing the whole request. The
 * endpoint only errors on auth/entitlement (handled by middleware).
 */
export const hostDashboardRoute = createProtectedRoute({
    method: 'get',
    path: '/dashboard',
    summary: 'Host Dashboard',
    description:
        'Returns aggregated host dashboard data: property counts, plan info, and unread conversation count. ' +
        'Requires VIEW_BASIC_STATS entitlement.',
    tags: ['Host', 'Dashboard'],
    responseSchema: HostDashboardResponseSchema,
    handler: async (ctx: Context, _params: Record<string, unknown>) => {
        try {
            const actor = getActorFromContext(ctx);
            apiLogger.debug({ actorId: actor.id, roles: actor.roles }, 'Host dashboard requested');

            // Section 1: property counts (owns its degradation, also yields the
            // accommodation IDs the conversations count needs).
            const { properties, accommodationIds } = await resolveProperties({ actor });

            // Section 2 (plan) was removed with the legacy billing system
            // (HOS-1416); the field always reads null now.
            const unreadConversations = await resolveUnreadConversations({
                actor,
                accommodationIds
            });

            const response: HostDashboardResponse = {
                properties,
                // HOS-1352: transitional until V3 (HOS-1357), see PR — dashboard plan stays null.
                plan: DASHBOARD_PLAN,
                unreadConversations
            };

            return response;
        } catch (error) {
            // Only reached on an unexpected failure outside the guarded
            // sections (e.g. actor resolution). The three data sections never
            // throw — they degrade to safe defaults.
            apiLogger.error({ error: String(error) }, 'Host dashboard handler failed');
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to load host dashboard data'
            );
        }
    },
    options: {}
});
