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
import { openManualInstallmentInTx } from './manual-installment-opening';
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

/** The persisted manual signup and its first installment. */
export type StartManualSubscriptionResult = {
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly authorizationWindowEndsAt: Date;
};

/** S1 for manual payment: opens the first installment in the commitment transaction. */
export async function startManualSubscription(
    input: { readonly userId: string; readonly billingOptionId: string },
    ports: StartSubscriptionPorts
): Promise<StartManualSubscriptionResult> {
    const parsed = StartManualSubscriptionInputSchema.parse(input);
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
            vertical: choice.vertical
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
            subscriptionId: row.id
        });
        if (!installment) throw commitmentTaken();
        return {
            subscriptionId: row.id,
            manualPaymentId: installment.id,
            periodStart: installment.periodStart,
            authorizationWindowEndsAt: row.authorizationWindowEndsAt
        };
    };

    const existing = await reuse();
    if (existing) return existing;
    const deadlines = await getCurrentBillingDeadlines();
    const periodStart = ports.clock.now();
    const authorizationWindowEndsAt = new Date(
        periodStart.getTime() + deadlines.values['10'].manualDays * 24 * 60 * 60 * 1000
    );
    try {
        return await getDb().transaction(async (tx) => {
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
            return {
                subscriptionId: subscription.id,
                manualPaymentId: manualPayment.id,
                periodStart: manualPayment.periodStart,
                authorizationWindowEndsAt:
                    subscription.authorizationWindowEndsAt ?? authorizationWindowEndsAt
            };
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505' || cause.constraint !== 'uq_subscription_commitment_origin')
            throw error;
        const raced = await reuse();
        if (!raced) throw error;
        return raced;
    }
}
