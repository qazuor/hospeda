import { describe, expect, it } from 'vitest';
import { resolveDueGraceReminder } from '../../../../src/services/billing/subscription/grace-reminder-notice';

const started = new Date('2001-06-20T15:00:00.000Z');
const ends = new Date('2001-06-30T15:00:00.000Z');
const day = (offset: number): Date => new Date(ends.getTime() + offset * 86_400_000);

describe('TEST:1707:2 AC:1707:2 grace reminder milestone', () => {
    it('resolves only the most recent due milestone inside the grace window', () => {
        const cases = [
            { offset: -5, expected: null },
            { offset: -3, expected: 3 },
            { offset: -2, expected: 3 },
            { offset: -1, expected: 1 },
            { offset: 0, expected: null }
        ] as const;
        for (const { offset, expected } of cases) {
            const result = resolveDueGraceReminder({
                graceStartedAt: started,
                graceEndsAt: ends,
                now: day(offset),
                daysBefore: [3, 1]
            });
            expect(result?.daysBefore ?? null).toBe(expected);
            if (expected !== null) expect(result?.targetDate).toBe('2001-06-30');
        }
    });

    it('discards milestones outside short grace and ignores invalid days', () => {
        expect(
            resolveDueGraceReminder({
                graceStartedAt: new Date('2001-06-28T15:00:00.000Z'),
                graceEndsAt: ends,
                now: day(-1),
                daysBefore: [3, 1]
            })?.daysBefore
        ).toBe(1);
        expect(
            resolveDueGraceReminder({
                graceStartedAt: new Date('2001-06-28T15:00:00.000Z'),
                graceEndsAt: new Date('2001-06-30T15:00:00.000Z'),
                now: day(-1),
                daysBefore: [3]
            })
        ).toBeNull();
        expect(
            resolveDueGraceReminder({
                graceStartedAt: started,
                graceEndsAt: ends,
                now: day(-1),
                daysBefore: [0, -1, 1.5]
            })
        ).toBeNull();
    });

    it('uses the Argentina market day across UTC midnight and normalizes ordering/repeats', () => {
        const result = resolveDueGraceReminder({
            graceStartedAt: new Date('2001-06-19T15:00:00.000Z'),
            graceEndsAt: new Date('2001-06-30T02:00:00.000Z'),
            now: new Date('2001-06-27T15:00:00.000Z'),
            daysBefore: [1, 3, 3]
        });
        expect(result).toEqual({ daysBefore: 3, targetDate: '2001-06-29' });
    });
});
