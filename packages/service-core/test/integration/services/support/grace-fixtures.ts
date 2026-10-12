import { vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { paymentFixture } from './payment-fixtures.js';

const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const DAY_MS = 86_400_000;

/** Builds a paid ACTIVE card subscription and moves its clock to the next cycle. */
export async function graceFixture({ graceDays = 7 }: { readonly graceDays?: number } = {}) {
    const fixture = await paymentFixture();
    const initialCharge = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    const credited = await recordChargeFact(
        { chargeId: initialCharge.chargeId },
        {
            provider: fixture.provider,
            clock: fixture.clock,
            beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            coverageNotices: fixture.coverageNotices
        }
    );
    if (credited.outcome !== 'CREDITED')
        throw new Error(`Expected fixture charge to be credited, got ${credited.outcome}`);

    fixture.clock.advance({ ms: 31 * DAY_MS });
    const planPolicy = vi.fn(async () => ({
        graceDays,
        allowsPause: false,
        current: true,
        sellable: true
    }));
    return { ...fixture, initialChargeId: initialCharge.chargeId, planPolicy };
}
