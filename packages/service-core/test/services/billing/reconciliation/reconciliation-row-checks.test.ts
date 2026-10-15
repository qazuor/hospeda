import { describe, expect, it, vi } from 'vitest';
import type { ReconciliationComparisonInput } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';
import {
    type ReconciliationRowCheck,
    runReconciliationRowChecks
} from '../../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';

describe('runReconciliationRowChecks', () => {
    it('stops after an S6 check defers or changes the row', async () => {
        const laterCheck = vi.fn<ReconciliationRowCheck>(async () => undefined);
        const deferredS6 = vi.fn<ReconciliationRowCheck>(async () => 'STOP_REMAINING_CHECKS');

        await runReconciliationRowChecks({} as unknown as ReconciliationComparisonInput, [
            deferredS6,
            laterCheck
        ]);

        expect(deferredS6).toHaveBeenCalledOnce();
        expect(laterCheck).not.toHaveBeenCalled();
    });
});
