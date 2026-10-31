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
import type { BillingFactSink } from '../facts/billing-fact-sink.js';
import {
    type CoverageNotices,
    type PromoChargePolicy,
    type PromoExhaustion,
    unwiredCoverageNotices
} from '../payment/payment-ports.js';
import { recordChargeFact } from '../payment/record-charge-fact.service.js';
import type { ChargebackDetection } from '../reconciliation/chargeback/chargeback-detection.js';
import {
    handleUnknownAuthorization,
    type UnknownAuthorizationArrival
} from '../reconciliation/handle-unknown-authorization.service.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port.js';
import { activatePendingWithSignupNotice } from '../subscription/activate-pending-with-signup-notice.js';
import { afterSubscriptionActivated } from '../subscription/after-activation-commit.js';
import type { TouristVipInheritancePort } from '../subscription/cancel-inherited-tourist-vip.service.js';
import type { ComplementPolicyPorts } from '../subscription/complement-ports.js';
import { declineFirstCharge } from '../subscription/decline-first-charge.service.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    type FirstChargeReader,
    noCancellationSeenAnnotation,
    noCreditedPayments,
    recordAuthorizationSeenAlive,
    recordCancellationSeen,
    type ScheduledChangeApplier,
    type SubscriptionPayments,
    type SuccessionCloser,
    unimplementedSuccessionCloser,
    unknownFirstCharge
} from '../subscription/subscription-billing-ports.js';
import { logProviderNoticeFailure } from './log-provider-notice-failure.js';
import { mirrorOurCancellationOnActive } from './mirror-our-cancellation-on-active.js';
import {
    getProviderNoticeMirror,
    type ProviderNoticeMirror,
    type ReadState
} from './provider-notice-mirror.js';
import { type MirrorDelegates, unregisteredMirrorDelegates } from './provider-notice-ports.js';
import { UnsupportedProviderAuthorizationError } from './unsupported-provider-authorization.error.js';

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
    | 'UNSUPPORTED_AUTHORIZATION'
    | 'RELINKED'
    | 'UNKNOWN_BECAME_KNOWN'
    | 'TOMBSTONE_WRITTEN'
    | 'RESOURCE_KIND_NOT_HANDLED'
    | 'UNSUPPORTED_NOTICE'
    | 'CHARGEBACK_MARKED'
    | 'CHARGEBACK_ON_UNCREDITED'
    | 'REFUNDED_NOT_CREDITED'
    | 'DEFERRED'
    | 'FAILED';
export interface ProcessProviderNoticePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
    readonly changeDirection?: VerticalsForBilling['changeDirection'];
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly payments?: SubscriptionPayments;
    readonly firstCharge?: FirstChargeReader;
    readonly successionCloser?: SuccessionCloser;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly delegates?: MirrorDelegates;
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    /** Reaches S7's Tourist VIP clause through `recordChargeFact` (AC:B7:31); unwired skips it. */
    readonly touristVipInheritance?: TouristVipInheritancePort;
    /** S38's interface, reaching S7 through `recordChargeFact` (AC:B7:28); unwired uses its failing default. */
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    /**
     * Hangs a payment on a reconciliation mark. The unknown-authorization handler
     * uses it to hang a receipt tombstone's payment on its mark (B11 §2.4), and
     * `recordChargeFact` for S5's/S7's reason 7; unwired, both use their default.
     */
    readonly markPayments?: ReconciliationMarkPayments;
    /** The internal chargeback interface (AC:B11:27), handed to `recordChargeFact`. */
    readonly chargebacks?: ChargebackDetection;
    readonly complements?: ComplementPolicyPorts;
}

/**
 * What the unknown-authorization handler left for the receiver: a final outcome
 * to answer with, or `LINKED` when the authorization now has a `provider_link`
 * (re-linked here, or by a concurrent process) and a charge can be recorded again.
 */
type UnknownResourceResolution =
    | { readonly kind: 'OUTCOME'; readonly outcome: Outcome }
    | { readonly kind: 'LINKED'; readonly outcome: Outcome };

/**
 * Hands an authorization with no `provider_link` to `handleUnknownAuthorization`
 * (B11 §2.4, AC:1676:4): the webhook of an unknown preapproval IS its detection.
 * The handler re-reads it by id and re-links it, writes a receipt tombstone (with
 * its mark and, unless it is a manifest probe, its cancellation) or marks the
 * named row. A resource the provider does not have (`NOT_FOUND`) has nothing to
 * link or cancel: `UNKNOWN_RESOURCE`. Any other error propagates (ack `ERROR`).
 * A re-link never mirrors in this notice: re-linking changes neither money nor
 * state (AC:B11:2); the next notice or the sweep mirrors.
 *
 * @param input.authorizationId - The provider id with no `provider_link`
 * @param input.arrival - What arrived: the authorization, or a charge of it
 * @param ports - The receiver's ports
 * @returns The outcome to answer with, or `LINKED`
 */
async function resolveUnknownAuthorization(
    input: { readonly authorizationId: string; readonly arrival: UnknownAuthorizationArrival },
    ports: ProcessProviderNoticePorts
): Promise<UnknownResourceResolution> {
    const correlationId = crypto.randomUUID();
    let result: Awaited<ReturnType<typeof handleUnknownAuthorization>>;
    try {
        result = await handleUnknownAuthorization(
            { authorizationId: input.authorizationId, arrival: input.arrival, correlationId },
            {
                provider: ports.provider,
                clock: ports.clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                ...(ports.markPayments === undefined ? {} : { markPayments: ports.markPayments }),
                ...(ports.coverageNotices === undefined
                    ? {}
                    : { coverageNotices: ports.coverageNotices }),
                ...(ports.billingFacts === undefined ? {} : { billingFacts: ports.billingFacts })
            }
        );
    } catch (error) {
        if (error instanceof PaymentProviderError && error.code === 'NOT_FOUND')
            return { kind: 'OUTCOME', outcome: 'UNKNOWN_RESOURCE' };
        if (error instanceof PaymentProviderError && error.code === 'UNSUPPORTED') {
            const unsupported = new UnsupportedProviderAuthorizationError({
                authorizationId: input.authorizationId,
                ...(input.arrival.kind === 'CHARGE' ? { chargeId: input.arrival.chargeId } : {}),
                providerStatus: error.providerStatus,
                providerCadence: error.providerCadence,
                correlationId,
                cause: error
            });
            logger.error(unsupported, unsupported.message, { capture: true });
            return { kind: 'OUTCOME', outcome: 'UNSUPPORTED_AUTHORIZATION' };
        }
        throw error;
    }
    if (result.outcome === 'RELINKED') return { kind: 'LINKED', outcome: 'RELINKED' };
    if (result.outcome === 'KNOWN') return { kind: 'LINKED', outcome: 'UNKNOWN_BECAME_KNOWN' };
    if (result.tombstone) return { kind: 'OUTCOME', outcome: 'TOMBSTONE_WRITTEN' };
    if (input.arrival.kind === 'CHARGE')
        // H-11 A: the named row has a live link of its own; no payment is written on it.
        logger.warn(
            {
                subscriptionId: result.subscriptionId,
                chargeId: input.arrival.chargeId,
                markId: result.markId,
                correlationId
            },
            'Charge of an unknown authorization marked on the named row without a payment'
        );
    return { kind: 'OUTCOME', outcome: 'DIVERGENCE_MARKED' };
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
            let result = await recordChargeFact({ chargeId: notice.resourceId }, ports);
            if (result.outcome === 'NO_SUBSCRIPTION' && result.authorizationId !== null) {
                const unknown = await resolveUnknownAuthorization(
                    {
                        authorizationId: result.authorizationId,
                        arrival: { kind: 'CHARGE', chargeId: notice.resourceId }
                    },
                    ports
                );
                if (unknown.kind === 'OUTCOME') return { ack: 'OK', outcome: unknown.outcome };
                // Linked now: record the charge once more; a second NO_SUBSCRIPTION ends below.
                result = await recordChargeFact({ chargeId: notice.resourceId }, ports);
            }
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
            if (result.outcome === 'CHARGEBACK_DETECTED')
                return { ack: 'OK', outcome: 'CHARGEBACK_MARKED' };
            if (
                result.outcome === 'CHARGEBACK_ON_UNCREDITED' ||
                result.outcome === 'REFUNDED_NOT_CREDITED'
            )
                return { ack: 'OK', outcome: result.outcome };
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
        if (!link) {
            const unknown = await resolveUnknownAuthorization(
                { authorizationId: notice.resourceId, arrival: { kind: 'AUTHORIZATION' } },
                ports
            );
            return { ack: 'OK', outcome: unknown.outcome };
        }
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
                await afterSubscriptionActivated({ subscription: row }, ports);
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
                await delegates.delegate({
                    pair: action.pair,
                    subscriptionId: row.id,
                    readAt,
                    cancelledSeenAt: link.cancelledSeenAt
                });
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
                const ours = await mirrorOurCancellationOnActive(
                    { subscriptionId: row.id, readAt, everyMonths: snapshot.cadence.everyMonths },
                    {
                        clock: ports.clock,
                        coverageNotices: ports.coverageNotices,
                        complements: ports.complements,
                        provider: ports.provider,
                        beforeCancelNotice: ports.beforeCancelNotice
                    }
                );
                if (ours.outcome === 'LOST_RACE') continue;
                if (ours.outcome === 'SCHEDULED') {
                    resolved = true;
                    break;
                }
                // NOT_OURS: mirror the provider's (or payer's) cancellation below.
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
    } catch (error) {
        logProviderNoticeFailure({ error, channel: input.channel });
        // HOS-1968: the provider record is still being written; the receiver answers a
        // deliberate retryable status instead of a generic failure.
        if (error instanceof PaymentProviderError && error.incompleteRead)
            return { ack: 'ERROR', outcome: 'DEFERRED' };
        return { ack: 'ERROR', outcome: 'FAILED' };
    }
}
