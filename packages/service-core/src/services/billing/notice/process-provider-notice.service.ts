import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    type NoticeDelivery,
    type PaymentProvider,
    PaymentProviderError
} from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss.js';
import {
    type CoverageNotices,
    type PromoChargePolicy,
    type PromoExhaustion,
    unwiredCoverageNotices
} from '../payment/payment-ports.js';
import { recordChargeFact } from '../payment/record-charge-fact.service.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import { activatePendingWithSignupNotice } from '../subscription/activate-pending-with-signup-notice.js';
import type { TouristVipInheritancePort } from '../subscription/cancel-inherited-tourist-vip.service.js';
import { declineFirstCharge } from '../subscription/decline-first-charge.service.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    type FirstChargeReader,
    noCancellationSeenAnnotation,
    noCreditedPayments,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type SubscriptionPayments,
    type SuccessionCloser,
    unimplementedSuccessionCloser,
    unknownFirstCharge
} from '../subscription/subscription-billing-ports.js';
import {
    getProviderNoticeMirror,
    type ProviderNoticeMirror,
    type ReadState
} from './provider-notice-mirror.js';
import { type MirrorDelegates, unregisteredMirrorDelegates } from './provider-notice-ports.js';

const logger = createLogger('process-provider-notice');

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
    | 'S4'
    | 'PAYMENT_CREDITED'
    | 'PAYMENT_ALREADY_CREDITED'
    | 'CARD_VALIDATION_IGNORED'
    | 'PAYMENT_RECORDED'
    | 'WAITING_FIRST_CHARGE_READING'
    | 'UNKNOWN_RESOURCE'
    | 'RESOURCE_KIND_NOT_HANDLED'
    | 'UNSUPPORTED_NOTICE'
    | 'FAILED';
export interface ProcessProviderNoticePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly payments?: SubscriptionPayments;
    readonly firstCharge?: FirstChargeReader;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly delegates?: MirrorDelegates;
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
    /** Reaches S7's Tourist VIP clause through `recordChargeFact` (AC:B7:31); unwired skips it. */
    readonly touristVipInheritance?: TouristVipInheritancePort;
}

/** Processes a provider delivery by re-reading its resource; the delivery never supplies state. */
export async function processProviderNotice(
    input: { readonly channel: 'WEBHOOKS' | 'IPN'; readonly delivery: NoticeDelivery },
    ports: ProcessProviderNoticePorts
): Promise<{ readonly ack: 'OK' | 'ERROR'; readonly outcome: Outcome }> {
    try {
        const value = inputSchema.parse(input);
        if (value.channel === 'IPN') return { ack: 'OK', outcome: 'IPN_NOT_PROCESSED' };
        let notice: Awaited<ReturnType<PaymentProvider['decodeNotice']>>;
        try {
            notice = await ports.provider.decodeNotice(value.delivery);
        } catch (error) {
            if (error instanceof PaymentProviderError && error.code === 'INVALID_NOTICE') {
                return { ack: 'OK', outcome: 'UNSUPPORTED_NOTICE' };
            }
            throw error;
        }
        if (notice.resourceKind === 'charge') {
            const result = await recordChargeFact({ chargeId: notice.resourceId }, ports);
            if (result.outcome === 'CARD_VALIDATION_IGNORED')
                return { ack: 'OK', outcome: 'CARD_VALIDATION_IGNORED' };
            if (result.outcome === 'NO_SUBSCRIPTION')
                return { ack: 'OK', outcome: 'UNKNOWN_RESOURCE' };
            if (result.outcome === 'RECORDED_PENDING')
                return { ack: 'OK', outcome: 'PAYMENT_RECORDED' };
            if (result.outcome === 'CREDITED')
                return {
                    ack: 'OK',
                    outcome:
                        result.credit.outcome === 'CREDITED'
                            ? 'PAYMENT_CREDITED'
                            : 'PAYMENT_ALREADY_CREDITED'
                };
            if (result.outcome === 'GRACE')
                return {
                    ack: 'OK',
                    outcome:
                        result.grace.outcome === 'GRACE_STARTED'
                            ? 'S4'
                            : 'RESOURCE_KIND_NOT_HANDLED'
                };
            return {
                ack: 'OK',
                outcome: result.decline.outcome === 'DECLINED' ? 'S16' : 'RESOURCE_KIND_NOT_HANDLED'
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
        if (snapshot.status === 'cancelled')
            await recordCancellationSeen({
                annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                subscriptionId: link.subscriptionId,
                seenAt: readAt
            });
        else
            await recordAuthorizationSeenAlive({
                annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                subscriptionId: link.subscriptionId,
                seenAt: readAt
            });
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
                getProviderNoticeMirror()[snapshot.status as ReadState][
                    row.status as keyof ProviderNoticeMirror['pending']
                ];
            if (action.kind === 'NOOP') finalOutcome = 'NOOP';
            if (action.kind === 'S2') {
                const changed = await activatePendingWithSignupNotice(
                    { subscriptionId: row.id, now: ports.clock.now() },
                    { successionCloser: closer }
                );
                if (!changed) continue;
                // S2 committed: the row now emits its source, replacing the predecessor's when it succeeds one.
                const vertical = VerticalEnumSchema.safeParse(row.vertical);
                if (row.userId && vertical.success) {
                    try {
                        await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged(
                            {
                                userId: row.userId,
                                vertical: vertical.data,
                                sourceType: 'SUBSCRIPTION',
                                change: row.succeedsId ? 'CHANGED' : 'ADDED'
                            }
                        );
                    } catch (error) {
                        logger.error(
                            { subscriptionId: row.id, error },
                            'Coverage changed notice failed after activation commit'
                        );
                    }
                } else {
                    logger.error(
                        { subscriptionId: row.id, vertical: row.vertical },
                        'Activated subscription has no coverage subject to notify'
                    );
                }
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
                const cancelled = await getDb().transaction(async (tx) => {
                    const cancelledAt = ports.clock.now();
                    const [updated] = await tx
                        .update(subscriptions)
                        .set({
                            status: 'CANCELLED',
                            serviceEndsAt: readAt,
                            updatedAt: cancelledAt
                        })
                        .where(
                            and(eq(subscriptions.id, row.id), eq(subscriptions.status, 'ACTIVE'))
                        )
                        .returning();
                    if (!updated) return null;
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
                    // coberturaPerdidaEn in the same transaction as the drop (contract §4.1; I-5).
                    if (updated.userId)
                        await recordCoverageLossIfUncovered({
                            tx,
                            userId: updated.userId,
                            vertical: updated.vertical ?? '',
                            lostAt: cancelledAt,
                            clock: ports.clock
                        });
                    return { userId: updated.userId, vertical: updated.vertical };
                });
                if (!cancelled) continue;
                // CANCELLED emits no source (03-contrato-de-cobertura.md:474): notice after commit.
                const vertical = VerticalEnumSchema.safeParse(cancelled.vertical);
                if (cancelled.userId && vertical.success) {
                    try {
                        await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged(
                            {
                                userId: cancelled.userId,
                                vertical: vertical.data,
                                sourceType: 'SUBSCRIPTION',
                                change: 'REMOVED'
                            }
                        );
                    } catch (error) {
                        logger.error(
                            { subscriptionId: row.id, error },
                            'Coverage changed notice failed after provider cancellation commit'
                        );
                    }
                } else {
                    logger.error(
                        { subscriptionId: row.id, vertical: cancelled.vertical },
                        'Cancelled subscription has no coverage subject to notify'
                    );
                }
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
        if (!saved) {
            const [currentLink] = await getDb()
                .select({ lastAppliedVersion: providerLinks.lastAppliedVersion })
                .from(providerLinks)
                .where(eq(providerLinks.id, link.id))
                .limit(1);
            if (
                /^\d+$/.test(currentLink?.lastAppliedVersion ?? '') &&
                /^\d+$/.test(notice.version) &&
                BigInt(currentLink?.lastAppliedVersion ?? '0') >= BigInt(notice.version)
            )
                return { ack: 'OK', outcome: 'DISCARDED_OLD_VERSION' };
            throw new Error('Provider link version changed concurrently');
        }
        return { ack: 'OK', outcome: finalOutcome };
    } catch {
        return { ack: 'ERROR', outcome: 'FAILED' };
    }
}
