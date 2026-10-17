import type { Clock } from '@repo/billing-verticals-contract';
import {
    coveredPeriods,
    emailOutbox,
    eq,
    inArray,
    payments,
    promoCodes,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    refunds,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import { createRecordedAmountMutationDecisions } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decision.js';
import type { AmountMutationDecisions } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decisions.port.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import type { ReconciliationDailySummary } from '../../../src/services/billing/reconciliation/sweep/comparisons/reconciliation-daily-summary.port.js';
import { createStateComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/state-comparison.js';
import {
    type ReconciliationSweepPorts,
    runReconciliationSweep
} from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { setExpectedPlanAmount } from './support/period-comparison-fixtures.js';
import {
    resetSeededTerminalReturnInventory,
    withSeededTerminalReturnInventory
} from './support/terminal-return-fixtures.js';

const trackedRows = new Map<string, string>();
type ExitGameFakeOptions = {
    readonly clock: Clock;
} & Pick<ConstructorParameters<typeof FakePaymentProvider>[0], 'honestAbout'>;

/** Returns a mutable test clock whose advances add exact milliseconds. */
export function exitGameClock(start = new Date('2026-11-01T10:00:00.000Z')): {
    readonly clock: Clock;
    set(at: Date): void;
    advanceDays(days: number): void;
    advanceMs(ms: number): void;
} {
    let instant = start.getTime();
    return {
        clock: { now: () => new Date(instant) },
        set: (at) => {
            instant = at.getTime();
        },
        advanceDays: (days) => {
            instant += days * 86_400_000;
        },
        advanceMs: (ms) => {
            instant += ms;
        }
    };
}

/** Creates the exit-game fake with an isolated provider id namespace. */
export function exitGameFake(input: ExitGameFakeOptions): FakePaymentProvider {
    return new FakePaymentProvider({ idNamespace: crypto.randomUUID(), ...input });
}

/** Mirrors the production sweep's comparison list (H5); TEST:1611:1 pins the cron to these three. */
export function exitGameComparisons(input: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly mutations?: AmountMutationDecisions;
    readonly dailySummary?: ReconciliationDailySummary;
}) {
    return [
        createStateComparison(),
        createPeriodChargesComparison({
            provider: input.provider,
            ...(input.dailySummary ? { dailySummary: input.dailySummary } : {})
        }),
        createAmountComparison({
            provider: input.provider,
            clock: input.clock,
            mutations: input.mutations ?? createRecordedAmountMutationDecisions()
        })
    ];
}

/** Runs the production comparison set and B11 ports over this test's seeded rows only. */
export async function runExitGameSweep(input: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly correlationId?: string;
    readonly mutations?: AmountMutationDecisions;
    readonly dailySummary?: ReconciliationDailySummary;
    readonly extraPorts?: Partial<ReconciliationSweepPorts>;
}) {
    const provider = input.provider;
    const beforeCancelNotice = outboxBeforeCancelNotice({ deliver: true });
    return withSeededReconciliationInventory(() =>
        withSeededCancellationRetryInventory(() =>
            withSeededTerminalReturnInventory(() =>
                runReconciliationSweep(
                    { ...(input.correlationId ? { correlationId: input.correlationId } : {}) },
                    {
                        provider,
                        clock: input.clock,
                        comparisons: exitGameComparisons(input),
                        markPayments: createPaymentReconciliationMarkPayments(input.clock),
                        cancellationRetry: { beforeCancelNotice },
                        terminalReturn: { beforeCancelNotice },
                        cancellationSeen: providerLinkCancellationSeen,
                        livenessPing: { ping: async () => undefined },
                        ...input.extraPorts
                    }
                )
            )
        )
    );
}

/** Tracks an owned subscription and recipient for afterEach cleanup. */
export function trackExitGameRow(subscriptionId: string, userId: string): void {
    trackedRows.set(subscriptionId, userId);
}

/** Seeds one approved payment against an explicitly anchored expected period amount. */
export async function seedChargedExitGameRow(input: {
    readonly provider: FakePaymentProvider;
    readonly clock: Clock;
    readonly expectedMinor: number;
    readonly chargedMinor: number;
}) {
    const { subscription, providerId } = await seedSubscription({
        status: 'ACTIVE',
        withLink: true,
        fake: input.provider
    });
    if (!subscription.userId || !providerId) throw new Error('Linked charged row is incomplete');
    trackExitGameRow(subscription.id, subscription.userId);
    await setExpectedPlanAmount({
        subscriptionId: subscription.id,
        amountMinor: input.expectedMinor
    });
    const charged = await input.provider.charge({
        authorizationId: providerId,
        amount: { amountMinor: input.chargedMinor, currency: 'ARS' },
        reference: subscription.id
    });
    await recordChargeFact(
        { chargeId: charged.chargeId },
        {
            provider: input.provider as unknown as PaymentProvider,
            clock: input.clock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            markPayments: createPaymentReconciliationMarkPayments(input.clock)
        }
    );
    const [payment] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, charged.chargeId));
    if (!payment) throw new Error('recordChargeFact did not persist the charged payment');
    return { subscription, providerId, chargeId: charged.chargeId, payment };
}

/** Cleans this game's marks and rows, retaining provider links on receipt tombstones. */
export async function retireExitGameRows(): Promise<void> {
    const db = getServiceTestDb();
    const ids = [...trackedRows.keys()];
    const userIds = [...new Set(trackedRows.values())];
    if (ids.length > 0) {
        await db
            .delete(successionRetainedPayments)
            .where(inArray(successionRetainedPayments.subscriptionId, ids));
        for (const subscriptionId of ids) {
            const [row] = await db
                .select({ userId: subscriptions.userId, class: subscriptions.class })
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            const marks = await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId }
            });
            for (const mark of marks) {
                await db
                    .update(reconciliationMarkPayments)
                    .set({ resolvedAt: new Date() })
                    .where(eq(reconciliationMarkPayments.markId, mark.id));
                await reconciliationMarkModel.lift({
                    markId: mark.id,
                    expectedVersion: mark.version,
                    liftedBy: row?.userId ?? userIds[0]!,
                    now: new Date()
                });
            }
            const paymentRows = await db
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, subscriptionId));
            for (const payment of paymentRows)
                await db.delete(refunds).where(eq(refunds.paymentId, payment.id));
            const redemptions = await db
                .select({ promoCodeId: promoRedemptions.promoCodeId })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.subscriptionId, subscriptionId));
            await db
                .delete(promoRedemptions)
                .where(eq(promoRedemptions.subscriptionId, subscriptionId));
            for (const redemption of redemptions)
                await db.delete(promoCodes).where(eq(promoCodes.id, redemption.promoCodeId));
            await db
                .update(payments)
                .set({ status: 'FAILED', factAt: new Date('2000-01-01T00:00:00.000Z') })
                .where(eq(payments.subscriptionId, subscriptionId));
            await db
                .delete(coveredPeriods)
                .where(eq(coveredPeriods.subscriptionId, subscriptionId));
            if (row?.class !== 'LAPIDA') {
                await db
                    .delete(providerLinks)
                    .where(eq(providerLinks.subscriptionId, subscriptionId));
                await db
                    .update(subscriptions)
                    .set({ status: 'ABANDONED' })
                    .where(eq(subscriptions.id, subscriptionId));
            }
        }
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
    }
    trackedRows.clear();
    resetSeededReconciliationInventory();
    resetSeededTerminalReturnInventory();
}
