/**
 * @file occupancy-calendar-grid.test.ts
 * @description Unit tests for the pure occupancy calendar grid/date helpers
 * (HOS-43 Phase 1).
 */

import { describe, expect, it } from 'vitest';
import {
    addMonths,
    buildDateRangeKeys,
    buildMonthGrid,
    compareMonths,
    getStartOfMonth,
    parseDateKey,
    toDateKey
} from '@/lib/calendar/occupancy-calendar-grid';

describe('toDateKey', () => {
    it('formats a local date as YYYY-MM-DD', () => {
        expect(toDateKey({ date: new Date(2026, 6, 5) })).toBe('2026-07-05');
    });

    it('pads single-digit month and day with a leading zero', () => {
        expect(toDateKey({ date: new Date(2026, 0, 1) })).toBe('2026-01-01');
    });
});

describe('parseDateKey', () => {
    it('parses a date key back into the matching local date', () => {
        const parsed = parseDateKey({ dateKey: '2026-07-05' });
        expect(parsed.getFullYear()).toBe(2026);
        expect(parsed.getMonth()).toBe(6);
        expect(parsed.getDate()).toBe(5);
    });

    it('round-trips through toDateKey', () => {
        const key = '2026-12-31';
        expect(toDateKey({ date: parseDateKey({ dateKey: key }) })).toBe(key);
    });
});

describe('getStartOfMonth', () => {
    it('returns day 1 of the same month', () => {
        const result = getStartOfMonth({ date: new Date(2026, 6, 15) });
        expect(toDateKey({ date: result })).toBe('2026-07-01');
    });
});

describe('addMonths', () => {
    it('advances forward by the given delta', () => {
        const result = addMonths({ date: new Date(2026, 6, 15), delta: 1 });
        expect(toDateKey({ date: result })).toBe('2026-08-01');
    });

    it('goes backward with a negative delta', () => {
        const result = addMonths({ date: new Date(2026, 6, 15), delta: -1 });
        expect(toDateKey({ date: result })).toBe('2026-06-01');
    });

    it('rolls over the year boundary forward', () => {
        const result = addMonths({ date: new Date(2026, 11, 1), delta: 1 });
        expect(toDateKey({ date: result })).toBe('2027-01-01');
    });

    it('rolls over the year boundary backward', () => {
        const result = addMonths({ date: new Date(2026, 0, 1), delta: -1 });
        expect(toDateKey({ date: result })).toBe('2025-12-01');
    });
});

describe('compareMonths', () => {
    it('returns 0 for the same month (different days)', () => {
        expect(compareMonths({ a: new Date(2026, 6, 1), b: new Date(2026, 6, 28) })).toBe(0);
    });

    it('returns a negative number when a is before b', () => {
        expect(compareMonths({ a: new Date(2026, 5, 1), b: new Date(2026, 6, 1) })).toBeLessThan(0);
    });

    it('returns a positive number when a is after b', () => {
        expect(compareMonths({ a: new Date(2026, 7, 1), b: new Date(2026, 6, 1) })).toBeGreaterThan(
            0
        );
    });

    it('compares across year boundaries', () => {
        expect(compareMonths({ a: new Date(2025, 11, 1), b: new Date(2026, 0, 1) })).toBeLessThan(
            0
        );
    });
});

describe('buildMonthGrid', () => {
    it('returns a length that is a multiple of 7', () => {
        const grid = buildMonthGrid({ month: new Date(2026, 6, 1) });
        expect(grid.length % 7).toBe(0);
    });

    it('contains every day of the month exactly once, in order', () => {
        // July 2026 has 31 days
        const grid = buildMonthGrid({ month: new Date(2026, 6, 1) });
        const dayNumbers = grid
            .filter((cell): cell is Date => cell !== null)
            .map((d) => d.getDate());
        expect(dayNumbers).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    });

    it('pads leading cells so the 1st lands on its correct weekday (Monday-first)', () => {
        // 2026-07-01 is a Wednesday -> 2 leading blanks (Mon, Tue)
        const grid = buildMonthGrid({ month: new Date(2026, 6, 1) });
        expect(grid[0]).toBeNull();
        expect(grid[1]).toBeNull();
        expect(grid[2]).not.toBeNull();
        expect(grid[2]?.getDate()).toBe(1);
    });

    it('does not pad when the 1st falls on a Monday', () => {
        // 2026-06-01 is a Monday
        const grid = buildMonthGrid({ month: new Date(2026, 5, 1) });
        expect(grid[0]).not.toBeNull();
        expect(grid[0]?.getDate()).toBe(1);
    });

    it('pads trailing cells to complete the final week', () => {
        const grid = buildMonthGrid({ month: new Date(2026, 6, 1) });
        const lastNonNullIndex = grid.reduce((acc, cell, i) => (cell === null ? acc : i), -1);
        const trailing = grid.slice(lastNonNullIndex + 1);
        expect(trailing.every((cell) => cell === null)).toBe(true);
    });
});

describe('buildDateRangeKeys', () => {
    it('builds an inclusive ascending range when start is before end', () => {
        expect(buildDateRangeKeys({ startKey: '2026-07-10', endKey: '2026-07-12' })).toEqual([
            '2026-07-10',
            '2026-07-11',
            '2026-07-12'
        ]);
    });

    it('builds the same range when start/end are swapped (order-independent)', () => {
        expect(buildDateRangeKeys({ startKey: '2026-07-12', endKey: '2026-07-10' })).toEqual([
            '2026-07-10',
            '2026-07-11',
            '2026-07-12'
        ]);
    });

    it('returns a single-element array when start equals end', () => {
        expect(buildDateRangeKeys({ startKey: '2026-07-10', endKey: '2026-07-10' })).toEqual([
            '2026-07-10'
        ]);
    });

    it('spans a month boundary correctly', () => {
        expect(buildDateRangeKeys({ startKey: '2026-07-30', endKey: '2026-08-02' })).toEqual([
            '2026-07-30',
            '2026-07-31',
            '2026-08-01',
            '2026-08-02'
        ]);
    });
});
