/**
 * @file occupancy-row-grouping.test.ts
 * @description Unit tests for the pure occupancy row grouping/priority
 * helpers (HOS-162 Phase 3 — source-scoped occupancy).
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    groupOccupancyRowsByDate,
    OCCUPANCY_SOURCE_PRIORITY,
    resolvePrimaryOccupancyRow
} from '@/lib/calendar/occupancy-row-grouping';

function makeRow(overrides: Partial<AccommodationOccupancy>): AccommodationOccupancy {
    return {
        id: 'occ-1',
        accommodationId: 'acc-1',
        date: '2026-07-20',
        isBlocked: true,
        source: OccupancySourceEnum.MANUAL,
        externalEventId: null,
        note: null,
        createdById: 'user-1',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
        ...overrides
    };
}

describe('groupOccupancyRowsByDate', () => {
    it('groups rows into a single-entry array when dates do not collide', () => {
        const rows = [
            makeRow({ id: 'a', date: '2026-07-10' }),
            makeRow({ id: 'b', date: '2026-07-11' })
        ];

        const grouped = groupOccupancyRowsByDate({ rows });

        expect(Object.keys(grouped)).toEqual(['2026-07-10', '2026-07-11']);
        expect(grouped['2026-07-10']).toHaveLength(1);
        expect(grouped['2026-07-11']).toHaveLength(1);
    });

    it('groups multiple rows for the same date under one key, preserving order', () => {
        const manual = makeRow({
            id: 'manual',
            date: '2026-07-20',
            source: OccupancySourceEnum.MANUAL
        });
        const airbnb = makeRow({
            id: 'airbnb',
            date: '2026-07-20',
            source: OccupancySourceEnum.AIRBNB
        });

        const grouped = groupOccupancyRowsByDate({ rows: [manual, airbnb] });

        expect(Object.keys(grouped)).toEqual(['2026-07-20']);
        expect(grouped['2026-07-20']).toEqual([manual, airbnb]);
    });

    it('returns an empty object for an empty row list', () => {
        expect(groupOccupancyRowsByDate({ rows: [] })).toEqual({});
    });
});

describe('resolvePrimaryOccupancyRow', () => {
    it('returns undefined for an empty row list', () => {
        expect(resolvePrimaryOccupancyRow({ rows: [] })).toBeUndefined();
    });

    it('returns the single row when only one source is present', () => {
        const row = makeRow({ source: OccupancySourceEnum.BOOKING });
        expect(resolvePrimaryOccupancyRow({ rows: [row] })).toBe(row);
    });

    it('prefers MANUAL over every sync source, regardless of array order', () => {
        const manual = makeRow({ id: 'manual', source: OccupancySourceEnum.MANUAL });
        const google = makeRow({ id: 'google', source: OccupancySourceEnum.GOOGLE_CALENDAR });
        const airbnb = makeRow({ id: 'airbnb', source: OccupancySourceEnum.AIRBNB });

        expect(resolvePrimaryOccupancyRow({ rows: [google, airbnb, manual] })).toBe(manual);
        expect(resolvePrimaryOccupancyRow({ rows: [manual, google, airbnb] })).toBe(manual);
    });

    it('follows the full documented priority order when MANUAL is absent', () => {
        const airbnb = makeRow({ id: 'airbnb', source: OccupancySourceEnum.AIRBNB });
        const booking = makeRow({ id: 'booking', source: OccupancySourceEnum.BOOKING });
        const other = makeRow({ id: 'other', source: OccupancySourceEnum.OTHER });
        const google = makeRow({ id: 'google', source: OccupancySourceEnum.GOOGLE_CALENDAR });

        expect(resolvePrimaryOccupancyRow({ rows: [other, booking, airbnb] })).toBe(airbnb);
        expect(resolvePrimaryOccupancyRow({ rows: [other, booking] })).toBe(booking);
        expect(resolvePrimaryOccupancyRow({ rows: [other] })).toBe(other);
        expect(resolvePrimaryOccupancyRow({ rows: [google, other, booking, airbnb] })).toBe(google);
    });

    it('exposes the priority order for consumers that need it directly', () => {
        expect(OCCUPANCY_SOURCE_PRIORITY).toEqual([
            OccupancySourceEnum.MANUAL,
            OccupancySourceEnum.GOOGLE_CALENDAR,
            OccupancySourceEnum.AIRBNB,
            OccupancySourceEnum.BOOKING,
            OccupancySourceEnum.OTHER
        ]);
    });
});
