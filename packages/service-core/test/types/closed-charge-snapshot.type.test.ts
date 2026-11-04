import type { AuthorizationSnapshot, ChargeSnapshot, ProviderRead } from '@repo/payments';
import { describe, expectTypeOf, it } from 'vitest';
import type {
    ClosedChargeSnapshot,
    ClosedChargeSnapshots
} from '../../src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshot.js';
import type { readPeriodCharges } from '../../src/services/billing/reconciliation/period-charges/read-period-charges.js';
import type { createAmountComparison } from '../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import type { readListedCharges } from '../../src/services/billing/reconciliation/sweep/comparisons/listed-charges.js';
import type { createPeriodChargesComparison } from '../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import type { createGraceExpiryCheck } from '../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { createLostFirstRejectionCheck } from '../../src/services/billing/reconciliation/sweep/lost-rejection-check.js';
import type { createPendingFirstChargeDeclineCheck } from '../../src/services/billing/reconciliation/sweep/pending-first-charge-check.js';
import type { createProviderPauseCheck } from '../../src/services/billing/reconciliation/sweep/provider-pause-check.js';
import type {
    ReconciliationComparison,
    ReconciliationComparisonInput
} from '../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import type {
    ReconciliationRowCheck,
    ReconciliationSweepPorts
} from '../../src/services/billing/reconciliation/sweep/reconciliation-sweep.types.js';
import type { createSuccessorGraceCheck } from '../../src/services/billing/reconciliation/sweep/successor-grace-check.js';

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

    /** Names of the properties of `T` that could hold a closed snapshot value. */
    type HoldsClosedValue<T> = {
        [K in keyof T]-?: [ClosedChargeSnapshot] extends [NonNullable<T[K]>] ? K : never;
    }[keyof T];
    /** Names of the properties of `T` typed as the closed snapshot finder. */
    type HoldsFinder<T> = {
        [K in keyof T]-?: [NonNullable<T[K]>] extends [ClosedChargeSnapshots] ? K : never;
    }[keyof T];

    it('hands every check only provider state stamped for the act (AC-13)', () => {
        expectTypeOf<keyof ReconciliationComparisonInput>().toEqualTypeOf<
            'subscription' | 'providerLink' | 'read' | 'act'
        >();
        expectTypeOf<ReconciliationComparisonInput['read']>().toEqualTypeOf<
            ProviderRead<AuthorizationSnapshot>
        >();
        expectTypeOf<HoldsClosedValue<ReconciliationComparisonInput>>().toEqualTypeOf<never>();
        expectTypeOf<HoldsFinder<ReconciliationComparisonInput>>().toEqualTypeOf<never>();
        expectTypeOf<
            Parameters<ReconciliationRowCheck>[0]
        >().toEqualTypeOf<ReconciliationComparisonInput>();
        expectTypeOf<
            Parameters<ReconciliationComparison>[0]
        >().toEqualTypeOf<ReconciliationComparisonInput>();
    });

    it('keeps closed snapshot values out of every check port (AC-13)', () => {
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createGraceExpiryCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createLostFirstRejectionCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createPeriodChargesComparison>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createSuccessorGraceCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createProviderPauseCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createPendingFirstChargeDeclineCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsClosedValue<Parameters<typeof createAmountComparison>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<HoldsClosedValue<ReconciliationSweepPorts>>().toEqualTypeOf<never>();
    });

    it('lets only the checks that reach the period-charges comparison carry the finder (AC-13)', () => {
        expectTypeOf<
            HoldsFinder<Parameters<typeof createGraceExpiryCheck>[0]>
        >().toEqualTypeOf<'closedChargeSnapshots'>();
        expectTypeOf<
            HoldsFinder<Parameters<typeof createLostFirstRejectionCheck>[0]>
        >().toEqualTypeOf<'closedChargeSnapshots'>();
        expectTypeOf<
            HoldsFinder<Parameters<typeof createPeriodChargesComparison>[0]>
        >().toEqualTypeOf<'closedChargeSnapshots'>();
        expectTypeOf<
            HoldsFinder<Parameters<typeof createSuccessorGraceCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsFinder<Parameters<typeof createPendingFirstChargeDeclineCheck>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<
            HoldsFinder<Parameters<typeof createAmountComparison>[0]>
        >().toEqualTypeOf<never>();
        expectTypeOf<HoldsFinder<ReconciliationSweepPorts>>().toEqualTypeOf<never>();
    });
});
