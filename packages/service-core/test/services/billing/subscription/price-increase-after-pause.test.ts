import { describe, expect, it } from 'vitest';
import { firstChargeHonouringNotice } from '../../../../src/services/billing/subscription/price-increase-after-pause.js';

const nextChargeAt = new Date('2026-04-15T12:00:00.000Z');
const base = { nextChargeAt, noticeDays: 60, everyMonths: 1 };

describe('TEST:B8b:4 first charge honouring price increase notice', () => {
    it('uses the resumed charge when notice has already elapsed', () => {
        const result = firstChargeHonouringNotice({
            ...base,
            announcedAt: new Date('2026-01-01T12:00:00.000Z')
        });
        expect(result.chargeAt).toEqual(nextChargeAt);
    });

    it('waits one cycle when notice expires one day after the resumed charge', () => {
        const result = firstChargeHonouringNotice({
            ...base,
            announcedAt: new Date('2026-02-15T12:00:00.000Z')
        });
        expect(result.chargeAt).toEqual(new Date('2026-05-15T12:00:00.000Z'));
    });

    it('accepts a charge exactly at the notice boundary', () => {
        const result = firstChargeHonouringNotice({
            ...base,
            announcedAt: new Date('2026-02-14T12:00:00.000Z')
        });
        expect(result.chargeAt).toEqual(nextChargeAt);
    });

    it('advances an annual cadence by twelve months', () => {
        const result = firstChargeHonouringNotice({
            ...base,
            everyMonths: 12,
            announcedAt: new Date('2026-02-15T12:00:00.000Z')
        });
        expect(result.chargeAt).toEqual(new Date('2027-04-15T12:00:00.000Z'));
    });

    it('rejects a notice shorter than sixty days', () => {
        expect(() =>
            firstChargeHonouringNotice({
                ...base,
                noticeDays: 59,
                announcedAt: new Date('2026-02-14T12:00:00.000Z')
            })
        ).toThrow();
    });
});
