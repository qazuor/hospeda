import { describe, expect, it } from 'vitest';
import {
    complementChargePeriodEnd,
    isComplementChargePeriodOpen,
    MARK_REASON_BY_CAUSE,
    S21_CAUSES
} from '../../../../src/services/billing/subscription/complement-s21-charge';

describe('complement S21 charge decision', () => {
    it('TEST:B5:14 maps every cause to the catalog reason 14/15/14', () => {
        expect(Object.keys(MARK_REASON_BY_CAUSE).sort()).toEqual([...S21_CAUSES].sort());
        expect(MARK_REASON_BY_CAUSE).toEqual({
            OTHER_CAUSE: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
            GRANT_REVOKED: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION',
            REVOCATION: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
        });
    });

    it.each([
        ['monthly', 1],
        ['quarterly', 3],
        ['semiannual', 6],
        ['annual', 12]
    ] as const)('TEST:B5:14 computes the %s cycle end', (cycle, months) => {
        const start = new Date('2026-01-15T10:30:00.000Z');
        const end = complementChargePeriodEnd({ cycle, periodStart: start });
        expect(end.getUTCMonth()).toBe((start.getUTCMonth() + months) % 12);
    });

    it('TEST:B5:14 clamps 31 January and treats the end as exclusive', () => {
        const start = new Date('2026-01-31T10:30:00.000Z');
        const end = complementChargePeriodEnd({ cycle: 'monthly', periodStart: start });
        expect(end).toEqual(new Date('2026-02-28T10:30:00.000Z'));
        expect(
            isComplementChargePeriodOpen({ cycle: 'monthly', periodStart: start, now: end })
        ).toBe(false);
    });
});
