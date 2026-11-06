import { type Clock, VerticalSchema } from '@repo/billing-verticals-contract';
import {
    and,
    courtesyGrants,
    eq,
    getDb,
    isNotNull,
    isNull,
    payments,
    providerLinks,
    sql,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports.js';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port.js';
import { confirmPrincipalPause } from './pause-subscription-provider.js';
import { computeReissueWindow } from './reissue-deferred-courtesy-support.js';

const logger = createLogger('reissue-deferred-courtesy-s9');
const inputSchema = z.strictObject({ successorSubscriptionId: z.uuid() });

class S9LostRaceError extends Error {
    constructor() {
        super('S9 transaction lost its guarded subscription update');
    }
}

/** The stable outcome of attempting S9 on a successor. */
export type ReissueDeferredCourtesyResult =
    | {
          readonly outcome: 'REISSUED';
          readonly grantId: string;
          readonly pauseId: string;
          readonly startsAt: Date;
          readonly endsAt: Date;
          readonly months: number;
          readonly providerCall: 'CONFIRMED' | 'NONE';
          readonly chargeMarksOpened: number;
      }
    | { readonly outcome: 'NOT_APPLIED' }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'SUCCESSOR_NOT_ACTIVE'
              | 'NOT_PRINCIPAL'
              | 'NO_DEFERRED_COURTESY'
              | 'ALREADY_PAUSED';
      }
    | { readonly outcome: 'LOST_RACE' };

/** Re-emits the deferred grant as one atomic courtesy pause on an ACTIVE successor. */
export async function reissueDeferredCourtesy(
    input: { readonly successorSubscriptionId: string },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly markPayments: ReconciliationMarkPayments;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<ReissueDeferredCourtesyResult> {
    const value = inputSchema.parse(input);
    const db = getDb();
    const [successor] = await db
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            class: subscriptions.class,
            paymentMethod: subscriptions.paymentMethod,
            firstChargeAt: subscriptions.firstChargeAt,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, value.successorSubscriptionId))
        .limit(1);
    if (!successor) return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_ACTIVE' };
    if (successor.class !== 'PRINCIPAL')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' };
    if (!successor.userId || !successor.vertical)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'S9 successor lacks coverage owner',
            undefined,
            'S9_SUCCESSOR_OWNER_MISSING'
        );

    const rows = await db
        .select({
            id: courtesyGrants.id,
            balanceMonths: courtesyGrants.balanceMonths,
            beneficiaryUserId: courtesyGrants.beneficiaryUserId
        })
        .from(courtesyGrants)
        .innerJoin(subscriptions, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.succeededById, successor.id),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt)
            )
        );
    if (rows.length === 0) return { outcome: 'NOT_APPLICABLE', reason: 'NO_DEFERRED_COURTESY' };
    if (rows.length > 1)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Multiple deferred courtesy grants found for S9 successor',
            undefined,
            'S9_MULTIPLE_DEFERRED_GRANTS'
        );
    const grant = rows[0];
    if (!grant || grant.balanceMonths === null || grant.balanceMonths <= 0)
        return { outcome: 'NOT_APPLICABLE', reason: 'NO_DEFERRED_COURTESY' };
    if (successor.status === 'PAUSED')
        return { outcome: 'NOT_APPLICABLE', reason: 'ALREADY_PAUSED' };
    if (successor.status !== 'ACTIVE')
        return { outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_ACTIVE' };
    const now = ports.clock.now();
    const hasPayment = await creditedPaymentsFromLedger.hasCreditedPayment({
        subscriptionId: successor.id
    });
    const creditEndsAt =
        successor.firstChargeAt && successor.firstChargeAt > now && !hasPayment
            ? successor.firstChargeAt
            : null;
    const window = computeReissueWindow({ now, balanceMonths: grant.balanceMonths, creditEndsAt });

    let providerCall: 'CONFIRMED' | 'NONE' = 'NONE';
    if (successor.paymentMethod === 'CARD') {
        const [link] = await db
            .select({ authorizationId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, successor.id))
            .limit(1);
        if (!link)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'S9 card successor has no provider link',
                undefined,
                'S9_PROVIDER_LINK_MISSING'
            );
        const confirmation = await confirmPrincipalPause({
            subscriptionId: successor.id,
            authorizationId: link.authorizationId,
            provider: ports.provider,
            clock: ports.clock
        });
        if (confirmation === 'NOT_APPLIED') {
            logger.error(
                { grantId: grant.id, successorSubscriptionId: successor.id },
                'S9 pause was not applied; deferred courtesy remains open',
                { capture: true }
            );
            return { outcome: 'NOT_APPLIED' };
        }
        providerCall = 'CONFIRMED';
    }

    type WrittenResult =
        | { readonly kind: 'LOST_RACE' }
        | { readonly kind: 'ALREADY_PAUSED' }
        | {
              readonly kind: 'REISSUED';
              readonly pauseId: string;
              readonly chargeMarksOpened: number;
              readonly userId: string;
              readonly vertical: string;
          };
    let written: WrittenResult;
    try {
        written = await db.transaction(async (tx) => {
            const [locked] = await tx
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.id, successor.id))
                .for('update')
                .limit(1);
            if (!locked) return { kind: 'LOST_RACE' as const };
            const [openPause] = await tx
                .select({ id: subscriptionPauses.id })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, successor.id),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                )
                .limit(1);
            if (openPause) return { kind: 'ALREADY_PAUSED' as const };
            const [moved] = await tx
                .update(courtesyGrants)
                .set({
                    subscriptionId: successor.id,
                    startsAt: window.startsAt,
                    endsAt: window.endsAt,
                    balanceMonths: null
                })
                .where(
                    and(
                        eq(courtesyGrants.id, grant.id),
                        isNotNull(courtesyGrants.balanceMonths),
                        isNull(courtesyGrants.balanceClosedAt)
                    )
                )
                .returning({ id: courtesyGrants.id });
            if (!moved) return { kind: 'LOST_RACE' as const };
            const [paused] = await tx
                .update(subscriptions)
                .set({ status: 'PAUSED', updatedAt: now })
                .where(and(eq(subscriptions.id, successor.id), eq(subscriptions.status, 'ACTIVE')))
                .returning({
                    id: subscriptions.id,
                    userId: subscriptions.userId,
                    vertical: subscriptions.vertical
                });
            if (!paused) throw new S9LostRaceError();
            if (!paused.userId || !paused.vertical)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'S9 successor lost its coverage owner',
                    undefined,
                    'S9_SUCCESSOR_OWNER_MISSING'
                );
            const [pause] = await tx
                .insert(subscriptionPauses)
                .values({
                    subscriptionId: successor.id,
                    reason: 'COURTESY',
                    requestedMonths: grant.balanceMonths,
                    startsAt: now,
                    expectedEndAt: window.endsAt
                })
                .returning({ id: subscriptionPauses.id });
            if (!pause) throw new Error('S9 pause insert returned no row');
            const charges = await tx
                .select({ id: payments.id })
                .from(payments)
                .where(
                    and(
                        eq(payments.subscriptionId, successor.id),
                        sql`${payments.status} IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')`,
                        sql`${payments.factAt} <= ${now}`
                    )
                );
            for (const charge of charges)
                await openReconciliationMark(
                    {
                        subject: { kind: 'SUBSCRIPTION', subscriptionId: successor.id },
                        reason: 'COBRO_DURANTE_CORTESIA',
                        payment: { source: 'PAYMENT', id: charge.id },
                        actor: { type: 'job' },
                        correlationId: crypto.randomUUID(),
                        tx
                    },
                    { markPayments: ports.markPayments }
                );
            return {
                kind: 'REISSUED' as const,
                pauseId: pause.id,
                chargeMarksOpened: charges.length,
                userId: paused.userId,
                vertical: paused.vertical
            };
        });
    } catch (error) {
        if (error instanceof S9LostRaceError) {
            written = { kind: 'LOST_RACE' };
        } else {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505' && cause.constraint === 'uq_subscription_pause_open')
                return { outcome: 'NOT_APPLICABLE', reason: 'ALREADY_PAUSED' };
            throw error;
        }
    }
    if (written.kind === 'ALREADY_PAUSED')
        return { outcome: 'NOT_APPLICABLE', reason: 'ALREADY_PAUSED' };
    if (written.kind === 'LOST_RACE') {
        if (providerCall === 'CONFIRMED')
            await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: successor.id },
                    reason: 'TRANSICION_NO_DECLARADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID()
                },
                { markPayments: ports.markPayments }
            );
        return { outcome: 'LOST_RACE' };
    }
    try {
        await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
            userId: written.userId,
            vertical: VerticalSchema.parse(written.vertical),
            sourceType: 'SUBSCRIPTION',
            change: 'CHANGED'
        });
    } catch (error) {
        logger.error(
            { successorSubscriptionId: successor.id, error },
            'S9 coverage notice failed after commit'
        );
    }
    return {
        outcome: 'REISSUED',
        grantId: grant.id,
        pauseId: written.pauseId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        months: grant.balanceMonths,
        providerCall,
        chargeMarksOpened: written.chargeMarksOpened
    };
}
