import { describe, expect, it } from 'vitest';
import { resolveDueAccessEnding } from '../../../../src/services/billing/subscription/access-ending-notice';

/** 15:00 UTC is noon in the market (UTC-3), so the local day equals the UTC day. */
const end = new Date('2026-12-15T15:00:00.000Z');
const at = (day: string) => new Date(`${day}T12:00:00.000Z`);

describe('HOS-2580 resolveDueAccessEnding', () => {
    it('is due from daysBefore days before the end, with the days that are left', () => {
        expect(
            resolveDueAccessEnding({ serviceEndsAt: end, now: at('2026-12-10'), daysBefore: 5 })
        ).toEqual({
            daysRemaining: 5,
            endDay: '2026-12-15'
        });
        expect(
            resolveDueAccessEnding({ serviceEndsAt: end, now: at('2026-12-14'), daysBefore: 5 })
                ?.daysRemaining
        ).toBe(1);
    });

    it('is not due before the window, on the end day or after it', () => {
        for (const day of ['2026-12-09', '2026-12-15', '2026-12-16'])
            expect(
                resolveDueAccessEnding({ serviceEndsAt: end, now: at(day), daysBefore: 5 })
            ).toBeNull();
    });

    it('counts market-local days, not UTC days', () => {
        // 02:00 UTC on the 16th is still the 15th in the market.
        const lateEnd = new Date('2026-12-16T02:00:00.000Z');
        expect(
            resolveDueAccessEnding({ serviceEndsAt: lateEnd, now: at('2026-12-10'), daysBefore: 5 })
        ).toEqual({ daysRemaining: 5, endDay: '2026-12-15' });
    });
});
