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

/** Provider operations used by the cutover. Implemented by `createProviderApi` and by test doubles. */
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
    | 'PROVIDER_ERROR';

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

/** The output manifest: ids and counts only, no data about people. */
export interface CutoverManifest {
    readonly schemaVersion: 1;
    readonly outcome: 'ok' | 'failed' | 'dry-run';
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly census: { readonly plans: WalkSummary; readonly preapprovals: WalkSummary };
    readonly cancelledPlanIds: readonly string[];
    readonly cancelledPreapprovalIds: readonly string[];
    readonly rereadCancelledIds: readonly string[];
    readonly preservedProbeIds: readonly string[];
    readonly unknownLiveIds: readonly string[];
    readonly failures: readonly CutoverFailure[];
}
