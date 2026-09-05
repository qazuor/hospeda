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

// ---------------------------------------------------------------------------
// Public-catalogue visibility (HOS-1062 F1)
// ---------------------------------------------------------------------------

/**
 * The `billing_plans.metadata` key that carries a plan's public-catalogue
 * visibility (HOS-1062 F1).
 *
 * Lives in `metadata` on purpose: the column is already `jsonb NOT NULL DEFAULT
 * '{}'`, so marking a plan needs no structural migration. Precedent in the same
 * table: `metadata.testPlan`, read by `routes/billing/protected-plans-list.ts`.
 *
 * Nothing writes this key yet — a negotiated plan is marked by an operator
 * (`UPDATE billing_plans SET metadata = metadata || '{"publicListing":"unlisted"}'::jsonb`)
 * until the admin plan form grows the control. The READ side is what F1 ships,
 * because that is the side whose absence is silent.
 */
export const PLAN_PUBLIC_LISTING_METADATA_KEY = 'publicListing';

/**
 * Whether a plan appears in the PUBLIC catalogue.
 *
 * Deliberately an enum and not a boolean named after a negation: `'unlisted'`
 * says what it does — the plan is absent from the public listing — and cannot be
 * misread as `isActive`, which it is orthogonal to. An unlisted plan is
 * **active and charging**; it is a negotiated agreement (a municipality's price)
 * that simply must not appear on the pricing page. An inactive plan, by
 * contrast, is one nobody can buy.
 *
 * - `'listed'` — ordinary catalogue plan. The default for every plan that has
 *   never been marked, which is every plan that exists today.
 * - `'unlisted'` — reachable by id (checkout resolves a plan by UUID, see
 *   `subscription-checkout.service.ts`), never enumerated by a public endpoint.
 */
export const BillingPlanPublicListingSchema = z.enum(['listed', 'unlisted']);

/** TypeScript type inferred from {@link BillingPlanPublicListingSchema} */
export type BillingPlanPublicListing = z.infer<typeof BillingPlanPublicListingSchema>;

/**
 * Reads the public-listing mark off a raw `billing_plans.metadata` value.
 *
 * The resolution is deliberately asymmetric, and the asymmetry is the whole
 * safety argument:
 *
 * - The key **absent** (or `metadata` itself `null`/`undefined`, the shape
 *   `mapDbToPlan` already tolerates) resolves to `'listed'`. Absence means the
 *   plan was never marked — true of every plan in production — not that a mark
 *   failed to resolve.
 * - The key **present but not a recognised value** resolves to `'unlisted'`.
 *   So does a `metadata` that is not a plain object at all. If a mark exists and
 *   cannot be read, the plan is withheld: a public catalogue missing a plan is
 *   recoverable, a published negotiated price is not (spec §7, rule 2).
 *
 * @param input - RO-RO input carrying the raw metadata value from the DB row
 * @returns The resolved public-listing value
 *
 * @example
 * ```ts
 * resolvePlanPublicListing({ metadata: {} });                          // 'listed'
 * resolvePlanPublicListing({ metadata: { publicListing: 'unlisted' } }); // 'unlisted'
 * resolvePlanPublicListing({ metadata: { publicListing: 'nope' } });     // 'unlisted'
 * ```
 */
export function resolvePlanPublicListing(input: { readonly metadata: unknown }): {
    readonly publicListing: BillingPlanPublicListing;
} {
    const { metadata } = input;

    if (metadata === null || metadata === undefined) {
        return { publicListing: 'listed' };
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        // A metadata value that is not a plain object cannot be interrogated for
        // a mark. Unreadable, therefore withheld.
        return { publicListing: 'unlisted' };
    }

    const raw = (metadata as Record<string, unknown>)[PLAN_PUBLIC_LISTING_METADATA_KEY];
    if (raw === undefined) {
        return { publicListing: 'listed' };
    }

    const parsed = BillingPlanPublicListingSchema.safeParse(raw);
    return { publicListing: parsed.success ? parsed.data : 'unlisted' };
}

/**
 * Whether a plan may be served by a PUBLIC endpoint.
 *
 * Positive test on purpose (`=== 'listed'`, never `!== 'unlisted'`): a plan
 * whose mark went missing somewhere between the DB row and this call — a mapper
 * that forgot the field, a fixture that never had it — is withheld rather than
 * published. That is the failure this predicate exists to make impossible, so it
 * accepts a loose shape and answers `false` for anything that is not positively
 * listed.
 *
 * Positional single argument, matching the sibling plan predicates it sits
 * beside (`isTestPlan`, `isAccommodationSubscription`, `subscriptionMatchesDomain`).
 *
 * @param plan - Any object carrying (or missing) a `publicListing` field
 * @returns `true` only when the plan is positively marked as publicly listed
 */
export function isPubliclyListedPlan(plan: { readonly publicListing?: unknown }): boolean {
    return plan.publicListing === 'listed';
}

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
    /**
     * When true, soft-deleted plans (`deletedAt IS NOT NULL`) are included in
     * the result. Defaults to excluding them. Admin-only — the public endpoint
     * never sets this.
     */
    includeDeleted: queryBooleanParam(),
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
    /**
     * Public-catalogue visibility (HOS-1062 F1), derived from
     * `metadata.publicListing` by {@link resolvePlanPublicListing}. Orthogonal to
     * `isActive`: an `'unlisted'` plan is active and charging, it just never
     * appears in a public listing.
     *
     * `.default('listed')` is wire tolerance, NOT the security decision. The
     * public endpoint filters unlisted plans out of its own in-process data
     * before a response is ever built, so this default can never publish a
     * negotiated price; it only stops an admin client from failing to parse a
     * payload produced by an API instance older than this field (Coolify serves
     * both versions during a rollout).
     */
    publicListing: BillingPlanPublicListingSchema.default('listed'),
    /** ISO 8601 creation timestamp */
    createdAt: z.string().datetime(),
    /** ISO 8601 last-update timestamp */
    updatedAt: z.string().datetime()
});

/** TypeScript type inferred from {@link BillingPlanResponseSchema} */
export type BillingPlanResponse = z.infer<typeof BillingPlanResponseSchema>;

/**
 * Admin-only response schema for a billing plan.
 *
 * Extends {@link BillingPlanResponseSchema} with operational fields that MUST
 * NOT leak to the public endpoint:
 * - `isDeleted` — whether the plan is soft-deleted (`deletedAt IS NOT NULL`).
 * - `activeSubscriptionCount` — number of live subscribers (status `active` or
 *   `trialing`, not soft-deleted) referencing the plan.
 *
 * This DTO is used ONLY by the admin list route so the admin UI can surface
 * subscriber impact before destructive actions. The base
 * {@link BillingPlanResponseSchema} stays free of these fields because it is
 * shared with the public plans endpoint.
 */
export const AdminBillingPlanResponseSchema = BillingPlanResponseSchema.extend({
    /** Whether the plan is soft-deleted (`deletedAt IS NOT NULL`) */
    isDeleted: z.boolean(),
    /** Count of live subscribers (status active/trialing, not soft-deleted) */
    activeSubscriptionCount: z.number().int().nonnegative()
});

/** TypeScript type inferred from {@link AdminBillingPlanResponseSchema} */
export type AdminBillingPlanResponse = z.infer<typeof AdminBillingPlanResponseSchema>;

/**
 * One propagated price-change effect surfaced to the admin after a plan price edit
 * (HOS-176). Populated only when `updatePlan` actually changed an EXISTING price —
 * monthly and/or annual, so a single update yields 0–2 effects. Informational: it lets
 * the admin see how many subscribers a change reaches and when it takes effect.
 */
export const PlanPriceChangeEffectSchema = z.object({
    /** Which interval's price changed. */
    billingInterval: z.enum(['month', 'year']),
    /** `increase` (advance notice + grace window) or `decrease` (applies immediately). */
    direction: z.enum(['increase', 'decrease']),
    /**
     * ISO 8601 earliest time the change applies: `now` for a decrease, `now + grace` for
     * an increase. The propagation cron re-enumerates the exact subscriber set at this time.
     */
    effectiveAt: z.string().datetime(),
    /**
     * Approximate count of live subscribers (with an MP preapproval) the change will
     * re-price — scoped to this effect's `billingInterval` (a monthly change does not count
     * annual subscribers, and vice-versa). The exact set is resolved by the cron at apply time.
     */
    affectedSubscriberCount: z.number().int().nonnegative()
});

/** TypeScript type inferred from {@link PlanPriceChangeEffectSchema} */
export type PlanPriceChangeEffect = z.infer<typeof PlanPriceChangeEffectSchema>;

/**
 * Admin response schema for the plan UPDATE route (HOS-176).
 *
 * Extends {@link BillingPlanResponseSchema} with the price-change propagation effects
 * triggered by THIS update (empty array when no price changed). Route-scoped — like
 * {@link AdminBillingPlanResponseSchema} — so the base DTO shared with the public plans
 * endpoint stays free of these admin-only, update-only fields.
 */
export const AdminBillingPlanUpdateResponseSchema = BillingPlanResponseSchema.extend({
    /** Price-change effects triggered by this update (0–2: monthly and/or annual). */
    priceChangeEffects: z.array(PlanPriceChangeEffectSchema)
});

/** TypeScript type inferred from {@link AdminBillingPlanUpdateResponseSchema} */
export type AdminBillingPlanUpdateResponse = z.infer<typeof AdminBillingPlanUpdateResponseSchema>;
