import { DEFAULT_RETRY_BACKOFF_MS, verifyCancelled } from './cancel.ts';
import { ProviderError } from './provider-api.ts';
import type { InverseManifest } from './read-manifest.ts';
import type { CutoverFailure, ProviderApi } from './types.ts';
import {
    CANCELLED_STATUS,
    NOT_CHARGED_PAYMENT_STATUSES,
    REFUND_DONE_STATUS,
    REFUNDABLE_PAYMENT_STATUS
} from './types.ts';

/** What inverse (b) did with the delivery probe. */
export type ProbeInverseAction = 'absent' | 'already-cancelled' | 'cancelled' | 'failed';

/** What inverse (c) did with the small payment. */
export type PaymentInverseAction =
    | 'absent'
    | 'not-charged'
    | 'already-refunded'
    | 'refunded'
    | 'failed';

/** Record of one inverse run: ids, actions and fixed text only, no data about people. */
export interface AbortInverseReport {
    readonly schemaVersion: 1;
    readonly kind: 'abort-inverse';
    readonly outcome: 'ok' | 'failed';
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly probe: { readonly id: string | null; readonly action: ProbeInverseAction };
    readonly payment: {
        readonly id: string | null;
        readonly refundId: string | null;
        readonly action: PaymentInverseAction;
    };
    readonly failures: readonly CutoverFailure[];
}

/** Input of {@link runAbortInverse}. */
export interface RunAbortInverseInput {
    readonly api: ProviderApi;
    /** The manifest of the aborted run (partial or finished). Only its step-4b ids are used. */
    readonly manifest: InverseManifest;
    readonly sleep: (ms: number) => Promise<void>;
    /** Waits between re-reads (probe: re-cancel and re-read; refund: re-read only). */
    readonly backoffMs?: readonly number[];
    readonly now?: () => Date;
}

/** Result of {@link runAbortInverse}. */
export interface RunAbortInverseResult {
    readonly ok: boolean;
    readonly report: AbortInverseReport;
}

function toFailure({ error }: { readonly error: unknown }): CutoverFailure {
    if (error instanceof ProviderError) return { code: 'PROVIDER_ERROR', detail: error.message };
    return {
        code: 'UNEXPECTED_ERROR',
        detail: error instanceof Error ? error.message : 'unknown error'
    };
}

/**
 * Inverse (b): re-reads the delivery probe by id; if it is not `cancelled`, cancels it and
 * verifies by re-reading (with the step-2 retries).
 */
async function inverseProbe({
    api,
    probeId,
    sleep,
    backoffMs,
    failures
}: {
    readonly api: ProviderApi;
    readonly probeId: string | undefined;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs: readonly number[];
    readonly failures: CutoverFailure[];
}): Promise<ProbeInverseAction> {
    if (probeId === undefined) return 'absent';
    const target = { kind: 'preapproval' as const, id: probeId };
    try {
        const first = await api.getById(target);
        if (first.status === CANCELLED_STATUS) return 'already-cancelled';
        await api.cancel(target);
        const { stuck } = await verifyCancelled({ api, targets: [target], sleep, backoffMs });
        if (stuck.length === 0) return 'cancelled';
        failures.push({
            code: 'NOT_CANCELLED',
            id: probeId,
            detail: `delivery probe still '${stuck[0]?.lastStatus ?? 'unknown'}' after the retries`
        });
    } catch (error) {
        failures.push({ ...toFailure({ error }), id: probeId });
    }
    return 'failed';
}

/** Re-reads a refund by id (never re-sending it) until it is done or the waits run out. */
async function confirmRefund({
    api,
    paymentId,
    refundId,
    sleep,
    backoffMs
}: {
    readonly api: ProviderApi;
    readonly paymentId: string;
    readonly refundId: string;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs: readonly number[];
}): Promise<string> {
    let status = (await api.getRefund({ paymentId, refundId })).status;
    for (const wait of backoffMs) {
        if (status === REFUND_DONE_STATUS) break;
        await sleep(wait);
        status = (await api.getRefund({ paymentId, refundId })).status;
    }
    return status;
}

/** Finds the refund to confirm: the manifest's, one the payment already carries, or a new one. */
async function resolveRefund({
    api,
    paymentId,
    knownRefundId,
    failures
}: {
    readonly api: ProviderApi;
    readonly paymentId: string;
    readonly knownRefundId: string | undefined;
    readonly failures: CutoverFailure[];
}): Promise<{
    readonly refundId: string | null;
    readonly created: boolean;
    readonly done?: 'not-charged';
}> {
    if (knownRefundId !== undefined) return { refundId: knownRefundId, created: false };
    const payment = await api.getPayment({ paymentId });
    const existing = payment.refundIds.at(-1);
    if (existing !== undefined) return { refundId: existing, created: false };
    if (NOT_CHARGED_PAYMENT_STATUSES.includes(payment.status)) {
        return { refundId: null, created: false, done: 'not-charged' };
    }
    if (payment.status !== REFUNDABLE_PAYMENT_STATUS) {
        failures.push({
            code: 'UNEXPECTED_STATUS',
            id: paymentId,
            detail: `payment '${payment.status}' is not in a status the inverse refunds`
        });
        return { refundId: null, created: false };
    }
    const call = await api.refundPayment({ paymentId });
    if (call.refundId !== null) return { refundId: call.refundId, created: true };
    // The answer carried no id: the payment itself is the source of truth for its refunds.
    const reread = (await api.getPayment({ paymentId })).refundIds.at(-1);
    if (reread !== undefined) return { refundId: reread, created: true };
    failures.push({
        code: 'REFUND_NOT_CONFIRMED',
        id: paymentId,
        detail: `refund call answered HTTP ${call.httpStatus} and the payment lists no refund`
    });
    return { refundId: null, created: false };
}

/**
 * Inverse (c): if the small payment was made and not refunded, refunds it; in every case where a
 * refund exists it is re-read by id until it reads done.
 */
async function inversePayment({
    api,
    manifest,
    sleep,
    backoffMs,
    failures
}: {
    readonly api: ProviderApi;
    readonly manifest: InverseManifest;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs: readonly number[];
    readonly failures: CutoverFailure[];
}): Promise<{ readonly refundId: string | null; readonly action: PaymentInverseAction }> {
    const { paymentId } = manifest;
    if (paymentId === undefined) {
        if (manifest.refundId === undefined) return { refundId: null, action: 'absent' };
        failures.push({
            code: 'UNEXPECTED_ERROR',
            id: manifest.refundId,
            detail: 'manifest carries a refund id without its payment id'
        });
        return { refundId: manifest.refundId, action: 'failed' };
    }
    try {
        const resolved = await resolveRefund({
            api,
            paymentId,
            knownRefundId: manifest.refundId,
            failures
        });
        if (resolved.done === 'not-charged') return { refundId: null, action: 'not-charged' };
        if (resolved.refundId === null) return { refundId: null, action: 'failed' };
        const status = await confirmRefund({
            api,
            paymentId,
            refundId: resolved.refundId,
            sleep,
            backoffMs
        });
        if (status === REFUND_DONE_STATUS) {
            return {
                refundId: resolved.refundId,
                action: resolved.created ? 'refunded' : 'already-refunded'
            };
        }
        failures.push({
            code: 'REFUND_NOT_CONFIRMED',
            id: resolved.refundId,
            detail: `refund still '${status}' after the re-reads`
        });
        return { refundId: resolved.refundId, action: 'failed' };
    } catch (error) {
        failures.push({ ...toFailure({ error }), id: paymentId });
        return { refundId: manifest.refundId ?? null, action: 'failed' };
    }
}

/**
 * Runs the abort-branch inverses (b) and (c) of the cutover (AC:U3:9), acting ONLY on the ids of
 * the given manifest. Ids that are absent (an abort before step 4b) are not a failure: there is
 * nothing to undo. It creates nothing and sends nothing to anybody: its only provider calls are
 * reads by id, a cancellation and a refund.
 *
 * @param input - provider client, the aborted run's manifest and the retry options
 * @returns `ok` and a report with the ids touched (the refund id included)
 */
export async function runAbortInverse({
    api,
    manifest,
    sleep,
    backoffMs = DEFAULT_RETRY_BACKOFF_MS,
    now = () => new Date()
}: RunAbortInverseInput): Promise<RunAbortInverseResult> {
    const startedAt = now().toISOString();
    const failures: CutoverFailure[] = [];
    const probeAction = await inverseProbe({
        api,
        probeId: manifest.probeId,
        sleep,
        backoffMs,
        failures
    });
    const payment = await inversePayment({ api, manifest, sleep, backoffMs, failures });
    const ok = failures.length === 0;
    return {
        ok,
        report: {
            schemaVersion: 1,
            kind: 'abort-inverse',
            outcome: ok ? 'ok' : 'failed',
            startedAt,
            finishedAt: now().toISOString(),
            probe: { id: manifest.probeId ?? null, action: probeAction },
            payment: {
                id: manifest.paymentId ?? null,
                refundId: payment.refundId,
                action: payment.action
            },
            failures
        }
    };
}
