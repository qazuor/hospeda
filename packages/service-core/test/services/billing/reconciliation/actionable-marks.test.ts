import { RECONCILIATION_MARK_REASON_CATALOG, RECONCILIATION_MARK_REASONS } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    actionableReconciliationMarkMetadata,
    listActionableReconciliationMarks
} from '../../../../src/services/billing/reconciliation/actionable-marks.js';

describe('actionable reconciliation mark metadata', () => {
    it.each(RECONCILIATION_MARK_REASONS)('resolves catalog defaults for %s', (reason) => {
        const markId = crypto.randomUUID();
        const result = actionableReconciliationMarkMetadata(reason, markId);
        const catalog = RECONCILIATION_MARK_REASON_CATALOG[reason];

        expect(result.reasonNumber).toBe(catalog.number);
        expect(result.refundConfirmation).toBe(catalog.refundConfirmation);
        expect(result.defaultProposal).toBe(catalog.defaultProposal);
        if (catalog.number === 7) expect(result.eventLink).toEqual({ markId });
        else expect(result.eventLink).toBeNull();
    });

    it.each([
        { page: 0, pageSize: 10 },
        { page: 1, pageSize: 101 }
    ])('rejects invalid pagination %#', async (input) => {
        await expect(listActionableReconciliationMarks(input)).rejects.toMatchObject({
            reason: 'ACTIONABLE_RECONCILIATION_MARKS_INPUT_INVALID'
        });
    });
});
