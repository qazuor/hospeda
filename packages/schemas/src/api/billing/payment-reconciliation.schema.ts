/**
 * Orphan-payment rescue schemas (HOS-765).
 *
 * ## What this surface is for
 *
 * HOS-276 fixed the three ways a real MercadoPago charge could end up with no
 * local counterpart. It did NOT build the recovery half of its own
 * recommendation, so when the state happens anyway the only tool is a call to
 * `POST /protected/billing/subscriptions/link-preapproval` issued from the
 * affected customer's OWN authenticated session — a user endpoint used as an
 * operations tool, with no screen and no record that an operator intervened.
 * And the payment itself was never recoverable at all: the webhooks already
 * answered 200, so MercadoPago never retries, and nothing in the codebase could
 * write that `billing_payments` row after the fact. Money charged that the
 * ledger cannot see, with no basis for a refund and nothing to reconcile.
 *
 * These schemas describe the three pieces that close it: a DIVERGENCE REPORT
 * (what MercadoPago has that we don't), a FORCE-LINK action, and a
 * BACKFILL-PAYMENT action.
 *
 * ## The tool PROPOSES; a human DECIDES
 *
 * Nothing here links automatically, and that is a hard design constraint rather
 * than a phase-2 ambition. The failure this whole area exists to prevent is
 * crediting one person's charge to another person's subscription, and every
 * automated correlation signal available is exactly the one that was already
 * measured to be too weak: `preapproval.payer_email` comes back EMPTY from
 * MercadoPago, which is why {@link findReconcileCandidates} degrades to
 * "this email OR no email at all" and matches anybody. So the report carries
 * `candidates` — plural, ranked, with the evidence that produced them — and the
 * two write verbs each take an explicit `localSubscriptionId` that an operator
 * typed after looking at that evidence. There is deliberately no "link the
 * obvious one" endpoint.
 *
 * ## Where the payer's real identity comes from
 *
 * Measured 2026-08-31 against two real prod/staging subscriptions:
 *
 * ```
 * preapproval.payer_email                     ->  ""   (what the old code read)
 * payment.payer.email                         ->  the REAL account that paid
 * payment.metadata.preapproval_id             ->  the subscription it belongs to
 * payment...transaction_data.subscription_id  ->  the subscription it belongs to
 * ```
 *
 * On a REAL charge the who and the what-for arrive together, which is what makes
 * an already-charged orphan attributable to a person at all. That is why
 * {@link BillingDivergenceOrphanPreapprovalSchema} carries BOTH
 * `payerEmail` (off the preapproval — usually empty, kept so the operator can
 * SEE that it is empty rather than wonder) and `payerEmailFromPayment` (off the
 * linked payment — the one that is actually worth something).
 *
 * The mechanism has a hard limit, and the UI must not oversell it. At
 * AUTHORIZATION time (day 1) there is no such pairing: the $0 validation charge
 * carries the email but reports `subscription_id: null`, and that $0 payment
 * does not always exist at all — a preapproval was measured in `authorized`
 * with a `card_id` and no associated payment whatsoever. So
 * `payerEmailFromPayment` is nullable and its absence is a NORMAL state, never
 * an error.
 *
 * ## Money is integer centavos, and the field name says so
 *
 * Same rule as `admin-billing-view.schema.ts`, for the same reason: MercadoPago
 * reports major units (pesos) and this repo stores centavos, so every monetary
 * field here is suffixed `InCents` and the conversion happens once, named, at
 * the boundary. Do NOT introduce a bare `amount`.
 *
 * @module api/billing/payment-reconciliation
 */

import { z } from 'zod';

/**
 * Which side of the ledger a divergence sits on.
 *
 * - `'unrecorded-payment'` — MercadoPago approved a charge and no
 *   `billing_payments` row exists for it. This is the accounting hole: money
 *   moved and the books do not show it.
 * - `'orphan-preapproval'` — MercadoPago holds an `authorized` preapproval that
 *   no `billing_subscriptions.mp_subscription_id` points at. Nothing has
 *   necessarily been charged yet; the damage is scheduled rather than done, and
 *   `nextPaymentDate` is when it lands.
 *
 * The two are reported through one endpoint on purpose: they are usually two
 * views of a single incident (an unlinked preapproval that later charges
 * produces an unrecorded payment), and an operator triaging one wants to see the
 * other in the same list.
 */
export const BillingDivergenceKindSchema = z.enum(['unrecorded-payment', 'orphan-preapproval']);

/** @see BillingDivergenceKindSchema */
export type BillingDivergenceKind = z.infer<typeof BillingDivergenceKindSchema>;

/**
 * A local row the operator could plausibly bind a divergence to.
 *
 * Never a decision — the report emits every candidate it found together with the
 * `matchedOn` signals that produced it, and stops there. An empty array is a
 * perfectly normal result and means "we could not propose anything; do not
 * guess".
 */
export const BillingDivergenceCandidateSchema = z.object({
    /** Local `billing_subscriptions.id`. */
    localSubscriptionId: z.string(),
    /** Local subscription status at report time (`pending_provider`, `abandoned`, ...). */
    localSubscriptionStatus: z.string(),
    /** Local `billing_customers.id` behind that subscription. */
    customerId: z.string().nullable(),
    /** The Hospeda account email on file for that customer, for eyeball comparison. */
    customerEmail: z.string().nullable(),
    /** Display name of the Hospeda user, when the join resolved one. */
    customerDisplayName: z.string().nullable(),
    /** `billing_pending_checkouts.id` the candidate came from, when it came from one. */
    pendingCheckoutId: z.string().nullable(),
    /** The checkout-time payer email snapshot, which may differ from the account email. */
    pendingCheckoutPayerEmail: z.string().nullable(),
    /** When the local row was created — proximity to the MP timestamp is itself evidence. */
    createdAt: z.coerce.date(),
    /**
     * The signals that put this row in the list, e.g. `['payer-email', 'mp-plan-id']`.
     *
     * Rendered verbatim to the operator. A candidate matched only on
     * `mp-plan-id` is a far weaker proposal than one that also matched
     * `payer-email`, and the screen must let a human see that difference instead
     * of hiding it behind a score.
     */
    matchedOn: z.array(z.string())
});

/** @see BillingDivergenceCandidateSchema */
export type BillingDivergenceCandidate = z.infer<typeof BillingDivergenceCandidateSchema>;

/**
 * An approved MercadoPago payment with no `billing_payments` row.
 */
export const BillingDivergenceUnrecordedPaymentSchema = z.object({
    kind: z.literal('unrecorded-payment'),
    /** MercadoPago `payment.id`. Doubles as the stable list key. */
    mpPaymentId: z.string(),
    /** MercadoPago `payment.status` (`approved`, `refunded`, ...). */
    mpStatus: z.string(),
    /** MercadoPago `payment.status_detail`, which is what explains a partial state. */
    mpStatusDetail: z.string().nullable(),
    /** Charged amount in integer centavos (MP reports pesos; converted at the boundary). */
    amountInCents: z.number().int(),
    /** ISO-4217 currency of the charge. */
    currency: z.string(),
    /** `payment.date_approved` — when the money actually moved. */
    approvedAt: z.coerce.date().nullable(),
    /** `payment.date_created`. */
    createdAt: z.coerce.date(),
    /**
     * `payment.payer.email` — the REAL email of the account that paid.
     *
     * This is the field the whole tool turns on, and the one the pre-HOS-765
     * correlation code never read (it looked at `preapproval.payer_email`, which
     * is empty). Nullable because a payment can arrive without it, not because
     * it is normally absent.
     */
    payerEmail: z.string().nullable(),
    /** `payment.payer.id` — the only payer field `/v1/payments/search` can filter on. */
    payerId: z.string().nullable(),
    /**
     * The preapproval this charge belongs to, read from
     * `payment.metadata.preapproval_id` or the `transaction_data.subscription_id`
     * inside `point_of_interaction`. `null` on the $0 authorization charge, which
     * carries the email but reports no subscription.
     */
    preapprovalId: z.string().nullable(),
    /** `payment.external_reference`, when set. */
    externalReference: z.string().nullable(),
    /** `payment.description`, purely for the operator's benefit. */
    description: z.string().nullable(),
    /** Local rows this payment could belong to. May be empty. */
    candidates: z.array(BillingDivergenceCandidateSchema)
});

/** @see BillingDivergenceUnrecordedPaymentSchema */
export type BillingDivergenceUnrecordedPayment = z.infer<
    typeof BillingDivergenceUnrecordedPaymentSchema
>;

/**
 * An `authorized` MercadoPago preapproval no local subscription points at.
 */
export const BillingDivergenceOrphanPreapprovalSchema = z.object({
    kind: z.literal('orphan-preapproval'),
    /** MercadoPago preapproval id. Doubles as the stable list key. */
    preapprovalId: z.string(),
    /** `preapproval.status` (`authorized`, `pending`, `paused`, ...). */
    mpStatus: z.string(),
    /** `preapproval.reason` — the human-readable plan name MercadoPago shows the payer. */
    reason: z.string().nullable(),
    /** `auto_recurring.transaction_amount` in integer centavos. */
    amountInCents: z.number().int().nullable(),
    /** ISO-4217 currency of the recurring charge. */
    currency: z.string().nullable(),
    /** `preapproval.date_created`. */
    createdAt: z.coerce.date(),
    /**
     * `preapproval.next_payment_date` — when MercadoPago will charge this card
     * next. On an orphan this is the deadline: after it passes, the incident
     * stops being a dangling authorization and becomes an unrecorded payment.
     */
    nextPaymentDate: z.coerce.date().nullable(),
    /** `preapproval.external_reference` — the pending-checkout nonce, when stamped. */
    externalReference: z.string().nullable(),
    /** `preapproval.preapproval_plan_id` — which commercial plan was bought. */
    preapprovalPlanId: z.string().nullable(),
    /** `preapproval.payer_id`. */
    payerId: z.string().nullable(),
    /**
     * `preapproval.payer_email`. Measured EMPTY on every real preapproval.
     *
     * Surfaced anyway, and deliberately: an operator who cannot see that this
     * field is blank will assume the tool simply failed to look it up, and will
     * trust `payerEmailFromPayment` less than it deserves.
     */
    payerEmail: z.string().nullable(),
    /**
     * The payer email recovered from a PAYMENT linked to this preapproval — the
     * one that is worth something.
     *
     * `null` is a normal, expected state, not a failure: it means no payment has
     * been associated yet (a preapproval authorized but never charged), and a
     * preapproval was measured `authorized` with a `card_id` and no payment at
     * all. The screen must read an absence here as "cannot attribute yet",
     * never as "attribution failed".
     */
    payerEmailFromPayment: z.string().nullable(),
    /** The payment `payerEmailFromPayment` was read off, for traceability. */
    sourcePaymentId: z.string().nullable(),
    /** Local rows this preapproval could belong to. May be empty. */
    candidates: z.array(BillingDivergenceCandidateSchema)
});

/** @see BillingDivergenceOrphanPreapprovalSchema */
export type BillingDivergenceOrphanPreapproval = z.infer<
    typeof BillingDivergenceOrphanPreapprovalSchema
>;

/**
 * One row of the divergence report, discriminated by {@link BillingDivergenceKindSchema}.
 */
export const BillingDivergenceItemSchema = z.discriminatedUnion('kind', [
    BillingDivergenceUnrecordedPaymentSchema,
    BillingDivergenceOrphanPreapprovalSchema
]);

/** @see BillingDivergenceItemSchema */
export type BillingDivergenceItem = z.infer<typeof BillingDivergenceItemSchema>;

/**
 * Query parameters for the divergence report.
 *
 * `page`/`pageSize` rather than `limit`, per the admin route convention
 * (`createAdminListRoute` rejects unknown params outright).
 */
export const BillingDivergenceSearchSchema = z.object({
    /** Restrict to one side of the ledger. Omitted means both. */
    kind: BillingDivergenceKindSchema.optional(),
    /**
     * Oldest MercadoPago record to consider, ISO-8601.
     *
     * Bounded rather than unbounded because every page of this report costs
     * PACED calls against MercadoPago (see `HOSPEDA_MP_SCAN_*`), so an operator
     * asking for "everything since the beginning" is asking for a multi-minute
     * request. Defaults to the last 90 days server-side.
     */
    since: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20)
});

/** @see BillingDivergenceSearchSchema */
export type BillingDivergenceSearch = z.infer<typeof BillingDivergenceSearchSchema>;

/**
 * Body for `POST /admin/billing/reconciliation/force-link`.
 */
export const ForceLinkPreapprovalRequestSchema = z.object({
    /** The MercadoPago preapproval to bind. */
    preapprovalId: z.string().min(1),
    /**
     * The local subscription to bind it to — typed by the operator after reading
     * the evidence, never defaulted from a candidate list.
     */
    localSubscriptionId: z.string().uuid(),
    /**
     * Why the operator is doing this, in their own words.
     *
     * Required and non-trivial on purpose. This is the only part of the audit
     * record a future reader cannot reconstruct from the ids: the ids say WHAT
     * was bound, and nothing at all about why a human decided these two things
     * were the same person.
     */
    reason: z.string().trim().min(10).max(500)
});

/** @see ForceLinkPreapprovalRequestSchema */
export type ForceLinkPreapprovalRequest = z.infer<typeof ForceLinkPreapprovalRequestSchema>;

/**
 * What a force-link did.
 *
 * `'linked'` and `'already-linked'` are both successes; they are distinguished
 * so a retried click does not read as a second binding in the audit trail.
 */
export const ForceLinkOutcomeSchema = z.enum(['linked', 'already-linked']);

/** @see ForceLinkOutcomeSchema */
export type ForceLinkOutcome = z.infer<typeof ForceLinkOutcomeSchema>;

/** Response of a successful force-link. */
export const ForceLinkPreapprovalResponseSchema = z.object({
    outcome: ForceLinkOutcomeSchema,
    preapprovalId: z.string(),
    localSubscriptionId: z.string(),
    /** The local status the subscription holds after the link. */
    localSubscriptionStatus: z.string(),
    /** `audit_log_entries.id`-equivalent correlation id echoed back for the operator. */
    auditedAt: z.coerce.date()
});

/** @see ForceLinkPreapprovalResponseSchema */
export type ForceLinkPreapprovalResponse = z.infer<typeof ForceLinkPreapprovalResponseSchema>;

/**
 * Body for `POST /admin/billing/reconciliation/backfill-payment`.
 */
export const BackfillPaymentRequestSchema = z.object({
    /** The MercadoPago `payment.id` to write into the ledger. */
    mpPaymentId: z.string().min(1),
    /** The local subscription the charge belongs to. */
    localSubscriptionId: z.string().uuid(),
    /** Operator justification — see {@link ForceLinkPreapprovalRequestSchema.reason}. */
    reason: z.string().trim().min(10).max(500)
});

/** @see BackfillPaymentRequestSchema */
export type BackfillPaymentRequest = z.infer<typeof BackfillPaymentRequestSchema>;

/**
 * What a backfill did.
 *
 * `'already-recorded'` is a success: it means a `billing_payments` row for this
 * MercadoPago payment already existed, so the ledger was already correct and
 * nothing was written twice.
 */
export const BackfillPaymentOutcomeSchema = z.enum(['recorded', 'already-recorded']);

/** @see BackfillPaymentOutcomeSchema */
export type BackfillPaymentOutcome = z.infer<typeof BackfillPaymentOutcomeSchema>;

/** Response of a successful backfill. */
export const BackfillPaymentResponseSchema = z.object({
    outcome: BackfillPaymentOutcomeSchema,
    mpPaymentId: z.string(),
    localSubscriptionId: z.string(),
    /** The `billing_payments.id` that now carries this charge. */
    billingPaymentId: z.string(),
    /** The recorded amount, echoed back in centavos so the operator can verify it. */
    amountInCents: z.number().int(),
    currency: z.string(),
    auditedAt: z.coerce.date()
});

/** @see BackfillPaymentResponseSchema */
export type BackfillPaymentResponse = z.infer<typeof BackfillPaymentResponseSchema>;

/**
 * Pagination envelope for the divergence report.
 *
 * Declared here rather than reused from the shared list-route envelope because
 * this endpoint is NOT a `createAdminListRoute`: the report has to carry
 * {@link BillingDivergenceReportSchema.truncated} at the top level, and the list
 * factory's response shape has room for `items` and `pagination` only. Paging
 * still speaks `page`/`pageSize` per the admin convention.
 */
export const BillingDivergencePaginationSchema = z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
});

/** @see BillingDivergencePaginationSchema */
export type BillingDivergencePagination = z.infer<typeof BillingDivergencePaginationSchema>;

/**
 * The divergence report as the admin screen receives it.
 */
export const BillingDivergenceReportSchema = z.object({
    items: z.array(BillingDivergenceItemSchema),
    pagination: BillingDivergencePaginationSchema,
    /**
     * True when a MercadoPago sweep hit its page ceiling, making `total` a FLOOR
     * rather than a count.
     *
     * The screen MUST render this. A partial report that presents itself as
     * complete tells an operator "there are no other divergences" on evidence
     * that only says "we stopped looking", and that reading is exactly how an
     * unrecorded charge stays unrecorded.
     */
    truncated: z.boolean(),
    /** How many MercadoPago requests this report cost. */
    mpCallCount: z.number().int(),
    /**
     * How many of those were rate-limited and retried.
     *
     * Surfaced rather than swallowed: a rising count is the early signal that the
     * measured 350 ms pacing no longer matches MercadoPago's undisclosed budget.
     */
    mpRateLimitedCount: z.number().int()
});

/** @see BillingDivergenceReportSchema */
export type BillingDivergenceReport = z.infer<typeof BillingDivergenceReportSchema>;
