import { eq, subscriptions } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger';
import { createChargebackDetection } from '../../../../src/services/billing/reconciliation/chargeback/chargeback-detection';
import { cancelActiveSubscription } from '../../../../src/services/billing/subscription/cancel-active-subscription.service';
import { applyS12ByChargeback } from '../../../../src/services/billing/subscription/service-end-s12-chargeback';
import { startSuccession } from '../../../../src/services/billing/subscription/start-succession.service';
import {
    createSuccessorCutter,
    type SuccessorCutter
} from '../../../../src/services/billing/subscription/successor-cutter';
import { getServiceTestDb } from '../helpers';
import { orphanPorts } from './addon-orphan-fixtures';
import {
    approvedCharge,
    chargebackFixture,
    paymentOfCharge,
    recordCharge
} from './chargeback-fixtures';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice';
import { noTouristVip } from './tourist-vip';

const successors: string[] = [];

/** Retires successor rows created by these cases after each test. */
export async function retireServiceEndSuccessors(): Promise<void> {
    for (const id of successors.splice(0))
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, id));
}

/** A real credited payment followed by S11; no subscription or payment state is fabricated. */
export async function scheduledChargebackFixture(input: { readonly chargeBack?: boolean } = {}) {
    const fixture = await chargebackFixture();
    const chargeId = await approvedCharge(fixture);
    await recordCharge(fixture, chargeId);
    const payment = await paymentOfCharge(chargeId);
    const scheduled = await cancelActiveSubscription(
        {
            actor: {
                id: fixture.user.id,
                roles: [],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            },
            subscriptionId: fixture.started.subscriptionId
        },
        {
            provider: fixture.provider,
            clock: fixture.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: fixture.coverageNotices,
            complements: {
                addonPolicy: async () => {
                    throw new Error('No addon');
                },
                listing: async () => {
                    throw new Error('No listing');
                }
            }
        }
    );
    if (scheduled.outcome !== 'SCHEDULED') throw new Error('S11 did not schedule cancellation');
    const [subscription] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.started.subscriptionId));
    if (!subscription) throw new Error('Scheduled subscription missing');
    if (input.chargeBack !== false) await fixture.provider.chargeBack({ chargeId });
    return { fixture, chargeId, payment, subscription, scheduled };
}

/** Starts a pending successor using S1 on the scheduled predecessor. */
export async function pendingSuccessor(
    input: Awaited<ReturnType<typeof scheduledChargebackFixture>>
) {
    const started = await startSuccession(
        {
            userId: input.fixture.user.id,
            predecessorSubscriptionId: input.fixture.started.subscriptionId,
            billingOptionId: input.subscription.billingOptionId!,
            returnUrl: 'https://example.test/return'
        },
        {
            provider: input.fixture.provider,
            clock: input.fixture.clock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    successors.push(started.subscriptionId);
    return started;
}

/** Detection wired to the real S12 service and a replaceable S31 interface. */
export function s12ChargebackPorts(input: {
    readonly fixture: Awaited<ReturnType<typeof chargebackFixture>>;
    readonly successorCutter?: SuccessorCutter;
}) {
    const { fixture } = input;
    const orphanhood = orphanPorts(getServiceTestDb()).ports;
    return {
        successorCutter:
            input.successorCutter ?? createSuccessorCutter({ clock: fixture.clock, orphanhood }),
        orphanhood,
        clock: fixture.clock,
        provider: fixture.provider,
        beforeCancelNotice: outboxBeforeCancelNotice(),
        coverageNotices: fixture.coverageNotices
    };
}

/** Detection wired to the real S12 service and a replaceable S31 interface. */
export function scheduledChargebackDetection(input: {
    readonly fixture: Awaited<ReturnType<typeof chargebackFixture>>;
    readonly successorCutter?: SuccessorCutter;
}) {
    const { fixture } = input;
    return createChargebackDetection({
        markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
        clock: fixture.clock,
        serviceEnd: {
            run: (args) => applyS12ByChargeback(args, s12ChargebackPorts(input))
        }
    });
}
