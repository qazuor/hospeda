import { describe, expect, it } from 'vitest';
import { isLastSlot } from '../../src/cron/last-slot';

describe('isLastSlot', () => {
    it.each([
        ['scheduled 04:10 tick', '2026-11-03T07:10:00.000Z', false, true],
        ['manual at 02:50', '2026-11-03T05:50:00.000Z', false, false],
        ['manual after 04:10', '2026-11-03T07:11:00.000Z', false, true],
        ['new cycle during the day', '2026-11-03T05:50:00.000Z', true, true]
    ])('%s', (_name, iso, newCycle, expected) => {
        expect(isLastSlot({ schedule: '10 2,3,4 * * *', now: new Date(iso), newCycle })).toBe(
            expected
        );
    });

    it('compares a DST-free time zone schedule on the market wall clock', () => {
        expect(
            isLastSlot({
                schedule: '10 2,3,4 * * *',
                now: new Date('2026-11-03T07:50:00.000Z'),
                newCycle: false
            })
        ).toBe(true);
    });
});
