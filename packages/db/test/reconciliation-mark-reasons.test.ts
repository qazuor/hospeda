import { describe, expect, it } from 'vitest';
import {
    RECONCILIATION_MARK_REASON_CATALOG as catalog,
    RECONCILIATION_MARK_REASONS as reasons
} from '../src/schemas/vertical/reconciliation-mark-reasons.ts';

describe('TEST:B3:16 — closed reason catalog', () => {
    it('has exactly 24 ordered reasons with contiguous MOT numbers', () => {
        expect(reasons).toHaveLength(24);
        expect(Object.keys(catalog)).toEqual([...reasons]);
        expect(reasons.map((reason) => catalog[reason].number)).toEqual(
            Array.from({ length: 24 }, (_, index) => index + 1)
        );
    });

    it('marks exactly the nine refund confirmations', () => {
        expect(
            reasons
                .filter((reason) => catalog[reason].refundConfirmation)
                .map((reason) => catalog[reason].number)
        ).toEqual([1, 2, 3, 7, 12, 15, 20, 23, 24]);
    });

    it('uses the correct defaults and split complement reasons', () => {
        expect(reasons[13]).toBe('COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA');
        expect(reasons[14]).toBe('COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION');
        expect(reasons[22]).toBe('ORDEN_PAGADA_SIN_INSTANCIA');
        expect(reasons[23]).toBe('IMPORTE_COBRADO_DE_MAS');
        expect(catalog[reasons[13]].defaultProposal).toBe('NO_REFUND');
        expect(catalog[reasons[13]].refundConfirmation).toBe(false);
        expect(catalog[reasons[14]].defaultProposal).toBe('REFUND');
        expect(catalog[reasons[14]].refundConfirmation).toBe(true);
        expect(catalog[reasons[23]].defaultProposal).toBe('REFUND_DIFFERENCE');
        expect(catalog[reasons[3]].defaultProposal).toBe('NONE');
        expect(
            reasons.reduce<Record<string, number>>((counts, reason) => {
                const proposal = catalog[reason].defaultProposal;
                counts[proposal] = (counts[proposal] ?? 0) + 1;
                return counts;
            }, {})
        ).toEqual({ REFUND: 8, NONE: 14, NO_REFUND: 1, REFUND_DIFFERENCE: 1 });
    });
});
