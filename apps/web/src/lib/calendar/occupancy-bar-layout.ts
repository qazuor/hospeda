/**
 * @file occupancy-bar-layout.ts
 * @description Pure helpers that turn flat per-day occupancy rows into
 * multi-day EVENT SPANS and lay those spans out as horizontal bars over a
 * Monday-first month grid (HOS-162 prototype — spanning event bars, replacing
 * the per-day source dots).
 *
 * Two stages:
 *  1. `buildOccupancyEvents` — collapse contiguous same-source rows sharing an
 *     `externalEventId` (or, for `MANUAL`, a contiguous run with the same note)
 *     into a single `{ startKey, endKey, title, source }` event.
 *  2. `layoutWeekBars` — for one week of the grid, clip every event to that
 *     week, resolve each clipped segment's column start/span and its
 *     start/end/continuation flags, and pack overlapping segments into stacked
 *     lanes (greedy interval scheduling).
 *
 * Deliberately framework-free (no React, no i18n, no CSS), mirroring
 * `occupancy-calendar-grid.ts` and `occupancy-row-grouping.ts`, so the span and
 * lane math is unit-testable in isolation.
 *
 * Prototype note: the bar's `title` currently comes from the row `note` column
 * (used as a stand-in for a future persisted `event_title` — the iCal parser
 * already has the VEVENT `SUMMARY` available but does not yet persist it).
 */

import type { AccommodationOccupancy, OccupancySourceEnum } from '@repo/schemas';
import { type DateKey, parseDateKey, toDateKey } from './occupancy-calendar-grid';

/** One multi-day occupancy event (an inclusive `startKey..endKey` span). */
export interface OccupancyEvent {
    readonly source: OccupancySourceEnum;
    /** The sync provider's event id, or `null` for `MANUAL` blocks. */
    readonly externalEventId: string | null;
    /** Event title (prototype: from `note`; future: persisted `event_title`). */
    readonly title: string | null;
    /** First occupied day, `YYYY-MM-DD`. */
    readonly startKey: DateKey;
    /** Last occupied day (inclusive), `YYYY-MM-DD`. */
    readonly endKey: DateKey;
}

/** One event clipped to a single week row, positioned by grid column + lane. */
export interface WeekBarSegment {
    readonly event: OccupancyEvent;
    /** 0-based column (Monday = 0) where this segment starts. */
    readonly colStart: number;
    /** Number of columns the segment spans (>= 1). */
    readonly span: number;
    /** True when the event's real start falls in this week (round the left edge). */
    readonly isStart: boolean;
    /** True when the event's real end falls in this week (round the right edge). */
    readonly isEnd: boolean;
    /** Whether this segment should render the event's text label. */
    readonly showLabel: boolean;
    /** Vertical stacking index within the week (0 = topmost lane). */
    readonly lane: number;
}

/** Returns the local `YYYY-MM-DD` key of the day after `key`. */
function nextDayKey(key: DateKey): DateKey {
    const date = parseDateKey({ dateKey: key });
    date.setDate(date.getDate() + 1);
    return toDateKey({ date });
}

/**
 * Collapses flat per-day occupancy rows into multi-day event spans.
 *
 * Rows are grouped by `(source, externalEventId)` — or, for `MANUAL` rows
 * (which have no `externalEventId`), by `(MANUAL, note)` — then each group is
 * split into contiguous calendar runs (a gap of more than one day starts a new
 * event). Each run becomes one {@link OccupancyEvent}.
 *
 * @param params - The occupancy rows (any date range, any source mix).
 * @returns The derived events, unsorted.
 */
export function buildOccupancyEvents({
    rows
}: {
    readonly rows: readonly AccommodationOccupancy[];
}): readonly OccupancyEvent[] {
    const groups = new Map<string, AccommodationOccupancy[]>();
    for (const row of rows) {
        const groupKey = `${row.source}|${row.externalEventId ?? `m:${row.note ?? ''}`}`;
        const bucket = groups.get(groupKey);
        if (bucket) {
            bucket.push(row);
        } else {
            groups.set(groupKey, [row]);
        }
    }

    const events: OccupancyEvent[] = [];
    for (const bucket of groups.values()) {
        const sorted = [...bucket].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        let runStart = sorted[0];
        let runPrev = sorted[0];
        if (!runStart || !runPrev) continue;
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            if (current && current.date === nextDayKey(runPrev.date)) {
                runPrev = current;
                continue;
            }
            events.push({
                source: runStart.source,
                externalEventId: runStart.externalEventId,
                title: runStart.note,
                startKey: runStart.date,
                endKey: runPrev.date
            });
            if (current) {
                runStart = current;
                runPrev = current;
            }
        }
        events.push({
            source: runStart.source,
            externalEventId: runStart.externalEventId,
            title: runStart.note,
            startKey: runStart.date,
            endKey: runPrev.date
        });
    }
    return events;
}

/**
 * Lays out the given events as stacked horizontal bar segments for one week
 * of the month grid.
 *
 * Each event that intersects the week is clipped to the week's real (non-pad)
 * columns, then packed into the lowest lane whose right edge does not overlap
 * the segment (greedy interval scheduling). Padding cells (`null`, days
 * outside the viewed month) never carry a segment, so cross-month events clip
 * cleanly at the month boundary.
 *
 * @param params.week - One week of the grid: exactly 7 `Date | null` cells.
 * @param params.events - All month events (already built by {@link buildOccupancyEvents}).
 * @returns The positioned segments plus the number of lanes used (for sizing).
 */
export function layoutWeekBars({
    week,
    events
}: {
    readonly week: readonly (Date | null)[];
    readonly events: readonly OccupancyEvent[];
}): { readonly segments: readonly WeekBarSegment[]; readonly laneCount: number } {
    const colKeys = week.map((date) => (date ? toDateKey({ date }) : null));
    const firstColIndex = colKeys.findIndex((key) => key !== null);
    const lastColIndex = colKeys.reduce((acc, key, i) => (key === null ? acc : i), -1);
    if (firstColIndex === -1 || lastColIndex === -1) {
        return { segments: [], laneCount: 0 };
    }
    const weekStartKey = colKeys[firstColIndex] as DateKey;
    const weekEndKey = colKeys[lastColIndex] as DateKey;

    const clipped: Omit<WeekBarSegment, 'lane'>[] = [];
    for (const event of events) {
        if (event.endKey < weekStartKey || event.startKey > weekEndKey) continue;
        let colStart = -1;
        let colEnd = -1;
        for (let c = 0; c < colKeys.length; c++) {
            const key = colKeys[c];
            if (!key) continue;
            if (key >= event.startKey && key <= event.endKey) {
                if (colStart === -1) colStart = c;
                colEnd = c;
            }
        }
        if (colStart === -1) continue;
        const isStart = colKeys[colStart] === event.startKey;
        const isEnd = colKeys[colEnd] === event.endKey;
        clipped.push({
            event,
            colStart,
            span: colEnd - colStart + 1,
            isStart,
            isEnd,
            // Label on the real start, or on a continuation that begins the
            // week (so a multi-week event re-labels itself on each new row).
            showLabel: isStart || colStart === firstColIndex
        });
    }

    // Greedy lane packing: earliest-starting, then longest, first.
    clipped.sort((a, b) => a.colStart - b.colStart || b.span - a.span);
    const laneRightEdge: number[] = [];
    const segments: WeekBarSegment[] = clipped.map((segment) => {
        let lane = 0;
        while (lane < laneRightEdge.length && (laneRightEdge[lane] ?? -1) >= segment.colStart) {
            lane++;
        }
        laneRightEdge[lane] = segment.colStart + segment.span - 1;
        return { ...segment, lane };
    });

    return { segments, laneCount: laneRightEdge.length };
}
