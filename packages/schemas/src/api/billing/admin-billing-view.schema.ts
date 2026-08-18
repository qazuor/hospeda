/**
 * Admin billing VIEW schemas (payments + subscriptions)
 *
 * ## Why this module exists
 *
 * `/api/v1/admin/billing/payments` and `/api/v1/admin/billing/subscriptions`
 * used to be served RAW by the `@qazuor/qzpay-hono` admin tier. That tier
 * returns qzpay's own storage shape, which differs from what the admin UI
 * consumes in two ways that are not cosmetic:
 *
 * 1. **Vocabulary.** qzpay reports a successful payment as `succeeded` and a
 *    cancelled subscription as `canceled` (one L). Hospeda's domain vocabulary
 *    (see {@link SubscriptionStatusEnum}) spells it `cancelled` (two L's). Both
 *    spellings are physically present in `billing_subscriptions.status` today,
 *    because the webhook path normalises through `QZPAY_TO_HOSPEDA_STATUS`
 *    while the admin cancel path writes qzpay's spelling straight to the row.
 *
 * 2. **Missing joins.** qzpay does not know Hospeda users: it carries a
 *    `customerId`, never a name or an email. Its subscription row carries a
 *    `planId` UUID, never a slug, and carries no amount at all — the price
 *    lives on the plan. No client-side adapter can invent those fields, which
 *    is why the translation lives server-side rather than in `apps/admin`.
 *
 * These schemas are the SINGLE place where qzpay's shape is translated into
 * Hospeda's. Adding a screen that reads payments or subscriptions must consume
 * these DTOs rather than re-deriving the mapping locally.
 *
 * ## Money is always integer centavos, and the field name says so
 *
 * Every monetary field in this module is suffixed `InCents`. This is deliberate
 * and load-bearing: the previous defect shipped because a field called `amount`
 * held centavos and was handed to a formatter whose JSDoc read
 * "Format a whole-unit ARS amount". A reviewer could not see the mismatch at
 * the call site. With the unit in the name, `formatArs(payment.amountInCents)`
 * reads as wrong on sight. Do NOT introduce a bare `amount` here.
 *
 * @module api/billing/admin-billing-view
 */

import { z } from 'zod';

/**
 * Payment status as the admin UI receives it.
 *
 * These are the values that actually travel at runtime, mapped from the payment
 * provider by `mapMpStatusToQZPayStatus`. This is intentionally NOT
 * `PaymentStatusEnum` from `packages/schemas/src/enums/payment-status.enum.ts`:
 * that enum describes an authorise/capture lifecycle (`captured`, `authorized`,
 * `declined`) that the MercadoPago integration never produces. Reusing it would
 * mean declaring states that can never occur while omitting `succeeded`, which
 * is the single most common state in the table.
 *
 * `completed` is NOT a member and never was — the admin UI invented it, which is
 * precisely the defect this module closes.
 */
export const AdminPaymentViewStatusSchema = z.enum([
    'succeeded',
    'pending',
    'processing',
    'failed',
    'canceled',
    'refunded',
    'partially_refunded'
]);

/** TypeScript type inferred from {@link AdminPaymentViewStatusSchema} */
export type AdminPaymentViewStatus = z.infer<typeof AdminPaymentViewStatusSchema>;

/**
 * Subscription status as the admin UI receives it.
 *
 * Normalised to Hospeda's spelling: a row physically stored as qzpay's
 * `canceled` is served here as `cancelled`. `abandoned` and `pending_provider`
 * are included because they exist in production data and previously rendered as
 * an empty badge — the UI map had no entry for them.
 */
export const AdminSubscriptionViewStatusSchema = z.enum([
    'active',
    'trialing',
    'past_due',
    'paused',
    'cancelled',
    'expired',
    'pending_provider',
    'abandoned',
    'comp'
]);

/** TypeScript type inferred from {@link AdminSubscriptionViewStatusSchema} */
export type AdminSubscriptionViewStatus = z.infer<typeof AdminSubscriptionViewStatusSchema>;

/**
 * The Hospeda user behind a billing customer.
 *
 * Resolved by joining `billing_customers.external_id` to `users.id`. Nullable
 * because a billing customer can outlive its user row (soft-deleted account), and
 * an operator still needs to see the payment. When null the UI must render an
 * explicit "unknown user" affordance rather than an empty cell — an empty cell is
 * what made the previous screen unusable.
 */
export const AdminBillingUserRefSchema = z.object({
    /** Hospeda `users.id` */
    id: z.string().uuid(),
    /** Display name, e.g. "Leandro Asrilevich" */
    displayName: z.string(),
    /** Contact email as held by the billing customer record */
    email: z.string()
});

/** TypeScript type inferred from {@link AdminBillingUserRefSchema} */
export type AdminBillingUserRef = z.infer<typeof AdminBillingUserRefSchema>;

/**
 * The plan behind a subscription or payment.
 *
 * `slug` is `billing_plans.name` (the stable identifier, e.g. `owner-basico`);
 * `displayName` is the human label (e.g. "Basic"). Both are served so the UI never
 * has to look a plan up in the static `ALL_PLANS` catalog — that lookup is what
 * produced the "every subscription is a Turista" rendering, because an unresolved
 * plan fell through a ternary chain into the last branch.
 */
export const AdminBillingPlanRefSchema = z.object({
    /** `billing_plans.id` (UUID) */
    id: z.string().uuid(),
    /** Stable plan identifier, e.g. `owner-basico` */
    slug: z.string(),
    /** Human-facing label, e.g. "Basic" */
    displayName: z.string(),
    /** Monthly list price in integer centavos, or null when the plan has none */
    monthlyPriceInCents: z.number().int().nonnegative().nullable(),
    /** Which product line the plan belongs to (SPEC-239) */
    productDomain: z.string().nullable()
});

/** TypeScript type inferred from {@link AdminBillingPlanRefSchema} */
export type AdminBillingPlanRef = z.infer<typeof AdminBillingPlanRefSchema>;

/**
 * One payment row as the admin payments screen consumes it.
 *
 * Enriched with the user and plan that qzpay's raw row cannot supply, and with
 * every amount named in centavos.
 */
export const AdminPaymentViewSchema = z.object({
    /** `billing_payments.id` */
    id: z.string().uuid(),
    /** Charged amount in integer centavos. 1800000 means $18.000,00 ARS. */
    amountInCents: z.number().int(),
    /** ISO 4217 currency code, e.g. `ARS` */
    currency: z.string(),
    /** Amount already refunded, in integer centavos. Zero when never refunded. */
    refundedAmountInCents: z.number().int().nonnegative(),
    /** Normalised payment status. See {@link AdminPaymentViewStatusSchema}. */
    status: AdminPaymentViewStatusSchema,
    /** ISO 8601 creation timestamp */
    createdAt: z.string().datetime(),
    /** Hospeda user behind the payment, or null when unresolvable */
    user: AdminBillingUserRefSchema.nullable(),
    /** Plan the payment was for, or null for one-off purchases with no plan */
    plan: AdminBillingPlanRefSchema.nullable(),
    /** Owning subscription, when the payment came from one */
    subscriptionId: z.string().uuid().nullable(),
    /** Owning invoice, when there is one */
    invoiceId: z.string().uuid().nullable(),
    /** Payment provider that processed it, e.g. `mercadopago` */
    provider: z.string().nullable(),
    /** Provider-side payment identifier, useful for reconciliation against MP */
    providerPaymentId: z.string().nullable(),
    /**
     * Whether this payment is eligible for a refund right now.
     *
     * Served by the backend rather than re-derived in the UI: the previous screen
     * computed it as `status === 'completed'`, a value the API never emits, so the
     * refund button was dead for every payment that ever existed. The rule is
     * "succeeded, or partially refunded with money still outstanding".
     */
    isRefundable: z.boolean()
});

/** TypeScript type inferred from {@link AdminPaymentViewSchema} */
export type AdminPaymentView = z.infer<typeof AdminPaymentViewSchema>;

/**
 * One subscription row as the admin subscriptions screen consumes it.
 */
export const AdminSubscriptionViewSchema = z.object({
    /** `billing_subscriptions.id` */
    id: z.string().uuid(),
    /** Normalised subscription status. See {@link AdminSubscriptionViewStatusSchema}. */
    status: AdminSubscriptionViewStatusSchema,
    /**
     * The status exactly as stored in the row, before normalisation.
     *
     * Kept so an operator debugging a discrepancy can see that a subscription
     * displayed as `cancelled` is physically stored as qzpay's `canceled`. Display
     * code must use {@link AdminSubscriptionViewSchema.shape.status}, never this.
     */
    rawStatus: z.string(),
    /** Hospeda user behind the subscription, or null when unresolvable */
    user: AdminBillingUserRefSchema.nullable(),
    /** Plan the subscription is on, or null when the plan row is gone */
    plan: AdminBillingPlanRefSchema.nullable(),
    /**
     * Recurring amount in integer centavos, derived from the plan's price for the
     * subscription's billing interval. Null when no plan price is on record —
     * rendered as "—", never as a fabricated `0,00`.
     */
    recurringAmountInCents: z.number().int().nonnegative().nullable(),
    /** Billing interval, e.g. `month` or `year` */
    billingInterval: z.string().nullable(),
    /** ISO 8601 start of the current billing period */
    currentPeriodStart: z.string().datetime().nullable(),
    /** ISO 8601 end of the current billing period */
    currentPeriodEnd: z.string().datetime().nullable(),
    /** ISO 8601 trial end, when the subscription had a trial */
    trialEnd: z.string().datetime().nullable(),
    /** Whether the subscription is set to stop at period end (soft cancel) */
    cancelAtPeriodEnd: z.boolean(),
    /** ISO 8601 creation timestamp — the subscription's true start date */
    createdAt: z.string().datetime(),
    /** Product line the subscription belongs to (SPEC-239) */
    productDomain: z.string().nullable()
});

/** TypeScript type inferred from {@link AdminSubscriptionViewSchema} */
export type AdminSubscriptionView = z.infer<typeof AdminSubscriptionViewSchema>;

/**
 * Query filters for the admin payments list.
 *
 * `status` accepts the NORMALISED vocabulary only. The service is responsible for
 * widening a normalised value to every spelling physically present in the column,
 * so filtering by `cancelled` must also match rows stored as `canceled`. The old
 * screen sent `completed`, a value no row has ever held, and sent `cancelled`
 * against a column holding both spellings — which is why its "Cancelada" filter
 * returned a fraction of the cancelled rows.
 */
export const AdminPaymentViewSearchSchema = z.object({
    /** Filter by normalised payment status */
    status: AdminPaymentViewStatusSchema.optional(),
    /** Free-text search over the payer's name and email */
    search: z.string().optional(),
    /** ISO 8601 lower bound on `createdAt`, inclusive */
    startDate: z.string().optional(),
    /** ISO 8601 upper bound on `createdAt`, inclusive */
    endDate: z.string().optional(),
    /** Lower bound on the charged amount, in integer centavos */
    minAmountInCents: z.coerce.number().int().nonnegative().optional(),
    /** Upper bound on the charged amount, in integer centavos */
    maxAmountInCents: z.coerce.number().int().nonnegative().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** TypeScript type inferred from {@link AdminPaymentViewSearchSchema} */
export type AdminPaymentViewSearch = z.infer<typeof AdminPaymentViewSearchSchema>;

/**
 * Query filters for the admin subscriptions list.
 *
 * See {@link AdminPaymentViewSearchSchema} for why `status` is normalised here and
 * widened in the service.
 */
export const AdminSubscriptionViewSearchSchema = z.object({
    /** Filter by normalised subscription status */
    status: AdminSubscriptionViewStatusSchema.optional(),
    /** Filter by plan slug, e.g. `owner-basico` */
    planSlug: z.string().optional(),
    /** Filter by product line (SPEC-239), e.g. `accommodation` or `commerce` */
    productDomain: z.string().optional(),
    /** Free-text search over the subscriber's name and email */
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** TypeScript type inferred from {@link AdminSubscriptionViewSearchSchema} */
export type AdminSubscriptionViewSearch = z.infer<typeof AdminSubscriptionViewSearchSchema>;
