import type {
    BillingDivergenceCandidate,
    BillingDivergenceItem,
    BillingDivergenceKind,
    BillingDivergenceOrphanPreapproval,
    BillingDivergenceReport,
    BillingDivergenceUnrecordedPayment,
    OrphanPaymentFlow,
    OrphanPaymentQueueItem,
    OrphanPaymentQueueReport,
    OrphanPaymentQueueStatus,
    OrphanPaymentReason,
    OrphanPaymentResolution
} from '@repo/schemas';

/**
 * Types for the orphan-payment rescue screen (HOS-765).
 *
 * Pure aliases of the schema package's types — `@repo/schemas` is the single
 * source of truth for this shape and the admin app must not restate it. The
 * sibling `billing-payments` feature learned this the expensive way: it invented
 * its own flat `Payment` interface with a bare `amount` in whole units and a
 * `method` field the API never sent, and the divergence was invisible at every
 * call site until money rendered wrong.
 *
 * Every monetary field here is integer CENTAVOS and says so in its name.
 *
 * @module features/billing-reconciliation/types
 */

/** One divergence row, discriminated by `kind`. */
export type Divergence = BillingDivergenceItem;

/** An approved MercadoPago payment with no `billing_payments` row. */
export type UnrecordedPayment = BillingDivergenceUnrecordedPayment;

/** An authorized preapproval no local subscription points at. */
export type OrphanPreapproval = BillingDivergenceOrphanPreapproval;

/** A local row a divergence could be bound to, with the signals that proposed it. */
export type DivergenceCandidate = BillingDivergenceCandidate;

/** Which side of the ledger a divergence sits on. */
export type DivergenceKind = BillingDivergenceKind;

/** The full report envelope, including the sweep's own honesty flags. */
export type DivergenceReport = BillingDivergenceReport;

/**
 * The rescue verb an operator is about to perform.
 *
 * Distinct from {@link DivergenceKind}: the kind describes what MercadoPago
 * shows, the action describes what the operator will write. They usually pair up
 * (an orphan preapproval is force-linked, an unrecorded payment is backfilled)
 * but they are not the same axis, and collapsing them would make the dialog
 * unable to express "this payment's preapproval also needs linking first".
 */
export type ReconcileAction = 'force-link' | 'backfill-payment';

/**
 * One row of the orphan-payment queue (HOS-1001).
 *
 * A DIFFERENT thing from a {@link Divergence}, and the screen must not blur
 * them. A divergence is what a sweep of MercadoPago FOUND after the fact; a
 * queue row is what the platform RECORDED at the instant it failed to book a
 * charge. The first costs paced third-party calls and can miss things; the
 * second is written synchronously by the flow that failed and cannot.
 */
export type OrphanQueueItem = OrphanPaymentQueueItem;

/** The queue listing envelope, including the unfiltered unresolved count. */
export type OrphanQueueReport = OrphanPaymentQueueReport;

/** Which confirmation flow could not book the payment. */
export type OrphanQueueFlow = OrphanPaymentFlow;

/** Why it could not be booked. */
export type OrphanQueueReason = OrphanPaymentReason;

/** Triage state of a queue row. */
export type OrphanQueueStatus = OrphanPaymentQueueStatus;

/** The two verdicts an operator may record. A row is never reopened. */
export type OrphanQueueResolution = OrphanPaymentResolution;
