import type { ReconciliationMarkReason, SelectSubscription } from '@repo/db';
import { getDb, reconciliationMarkModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { claimedRefundAmount, lockRefundSource } from '../../../refund/refund-source.js';
import type { ReconciliationDivergence } from '../reconciliation-divergence.js';
import type { ExpectedAmountPolicy } from './expected-amount.js';
import type { ReconciliationDailySummary } from './reconciliation-daily-summary.port.js';

const logger = createLogger('billing-period-charges-comparison');
const OVERCHARGED = 'IMPORTE_COBRADO_DE_MAS' as const satisfies ReconciliationMarkReason;

/** Compare one credited period charge with its anchored period price (AC:B11:11). */
export async function compareCreditedChargeAmount(input: {
    readonly subscription: SelectSubscription;
    readonly paymentId: string;
    readonly chargeId: string;
    readonly chargedMinor: number;
    readonly chargeCurrency: string;
    readonly chargeCreatedAt: Date;
    readonly isAlreadyHung: () => Promise<boolean>;
    readonly ports: {
        readonly expectedAmounts: ExpectedAmountPolicy;
        readonly dailySummary: ReconciliationDailySummary;
    };
}): Promise<readonly ReconciliationDivergence[]> {
    const expected = await input.ports.expectedAmounts.expectedAmount({
        subscription: input.subscription,
        purpose: { kind: 'PERIOD', chargeCreatedAt: input.chargeCreatedAt }
    });
    if (expected.kind === 'NOT_COMPARABLE') return [];
    if (expected.currency !== input.chargeCurrency) {
        logger.warn(
            {
                subscriptionId: input.subscription.id,
                paymentId: input.paymentId,
                chargeId: input.chargeId,
                expectedCurrency: expected.currency,
                chargedCurrency: input.chargeCurrency
            },
            'Skipping period charge amount comparison because currencies differ'
        );
        return [];
    }

    const differenceMinor = input.chargedMinor - expected.amountMinor;
    if (differenceMinor === 0) return [];
    if (differenceMinor < 0) {
        await input.ports.dailySummary.addUndercharge({
            subscriptionId: input.subscription.id,
            paymentId: input.paymentId,
            chargeId: input.chargeId,
            expectedMinor: expected.amountMinor,
            chargedMinor: input.chargedMinor,
            differenceMinor,
            currency: input.chargeCurrency
        });
        return [];
    }

    if (
        (await input.isAlreadyHung()) ||
        (await reconciliationMarkModel.hasPaymentHungOnReason({
            subscriptionId: input.subscription.id,
            paymentId: input.paymentId,
            reason: OVERCHARGED
        }))
    )
        return [];

    const source = { kind: 'PAYMENT' as const, id: input.paymentId };
    const claimed = await getDb().transaction(async (tx) => {
        await lockRefundSource({ tx, source });
        return claimedRefundAmount({ tx, source });
    });
    const proposedRefundMinor = differenceMinor - claimed;
    if (proposedRefundMinor <= 0) return [];
    return [
        {
            reason: OVERCHARGED,
            payment: { source: 'PAYMENT', id: input.paymentId },
            detail: [
                { field: 'provider.charge_id', new: input.chargeId },
                { field: 'provider.charge_amount_minor', new: input.chargedMinor },
                { field: 'reconciliation_mark.expected_minor', new: expected.amountMinor },
                { field: 'reconciliation_mark.proposed_refund_minor', new: proposedRefundMinor }
            ]
        }
    ];
}
