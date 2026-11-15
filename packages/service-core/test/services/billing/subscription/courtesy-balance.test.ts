import { describe, expect, it } from 'vitest';
import { computeCourtesyBalanceMonths } from '../../../../src/services/billing/subscription/courtesy-balance';

describe('AC:B8b:10 courtesy balance', () => {
    const months = (startsAt: string, endsAt: string, now: string) =>
        computeCourtesyBalanceMonths({
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            now: new Date(now)
        }).months;

    it('counts three full calendar months', () => {
        expect(months('2026-01-01', '2026-04-01', '2026-01-01')).toBe(3);
    });
    it('rounds two months and one day up', () => {
        expect(months('2026-01-01', '2026-03-02', '2026-01-01')).toBe(3);
    });
    it('counts 29 days as one month', () => {
        expect(months('2026-03-01', '2026-03-30', '2026-03-01')).toBe(1);
    });
    it('starts at the grant start when it has not begun', () => {
        expect(months('2026-05-01', '2026-07-01', '2026-04-01')).toBe(2);
    });
    it('returns zero for an expired grant', () => {
        expect(months('2026-01-01', '2026-02-01', '2026-03-01')).toBe(0);
    });
    it('clamps January 31 to February 28 and 29', () => {
        expect(months('2025-01-31', '2025-02-28', '2025-01-31')).toBe(1);
        expect(months('2024-01-31', '2024-02-29', '2024-01-31')).toBe(1);
        expect(months('2025-01-31', '2025-03-01', '2025-01-31')).toBe(2);
    });
});
