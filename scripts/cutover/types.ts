/**
 * Shared types for the cutover script (U3, HOS-1426).
 *
 * This folder is standalone by design: it imports nothing from the old system,
 * the new system, or any payment SDK. It talks to the provider over native
 * fetch and reads the old database read-only, for known ids only.
 */

/** The two provider object families the cutover walks. */
export type ObjectKind = 'plan' | 'preapproval';

/** The only status the cutover treats as "done". */
export const CANCELLED_STATUS = 'cancelled';

/** Preapproval statuses that still bind a payer and must be cancelled (step 1b). */
export const LIVE_PREAPPROVAL_STATUSES: readonly string[] = ['pending', 'authorized', 'paused'];

/** One provider object as read by id. Only the id and status are ever kept. */
export interface ProviderObject {
    readonly kind: ObjectKind;
    readonly id: string;
    readonly status: string;
}

/** One page of the unfiltered provider search. */
export interface ListPage {
    readonly total: number;
    readonly results: readonly { readonly id: string; readonly status: string }[];
}

/** Outcome of one cancellation call. A call is never trusted: it is re-read by id. */
export interface CancelCallResult {
    readonly accepted: boolean;
    readonly httpStatus: number;
}

/** One payment as read by id: its status and the ids of the refunds it already carries. */
export interface PaymentRead {
    readonly id: string;
    readonly status: string;
    /** Refund ids the provider lists on the payment, oldest first. Ids only, never amounts or payers. */
    readonly refundIds: readonly string[];
}

/** One refund as read by id. */
export interface RefundRead {
    readonly id: string;
    readonly status: string;
}

/** Outcome of one refund call. Like a cancellation, it is never trusted: the refund is re-read by id. */
export interface RefundCallResult {
    readonly accepted: boolean;
    readonly httpStatus: number;
    /** The new refund id when the provider answered one, `null` otherwise. */
    readonly refundId: string | null;
}

/** Payment status that can (and must) be refunded by inverse (c). */
export const REFUNDABLE_PAYMENT_STATUS = 'approved';

/** Payment status after a full refund. */
export const REFUNDED_PAYMENT_STATUS = 'refunded';

/** Payment statuses that mean no money moved, so inverse (c) has nothing to give back. */
export const NOT_CHARGED_PAYMENT_STATUSES: readonly string[] = ['rejected', 'cancelled'];

/** The only refund status treated as done. */
export const REFUND_DONE_STATUS = 'approved';

/**
 * Provider operations used by the cutover. Implemented by `createProviderApi` and by test doubles.
 *
 * The step-4b delivery probe is a preapproval at the provider, so its re-read and cancellation
 * are `getById`/`cancel` with kind `preapproval`. The three payment methods are the minimal set
 * the abort inverses need (HOS-1427); U3.3 reuses them for the real step 4b.
 */
export interface ProviderApi {
    readonly listPage: (input: {
        readonly kind: ObjectKind;
        readonly offset: number;
        readonly limit: number;
    }) => Promise<ListPage>;
    readonly getById: (input: {
        readonly kind: ObjectKind;
        readonly id: string;
    }) => Promise<ProviderObject>;
    readonly cancel: (input: {
        readonly kind: ObjectKind;
        readonly id: string;
    }) => Promise<CancelCallResult>;
    readonly getPayment: (input: { readonly paymentId: string }) => Promise<PaymentRead>;
    /** Full refund of a payment. Carries a deterministic idempotency key, so a retry cannot refund twice. */
    readonly refundPayment: (input: { readonly paymentId: string }) => Promise<RefundCallResult>;
    readonly getRefund: (input: {
        readonly paymentId: string;
        readonly refundId: string;
    }) => Promise<RefundRead>;
}

/** Ids the old database knows, split by object family. Ids only, never rows. */
export interface KnownIds {
    readonly planIds: readonly string[];
    readonly preapprovalIds: readonly string[];
}

/** Resolves the ids the old database knows. Read-only by contract. */
export type KnownIdsReader = () => Promise<KnownIds>;

/** Stable failure codes. The run stops the cutover on any of them. */
export type FailureCode =
    | 'WALK_COUNT_MISMATCH'
    | 'KNOWN_ID_MISSING'
    | 'UNEXPECTED_STATUS'
    | 'NOT_CANCELLED'
    | 'REFUND_NOT_CONFIRMED'
    | 'MANIFEST_WRITE_FAILED'
    | 'PROVIDER_ERROR'
    | 'OLD_DB_ERROR'
    | 'UNEXPECTED_ERROR';

/** One failure. `detail` is fixed text plus ids: never provider payloads. */
export interface CutoverFailure {
    readonly code: FailureCode;
    readonly id?: string;
    readonly detail: string;
}

/** Walk totals per family, for the manifest. */
export interface WalkSummary {
    readonly total: number;
    readonly walked: number;
}

/**
 * Outcome of a run. `in-progress` marks a PARTIAL manifest: a checkpoint written while the run
 * was still going (an abort or a crash leaves it as the last word). Every other value marks a
 * FINISHED record, which is never overwritten.
 */
export type ManifestOutcome = 'in-progress' | 'ok' | 'failed' | 'dry-run';

/**
 * The output manifest: ids and counts only, no data about people.
 *
 * `probeId`, `paymentId` and `refundId` are the step-4b ids (the delivery probe preapproval,
 * the small payment and its refund). They are optional and absent until step 4b creates them,
 * so a manifest from a run that aborted before 4b has none of them. Adding them did not bump
 * `schemaVersion`: every version-1 reader keeps working (HOS-1427, owner decision 17).
 */
export interface CutoverManifest {
    readonly schemaVersion: 1;
    readonly outcome: ManifestOutcome;
    readonly startedAt: string;
    /** When the run finished; on an `in-progress` manifest, when that checkpoint was written. */
    readonly finishedAt: string;
    readonly census: { readonly plans: WalkSummary; readonly preapprovals: WalkSummary };
    readonly cancelledPlanIds: readonly string[];
    readonly cancelledPreapprovalIds: readonly string[];
    readonly rereadCancelledIds: readonly string[];
    readonly preservedProbeIds: readonly string[];
    readonly unknownLiveIds: readonly string[];
    readonly failures: readonly CutoverFailure[];
    readonly probeId?: string;
    readonly paymentId?: string;
    readonly refundId?: string;
}
