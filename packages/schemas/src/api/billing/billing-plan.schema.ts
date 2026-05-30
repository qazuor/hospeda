import { z } from 'zod';
import { queryBooleanParam } from '../../common/query-helpers.js';

/**
 * Plan category schema.
 *
 * Mirrors `PlanCategory` in `@repo/billing` (`'owner' | 'complex' | 'tourist'`,
 * a string union — not a TS enum) without taking a runtime dependency on that
 * package; `@repo/schemas` is the SSOT and must not import from `@repo/billing`.
 */
export const BillingPlanCategoryEnumSchema = z.enum(['owner', 'complex', 'tourist'], {
    error: () => ({ message: 'zodError.billing.plan.category.invalid' })
});

/** TypeScript type inferred from {@link BillingPlanCategoryEnumSchema} */
export type BillingPlanCategory = z.infer<typeof BillingPlanCategoryEnumSchema>;

/**
 * Entitlements payload — an array of entitlement keys (slugs).
 *
 * Kept as plain strings rather than coupling to the `EntitlementKey` enum in
 * `@repo/billing`. The service validates keys against the live catalog.
 */
const entitlementsSchema = z
    .array(
        z
            .string({ message: 'zodError.billing.plan.entitlements.item.invalidType' })
            .min(1, { message: 'zodError.billing.plan.entitlements.item.min' }),
        { message: 'zodError.billing.plan.entitlements.invalidType' }
    )
    .max(200, { message: 'zodError.billing.plan.entitlements.max' });

/**
 * Limits payload — a map of limit key → numeric value.
 *
 * Maps 1:1 to the qzpay `billing_plans.limits` JSON column (`Record<string,
 * number>`). A value of `-1` means unlimited; `0` means none.
 */
const limitsSchema = z.record(
    z.string({ message: 'zodError.billing.plan.limits.key.invalidType' }).min(1, {
        message: 'zodError.billing.plan.limits.key.min'
    }),
    z
        .number({ message: 'zodError.billing.plan.limits.value.invalidType' })
        .int({ message: 'zodError.billing.plan.limits.value.int' })
        .min(-1, { message: 'zodError.billing.plan.limits.value.min' })
);

/**
 * Schema for creating a new billing plan (admin operation).
 *
 * SINGLE SOURCE OF TRUTH for the create-plan request contract. Mirrors the
 * `PlanDefinition` shape persisted by the service into the qzpay `billing_plans`
 * row (`name`, `metadata`, `entitlements`, `limits`) plus the related
 * `billing_prices` rows (monthly always; annual when `annualPriceArs > 0`).
 *
 * The `slug` is WRITE-ONCE: it is accepted here on creation but is forbidden in
 * {@link UpdateBillingPlanSchema} because subscriptions reference the plan by
 * UUID while config/web still resolve by slug (SPEC-168 decision D1).
 */
export const CreateBillingPlanSchema = z
    .object({
        /** Unique plan slug — stored as `billing_plans.name`. Immutable after creation. */
        slug: z
            .string({ message: 'zodError.billing.plan.create.slug.invalidType' })
            .min(2, { message: 'zodError.billing.plan.create.slug.min' })
            .max(60, { message: 'zodError.billing.plan.create.slug.max' })
            .regex(/^[a-z0-9-]+$/, { message: 'zodError.billing.plan.create.slug.format' }),
        /** Human-readable display name (stored in metadata.displayName) */
        name: z
            .string({ message: 'zodError.billing.plan.create.name.invalidType' })
            .min(1, { message: 'zodError.billing.plan.create.name.min' })
            .max(120, { message: 'zodError.billing.plan.create.name.max' }),
        /** Plan description */
        description: z
            .string({ message: 'zodError.billing.plan.create.description.invalidType' })
            .max(1000, { message: 'zodError.billing.plan.create.description.max' }),
        /** Target user category */
        category: BillingPlanCategoryEnumSchema,
        /** Monthly price in ARS cents (0 for free plans) */
        monthlyPriceArs: z
            .number({ message: 'zodError.billing.plan.create.monthlyPriceArs.invalidType' })
            .int({ message: 'zodError.billing.plan.create.monthlyPriceArs.int' })
            .min(0, { message: 'zodError.billing.plan.create.monthlyPriceArs.min' }),
        /** Annual price in ARS cents (0 for free, null when there is no annual option) */
        annualPriceArs: z
            .number({ message: 'zodError.billing.plan.create.annualPriceArs.invalidType' })
            .int({ message: 'zodError.billing.plan.create.annualPriceArs.int' })
            .min(0, { message: 'zodError.billing.plan.create.annualPriceArs.min' })
            .nullable(),
        /** USD reference price for display purposes */
        monthlyPriceUsdRef: z
            .number({ message: 'zodError.billing.plan.create.monthlyPriceUsdRef.invalidType' })
            .min(0, { message: 'zodError.billing.plan.create.monthlyPriceUsdRef.min' }),
        /** Whether the plan has a trial period */
        hasTrial: z.boolean({ message: 'zodError.billing.plan.create.hasTrial.invalidType' }),
        /** Trial duration in days (0 when no trial) */
        trialDays: z
            .number({ message: 'zodError.billing.plan.create.trialDays.invalidType' })
            .int({ message: 'zodError.billing.plan.create.trialDays.int' })
            .min(0, { message: 'zodError.billing.plan.create.trialDays.min' }),
        /** Whether this is the default plan for its category */
        isDefault: z.boolean({ message: 'zodError.billing.plan.create.isDefault.invalidType' }),
        /** Display sort order */
        sortOrder: z
            .number({ message: 'zodError.billing.plan.create.sortOrder.invalidType' })
            .int({ message: 'zodError.billing.plan.create.sortOrder.int' })
            .min(0, { message: 'zodError.billing.plan.create.sortOrder.min' }),
        /** Entitlement keys granted by the plan */
        entitlements: entitlementsSchema,
        /** Limit map (key → value, -1 = unlimited) */
        limits: limitsSchema,
        /** Whether the plan is available for purchase */
        isActive: z.boolean({ message: 'zodError.billing.plan.create.isActive.invalidType' })
    })
    .strict()
    .refine((data) => !data.hasTrial || data.trialDays > 0, {
        message: 'zodError.billing.plan.create.trialDays.requiredWhenTrial',
        path: ['trialDays']
    });

/** TypeScript type inferred from {@link CreateBillingPlanSchema} */
export type CreateBillingPlan = z.infer<typeof CreateBillingPlanSchema>;

/**
 * Schema for updating an existing billing plan (admin operation).
 *
 * Every field is optional (partial update). `slug` is intentionally ABSENT —
 * it is immutable after creation (SPEC-168 decision D1). `strict()` rejects any
 * unknown field, including an attempt to send `slug`.
 */
export const UpdateBillingPlanSchema = z
    .object({
        name: z
            .string({ message: 'zodError.billing.plan.update.name.invalidType' })
            .min(1, { message: 'zodError.billing.plan.update.name.min' })
            .max(120, { message: 'zodError.billing.plan.update.name.max' })
            .optional(),
        description: z
            .string({ message: 'zodError.billing.plan.update.description.invalidType' })
            .max(1000, { message: 'zodError.billing.plan.update.description.max' })
            .optional(),
        category: BillingPlanCategoryEnumSchema.optional(),
        monthlyPriceArs: z
            .number({ message: 'zodError.billing.plan.update.monthlyPriceArs.invalidType' })
            .int({ message: 'zodError.billing.plan.update.monthlyPriceArs.int' })
            .min(0, { message: 'zodError.billing.plan.update.monthlyPriceArs.min' })
            .optional(),
        annualPriceArs: z
            .number({ message: 'zodError.billing.plan.update.annualPriceArs.invalidType' })
            .int({ message: 'zodError.billing.plan.update.annualPriceArs.int' })
            .min(0, { message: 'zodError.billing.plan.update.annualPriceArs.min' })
            .nullable()
            .optional(),
        monthlyPriceUsdRef: z
            .number({ message: 'zodError.billing.plan.update.monthlyPriceUsdRef.invalidType' })
            .min(0, { message: 'zodError.billing.plan.update.monthlyPriceUsdRef.min' })
            .optional(),
        hasTrial: z
            .boolean({ message: 'zodError.billing.plan.update.hasTrial.invalidType' })
            .optional(),
        trialDays: z
            .number({ message: 'zodError.billing.plan.update.trialDays.invalidType' })
            .int({ message: 'zodError.billing.plan.update.trialDays.int' })
            .min(0, { message: 'zodError.billing.plan.update.trialDays.min' })
            .optional(),
        isDefault: z
            .boolean({ message: 'zodError.billing.plan.update.isDefault.invalidType' })
            .optional(),
        sortOrder: z
            .number({ message: 'zodError.billing.plan.update.sortOrder.invalidType' })
            .int({ message: 'zodError.billing.plan.update.sortOrder.int' })
            .min(0, { message: 'zodError.billing.plan.update.sortOrder.min' })
            .optional(),
        entitlements: entitlementsSchema.optional(),
        limits: limitsSchema.optional(),
        isActive: z
            .boolean({ message: 'zodError.billing.plan.update.isActive.invalidType' })
            .optional()
    })
    .strict();

/** TypeScript type inferred from {@link UpdateBillingPlanSchema} */
export type UpdateBillingPlan = z.infer<typeof UpdateBillingPlanSchema>;

/**
 * Query schema for listing/searching billing plans (admin operation).
 */
export const BillingPlanSearchSchema = z.object({
    /** Filter by category */
    category: BillingPlanCategoryEnumSchema.optional(),
    /** Filter by active flag */
    active: queryBooleanParam(),
    /** Free-text search over slug/name */
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** TypeScript type inferred from {@link BillingPlanSearchSchema} */
export type BillingPlanSearch = z.infer<typeof BillingPlanSearchSchema>;

/**
 * Response schema for a billing plan returned by the API.
 *
 * `PlanDefinition`-shaped (slug/name/category/prices/entitlements/limits) plus
 * the DB `id` (UUID) and timestamps. The service maps the qzpay `billing_plans`
 * row + related `billing_prices` into this DTO. The mutation identifier is `id`
 * (UUID), not `slug` (SPEC-168 decision D1).
 */
export const BillingPlanResponseSchema = z.object({
    /** DB primary key (UUID) — the mutation identifier */
    id: z.string().uuid(),
    /** Plan slug (`billing_plans.name`) — immutable */
    slug: z.string(),
    /** Display name */
    name: z.string(),
    /** Description */
    description: z.string(),
    /** Category */
    category: BillingPlanCategoryEnumSchema,
    /** Monthly price in ARS cents */
    monthlyPriceArs: z.number().int(),
    /** Annual price in ARS cents (null when no annual option) */
    annualPriceArs: z.number().int().nullable(),
    /** USD reference price */
    monthlyPriceUsdRef: z.number(),
    /** Whether the plan has a trial */
    hasTrial: z.boolean(),
    /** Trial duration in days */
    trialDays: z.number().int(),
    /** Whether this is the default plan for its category */
    isDefault: z.boolean(),
    /** Display sort order */
    sortOrder: z.number().int(),
    /** Entitlement keys */
    entitlements: z.array(z.string()),
    /** Limit map (key → value) */
    limits: z.record(z.string(), z.number().int()),
    /** Whether the plan is active */
    isActive: z.boolean(),
    /** ISO 8601 creation timestamp */
    createdAt: z.string().datetime(),
    /** ISO 8601 last-update timestamp */
    updatedAt: z.string().datetime()
});

/** TypeScript type inferred from {@link BillingPlanResponseSchema} */
export type BillingPlanResponse = z.infer<typeof BillingPlanResponseSchema>;
