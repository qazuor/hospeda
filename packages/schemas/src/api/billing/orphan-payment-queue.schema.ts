/**
 * Orphan-payment queue schemas (HOS-714 vocabulary, HOS-1001 reader).
 *
 * ## Why the vocabulary lives here and not in the API
 *
 * `billing_orphan_payments.flow` / `.reason` / `.status` are free `varchar`
 * columns; the only thing that keeps them a closed vocabulary is the code that
 * writes them. Until HOS-1001 that code was a pair of TypeScript unions inside
 * `apps/api/src/services/billing/orphan-payment-queue.service.ts` — invisible to
 * anything that wanted to READ the table, which is exactly what HOS-1001 had to
 * build. Moving the three vocabularies here makes the writer and the reader
 * agree by construction instead of by convention, per the repo's single-source
 * -of-truth rule for types and validation.
 *
 * ## What the queue is
 *
 * A row means **a payment provider confirmed a charge that Hospeda could not
 * book**. Two distinct families of that, and HOS-1001 is what added the second:
 *
 * 1. *The subscription cannot take it* — no local row, or a status the
 *    confirmation flow does not act on ({@link OrphanPaymentReasonSchema}'s
 *    `subscription-not-found` / `subscription-status-not-applicable`, HOS-714).
 * 2. *Our own ledger write failed* — the subscription is perfectly fine and
 *    `billing_payments` simply did not receive the row (`ledger-write-failed`).
 *    Four flows used to log that at `error` and continue, which left money
 *    collected with no accounting entry and no way to find out.
 *
 * They are one table because the human answer is the same either way: look at
 * it, decide, record what you decided.
 *
 * ## Money is integer centavos, and the field name says so
 *
 * Same rule as `payment-reconciliation.schema.ts`: every monetary field is
 * suffixed `InCents`. The DB column is already centavos; the reader never
 * converts.
 *
 * @module api/billing/orphan-payment-queue
 */

import { z } from 'zod';
import { createBooleanQueryParam } from '../http/base-http.schema.js';

/**
 * Which confirmation flow could not book the payment.
 *
 * Stored verbatim in `billing_orphan_payments.flow` so a human triaging the
 * queue knows which code path produced the row. Adding a value here is the ONLY
 * way a new flow may enqueue: the writer's parameter type is derived from this
 * enum, so an unlisted flow does not typecheck.
 */
export const OrphanPaymentFlowSchema = z.enum([
    /** Prorated delta paid upfront to move to a more expensive plan (SPEC-141 D7). */
    'plan-change-upgrade',
    /** Annual subscription paid upfront (SPEC-141 D1). */
    'annual-upfront',
    /** One-time add-on purchase confirmed by webhook (HOS-595 / HOS-1001). */
    'addon-purchase',
    /** Recurring charge booked by the dead-letter retry cron (HOS-1001). */
    'subscription-authorized-payment-retry'
]);

/** @see OrphanPaymentFlowSchema */
export type OrphanPaymentFlow = z.infer<typeof OrphanPaymentFlowSchema>;

/**
 * Why the payment could not be booked.
 *
 * Stored verbatim in `billing_orphan_payments.reason`. Kept coarse on purpose:
 * the precise status that blocked a flow travels in `observedStatus`, so a new
 * blocking status does not need a new reason code.
 *
 * `ledger-write-failed` is categorically different from its two siblings and
 * that difference is the whole of HOS-1001: the other two mean *the
 * subscription cannot receive this money*, this one means *the subscription is
 * fine and our own write to `billing_payments` failed*. A triaging human reads
 * the first two as "decide what this customer should get" and the third as
 * "the books are missing a row that is known to be owed".
 */
export const OrphanPaymentReasonSchema = z.enum([
    /** The subscription the payment names has no local row. */
    'subscription-not-found',
    /** A local row exists, but its status is not one the flow can act on. */
    'subscription-status-not-applicable',
    /** The subscription was applicable; the `billing_payments` insert threw (HOS-1001). */
    'ledger-write-failed'
]);

/** @see OrphanPaymentReasonSchema */
export type OrphanPaymentReason = z.infer<typeof OrphanPaymentReasonSchema>;

/**
 * Triage state of a queue row.
 *
 * `unresolved` is the only state the writer ever produces; the other two are an
 * operator's verdict.
 *
 * The distinction between them is deliberate and load-bearing for the counters:
 * `resolved` means *the money was accounted for* (the ledger row was backfilled,
 * or a refund was issued), `dismissed` means *no action was owed* (a sandbox
 * test, a duplicate, a charge that turned out to be booked elsewhere). Folding
 * them into one "closed" state would make it impossible to tell a queue that was
 * worked from a queue that was cleared.
 */
export const OrphanPaymentQueueStatusSchema = z.enum(['unresolved', 'resolved', 'dismissed']);

/** @see OrphanPaymentQueueStatusSchema */
export type OrphanPaymentQueueStatus = z.infer<typeof OrphanPaymentQueueStatusSchema>;

/**
 * The two verdicts an operator may record. A row can never be moved BACK to
 * `unresolved` through this API — reopening a triaged payment is a decision with
 * an audit trail of its own, not a button.
 */
export const OrphanPaymentResolutionSchema = z.enum(['resolved', 'dismissed']);

/** @see OrphanPaymentResolutionSchema */
export type OrphanPaymentResolution = z.infer<typeof OrphanPaymentResolutionSchema>;

/**
 * One queue row as the admin screen receives it.
 *
 * Mirrors `billing_orphan_payments` one-for-one except that `flow`, `reason` and
 * `status` are narrowed to their enums here rather than left as the raw
 * `varchar` the column holds. A legacy row carrying a value outside the enum
 * would fail this schema — which is the correct, loud outcome: the reader must
 * never quietly render a vocabulary it does not understand as if it did.
 */
export const OrphanPaymentQueueItemSchema = z.object({
    /** `billing_orphan_payments.id`. */
    id: z.string(),
    /** Payment provider that confirmed the charge (`mercadopago`). */
    provider: z.string(),
    /** The provider's own payment id — the handle an operator takes to MercadoPago. */
    providerPaymentId: z.string(),
    flow: OrphanPaymentFlowSchema,
    reason: OrphanPaymentReasonSchema,
    /** Local subscription the payment named. Null when the row never existed. */
    subscriptionId: z.string().nullable(),
    /** Local billing customer, when the subscription row was found. */
    customerId: z.string().nullable(),
    /** The charged amount, in integer centavos exactly as the column stores it. */
    amountInCents: z.number().int(),
    currency: z.string(),
    /**
     * `false` when the charge came from the MercadoPago sandbox.
     *
     * The first thing a triage decision needs is whether real money moved, so
     * this is not an optional detail the screen may drop.
     */
    livemode: z.boolean(),
    /** The local status observed at discard time, when there was a local row. */
    observedStatus: z.string().nullable(),
    /** Caller label of whatever observed the orphan (`webhook`, a cron job, …). */
    source: z.string(),
    status: OrphanPaymentQueueStatusSchema,
    /** What the human did about it. Null while unresolved. */
    resolutionNote: z.string().nullable(),
    /** Who recorded the verdict. Null while unresolved. */
    resolvedById: z.string().nullable(),
    resolvedAt: z.coerce.date().nullable(),
    /** Flow-specific context (plan ids, the ledger error message, metadata echoes). */
    metadata: z.record(z.string(), z.unknown()),
    detectedAt: z.coerce.date()
});

/** @see OrphanPaymentQueueItemSchema */
export type OrphanPaymentQueueItem = z.infer<typeof OrphanPaymentQueueItemSchema>;

/**
 * Query parameters for the queue listing.
 *
 * `page`/`pageSize` rather than `limit`, per the admin route convention.
 *
 * Note what is NOT here: a `since`. Unlike the divergence report next door, this
 * endpoint reads one local table with an index on `detected_at` and costs no
 * third-party calls, so there is no window to bound. An operator wants the whole
 * backlog by default, oldest incident still visible.
 */
export const OrphanPaymentQueueSearchSchema = z.object({
    /**
     * Restrict to one triage state.
     *
     * Defaults to `unresolved` — the queue's reason to exist is the work still
     * outstanding, and a default of "everything" would bury one live incident
     * under a year of settled ones.
     */
    status: OrphanPaymentQueueStatusSchema.default('unresolved'),
    /** Restrict to one confirmation flow. Omitted means all. */
    flow: OrphanPaymentFlowSchema.optional(),
    /** Restrict to one reason. Omitted means all. */
    reason: OrphanPaymentReasonSchema.optional(),
    /**
     * Restrict to real-money rows (`true`) or sandbox ones (`false`).
     *
     * Omitted means both, and the item's own `livemode` still says which is
     * which — the filter is a convenience, never the thing that keeps a sandbox
     * row from being mistaken for a real one.
     *
     * `createBooleanQueryParam`, NOT `z.coerce.boolean()`. A query parameter
     * arrives as a STRING, and `Boolean('false')` is `true` — so the coercing
     * form would answer `?livemode=false` with the real-money rows, which on
     * this endpoint specifically means handing back production charges to an
     * operator who asked to see the sandbox ones.
     */
    livemode: createBooleanQueryParam('Filter by real-money (true) or sandbox (false) rows'),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
});

/** @see OrphanPaymentQueueSearchSchema */
export type OrphanPaymentQueueSearch = z.infer<typeof OrphanPaymentQueueSearchSchema>;

/** Pagination envelope for the queue listing. */
export const OrphanPaymentQueuePaginationSchema = z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
});

/** @see OrphanPaymentQueuePaginationSchema */
export type OrphanPaymentQueuePagination = z.infer<typeof OrphanPaymentQueuePaginationSchema>;

/**
 * The queue listing as the admin screen receives it.
 *
 * `unresolvedTotal` is deliberately independent of the filter and of the page:
 * it is the number the screen shows as a badge, and it must not change when an
 * operator narrows the list to one flow. A filtered count would make an
 * outstanding incident disappear from the badge without being resolved.
 */
export const OrphanPaymentQueueReportSchema = z.object({
    items: z.array(OrphanPaymentQueueItemSchema),
    pagination: OrphanPaymentQueuePaginationSchema,
    /** Total UNRESOLVED rows in the table, ignoring every filter on this request. */
    unresolvedTotal: z.number().int()
});

/** @see OrphanPaymentQueueReportSchema */
export type OrphanPaymentQueueReport = z.infer<typeof OrphanPaymentQueueReportSchema>;

/**
 * Body for `POST /admin/billing/reconciliation/orphan-queue/resolve`.
 */
export const ResolveOrphanPaymentRequestSchema = z.object({
    /** `billing_orphan_payments.id` to close. */
    orphanPaymentId: z.string().uuid(),
    /** What the operator decided. */
    resolution: OrphanPaymentResolutionSchema,
    /**
     * What was actually done about the money, in the operator's own words.
     *
     * Required and non-trivial for the same reason the rescue verbs next door
     * require one: the ids record WHICH payment was closed and nothing at all
     * about whether the customer was made whole. This note is the only place a
     * future reader learns that.
     */
    note: z.string().trim().min(10).max(500)
});

/** @see ResolveOrphanPaymentRequestSchema */
export type ResolveOrphanPaymentRequest = z.infer<typeof ResolveOrphanPaymentRequestSchema>;

/** Response of a successful resolution. */
export const ResolveOrphanPaymentResponseSchema = z.object({
    orphanPaymentId: z.string(),
    /** The state the row now holds. */
    status: OrphanPaymentQueueStatusSchema,
    /** The provider payment id, echoed so the operator can verify what they closed. */
    providerPaymentId: z.string(),
    resolvedAt: z.coerce.date(),
    auditedAt: z.coerce.date()
});

/** @see ResolveOrphanPaymentResponseSchema */
export type ResolveOrphanPaymentResponse = z.infer<typeof ResolveOrphanPaymentResponseSchema>;
