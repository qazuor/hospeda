import type { AuthorizationSnapshot, ChargeSnapshot, ProviderRead } from '@repo/payments';
import { describe, expectTypeOf, it } from 'vitest';
import type { ClosedChargeSnapshot } from '../../src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshot.js';
import type { readPeriodCharges } from '../../src/services/billing/reconciliation/period-charges/read-period-charges.js';
import type { readListedCharges } from '../../src/services/billing/reconciliation/sweep/comparisons/listed-charges.js';

describe('closed charge snapshot type boundary', () => {
    it('keeps closed snapshots outside ProviderRead and decision inputs', () => {
        expectTypeOf<ClosedChargeSnapshot>().not.toMatchTypeOf<ProviderRead<ChargeSnapshot>>();
        type ReadInput = Parameters<typeof readPeriodCharges>[0];
        expectTypeOf<ReadInput['authorizationRead']>().toEqualTypeOf<
            ProviderRead<AuthorizationSnapshot>
        >();
        expectTypeOf<
            Extract<keyof ReadInput, 'closedChargeSnapshot' | 'closedChargeSnapshots'>
        >().toEqualTypeOf<never>();
        type ListedInput = Parameters<typeof readListedCharges>[0];
        expectTypeOf<
            Extract<keyof ListedInput, 'closedChargeSnapshot' | 'closedChargeSnapshots'>
        >().toEqualTypeOf<never>();
    });
});
