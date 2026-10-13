import { vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { paymentFixture } from './payment-fixtures.js';

const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const DAY_MS = 86_400_000;

/** Builds a paid ACTIVE card subscription and moves its clock to the next cycle. */
export async function graceFixture({
    graceDays = 7,
    inheritsTouristVip = false
}: {
    readonly graceDays?: number;
    readonly inheritsTouristVip?: boolean;
} = {}) {
    const fixture = await paymentFixture({ inheritsTouristVip });
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

/**
 * A paid card principal whose next cycle fails and enters grace through S4,
 * with the provider retrying the same record (`approveOnAttempt` optional).
 */
export async function graceWithFailedCycle({
    graceDays = 7,
    approveOnAttempt,
    beforeS4,
    inheritsTouristVip = false
}: {
    readonly graceDays?: number;
    /** Whether the seeded plan version inherits Tourist VIP (AC:B7:30); `false` by default. */
    readonly inheritsTouristVip?: boolean;
    readonly approveOnAttempt?: 2 | 3 | 4;
    readonly beforeS4?: (fixture: Awaited<ReturnType<typeof graceFixture>>) => Promise<void>;
} = {}) {
    const fixture = await graceFixture({ graceDays, inheritsTouristVip });
    const { chargeId } = await fixture.provider.failChargeCycle({
        authorizationId: fixture.started.authorizationId,
        declineReason: 'issuer_declined',
        approveOnAttempt
    });
    await beforeS4?.(fixture);
    const ports = {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy,
        coverageNotices: fixture.coverageNotices
    };
    const entered = await recordChargeFact({ chargeId }, ports);
    if (entered.outcome !== 'GRACE' || entered.grace.outcome !== 'GRACE_STARTED')
        throw new Error(`Expected the failed cycle to open grace, got ${JSON.stringify(entered)}`);
    const read = await fixture.provider.readCharge({ chargeId });
    const createdAt = Date.parse(read.snapshot.createdAt);
    const expiresAt = Date.parse(read.snapshot.expiresAt ?? read.snapshot.createdAt);
    /** Moves the clock to the given retry attempt (2, 3 or 4) of the failed record. */
    const advanceToAttempt = (attempt: 2 | 3 | 4) => {
        const at = createdAt + ((expiresAt - createdAt) * (attempt - 1)) / 4;
        fixture.clock.advance({ ms: Math.max(0, at - fixture.clock.now().getTime()) });
    };
    return { ...fixture, chargeId, ports, advanceToAttempt, chargeCreatedAt: createdAt };
}
