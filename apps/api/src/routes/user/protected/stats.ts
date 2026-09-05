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
import { BUSINESS_VERTICAL_PRODUCT_DOMAINS, type ProductDomainEnum } from '@repo/schemas';
import {
    AccommodationReviewService,
    DestinationReviewService,
    ServiceError,
    subscriptionMatchesDomain,
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
    /**
     * Plan info, populated only when exactly one product domain (HOS-1066)
     * has a live entitlement-granting subscription. `null` with
     * `activeSubscriptionsCount > 1` means the account has several active
     * subscriptions across domains — the UI renders a count summary instead
     * of a single plan and links to the (domain-scoped) subscription page.
     */
    plan: z
        .object({
            name: z.string(),
            status: z.string()
        })
        .nullable()
        .optional(),
    /**
     * Number of distinct product domains carrying a live entitlement-granting
     * subscription (HOS-1066). `0` means no active subscription (free tier),
     * `1` means `plan` above describes it, `2+` means the UI must show a
     * summary rather than a single plan.
     */
    activeSubscriptionsCount: z.number().optional()
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
 * The domains a customer's subscriptions can be resolved into for THIS
 * widget: the real business verticals only, never `Object.values(ProductDomainEnum)`.
 *
 * `ProductDomainEnum.ADDON` (HOS-847) tags a recurring add-on's own
 * MercadoPago preapproval row — a billing mechanism, not a vertical the
 * account "subscribes to" the way accommodation/gastronomy/experience/partner
 * are. Grouping by the full enum would count an active add-on as a second
 * "vertical" and turn "one real plan + one add-on" into the 2+ summary case,
 * hiding the plan name entirely — see
 * {@link BUSINESS_VERTICAL_PRODUCT_DOMAINS}'s doc in `@repo/schemas` for the
 * general rule and why this was caught only in review, not by the enum's own
 * frozen-count guard.
 *
 * Iterating this fixed list (rather than reading `productDomain` off the row
 * directly) keeps `subscriptionMatchesDomain` the ONLY place that compares a
 * subscription's domain (see that module's doc) — this file never inspects
 * the column itself.
 */
const KNOWN_BUSINESS_DOMAINS = BUSINESS_VERTICAL_PRODUCT_DOMAINS;

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
 * HOS-1066: this used to pick the single most-recently-created entitlement-
 * granting subscription regardless of vertical (`orderBy(desc(createdAt)).limit(1)`),
 * so a host who also holds a gastronomy/experience/partner subscription could
 * see that OTHER vertical's plan here, while the "Ver mi suscripción" link
 * (`GET /users/me/subscription`, domain-scoped via `subscriptionMatchesDomain`)
 * correctly showed the accommodation plan — two contiguous surfaces
 * disagreeing about the same subscriber. This now groups the customer's live
 * subscriptions by domain (one entry per domain, most-recent-first thanks to
 * the `ORDER BY createdAt DESC` below) and reports a single plan only when
 * exactly one domain has an active subscription. With more than one, the
 * card is a summary — see {@link UserPlanSummary}'s `activeSubscriptionsCount`
 * — and delegates plan detail to the (domain-scoped) subscription page,
 * per owner decision.
 *
 * @remarks `getDb()` is used directly because billing entities are managed by
 *   the external qzpay library and have no service in `@repo/service-core`.
 *   The read is deliberately non-fatal: a billing failure must not break the
 *   rest of the stats payload, so it is isolated in a try/catch.
 *
 * @param input - Lookup input.
 * @param input.userId - The actor id, matched against `billing_customers.external_id`.
 * @returns `{ plan, activeSubscriptionsCount }`. `plan` is `null` when the
 *   user has no live entitlement-granting subscription, when the billing read
 *   fails, OR when more than one domain has an active subscription (the
 *   summary case — check `activeSubscriptionsCount` instead).
 *   `activeSubscriptionsCount` is the number of DISTINCT domains carrying a
 *   live entitlement-granting subscription (0, 1, or more).
 */
export async function resolveUserPlanSummary(input: { readonly userId: string }): Promise<{
    readonly plan: UserPlanSummary | null;
    readonly activeSubscriptionsCount: number;
}> {
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
            return { plan: null, activeSubscriptionsCount: 0 };
        }

        /**
         * Find every live entitlement-granting subscription for this customer,
         * most-recent-first.
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
        const subscriptions = await db
            .select()
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.customerId, customer.id),
                    inArray(billingSubscriptions.status, [...ENTITLEMENT_GRANTING_STATUSES]),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .orderBy(desc(billingSubscriptions.createdAt));

        if (subscriptions.length === 0) {
            return { plan: null, activeSubscriptionsCount: 0 };
        }

        /**
         * Group by domain: one subscription per domain, the most recent one
         * (subscriptions are already ordered `DESC createdAt`, so `.find()`
         * keeps the first — newest — match per domain). A subscription whose
         * `productDomain` matches none of the known BUSINESS VERTICAL domains
         * (e.g. a stray legacy `'commerce'` row, or a recurring add-on's own
         * `'addon'`-tagged row — see `subscriptionMatchesDomain`'s doc) matches
         * no bucket and is dropped, by design.
         */
        const subscriptionByDomain = KNOWN_BUSINESS_DOMAINS.reduce((acc, domain) => {
            const match = subscriptions.find((sub) => subscriptionMatchesDomain(sub, domain));
            if (match) {
                acc.set(domain, match);
            }
            return acc;
        }, new Map<ProductDomainEnum, (typeof subscriptions)[number]>());

        const activeSubscriptionsCount = subscriptionByDomain.size;

        if (activeSubscriptionsCount !== 1) {
            // 0 (all subscriptions were dark/unrecognised domains) or 2+
            // (the summary case) both report no single `plan`.
            return { plan: null, activeSubscriptionsCount };
        }

        const [subscription] = subscriptionByDomain.values();
        if (!subscription) {
            return { plan: null, activeSubscriptionsCount };
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
            },
            activeSubscriptionsCount
        };
    } catch (error) {
        apiLogger.warn(
            'Failed to resolve billing plan for user stats',
            error instanceof Error ? error.message : String(error)
        );
        return { plan: null, activeSubscriptionsCount: 0 };
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

        const { plan, activeSubscriptionsCount } = await resolveUserPlanSummary({
            userId: actor.id
        });

        return {
            bookmarkCount,
            reviewCount,
            plan,
            activeSubscriptionsCount
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
