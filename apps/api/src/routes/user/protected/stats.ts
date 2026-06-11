/**
 * User stats endpoint.
 * Returns aggregated statistics for the authenticated user.
 * @route GET /api/v1/protected/users/me/stats
 */
import { and, billingCustomers, billingSubscriptions, desc, eq, getDb, or } from '@repo/db';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError,
    UserBookmarkService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { PlanService } from '../../../services/plan.service';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Module-level PlanService singleton for plan name resolution */
const planService = new PlanService();

const bookmarkService = new UserBookmarkService({ logger: apiLogger });
const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });
const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/** Response schema for user stats */
const UserStatsResponseSchema = z.object({
    bookmarkCount: z.number(),
    reviewCount: z.number(),
    /** Plan info is included when billing is available */
    plan: z
        .object({
            name: z.string(),
            status: z.string()
        })
        .nullable()
        .optional()
});

/**
 * Resolves a billing plan's display name from a subscription's `planId`.
 *
 * `billing_subscriptions.plan_id` stores the plan UUID, but legacy rows may
 * carry the slug instead. This dual-resolve mirrors `resolvePlanByIdOrSlug`
 * in addon.checkout.ts: try `getById` first (the documented UUID format),
 * fall back to `getBySlug`. Returns `null` when neither lookup succeeds, so
 * the caller can decide on a sensible fallback (never leak the raw UUID).
 *
 * @param service - PlanService instance (or any object exposing getById/getBySlug)
 * @param planId - The subscription's planId (UUID or, for legacy rows, slug)
 * @returns The resolved plan name, or `null` when the plan cannot be found
 */
export async function resolvePlanName(
    service: Pick<PlanService, 'getById' | 'getBySlug'>,
    planId: string
): Promise<string | null> {
    const byId = await service.getById(planId);
    if (byId.success) {
        return byId.data.name;
    }
    const bySlug = await service.getBySlug(planId);
    if (bySlug.success) {
        return bySlug.data.name;
    }
    return null;
}

export const userStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/me/stats',
    summary: 'Get user statistics',
    description:
        'Returns aggregated statistics for the authenticated user including bookmark count, review count and plan info.',
    tags: ['Users'],
    responseSchema: UserStatsResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        const bookmarkCountResult = await bookmarkService.countBookmarksForUser(actor, {
            userId: actor.id
        });

        if (bookmarkCountResult.error) {
            throw new ServiceError(
                bookmarkCountResult.error.code,
                bookmarkCountResult.error.message
            );
        }

        const bookmarkCount = bookmarkCountResult.data?.count ?? 0;

        /** Fetch review counts from both review services */
        const [accReviewResult, destReviewResult] = await Promise.all([
            accommodationReviewService.listByUser(actor, {
                userId: actor.id,
                page: 1,
                pageSize: 1,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            }),
            destinationReviewService.listByUser(actor, {
                userId: actor.id,
                page: 1,
                pageSize: 1,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            })
        ]);

        const accReviewTotal = accReviewResult.data?.total ?? 0;
        const destReviewTotal = destReviewResult.data?.pagination?.total ?? 0;
        const reviewCount = accReviewTotal + destReviewTotal;

        /** Resolve billing plan info - failure is non-fatal */
        let plan: { name: string; status: string } | null = null;

        try {
            /**
             * @remarks getDb() is used directly here because billing entities
             * (billingCustomers, billingSubscriptions) are managed by the external
             * qzpay-hono library and have no corresponding service in @repo/service-core.
             * This read is intentionally non-fatal and isolated in a try/catch.
             */
            const db = getDb();

            /** Find the billing customer record by user's external ID */
            const [customer] = await db
                .select()
                .from(billingCustomers)
                .where(eq(billingCustomers.externalId, actor.id))
                .limit(1);

            if (customer) {
                /** Find the most recent active or trialing subscription */
                const [subscription] = await db
                    .select()
                    .from(billingSubscriptions)
                    .where(
                        and(
                            eq(billingSubscriptions.customerId, customer.id),
                            or(
                                eq(billingSubscriptions.status, 'active'),
                                eq(billingSubscriptions.status, 'trialing')
                            )
                        )
                    )
                    .orderBy(desc(billingSubscriptions.createdAt))
                    .limit(1);

                if (subscription) {
                    /**
                     * `subscription.planId` stores the plan UUID; resolvePlanName
                     * dual-resolves (id then slug). Fall back to the raw planId
                     * only when the plan cannot be found at all.
                     */
                    const resolvedName = await resolvePlanName(planService, subscription.planId);

                    plan = {
                        name: resolvedName ?? subscription.planId,
                        status: subscription.status
                    };
                }
            }
        } catch (error) {
            apiLogger.warn(
                'Failed to resolve billing plan for user stats',
                error instanceof Error ? error.message : String(error)
            );
        }

        return {
            bookmarkCount,
            reviewCount,
            plan
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
