import { describe, expect, it } from 'vitest';
import {
    getVenueEventEnd,
    isVenueEventLive,
    isVenueEventPast,
    partitionVenueEvents,
    VENUE_EVENT_PAST_RETENTION_DAYS,
    withVenueEventPastFlag
} from '../../../src/entities/venue/subtypes/venue.event.lifecycle';

type Timing = Parameters<typeof isVenueEventPast>[0]['event'];

const once = (over: Partial<Timing>): Timing => ({
    recurrence: 'once',
    date: '2026-11-17',
    startTime: '21:00',
    endTime: '23:00',
    ...over
});
const weekly: Timing = {
    recurrence: 'weekly',
    date: null,
    startTime: '21:00',
    endTime: null
};

/** AR is UTC-3 all year: local `HH:MM` on `YYYY-MM-DD` as an instant. */
const ar = (date: string, time: string): Date => new Date(`${date}T${time}:00-03:00`);

describe('isVenueEventPast', () => {
    it.each([
        ['ended yesterday', once({ date: '2026-11-16' }), ar('2026-11-17', '10:00'), true],
        ['ends later today', once({}), ar('2026-11-17', '22:59'), false],
        ['exactly at the end is not past', once({}), ar('2026-11-17', '23:00'), false],
        ['one minute after the end', once({}), ar('2026-11-17', '23:01'), true],
        [
            'crosses midnight, 01:00 next day',
            once({ startTime: '22:00', endTime: '02:00' }),
            ar('2026-11-18', '01:00'),
            false
        ],
        [
            'crosses midnight, 02:01 next day',
            once({ startTime: '22:00', endTime: '02:00' }),
            ar('2026-11-18', '02:01'),
            true
        ],
        [
            'no end time, 23:30 same day',
            once({ endTime: null, startTime: '23:00' }),
            ar('2026-11-17', '23:30'),
            false
        ],
        [
            'no end time, 05:59 next day',
            once({ endTime: null, startTime: '23:00' }),
            ar('2026-11-18', '05:59'),
            false
        ],
        [
            'no end time, 06:01 next day',
            once({ endTime: null, startTime: '23:00' }),
            ar('2026-11-18', '06:01'),
            true
        ],
        [
            'month end, no end time, after grace',
            once({ date: '2026-11-30', endTime: null }),
            ar('2026-12-01', '06:01'),
            true
        ],
        [
            'month end, no end time, inside grace',
            once({ date: '2026-11-30', endTime: null }),
            ar('2026-12-01', '05:00'),
            false
        ],
        [
            'year end, crossing midnight',
            once({ date: '2026-12-31', startTime: '22:00', endTime: '03:00' }),
            ar('2027-01-01', '03:01'),
            true
        ],
        [
            '21:30 AR (00:30 UTC next day) is still live',
            once({ startTime: '22:00', endTime: '23:30' }),
            ar('2026-11-17', '21:30'),
            false
        ],
        ['weekly is never past', weekly, ar('2030-01-01', '12:00'), false]
    ])('%s', (_name, event, now, expected) => {
        expect(isVenueEventPast({ event, now })).toBe(expected);
    });

    it('uses the venue zone, not the process clock', () => {
        const event = once({ date: '2026-11-17', startTime: '22:00', endTime: '23:30' });
        const now = new Date('2026-11-18T00:30:00Z');
        expect(isVenueEventPast({ event, now })).toBe(false);
        expect(isVenueEventPast({ event, now, timeZone: 'UTC' })).toBe(true);
    });

    it('treats a once event without a date as never past', () => {
        expect(isVenueEventPast({ event: once({ date: null }), now: new Date() })).toBe(false);
    });

    describe('olderThanDays (retention)', () => {
        const event = once({ date: '2026-09-01', startTime: '21:00', endTime: '23:00' });
        const end = ar('2026-09-01', '23:00').getTime();
        const day = 86_400_000;
        const retention = VENUE_EVENT_PAST_RETENTION_DAYS;
        const at = (days: number, extraMin: number) =>
            new Date(end + days * day + extraMin * 60_000);

        it('keeps an event that ended 59 days ago', () => {
            expect(isVenueEventPast({ event, now: at(59, 0), olderThanDays: retention })).toBe(
                false
            );
        });
        it('keeps it exactly at 60 days', () => {
            expect(isVenueEventPast({ event, now: at(60, 0), olderThanDays: retention })).toBe(
                false
            );
        });
        it('selects it once it ended 61 days ago', () => {
            expect(isVenueEventPast({ event, now: at(61, 0), olderThanDays: retention })).toBe(
                true
            );
        });
        it('never selects a weekly event', () => {
            expect(
                isVenueEventPast({ event: weekly, now: at(400, 0), olderThanDays: retention })
            ).toBe(false);
        });
        it('counts from the real end of a midnight-crossing event across month end', () => {
            const crossing = once({ date: '2026-09-30', startTime: '22:00', endTime: '02:00' });
            // ends 2026-10-01 02:00 AR; +60 days = 2026-11-30 02:00
            expect(
                isVenueEventPast({
                    event: crossing,
                    now: ar('2026-11-30', '02:00'),
                    olderThanDays: 60
                })
            ).toBe(false);
            expect(
                isVenueEventPast({
                    event: crossing,
                    now: ar('2026-11-30', '02:01'),
                    olderThanDays: 60
                })
            ).toBe(true);
        });
    });
});

describe('getVenueEventEnd', () => {
    it('is null for weekly', () => {
        expect(getVenueEventEnd({ event: weekly })).toBeNull();
    });
    it('adds the grace on the next day when there is no end time', () => {
        expect(getVenueEventEnd({ event: once({ endTime: null }) })).toEqual({
            date: '2026-11-18',
            time: '06:00'
        });
    });
});

describe('isVenueEventLive / partitionVenueEvents / withVenueEventPastFlag', () => {
    const now = ar('2026-11-17', '12:00');
    const future = { ...once({ date: '2026-11-20' }), isActive: true };
    const parked = { ...once({ date: '2026-11-20' }), isActive: false };
    const past = { ...once({ date: '2026-11-10' }), isActive: true };

    it('live means active and not past', () => {
        expect(isVenueEventLive({ event: future, now })).toBe(true);
        expect(isVenueEventLive({ event: parked, now })).toBe(false);
        expect(isVenueEventLive({ event: past, now })).toBe(false);
    });

    it('partitions switched-off entries on the current side, past ones apart', () => {
        const result = partitionVenueEvents({ events: [future, parked, past], now });
        expect(result.current).toEqual([future, parked]);
        expect(result.past).toEqual([past]);
    });

    it('flags every entry', () => {
        expect(
            withVenueEventPastFlag({ events: [future, past], now }).map((e) => e.isPast)
        ).toEqual([false, true]);
    });
});
