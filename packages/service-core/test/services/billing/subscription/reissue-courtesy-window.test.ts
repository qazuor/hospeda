import { describe, expect, it } from 'vitest';
import { computeReissueWindow } from '../../../../src/services/billing/subscription/reissue-deferred-courtesy-support.js';

describe('AC:B8b:12 deferred courtesy reissue window', () => {
    const now = new Date('2026-01-31T12:00:00.000Z');

    it('starts now without a later credit and ignores an elapsed credit', () => {
        expect(
            computeReissueWindow({ now, balanceMonths: 2, creditEndsAt: null }).startsAt
        ).toEqual(now);
        expect(
            computeReissueWindow({
                now,
                balanceMonths: 2,
                creditEndsAt: new Date('2026-01-30T12:00:00.000Z')
            }).startsAt
        ).toEqual(now);
    });
    it('starts at a future credit end and clamps calendar months', () => {
        const creditEndsAt = new Date('2026-01-31T12:00:00.000Z');
        expect(computeReissueWindow({ now, balanceMonths: 1, creditEndsAt }).endsAt).toEqual(
            new Date('2026-02-28T12:00:00.000Z')
        );
        expect(
            computeReissueWindow({
                now: new Date('2024-01-31T12:00:00.000Z'),
                balanceMonths: 1,
                creditEndsAt: new Date('2024-01-31T12:00:00.000Z')
            }).endsAt
        ).toEqual(new Date('2024-02-29T12:00:00.000Z'));
    });
    it('adds two and twelve calendar months', () => {
        expect(
            computeReissueWindow({
                now: new Date('2026-03-15T00:00:00.000Z'),
                balanceMonths: 2,
                creditEndsAt: null
            }).endsAt
        ).toEqual(new Date('2026-05-15T00:00:00.000Z'));
        expect(
            computeReissueWindow({
                now: new Date('2026-03-15T00:00:00.000Z'),
                balanceMonths: 12,
                creditEndsAt: null
            }).endsAt
        ).toEqual(new Date('2027-03-15T00:00:00.000Z'));
    });
    it('rejects non-positive and non-integer balances', () => {
        expect(() => computeReissueWindow({ now, balanceMonths: 0, creditEndsAt: null })).toThrow();
        expect(() =>
            computeReissueWindow({ now, balanceMonths: 1.5, creditEndsAt: null })
        ).toThrow();
    });
});
