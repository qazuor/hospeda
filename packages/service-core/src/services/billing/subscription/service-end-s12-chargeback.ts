/**
 * S12's second event (AC:B8a:7, TRANS:B:S12, DEC-SUB-020 📌1): a chargeback ends a
 * scheduled principal now. S31 cuts a live successor before orphanhood. S18 does not run:
 * an abandoned successor must not close the succession as a normal service end would.
 * This event writes `service_ends_at = now` because retention reads that column to decide
 * whether service remains live; the scheduled date no longer describes this row.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    type DrizzleClient,
    emailOutboxModel,
    eq,
    getDb,
    payments,
    subscriptions,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved,
    runOrphanhood
} from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from './before-cancel-notice-kinds';
import { pauseComplementsS32 } from './complement-pause-s32';
import type { ComplementPolicyPorts } from './complement-ports';
import { emitServiceEndRemoved } from './service-end-s12';
import type { BeforeCancelNotice } from './start-subscription.service';
import type {
    CancellationSeenAnnotator,
    ScheduledChangeApplier
} from './subscription-billing-ports';
import { completeSuccessorCut } from './successor-cut-after-commit';
import type { SuccessorCutResult, SuccessorCutter } from './successor-cutter';

const logger = createLogger('service-end-s12-chargeback');
const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    paymentId: z.uuid(),
    now: z.date()
});

/** Input for the chargeback event of S12. */
export interface S12ChargebackInput {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly now: Date;
}

/** Transactional and after-commit dependencies of chargeback S12. */
export interface S12ChargebackPorts {
    readonly successorCutter: SuccessorCutter;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly clock: Clock;
    readonly provider: PaymentProvider;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    readonly complements?: ComplementPolicyPorts;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly db?: DrizzleClient;
}

/** The one S12 write, or the state that prevented it. */
export type S12ChargebackResult =
    | {
          readonly outcome: 'CANCELLED';
          readonly subscriptionId: string;
          readonly successorCut: SuccessorCutResult['outcome'];
          readonly cancelledAddons: number;
          readonly mailEnqueued: boolean;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE' | 'ALREADY_CANCELLED';
          readonly subscriptionId: string;
      };

async function enqueueChargebackMail(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly userId: string;
    readonly vertical: string;
}): Promise<boolean> {
    const [recipient] = await input.tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
    if (!recipient?.email) {
        logger.error({ subscriptionId: input.subscriptionId }, 'No recipient for chargeback S12');
        return false;
    }
    const [payment] = await input.tx
        .select({ amount: payments.amount, currency: payments.currency, factAt: payments.factAt })
        .from(payments)
        .where(
            and(eq(payments.id, input.paymentId), eq(payments.subscriptionId, input.subscriptionId))
        )
        .limit(1);
    if (!payment)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Chargeback payment missing',
            undefined,
            'S12_CHARGEBACK_PAYMENT_MISSING'
        );
    const template = BEFORE_CANCEL_TEMPLATE_BY_KIND.CHARGEBACK_SUSPENSION;
    await emailOutboxModel.enqueue(
        {
            recipientUserId: input.userId,
            recipientEmail: recipient.email,
            template,
            payload: {
                subscriptionId: input.subscriptionId,
                vertical: input.vertical,
                paymentMethod: 'CARD',
                touristVipLost: false,
                oneTimeAddons: [],
                chargedBackPayment: {
                    amountMinor: payment.amount,
                    currency: payment.currency,
                    chargedOn: getLocalDateString({
                        instant: payment.factAt,
                        timeZone: 'Etc/GMT+4'
                    })
                },
                courtesyEnded: false,
                origin: 'CANCEL_SCHEDULED'
            },
            dedupKey: buildEmailDedupKey({
                recipient: input.userId,
                template,
                occurrence: buildEventOccurrence({ eventId: input.paymentId })
            })
        },
        input.tx
    );
    return true;
}

/** Ends a scheduled principal immediately after its credited payment was reread as charged back. */
export async function applyS12ByChargeback(
    input: S12ChargebackInput,
    ports: S12ChargebackPorts
): Promise<S12ChargebackResult> {
    const { subscriptionId, paymentId, now } = inputSchema.parse(input);
    const committed = await (ports.db ?? getDb()).transaction(async (tx) => {
        const [row] = await tx
            .select({
                class: subscriptions.class,
                status: subscriptions.status,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1)
            .for('update');
        if (!row)
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'Subscription missing',
                undefined,
                'S12_CHARGEBACK_SUBSCRIPTION_MISSING'
            );
        if (row.class !== 'PRINCIPAL')
            return { outcome: 'NOT_APPLICABLE' as const, subscriptionId };
        if (row.status === 'CANCELLED')
            return { outcome: 'ALREADY_CANCELLED' as const, subscriptionId };
        if (row.status !== 'CANCEL_SCHEDULED')
            return { outcome: 'NOT_APPLICABLE' as const, subscriptionId };
        if (!row.userId || !row.vertical)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Principal has no subject',
                undefined,
                'S12_CHARGEBACK_WITHOUT_SUBJECT'
            );
        const [written] = await tx
            .update(subscriptions)
            .set({
                status: 'CANCELLED',
                serviceEndsAt: now,
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: now
            })
            .where(
                and(
                    eq(subscriptions.id, subscriptionId),
                    eq(subscriptions.status, 'CANCEL_SCHEDULED')
                )
            )
            .returning({ id: subscriptions.id });
        if (!written)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription left CANCEL_SCHEDULED under lock',
                undefined,
                'S12_STATE_CHANGED'
            );
        const cut = await ports.successorCutter.cutSuccessor({
            predecessorSubscriptionId: subscriptionId,
            tx
        });
        await recordCoverageLossIfUncovered({
            tx,
            userId: row.userId,
            vertical: row.vertical,
            lostAt: now,
            clock: ports.clock
        });
        const { cancelled } = await runOrphanhood({ tx, subscriptionId, now }, ports.orphanhood);
        const mailEnqueued = await enqueueChargebackMail({
            tx,
            subscriptionId,
            paymentId,
            userId: row.userId,
            vertical: row.vertical
        });
        return {
            outcome: 'CANCELLED' as const,
            subscriptionId,
            userId: row.userId,
            vertical: row.vertical,
            cut,
            cancelled,
            mailEnqueued
        };
    });
    if (committed.outcome !== 'CANCELLED') return committed;
    try {
        await completeSuccessorCut(committed.cut, ports);
    } catch (error) {
        logger.error({ subscriptionId, error }, 'S31 completion failed after chargeback S12');
    }
    try {
        const coverageNotices = ports.coverageNotices ?? unwiredCoverageNotices;
        await emitServiceEndRemoved({
            ended: [committed],
            coverageNotices: {
                emitCoverageChanged: (event) => coverageNotices.emitCoverageChanged(event)
            }
        });
    } catch (error) {
        logger.error({ subscriptionId, error }, 'Coverage notice failed after chargeback S12');
    }
    try {
        await emitAddonCoverageRemoved({
            cancelled: committed.cancelled,
            coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
        });
    } catch (error) {
        logger.error(
            { subscriptionId, error },
            'Addon coverage notice failed after chargeback S12'
        );
    }
    try {
        await cancelAddonComplementsAtProvider({ cancelled: committed.cancelled }, ports);
    } catch (error) {
        logger.error(
            { subscriptionId, error },
            'Addon provider cancellation failed after chargeback S12'
        );
    }
    if (ports.complements) {
        try {
            await pauseComplementsS32(
                { principalSubscriptionId: subscriptionId, trigger: 'PRINCIPAL_LEFT_LIVE_ROWS' },
                { provider: ports.provider, clock: ports.clock, policy: ports.complements }
            );
        } catch (error) {
            logger.error({ subscriptionId, error }, 'S32 failed after chargeback S12');
        }
    }
    return {
        outcome: 'CANCELLED',
        subscriptionId,
        successorCut: committed.cut.outcome,
        cancelledAddons: committed.cancelled.length,
        mailEnqueued: committed.mailEnqueued
    };
}
