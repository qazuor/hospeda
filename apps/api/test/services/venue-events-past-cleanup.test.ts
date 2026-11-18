/**
 * Selection rule of the past-venue-events cleanup (HOS-2254, AC-12): an event
 * is deleted only when it is a one-off whose END (venue zone) is more than 60
 * days behind. The storage is an in-memory fake with the same contract as the
 * Drizzle ports (`once` only, `date <= maxDate`, keyset by id).
 */

import { describe, expect, it } from 'vitest';
import {
    type PastEventCandidate,
    purgePastVenueEvents,
    type VenueEventsCleanupPorts
} from '../../src/services/venue-events-past-cleanup';

interface Row extends PastEventCandidate {
    readonly recurrence: 'once' | 'weekly';
}

function fakePorts(rows: Row[]): VenueEventsCleanupPorts & { readonly remaining: () => string[] } {
    return {
        readCandidates: async ({ maxDate, afterId, limit }) =>
            rows
                .filter(
                    (row) =>
                        row.recurrence === 'once' &&
                        row.date !== null &&
                        row.date <= maxDate &&
                        (afterId === null || row.id > afterId)
                )
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(0, limit),
        deleteByIds: async (ids) => {
            let count = 0;
            for (const id of ids) {
                const index = rows.findIndex((row) => row.id === id);
                if (index >= 0) {
                    rows.splice(index, 1);
                    count++;
                }
            }
            return count;
        },
        remaining: () => rows.map((row) => row.id)
    };
}

const once = (id: string, date: string, over: Partial<Row> = {}): Row => ({
    id,
    recurrence: 'once',
    date,
    startTime: '21:00:00',
    endTime: '23:00:00',
    ...over
});

/** 2026-11-18 12:00 AR. */
const NOW = new Date('2026-11-18T15:00:00Z');

describe('purgePastVenueEvents', () => {
    it('deletes an event that ended 61 days ago, keeps 59, and never a weekly one', async () => {
        // End 23:00. Now is 2026-11-18 12:00: 2026-09-18 23:00 + 60d = 2026-11-17 23:00 (61d ago).
        const ports = fakePorts([
            once('a-61', '2026-09-18'),
            once('b-59', '2026-09-20'),
            { ...once('c-weekly', '2020-01-01'), recurrence: 'weekly', date: null },
            once('d-future', '2026-12-01')
        ]);

        const result = await purgePastVenueEvents({ now: NOW, ports });

        expect(result.deleted).toBe(1);
        expect(ports.remaining().sort()).toEqual(['b-59', 'c-weekly', 'd-future']);
    });

    it('counts the midnight-crossing end, not the start day (month end)', async () => {
        // Starts 2026-09-18 22:00, ends 2026-09-19 02:00; 60 days later = 2026-11-18 02:00 AR, already behind 12:00.
        // The same event starting 09-19 ends 09-20 02:00: 60 days later is 11-19 02:00, still inside.
        const ports = fakePorts([
            once('crossing-out', '2026-09-18', { startTime: '22:00:00', endTime: '02:00:00' }),
            once('crossing-in', '2026-09-19', { startTime: '22:00:00', endTime: '02:00:00' })
        ]);

        await purgePastVenueEvents({ now: NOW, ports });

        expect(ports.remaining()).toEqual(['crossing-in']);
    });

    it('applies the no-end grace (next day 06:00)', async () => {
        const ports = fakePorts([
            once('no-end-out', '2026-09-17', { endTime: null }),
            once('no-end-in', '2026-09-18', { endTime: null })
        ]);

        await purgePastVenueEvents({ now: NOW, ports });

        // 09-17 -> ends 09-18 06:00, +60d = 11-17 06:00: out. 09-18 -> 11-18 06:00 < 12:00: also out.
        expect(ports.remaining()).toEqual([]);
    });

    it('is idempotent and pages through more rows than one batch', async () => {
        const rows = Array.from({ length: 7 }, (_, i) => once(`id-${i}`, '2026-01-10'));
        rows.push(once('keep', '2026-11-10'));
        const ports = fakePorts(rows);

        const first = await purgePastVenueEvents({ now: NOW, ports, batchSize: 3 });
        const second = await purgePastVenueEvents({ now: NOW, ports, batchSize: 3 });

        expect(first.deleted).toBe(7);
        expect(second.deleted).toBe(0);
        expect(ports.remaining()).toEqual(['keep']);
    });

    it('does not stall on a page of rows it keeps (keyset, not offset)', async () => {
        // Rows inside the SQL pre-filter (date <= today-60) but not yet 60 days past:
        // 2026-09-19 ends 09-19 23:00, +60d = 11-18 23:00 > 12:00, kept.
        const rows = [
            ...Array.from({ length: 4 }, (_, i) => once(`kept-${i}`, '2026-09-19')),
            once('zz-old', '2026-01-01')
        ];
        const ports = fakePorts(rows);

        const result = await purgePastVenueEvents({ now: NOW, ports, batchSize: 2 });

        expect(result.deleted).toBe(1);
        expect(ports.remaining().sort()).toEqual(['kept-0', 'kept-1', 'kept-2', 'kept-3']);
    });
});
