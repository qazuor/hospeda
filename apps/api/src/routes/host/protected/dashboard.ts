/**
 * Host Dashboard Protected Endpoint
 *
 * Single aggregation endpoint returning property counts, plan info,
 * and unread conversation count for the authenticated host user.
 *
 * Dashboard statistics require the owner's effective view_basic_stats capability.
 *
 * GET /api/v1/protected/host/dashboard
 */

import {
    OwnPlanStatusSchema,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import {
    AccommodationService,
    ConversationService,
    readOwnPlanState,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { getClock } from '../../../utils/clock';
import { env } from '../../../utils/env';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
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
            /** Coarse legacy status, kept for existing consumers (mobile). */
            status: z.enum(['active', 'trial', 'cancelled', 'expired', 'past_due']),
            /** Exact status of the live principal subscription (HOS-2543). */
            subscriptionStatus: OwnPlanStatusSchema,
            /** ISO end of service; set for a scheduled cancellation, `null` otherwise. */
            serviceEndsAt: z.string().nullable(),
            isTrial: z.boolean()
        })
        .nullable(),
    unreadConversations: z.number().int().min(0),
    /**
     * Sections whose numbers are a zero FALLBACK because their read failed
     * (HOS-2424). The numeric fields stay present for contract compatibility,
     * but a client must show these as "not available", never as a real 0.
     */
    unavailable: z.array(z.enum(['properties', 'unreadConversations']))
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
async function resolveProperties(input: { actor: Actor }): Promise<{
    properties: HostDashboardProperties;
    accommodationIds: string[];
    degraded: boolean;
}> {
    const { actor } = input;
    try {
        const result = await accommodationService.getByOwner({ ownerId: actor.id }, actor);

        if (result.error || !result.data) {
            apiLogger.warn(
                { actorId: actor.id, error: result.error?.code },
                'Host dashboard: getByOwner returned an error — degrading properties to zero'
            );
            return { properties: ZERO_PROPERTIES, accommodationIds: [], degraded: true };
        }

        const list = result.data.accommodations;
        const accommodationIds = list.map((item) => item.id);

        // V6.9b (HOS-1641): counted by the single publication state.
        const countIn = (status: PublicationStatusEnum): number =>
            list.filter((item) => item.publicationStatus === status).length;
        const published = countIn(PublicationStatusEnum.PUBLISHED);
        const draft = countIn(PublicationStatusEnum.DRAFT);
        const archived = countIn(PublicationStatusEnum.ARCHIVED);

        return {
            // UNPUBLISHED_BY_BILLING, MODERATED and PURGED are counted in `total`
            // but have no dedicated field.
            properties: { total: list.length, published, draft, archived },
            accommodationIds,
            degraded: false
        };
    } catch (error) {
        apiLogger.warn(
            { actorId: actor.id, error: String(error) },
            'Host dashboard: getByOwner threw — degrading properties to zero'
        );
        return { properties: ZERO_PROPERTIES, accommodationIds: [], degraded: true };
    }
}

/** Subscription status -> the dashboard's coarse plan status. */
const PLAN_STATUS_BY_SUBSCRIPTION_STATUS: Readonly<
    Record<string, HostDashboardPlan['status'] | undefined>
> = {
    ACTIVE: 'active',
    GRACE_PERIOD: 'past_due',
    SUSPENDED: 'past_due',
    CANCEL_SCHEDULED: 'cancelled',
    PAUSED: 'cancelled'
};

/**
 * Resolve the owner's plan from the live PRINCIPAL subscription (HOS-2543).
 *
 * Reads through `readOwnPlanState`, the same reader behind Mi suscripcion, so the
 * plan name comes from the catalog (`plan.name`) and never from a constant.
 * The accommodation principal wins; any other live principal is the fallback.
 * The exact subscription status is returned in `subscriptionStatus` (one label per
 * status on the card); `status` stays as the coarse legacy value. `isTrial` is always false: the trial is Hospeda's own state machine and the
 * client reads it separately.
 *
 * FAIL-SAFE: a failed read degrades to `null` (the card then shows the
 * "no subscription" message), never a 500.
 *
 * @param input - `{ actor }` whose `id` is the owner.
 * @returns The plan summary, or `null` when the owner has no live principal.
 */
async function resolvePlan(input: { actor: Actor }): Promise<HostDashboardPlan | null> {
    const { actor } = input;
    try {
        const { subscriptions } = await readOwnPlanState({
            userId: actor.id,
            now: getClock().clock.now()
        });
        const chosen =
            subscriptions.find((row) => row.vertical === VerticalEnum.ACCOMMODATION) ??
            subscriptions[0];
        if (!chosen) return null;
        const parsedStatus = OwnPlanStatusSchema.safeParse(chosen.status);
        if (!parsedStatus.success) {
            apiLogger.warn(
                { actorId: actor.id, status: chosen.status },
                'Host dashboard: live subscription has an unexpected status — plan null'
            );
            return null;
        }
        return {
            slug: chosen.plan.slug,
            name: chosen.plan.name,
            status: PLAN_STATUS_BY_SUBSCRIPTION_STATUS[chosen.status] ?? 'active',
            subscriptionStatus: parsedStatus.data,
            serviceEndsAt: chosen.serviceEndsAt?.toISOString() ?? null,
            isTrial: false
        };
    } catch (error) {
        apiLogger.warn(
            { actorId: actor.id, error: String(error) },
            'Host dashboard: plan read threw — degrading plan to null'
        );
        return null;
    }
}

/**
 * Resolve the coarse unread-conversations count for the owner.
 *
 * FAIL-SAFE: any failure or an empty accommodation set resolves to `0`; a failure
 * is flagged with `degraded: true` so the client can say "not available" (HOS-2424).
 *
 * NOTE: `getUnreadCount` is a documented "coarse" count — it counts
 * conversations with any activity, not strictly conversations where
 * `lastReadAt < lastActivityAt`. This is an accepted approximation for
 * the dashboard badge (see ConversationService.getUnreadCount JSDoc).
 *
 * @param input - `{ actor, accommodationIds }`.
 * @returns `{ count, degraded }`: the unread count (>= 0) and whether it is a failure fallback.
 */
async function resolveUnreadConversations(input: {
    actor: Actor;
    accommodationIds: string[];
}): Promise<{ count: number; degraded: boolean }> {
    const { actor, accommodationIds } = input;
    if (accommodationIds.length === 0) {
        return { count: 0, degraded: false };
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
            return { count: 0, degraded: true };
        }

        return { count: result.data.count, degraded: false };
    } catch (error) {
        apiLogger.warn(
            { actorId: actor.id, error: String(error) },
            'Host dashboard: getUnreadCount threw — degrading to zero'
        );
        return { count: 0, degraded: true };
    }
}

/**
 * GET /api/v1/protected/host/dashboard
 *
 * Returns aggregated host dashboard data:
 * - Property counts (total, published, draft, archived) scoped to the owner
 * - Plan info: the live PRINCIPAL subscription's catalog plan (HOS-2543), null when none
 * - Unread conversations count (coarse approximation)
 *
 * The dashboard requires view_basic_stats; the plan summary is a separate data
 * read, not an authorization gate.
 */
export const hostDashboardRoute = createProtectedRoute({
    method: 'get',
    path: '/dashboard',
    summary: 'Host Dashboard',
    description:
        'Returns aggregated host dashboard data: property counts, the plan summary, and unread conversation count. ' +
        'Requires VIEW_BASIC_STATS entitlement.',
    tags: ['Host', 'Dashboard'],
    responseSchema: HostDashboardResponseSchema,
    handler: async (ctx: Context, _params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.ACCOMMODATION,
            keys: ['view_basic_stats']
        });
        try {
            apiLogger.debug({ actorId: actor.id, roles: actor.roles }, 'Host dashboard requested');

            // Section 1: property counts (owns its degradation, also yields the
            // accommodation IDs the conversations count needs).
            const {
                properties,
                accommodationIds,
                degraded: propertiesDegraded
            } = await resolveProperties({ actor });

            const plan = await resolvePlan({ actor });
            const unread = await resolveUnreadConversations({
                actor,
                accommodationIds
            });
            const unavailable: HostDashboardResponse['unavailable'] = [
                ...(propertiesDegraded ? (['properties'] as const) : []),
                // With the properties read degraded there are no accommodation ids, so
                // the unread count was computed from an empty list: not a real 0.
                ...(unread.degraded || propertiesDegraded ? (['unreadConversations'] as const) : [])
            ];

            const response: HostDashboardResponse = {
                properties,
                plan,
                unreadConversations: unread.count,
                unavailable
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
    }
});
