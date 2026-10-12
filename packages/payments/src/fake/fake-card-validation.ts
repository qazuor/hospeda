import type { Clock } from '@repo/billing-verticals-contract';
import type { ChargeSnapshot, Money } from '../provider/payment-provider';
import type { FakeLedger } from './fake-ledger';

const ZERO_ARS: Money = { amountMinor: 0, currency: 'ARS' };

/** Records the measured zero-amount card validation (RP12) and its charge notice. */
export function createFakeCardValidation(args: {
    readonly clock: Clock;
    readonly ledger: FakeLedger;
    readonly passes: boolean;
}): ChargeSnapshot {
    const chargeId = args.ledger.nextId({ prefix: 'charge' });
    const snapshot: ChargeSnapshot = {
        chargeId,
        createdAt: args.clock.now().toISOString(),
        expiresAt: null,
        purpose: 'cardValidation',
        authorizationId: null,
        reference: null,
        status: args.passes ? 'approved' : 'rejected',
        declineReason: args.passes ? null : 'card validation rejected',
        amount: { ...ZERO_ARS },
        refundedAmount: { ...ZERO_ARS }
    };
    args.ledger.charges.set(chargeId, {
        snapshot,
        version: 1,
        settleAt: null,
        refundAttempts: 0,
        refundsByReference: new Map()
    });
    args.ledger.emit({ resourceKind: 'charge', resourceId: chargeId, version: 1 });
    return snapshot;
}
