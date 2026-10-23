import { z } from 'zod';

/** Summary of the single live principal subscription shown on the account dashboard. */
export const AccountPlanSummarySchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED']),
    vertical: z.string().min(1)
});

/** Required response shape consumed by the account dashboard stats widget. */
export const UserStatsResponseSchema = z.object({
    bookmarkCount: z.number().int().nonnegative(),
    reviewCount: z.number().int().nonnegative(),
    plan: AccountPlanSummarySchema.nullable(),
    activeSubscriptionsCount: z.number().int().nonnegative()
});

/** Inferred response type for the authenticated user's dashboard statistics. */
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;
