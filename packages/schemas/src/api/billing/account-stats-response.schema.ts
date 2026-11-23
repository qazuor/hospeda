import { z } from 'zod';

/**
 * Statuses of a live principal subscription an owner-facing plan card can show
 * (HOS-2543). A subset of `SUBSCRIPTION_STATUSES` (`@repo/db`, `subscription.dbschema.ts`),
 * mirrored here because `@repo/schemas` cannot import the db package; a guard test in
 * `apps/api` fails if a value drifts out of that list.
 *
 * `PENDING_AUTHORIZATION` and `CHARGE_DECLINED` (HOS-2553) are the two unsettled states:
 * the owner is waiting to authorize the checkout, or the provider declined the charge.
 * They are shown so such an owner is never told "no subscription", but Mi suscripcion
 * and its self-service actions still read only the settled ones.
 */
export const OWN_PLAN_STATUSES = [
    'ACTIVE',
    'GRACE_PERIOD',
    'SUSPENDED',
    'CANCEL_SCHEDULED',
    'PAUSED',
    'PENDING_AUTHORIZATION',
    'CHARGE_DECLINED'
] as const;

/** Zod enum of {@link OWN_PLAN_STATUSES}. */
export const OwnPlanStatusSchema = z.enum(OWN_PLAN_STATUSES);

/** Exact status of a live principal subscription. */
export type OwnPlanStatus = z.infer<typeof OwnPlanStatusSchema>;

/** Summary of the single live principal subscription shown on the account dashboard. */
export const AccountPlanSummarySchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    status: OwnPlanStatusSchema,
    vertical: z.string().min(1)
});

/** Required response shape consumed by the account dashboard stats widget. */
export const UserStatsResponseSchema = z.object({
    bookmarkCount: z.number().int().nonnegative(),
    reviewCount: z.number().int().nonnegative(),
    plan: AccountPlanSummarySchema.nullable(),
    activeSubscriptionsCount: z.number().int().nonnegative(),
    /**
     * Every live principal subscription, oldest first (HOS-2553). Additive: `plan` and
     * `activeSubscriptionsCount` keep their meaning, and an API that predates this field
     * parses as an empty list.
     */
    subscriptions: z.array(AccountPlanSummarySchema).default([])
});

/** Inferred response type for the authenticated user's dashboard statistics. */
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;
