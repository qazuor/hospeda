/**
 * Reason label port of the billing staff mails (HOS-2565 D8, AC-3.11).
 */
import { describe, expect, it } from 'vitest';
import { resolveReconciliationReasonLabel } from '../../../src/utils/reconciliation-summary/reconciliation-reason-label.js';

describe('resolveReconciliationReasonLabel', () => {
    it('reads the Spanish label the admin shows for COBRO_DUPLICADO', () => {
        expect(resolveReconciliationReasonLabel({ reason: 'COBRO_DUPLICADO' })).toBe(
            'Cobro duplicado'
        );
    });

    it('reads the label of another reason, not just the first one', () => {
        expect(resolveReconciliationReasonLabel({ reason: 'CONTRACARGO' })).toBe('Contracargo');
    });

    it('answers null for a code that is not in the catalog', () => {
        expect(resolveReconciliationReasonLabel({ reason: 'ALGO_NUEVO' })).toBeNull();
        expect(resolveReconciliationReasonLabel({ reason: '' })).toBeNull();
    });

    it('does not answer for a key that is not a reason', () => {
        expect(resolveReconciliationReasonLabel({ reason: 'title' })).toBeNull();
    });
});
