/**
 * User stats endpoint.
 * Returns aggregated statistics for the authenticated user.
 * @route GET /api/v1/protected/users/me/stats
 */
import { getPlanBySlug } from '@repo/billing';
import { and, billingCustomers, billingSubscriptions, desc, eq, getDb, or } from '@repo/db';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError,
    UserBookmarkService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

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
                    /** Resolve plan name from billing config using planId as slug */
                    const planDefinition = getPlanBySlug(subscription.planId);
                    const planName = planDefinition?.name ?? subscription.planId;

                    plan = { name: planName, status: subscription.status };
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
