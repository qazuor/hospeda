import { confirmRefund, resolveRefund } from './abort-inverse.ts';
import { DEFAULT_RETRY_BACKOFF_MS, verifyCancelled } from './cancel.ts';
import { ProviderError } from './provider-api.ts';
import type { CutoverFailure, CutoverManifest, DeliveryReader, ProviderApi } from './types.ts';
import { REFUND_DONE_STATUS } from './types.ts';

/** Delivery polling schedule for the step-4b probe and payment (milliseconds). */
export const DEFAULT_DELIVERY_WAITS_MS: readonly number[] = [
    2_000, 3_000, 5_000, 10_000, 20_000, 30_000, 60_000, 60_000
];

/** Inputs for the standalone step-4b provider probe and small payment. */
export interface RunStep4bInput {
    readonly api: ProviderApi;
    readonly readDelivery: DeliveryReader;
    readonly payment: {
        readonly amountArs: number;
        readonly cardToken: string;
        readonly paymentMethodId: string;
        readonly payerEmail: string;
    };
    readonly sleep: (ms: number) => Promise<void>;
    readonly deliveryWaitsMs?: readonly number[];
    readonly backoffMs?: readonly number[];
    readonly now?: () => Date;
    readonly onCheckpoint?: (manifest: CutoverManifest) => boolean;
}

/** Runs step 4b, retaining only provider ids and failures in its checkpoint manifest. */
export async function runStep4b({
    api,
    readDelivery,
    payment,
    sleep,
    deliveryWaitsMs = DEFAULT_DELIVERY_WAITS_MS,
    backoffMs = DEFAULT_RETRY_BACKOFF_MS,
    now = () => new Date(),
    onCheckpoint
}: RunStep4bInput): Promise<{ readonly ok: boolean; readonly manifest: CutoverManifest }> {
    const startedAt = now().toISOString();
    const idem = startedAt.replace(/[:.]/g, '');
    const probeKey = `cutover-4b-probe-${idem}`;
    const paymentKey = `cutover-4b-payment-${idem}`;
    const failures: CutoverFailure[] = [];
    let probeId: string | undefined;
    let paymentId: string | undefined;
    let refundId: string | undefined;
    const build = (outcome: CutoverManifest['outcome']): CutoverManifest => ({
        schemaVersion: 1,
        step: '4b',
        outcome,
        startedAt,
        finishedAt: now().toISOString(),
        census: { plans: { total: 0, walked: 0 }, preapprovals: { total: 0, walked: 0 } },
        cancelledPlanIds: [],
        cancelledPreapprovalIds: [],
        rereadCancelledIds: [],
        preservedProbeIds: [],
        unknownLiveIds: [],
        failures: [...failures],
        ...(probeId === undefined ? {} : { probeId }),
        ...(paymentId === undefined ? {} : { paymentId }),
        ...(refundId === undefined ? {} : { refundId })
    });
    const checkpoint = (): boolean => onCheckpoint?.(build('in-progress')) ?? true;
    const result = (): { readonly ok: boolean; readonly manifest: CutoverManifest } => {
        const ok = failures.length === 0;
        return { ok, manifest: build(ok ? 'ok' : 'failed') };
    };
    const failUnexpected = (error: unknown): void => {
        failures.push(
            error instanceof ProviderError
                ? { code: 'PROVIDER_ERROR', detail: error.message }
                : {
                      code: 'UNEXPECTED_ERROR',
                      detail: error instanceof Error ? error.message : 'unknown error'
                  }
        );
    };
    const awaitDelivery = async (
        channel: 'IPN' | 'WEBHOOKS',
        resourceId: string
    ): Promise<void> => {
        const read = async (): Promise<boolean> => {
            try {
                return await readDelivery({ channel, resourceId });
            } catch (error) {
                failures.push({
                    code: 'NEW_DB_ERROR',
                    id: resourceId,
                    detail: error instanceof Error ? error.message : 'delivery read failed'
                });
                return false;
            }
        };
        if (await read()) return;
        for (const wait of deliveryWaitsMs) {
            await sleep(wait);
            if (await read()) return;
        }
        failures.push({
            code: 'DELIVERY_NOT_SEEN',
            id: resourceId,
            detail: `delivery for ${channel} resource was not seen`
        });
    };

    if (!checkpoint()) {
        failures.push({
            code: 'MANIFEST_WRITE_FAILED',
            detail: 'the first manifest checkpoint could not be written; nothing was called'
        });
        return result();
    }
    try {
        const probe = await api.createProbe({
            payerEmail: payment.payerEmail,
            idempotencyKey: probeKey
        });
        if (probe.id === null) {
            failures.push({
                code: 'PROVIDER_ERROR',
                detail: `probe create answered HTTP ${probe.httpStatus}; idempotency key ${probeKey}`
            });
            return result();
        }
        probeId = probe.id;
        if (!checkpoint())
            failures.push({
                code: 'MANIFEST_WRITE_FAILED',
                id: probeId,
                detail: 'probe id checkpoint could not be written'
            });
        if (failures.length === 0) {
            try {
                await api.getById({ kind: 'preapproval', id: probeId });
                await awaitDelivery('WEBHOOKS', probeId);
            } catch (error) {
                failUnexpected(error);
            }
        }
        // The probe must always be closed once its id exists, including a missing delivery.
        await api.cancel({ kind: 'preapproval', id: probeId });
        const verification = await verifyCancelled({
            api,
            targets: [{ kind: 'preapproval', id: probeId }],
            sleep,
            backoffMs
        });
        if (verification.stuck.length > 0)
            failures.push({
                code: 'NOT_CANCELLED',
                id: probeId,
                detail: `preapproval still '${verification.stuck[0]?.lastStatus ?? 'unknown'}' after the retries`
            });
        if (failures.length > 0) return result();

        const created = await api.createPayment({ ...payment, idempotencyKey: paymentKey });
        if (created.id === null) {
            failures.push({
                code: 'PROVIDER_ERROR',
                detail: `payment create answered HTTP ${created.httpStatus}; idempotency key ${paymentKey}`
            });
            return result();
        }
        paymentId = created.id;
        if (!checkpoint())
            failures.push({
                code: 'MANIFEST_WRITE_FAILED',
                id: paymentId,
                detail: 'payment id checkpoint could not be written'
            });
        let status = (await api.getPayment({ paymentId })).status;
        for (const wait of backoffMs) {
            if (status === 'approved') break;
            await sleep(wait);
            status = (await api.getPayment({ paymentId })).status;
        }
        if (status !== 'approved') {
            failures.push({
                code: 'PAYMENT_NOT_APPROVED',
                id: paymentId,
                detail: `payment remained '${status}' after the re-reads`
            });
            return result();
        }
        await awaitDelivery('IPN', paymentId);
        const refundFailures: CutoverFailure[] = [];
        const resolved = await resolveRefund({
            api,
            paymentId,
            knownRefundId: undefined,
            failures: refundFailures
        });
        failures.push(...refundFailures);
        if (resolved.refundId !== null) {
            refundId = resolved.refundId;
            if (!checkpoint())
                failures.push({
                    code: 'MANIFEST_WRITE_FAILED',
                    id: refundId,
                    detail: 'refund id checkpoint could not be written'
                });
            const refundStatus = await confirmRefund({
                api,
                paymentId,
                refundId,
                sleep,
                backoffMs
            });
            if (refundStatus !== REFUND_DONE_STATUS)
                failures.push({
                    code: 'REFUND_NOT_CONFIRMED',
                    id: refundId,
                    detail: `refund still '${refundStatus}' after the re-reads`
                });
        } else if (resolved.done !== 'not-charged' && refundFailures.length === 0) {
            failures.push({
                code: 'REFUND_NOT_CONFIRMED',
                id: paymentId,
                detail: 'refund call returned no refund id'
            });
        }
    } catch (error) {
        failUnexpected(error);
    }
    return result();
}
