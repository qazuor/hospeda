import { z } from 'zod';
import { PlanRoleSchema } from './plan-role.js';

/**
 * Zod contracts of the administrative action 18 — *publish a plan version*
 * (HOS-1436, piece V2, AC:V2:6). Creating a plan, publishing a version
 * (retiring by publishing a non-sellable one, or undoing a retire), previewing
 * the confirmation and reading the published result all go through here.
 *
 * The four billing cycles are the closed list of `billing_option.cycle`
 * (`ck_billing_option_cycle`); the request may narrow them with `cycles`, which
 * cause (h) of `G-R3` validates against.
 */

/** The closed list of billing cycles (`billing_option.cycle`). */
export const BILLING_CYCLES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const BillingCycleSchema = z.enum(BILLING_CYCLES);

/**
 * Calendar equivalence of each billing cycle in months, not a commercial value.
 * A quarter is three months by definition, so G7's commercial-value rule does
 * not apply to this canonical conversion.
 */
export const BILLING_CYCLE_MONTHS = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12
} as const satisfies Record<BillingCycle, number>;

/** One entitlement a version grants; both quotas present for a metered one. */
export const PlanVersionEntitlementInputSchema = z.object({
    key: z.string().min(1).max(64),
    planQuota: z.number().int().nonnegative().nullable().optional(),
    trialQuota: z.number().int().nonnegative().nullable().optional()
});
export type PlanVersionEntitlementInput = z.infer<typeof PlanVersionEntitlementInputSchema>;

/** One limit a version sets and its value. */
export const PlanVersionLimitInputSchema = z.object({
    key: z.string().min(1).max(64),
    value: z.number().int().nonnegative()
});
export type PlanVersionLimitInput = z.infer<typeof PlanVersionLimitInputSchema>;

/**
 * What a version being published declares. `current` is not here: publishing a
 * version always makes it the plan's current one.
 */
export const PlanVersionContentSchema = z.object({
    rank: z.number().int(),
    sellable: z.boolean(),
    trialDays: z.number().int().nonnegative(),
    graceDays: z.number().int().nonnegative(),
    allowsPause: z.boolean(),
    inheritsTouristVip: z.boolean(),
    entitlements: z.array(PlanVersionEntitlementInputSchema).default([]),
    limits: z.array(PlanVersionLimitInputSchema).default([]),
    /** Optional subset of the closed cycles, read by cause (h) of `G-R3`. */
    cycles: z.array(BillingCycleSchema).optional()
});
export type PlanVersionContentInput = z.infer<typeof PlanVersionContentSchema>;

/** Preview request: builds the confirmation, writes nothing. */
export const PreviewPlanVersionRequestSchema = PlanVersionContentSchema;
export type PreviewPlanVersionRequest = z.infer<typeof PreviewPlanVersionRequestSchema>;

/** Publish request: the preview plus the explicit `confirmed: true`. */
export const PublishPlanVersionRequestSchema = PlanVersionContentSchema.extend({
    confirmed: z.literal(true)
});
export type PublishPlanVersionRequest = z.infer<typeof PublishPlanVersionRequestSchema>;

/** Create-plan request; `role` is accepted only here, never updated. */
export const CreatePlanRequestSchema = z.object({
    vertical: z.string().min(1).max(32),
    slug: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    description: z.string().nullable().optional(),
    pricingOrder: z.number().int().optional(),
    role: PlanRoleSchema.nullable().optional()
});
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

/** One key and what it changes against the current version. */
export const PlanPublicationChangeSchema = z.object({
    key: z.string(),
    kind: z.enum(['entitlement', 'limit', 'setting']),
    from: z.unknown().nullable(),
    to: z.unknown().nullable()
});
export type PlanPublicationChange = z.infer<typeof PlanPublicationChangeSchema>;

/** The key-by-key confirmation shown before publishing (ACC:18). */
export const PlanPublicationConfirmationSchema = z.object({
    planId: z.string().uuid(),
    vertical: z.string(),
    role: PlanRoleSchema.nullable(),
    sellable: z.boolean(),
    currentVersionId: z.string().uuid().nullable(),
    /** How many customers the version reaches (0 until B3 anchors subscriptions). */
    anchoredCustomers: z.number().int().nonnegative(),
    changes: z.array(PlanPublicationChangeSchema),
    message: z.string()
});
export type PlanPublicationConfirmation = z.infer<typeof PlanPublicationConfirmationSchema>;

/** The published plan version, as the route returns it. */
export const PublishedPlanVersionSchema = z.object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    vertical: z.string(),
    rank: z.number().int(),
    sellable: z.boolean(),
    current: z.boolean(),
    trialDays: z.number().int(),
    graceDays: z.number().int(),
    allowsPause: z.boolean(),
    inheritsTouristVip: z.boolean(),
    createdAt: z.string().datetime({ offset: true })
});
export type PublishedPlanVersion = z.infer<typeof PublishedPlanVersionSchema>;
