import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import {
    actStartInstant,
    assertFreshForAct,
    type NoticeDelivery,
    type PaymentProvider
} from '@repo/payments';
import { z } from 'zod';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { declineFirstCharge } from '../subscription/decline-first-charge.service.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    type FirstChargeReader,
    noCreditedPayments,
    type SubscriptionPayments,
    type SuccessionCloser,
    unimplementedSuccessionCloser,
    unknownFirstCharge
} from '../subscription/subscription-billing-ports.js';
import { PROVIDER_NOTICE_MIRROR, type ReadState } from './provider-notice-mirror.js';
import { type MirrorDelegates, unregisteredMirrorDelegates } from './provider-notice-ports.js';

const inputSchema = z.strictObject({
    channel: z.enum(['WEBHOOKS', 'IPN']),
    delivery: z.object({ headers: z.record(z.string(), z.string()), body: z.string() })
});
type Outcome =
    | 'IPN_NOT_PROCESSED'
    | 'DISCARDED_OLD_VERSION'
    | 'APPLIED'
    | 'NOOP'
    | 'DIVERGENCE_MARKED'
    | 'DELEGATED'
    | 'S16'
    | 'WAITING_FIRST_CHARGE_READING'
    | 'UNKNOWN_RESOURCE'
    | 'RESOURCE_KIND_NOT_HANDLED'
    | 'FAILED';
export interface ProcessProviderNoticePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly payments?: SubscriptionPayments;
    readonly firstCharge?: FirstChargeReader;
    readonly successionCloser?: SuccessionCloser;
    readonly delegates?: MirrorDelegates;
}

/** Processes a provider delivery by re-reading its resource; the delivery never supplies state. */
export async function processProviderNotice(
    input: { readonly channel: 'WEBHOOKS' | 'IPN'; readonly delivery: NoticeDelivery },
    ports: ProcessProviderNoticePorts
): Promise<{ readonly ack: 'OK' | 'ERROR'; readonly outcome: Outcome }> {
    try {
        const value = inputSchema.parse(input);
        if (value.channel === 'IPN') return { ack: 'OK', outcome: 'IPN_NOT_PROCESSED' };
        const notice = await ports.provider.decodeNotice(value.delivery);
        if (notice.resourceKind === 'charge') {
            const result = await declineFirstCharge({ chargeId: notice.resourceId }, ports);
            return {
                ack: 'OK',
                outcome: result.outcome === 'DECLINED' ? 'S16' : 'RESOURCE_KIND_NOT_HANDLED'
            };
        }
        if (notice.resourceKind === 'refund')
            return { ack: 'OK', outcome: 'RESOURCE_KIND_NOT_HANDLED' };
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.providerId, notice.resourceId))
            .limit(1);
        if (!link) return { ack: 'OK', outcome: 'UNKNOWN_RESOURCE' };
        if (
            /^\d+$/.test(notice.version) &&
            /^\d+$/.test(link.lastAppliedVersion ?? '') &&
            BigInt(notice.version) <= BigInt(link.lastAppliedVersion as string)
        )
            return { ack: 'OK', outcome: 'DISCARDED_OLD_VERSION' };

        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({ authorizationId: link.providerId });
        const { snapshot, readAt } = assertFreshForAct({ read, act });
        let finalOutcome: Outcome = 'APPLIED';
        const payments = ports.payments ?? noCreditedPayments;
        const firstCharge = ports.firstCharge ?? unknownFirstCharge;
        const closer = ports.successionCloser ?? unimplementedSuccessionCloser;
        const delegates = ports.delegates ?? unregisteredMirrorDelegates;

        let resolved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const [row] = await getDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, link.subscriptionId))
                .limit(1);
            if (!row) return { ack: 'OK', outcome: 'UNKNOWN_RESOURCE' };
            const action =
                PROVIDER_NOTICE_MIRROR[snapshot.status as ReadState][
                    row.status as keyof typeof PROVIDER_NOTICE_MIRROR.pending
                ];
            if (action.kind === 'NOOP') finalOutcome = 'NOOP';
            if (action.kind === 'S2') {
                const changed = await subscriptionModel.activatePendingAuthorization({
                    subscriptionId: row.id,
                    now: ports.clock.now()
                });
                if (!changed) continue;
            }
            if (action.kind === 'DIVERGENCE') {
                await openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: row.id },
                    reason: 'TRANSICION_NO_DECLARADA',
                    actor: { type: 'provider' },
                    correlationId: crypto.randomUUID()
                });
                finalOutcome = 'DIVERGENCE_MARKED';
            }
            if (action.kind === 'DELEGATE') {
                await delegates.delegate({ pair: action.pair, subscriptionId: row.id });
                finalOutcome = 'DELEGATED';
            }
            if (action.kind === 'PROVIDER_CANCEL') {
                if (!(await payments.hasCreditedPayment({ subscriptionId: row.id }))) {
                    const first = await firstCharge.readFirstCharge({ subscriptionId: row.id });
                    if (first.outcome === 'UNKNOWN')
                        return { ack: 'OK', outcome: 'WAITING_FIRST_CHARGE_READING' };
                    if (first.outcome === 'REJECTED') {
                        const declined = await declineFirstCharge(
                            { chargeId: first.chargeId },
                            ports
                        );
                        finalOutcome =
                            declined.outcome === 'DECLINED' ? 'S16' : 'RESOURCE_KIND_NOT_HANDLED';
                        resolved = true;
                        break;
                    }
                }
                const changed = await getDb().transaction(async (tx) => {
                    const [updated] = await tx
                        .update(subscriptions)
                        .set({
                            status: 'CANCELLED',
                            serviceEndsAt: readAt,
                            updatedAt: ports.clock.now()
                        })
                        .where(
                            and(eq(subscriptions.id, row.id), eq(subscriptions.status, 'ACTIVE'))
                        )
                        .returning();
                    if (!updated) return false;
                    const [successor] = await tx
                        .select({ id: subscriptions.id })
                        .from(subscriptions)
                        .where(
                            and(
                                eq(subscriptions.succeedsId, row.id),
                                eq(subscriptions.class, 'PRINCIPAL'),
                                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
                            )
                        )
                        .limit(1);
                    if (successor)
                        await closer.closeSuccession({ predecessorSubscriptionId: row.id, tx });
                    return true;
                });
                if (!changed) continue;
            }
            resolved = true;
            break;
        }
        if (!resolved) throw new Error('Subscription mirror lost three optimistic updates');
        const lastModified =
            snapshot.lastModifiedAt === null ? null : new Date(snapshot.lastModifiedAt);
        const versionCondition =
            link.lastAppliedVersion === null
                ? isNull(providerLinks.lastAppliedVersion)
                : eq(providerLinks.lastAppliedVersion, link.lastAppliedVersion);
        const [saved] = await getDb()
            .update(providerLinks)
            .set({ lastAppliedVersion: notice.version, lastModified })
            .where(and(eq(providerLinks.id, link.id), versionCondition))
            .returning();
        if (!saved) throw new Error('Provider link version changed concurrently');
        return { ack: 'OK', outcome: finalOutcome };
    } catch {
        return { ack: 'ERROR', outcome: 'FAILED' };
    }
}
