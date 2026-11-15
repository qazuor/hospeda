import type { DrizzleClient } from '@repo/db';
import {
    createManualPendingAuthorization,
    getDb,
    manualPaymentModel,
    subscriptionModel
} from '@repo/db';
import { isManualPaymentOnlyVertical, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import { enqueueManualInstallmentOpenedNotice } from './manual-installment-opened-notice';
import { openManualInstallmentInTx } from './manual-installment-opening';
import { enqueueManualInstallmentUnpaidNotice } from './manual-installment-unpaid-notice';
import { commitmentTaken } from './resolve-live-commitment';
import {
    assertPlanForSale,
    assertTouristVipPurchaseAllowed,
    closeDeclinedAttempts,
    readBillingChoice,
    type StartSubscriptionPorts
} from './start-subscription.service';

const StartManualSubscriptionInputSchema = z.strictObject({
    userId: z.uuid(),
    billingOptionId: z.uuid()
});

/** The persisted manual signup and its first installment (AC:V7:17, ACC:6). */
export type StartManualSubscriptionResult = {
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly authorizationWindowEndsAt: Date;
    readonly created: boolean;
};

/** Builds the additive result while keeping legacy deep-equality shapes stable (AC:V7:17, ACC:6). */
function manualSubscriptionResult(
    result: Omit<StartManualSubscriptionResult, 'created'>,
    created: boolean
): StartManualSubscriptionResult {
    const value = { ...result } as StartManualSubscriptionResult;
    Object.defineProperty(value, 'created', { value: created, enumerable: false });
    return value;
}

/** S1 for manual payment; joins a caller transaction and reports idempotency (AC:V7:17, ACC:6). */
export async function startManualSubscription(
    input: {
        readonly userId: string;
        readonly billingOptionId: string;
        readonly tx?: DrizzleClient;
    },
    ports: StartSubscriptionPorts
): Promise<StartManualSubscriptionResult> {
    const parsed = StartManualSubscriptionInputSchema.parse({
        userId: input.userId,
        billingOptionId: input.billingOptionId
    });
    const choice = await readBillingChoice({ billingOptionId: parsed.billingOptionId });
    if (!isManualPaymentOnlyVertical({ vertical: choice.vertical })) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Manual payment is not available for this vertical',
            undefined,
            'MANUAL_PAYMENT_NOT_AVAILABLE'
        );
    }
    await assertPlanForSale({ planVersionId: choice.planVersionId, planPolicy: ports.planPolicy });
    await assertTouristVipPurchaseAllowed({
        vertical: choice.vertical,
        userId: parsed.userId,
        touristVipInheritance: ports.touristVipInheritance
    });
    await closeDeclinedAttempts({ userId: parsed.userId, vertical: choice.vertical }, ports);

    const reuse = async (): Promise<StartManualSubscriptionResult | null> => {
        const existing = await subscriptionModel.findLiveCommitment({
            userId: parsed.userId,
            vertical: choice.vertical,
            tx: input.tx
        });
        if (!existing) return null;
        const row = existing.subscription;
        if (
            row.status !== 'PENDING_AUTHORIZATION' ||
            row.paymentMethod !== 'MANUAL' ||
            row.billingOptionId !== choice.id ||
            !row.authorizationWindowEndsAt ||
            ports.clock.now().getTime() >= row.authorizationWindowEndsAt.getTime()
        )
            throw commitmentTaken();
        const installment = await manualPaymentModel.findAwaitingInstallment({
            subscriptionId: row.id,
            tx: input.tx
        });
        if (!installment) throw commitmentTaken();
        return manualSubscriptionResult(
            {
                subscriptionId: row.id,
                manualPaymentId: installment.id,
                periodStart: installment.periodStart,
                authorizationWindowEndsAt: row.authorizationWindowEndsAt
            },
            false
        );
    };

    const existing = await reuse();
    if (existing) return existing;
    const deadlines = await getCurrentBillingDeadlines();
    const periodStart = ports.clock.now();
    const authorizationWindowEndsAt = new Date(
        periodStart.getTime() + deadlines.values['10'].manualDays * 24 * 60 * 60 * 1000
    );
    try {
        const create = async (tx: DrizzleClient): Promise<StartManualSubscriptionResult> => {
            const subscription = await createManualPendingAuthorization({
                userId: parsed.userId,
                vertical: choice.vertical,
                planVersionId: choice.planVersionId,
                billingOptionId: choice.id,
                authorizationWindowDeadlineVersion: deadlines.version,
                authorizationWindowEndsAt,
                tx
            });
            const { manualPayment } = await openManualInstallmentInTx({
                tx,
                subscriptionId: subscription.id,
                periodStart
            });
            await enqueueManualInstallmentUnpaidNotice({
                tx,
                manualPaymentId: manualPayment.id,
                subscriptionId: subscription.id,
                vertical: choice.vertical,
                periodStart,
                openedAt: periodStart,
                firstInstallment: true
            });
            await enqueueManualInstallmentOpenedNotice({
                tx,
                subscription,
                manualPaymentId: manualPayment.id,
                periodStart,
                dueAt: subscription.authorizationWindowEndsAt ?? authorizationWindowEndsAt,
                firstInstallment: true
            });
            return manualSubscriptionResult(
                {
                    subscriptionId: subscription.id,
                    manualPaymentId: manualPayment.id,
                    periodStart: manualPayment.periodStart,
                    authorizationWindowEndsAt:
                        subscription.authorizationWindowEndsAt ?? authorizationWindowEndsAt
                },
                true
            );
        };
        return input.tx ? await create(input.tx) : await getDb().transaction(create);
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505' || cause.constraint !== 'uq_subscription_commitment_origin')
            throw error;
        if (input.tx) throw error;
        const raced = await reuse();
        if (!raced) throw error;
        return raced;
    }
}
