/**
 * User stats endpoint.
 * Returns aggregated statistics for the authenticated user.
 * @route GET /api/v1/protected/users/me/stats
 */
import { ENTITLEMENT_GRANTING_STATUSES } from '@repo/billing';
import {
    and,
    billingCustomers,
    billingSubscriptions,
    desc,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
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

/** The `plan` block of the user-stats response: the plan the account dashboard shows. */
export interface UserPlanSummary {
    /** Resolved plan display name, falling back to the raw `planId`. */
    readonly name: string;
    /** The subscription's stored status (`active` | `trialing` | `comp`). */
    readonly status: string;
}

/**
 * Resolves the plan summary rendered by the "mi plan" widget on `/mi-cuenta/`.
 *
 * Both reads exclude soft-deleted rows (HOS-755). Neither did before, so a
 * subscription that had been soft-deleted — and that every other surface
 * (`GET /users/me/subscription`, the entitlement middleware, all of which read
 * through qzpay, which filters `deleted_at` at the repository level) correctly
 * treated as gone — kept being reported here. The account dashboard therefore
 * showed a plan the user no longer had, contradicting the subscription page on
 * the same session.
 *
 * `billing_customers.deleted_at` is filtered for the same reason and because
 * `external_id` carries no UNIQUE constraint: without the predicate a stale,
 * soft-deleted customer row can win the unordered `LIMIT 1` over the live one.
 *
 * @remarks `getDb()` is used directly because billing entities are managed by
 *   the external qzpay library and have no service in `@repo/service-core`.
 *   The read is deliberately non-fatal: a billing failure must not break the
 *   rest of the stats payload, so it is isolated in a try/catch.
 *
 * @param input - Lookup input.
 * @param input.userId - The actor id, matched against `billing_customers.external_id`.
 * @returns `{ plan }` — `null` when the user has no live entitlement-granting
 *   subscription, or when the billing read fails.
 */
export async function resolveUserPlanSummary(input: {
    readonly userId: string;
}): Promise<{ readonly plan: UserPlanSummary | null }> {
    try {
        const db = getDb();

        /** Find the live billing customer record by the user's external ID. */
        const [customer] = await db
            .select()
            .from(billingCustomers)
            .where(
                and(
                    eq(billingCustomers.externalId, input.userId),
                    isNull(billingCustomers.deletedAt)
                )
            )
            .limit(1);

        if (!customer) {
            return { plan: null };
        }

        /**
         * Find the most recent live entitlement-granting subscription.
         *
         * H-70: this used a hand-written `active || trialing` pair and
         * therefore dropped `comp`. A complimentary subscriber got
         * `plan: null`, which the account dashboard renders as
         * "Plan Gratuito" — telling someone on a comped paid plan that
         * they have nothing. `ENTITLEMENT_GRANTING_STATUSES` is the
         * canonical set (created for exactly this drift in HOS-239).
         *
         * HOS-755: `deleted_at IS NULL` is what keeps a soft-deleted row from
         * outliving its own deletion here. A soft-deleted subscription keeps
         * its `active`/`comp` status forever — the status set alone never
         * excludes it.
         */
        const [subscription] = await db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.customerId, customer.id),
                    inArray(billingSubscriptions.status, [...ENTITLEMENT_GRANTING_STATUSES]),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(desc(billingSubscriptions.createdAt))
            .limit(1);

        if (!subscription) {
            return { plan: null };
        }

        /**
         * `subscription.planId` stores the plan UUID; resolvePlanName
         * dual-resolves (id then slug). Fall back to the raw planId
         * only when the plan cannot be found at all.
         */
        const resolvedName = await resolvePlanName(planService, subscription.planId);

        return {
            plan: {
                name: resolvedName ?? subscription.planId,
                status: subscription.status
            }
        };
    } catch (error) {
        apiLogger.warn(
            'Failed to resolve billing plan for user stats',
            error instanceof Error ? error.message : String(error)
        );
        return { plan: null };
    }
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

        const { plan } = await resolveUserPlanSummary({ userId: actor.id });

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
