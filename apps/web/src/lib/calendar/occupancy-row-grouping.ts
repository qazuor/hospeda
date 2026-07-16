/**
 * @file occupancy-row-grouping.ts
 * @description Pure helpers for grouping and prioritizing occupancy rows by
 * date (`CalendarSection.client.tsx`, HOS-162 Phase 3).
 *
 * As of HOS-162, the `accommodation_occupancy` unique index is scoped to
 * `(accommodationId, date, source)` instead of `(accommodationId, date)`, so
 * a single date can now carry MULTIPLE rows — one per source (`MANUAL`,
 * `GOOGLE_CALENDAR`, `AIRBNB`, `BOOKING`, `OTHER`). These helpers translate a
 * flat row list into a per-date grouping and resolve a single "primary" row
 * per date for display, deterministically, by source priority.
 *
 * Deliberately framework-free (no React, no i18n), mirroring
 * `occupancy-calendar-grid.ts`.
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import type { DateKey } from './occupancy-calendar-grid';

/**
 * Source priority used to pick the single "primary" row for a date when it
 * carries rows from multiple sources. `MANUAL` always wins — a host's manual
 * block/free choice takes precedence over sync data — followed by the sync
 * sources in a fixed, deterministic order.
 */
export const OCCUPANCY_SOURCE_PRIORITY: readonly OccupancySourceEnum[] = [
    OccupancySourceEnum.MANUAL,
    OccupancySourceEnum.GOOGLE_CALENDAR,
    OccupancySourceEnum.AIRBNB,
    OccupancySourceEnum.BOOKING,
    OccupancySourceEnum.OTHER
];

/**
 * Groups a flat occupancy row list by `date`.
 *
 * @param params - The occupancy rows to group (any date range, any source mix).
 * @returns A map of `DateKey` to the (always non-empty) rows for that date.
 */
export function groupOccupancyRowsByDate({
    rows
}: {
    readonly rows: readonly AccommodationOccupancy[];
}): Record<DateKey, readonly AccommodationOccupancy[]> {
    const grouped: Record<DateKey, AccommodationOccupancy[]> = {};
    for (const row of rows) {
        const existing = grouped[row.date];
        if (existing) {
            existing.push(row);
        } else {
            grouped[row.date] = [row];
        }
    }
    return grouped;
}

/**
 * Resolves the single "primary" row for a date's row list, by
 * {@link OCCUPANCY_SOURCE_PRIORITY}. This is the row a day cell renders its
 * source label/dot from — and, since `MANUAL` is always highest priority,
 * the row a caller can rely on to also decide togglability: a `MANUAL` row
 * is only ever primary when one exists for the date, so checking the
 * resolved row's `source` is equivalent to checking "does this date have a
 * MANUAL row".
 *
 * @param params - The rows for a single date (possibly empty).
 * @returns The highest-priority row, or `undefined` when `rows` is empty.
 */
export function resolvePrimaryOccupancyRow({
    rows
}: {
    readonly rows: readonly AccommodationOccupancy[];
}): AccommodationOccupancy | undefined {
    for (const source of OCCUPANCY_SOURCE_PRIORITY) {
        const match = rows.find((row) => row.source === source);
        if (match) return match;
    }
    return rows[0];
}
