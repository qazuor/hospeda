/**
 * @file occupancy-bar-layout.test.ts
 * @description Unit tests for the HOS-162 spanning-bar layout helpers:
 * `buildOccupancyEvents` (per-day rows -> multi-day event spans) and
 * `layoutWeekBars` (events -> per-week positioned + lane-packed segments).
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildOccupancyEvents, layoutWeekBars } from '@/lib/calendar/occupancy-bar-layout';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function row({
    date,
    source,
    externalEventId = null,
    note = null
}: {
    date: string;
    source: OccupancySourceEnum;
    externalEventId?: string | null;
    note?: string | null;
}): AccommodationOccupancy {
    return {
        id: `occ-${source}-${date}`,
        accommodationId: 'acc-1',
        date,
        isBlocked: true,
        source,
        externalEventId,
        note,
        createdById: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
    } as AccommodationOccupancy;
}

/** A Monday-first week of real Dates, e.g. weekOf('2026-08-03') = Mon 3 .. Sun 9. */
function weekOf(mondayKey: string): (Date | null)[] {
    const [y, m, d] = mondayKey.split('-').map(Number);
    const days: (Date | null)[] = [];
    for (let i = 0; i < 7; i++) {
        days.push(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + i));
    }
    return days;
}

// ---------------------------------------------------------------------------
// buildOccupancyEvents
// ---------------------------------------------------------------------------

describe('buildOccupancyEvents', () => {
    it('collapses contiguous same-source rows sharing an externalEventId into one span', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-08-13',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1',
                    note: 'Airbnb'
                }),
                row({
                    date: '2026-08-14',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1',
                    note: 'Airbnb'
                }),
                row({
                    date: '2026-08-15',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1',
                    note: 'Airbnb'
                })
            ]
        });
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            source: OccupancySourceEnum.AIRBNB,
            externalEventId: 'a1',
            title: 'Airbnb',
            startKey: '2026-08-13',
            endKey: '2026-08-15'
        });
    });

    it('splits a date gap in the same event id into two separate spans', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-08-13',
                    source: OccupancySourceEnum.BOOKING,
                    externalEventId: 'b1'
                }),
                row({
                    date: '2026-08-14',
                    source: OccupancySourceEnum.BOOKING,
                    externalEventId: 'b1'
                }),
                // gap on the 15th
                row({
                    date: '2026-08-16',
                    source: OccupancySourceEnum.BOOKING,
                    externalEventId: 'b1'
                })
            ]
        });
        expect(events).toHaveLength(2);
        const ranges = events.map((e) => [e.startKey, e.endKey]).sort();
        expect(ranges).toEqual([
            ['2026-08-13', '2026-08-14'],
            ['2026-08-16', '2026-08-16']
        ]);
    });

    it('keeps MANUAL runs with different notes as separate events', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-08-04',
                    source: OccupancySourceEnum.MANUAL,
                    note: 'Mantenimiento'
                }),
                row({
                    date: '2026-08-05',
                    source: OccupancySourceEnum.MANUAL,
                    note: 'Mantenimiento'
                }),
                row({ date: '2026-08-06', source: OccupancySourceEnum.MANUAL, note: 'Otra cosa' })
            ]
        });
        expect(events).toHaveLength(2);
        expect(events.find((e) => e.title === 'Mantenimiento')).toMatchObject({
            startKey: '2026-08-04',
            endKey: '2026-08-05'
        });
        expect(events.find((e) => e.title === 'Otra cosa')).toMatchObject({
            startKey: '2026-08-06',
            endKey: '2026-08-06'
        });
    });

    it('emits one event per source when two sources overlap the same dates', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({ date: '2026-08-15', source: OccupancySourceEnum.MANUAL, note: 'block' }),
                row({
                    date: '2026-08-15',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1'
                })
            ]
        });
        expect(events).toHaveLength(2);
        expect(events.map((e) => e.source).sort()).toEqual(
            [OccupancySourceEnum.AIRBNB, OccupancySourceEnum.MANUAL].sort()
        );
    });
});

// ---------------------------------------------------------------------------
// layoutWeekBars
// ---------------------------------------------------------------------------

describe('layoutWeekBars', () => {
    it('places a single in-week event as one segment with correct columns and end flags', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({ date: '2026-08-04', source: OccupancySourceEnum.MANUAL, note: 'x' }),
                row({ date: '2026-08-06', source: OccupancySourceEnum.MANUAL, note: 'x' }),
                row({ date: '2026-08-05', source: OccupancySourceEnum.MANUAL, note: 'x' })
            ]
        });
        const { segments, laneCount } = layoutWeekBars({ week: weekOf('2026-08-03'), events });
        expect(segments).toHaveLength(1);
        // Mon=0: 4th is Tue(1), 6th is Thu(3) -> colStart 1, span 3.
        expect(segments[0]).toMatchObject({ colStart: 1, span: 3, isStart: true, isEnd: true });
        expect(laneCount).toBe(1);
    });

    it('clips a cross-week event: first week has no end cap, spilled week has no start cap', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-08-08',
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'g1'
                }),
                row({
                    date: '2026-08-09',
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'g1'
                }),
                row({
                    date: '2026-08-10',
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'g1'
                }),
                row({
                    date: '2026-08-11',
                    source: OccupancySourceEnum.GOOGLE_CALENDAR,
                    externalEventId: 'g1'
                })
            ]
        });
        // Week 1: Mon 3 .. Sun 9 -> event covers Sat 8, Sun 9 (cols 5,6).
        const week1 = layoutWeekBars({ week: weekOf('2026-08-03'), events });
        expect(week1.segments).toHaveLength(1);
        expect(week1.segments[0]).toMatchObject({
            colStart: 5,
            span: 2,
            isStart: true,
            isEnd: false
        });
        // Week 2: Mon 10 .. Sun 16 -> event covers Mon 10, Tue 11 (cols 0,1).
        const week2 = layoutWeekBars({ week: weekOf('2026-08-10'), events });
        expect(week2.segments[0]).toMatchObject({
            colStart: 0,
            span: 2,
            isStart: false,
            isEnd: true
        });
    });

    it('stacks overlapping events into separate lanes', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-08-13',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1'
                }),
                row({
                    date: '2026-08-14',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1'
                }),
                row({
                    date: '2026-08-15',
                    source: OccupancySourceEnum.AIRBNB,
                    externalEventId: 'a1'
                }),
                row({ date: '2026-08-14', source: OccupancySourceEnum.MANUAL, note: 'm' }),
                row({ date: '2026-08-15', source: OccupancySourceEnum.MANUAL, note: 'm' })
            ]
        });
        const { segments, laneCount } = layoutWeekBars({ week: weekOf('2026-08-10'), events });
        expect(segments).toHaveLength(2);
        expect(laneCount).toBe(2);
        expect(new Set(segments.map((s) => s.lane))).toEqual(new Set([0, 1]));
    });

    it('ignores an event that only overlaps out-of-month padding cells', () => {
        const events = buildOccupancyEvents({
            rows: [
                row({
                    date: '2026-07-30',
                    source: OccupancySourceEnum.OTHER,
                    externalEventId: 'o1'
                })
            ]
        });
        // Week of Aug 3 has no July cells at all -> no segment.
        const { segments, laneCount } = layoutWeekBars({ week: weekOf('2026-08-03'), events });
        expect(segments).toHaveLength(0);
        expect(laneCount).toBe(0);
    });

    it('returns nothing for an all-padding week', () => {
        const events = buildOccupancyEvents({
            rows: [row({ date: '2026-08-15', source: OccupancySourceEnum.MANUAL, note: 'm' })]
        });
        const { segments, laneCount } = layoutWeekBars({
            week: [null, null, null, null, null, null, null],
            events
        });
        expect(segments).toHaveLength(0);
        expect(laneCount).toBe(0);
    });
});
