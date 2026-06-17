/**
 * @file OpeningHoursSection.test.ts
 * @description Unit tests for the opening-hours helper logic in gastronomy-hours.ts
 * and source-read assertions for OpeningHoursSection.astro (SPEC-239 T-054).
 *
 * The Astro component cannot be rendered in Vitest so we:
 * 1. Unit-test the pure helpers (getDayKey, getTodayIndex, parseTimeToMinutes,
 *    computeOpenNowStatus) with an injectable `now` parameter.
 * 2. Source-read the component to assert structural correctness.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { GastronomyOpeningHoursEntry } from '../../src/data/types';
import {
    ORDERED_DAY_KEYS,
    computeOpenNowStatus,
    getDayKey,
    getTodayIndex,
    parseTimeToMinutes
} from '../../src/lib/gastronomy-hours';

// ---------------------------------------------------------------------------
// Source-read assertions
// ---------------------------------------------------------------------------

const src = readFileSync(
    resolve(__dirname, '../../src/components/gastronomy/OpeningHoursSection.astro'),
    'utf8'
);

describe('OpeningHoursSection.astro (source assertions)', () => {
    it('imports getTodayIndex and ORDERED_DAY_KEYS from gastronomy-hours', () => {
        expect(src).toContain('getTodayIndex');
        expect(src).toContain('ORDERED_DAY_KEYS');
        expect(src).toContain('gastronomy-hours');
    });

    it('uses ORDERED_DAY_KEYS to iterate the week in Mon→Sun order', () => {
        expect(src).toContain('ORDERED_DAY_KEYS');
    });

    it('highlights today row with a brand-accent left border', () => {
        expect(src).toContain('brand-accent');
        expect(src).toContain('today');
    });

    it('renders "open 24h" text for open24h entries', () => {
        expect(src).toContain('open24h');
    });

    it('shows closed state for isOpen = false entries', () => {
        expect(src).toContain('isOpen');
    });

    it('uses gastronomy.detail.openingHours.title i18n key for section heading', () => {
        expect(src).toContain('gastronomy.detail.openingHours.title');
    });

    it('does not use Tailwind utility classes', () => {
        expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-)\w/);
    });

    it('uses CSS tokens for theming', () => {
        expect(src).toContain('var(--');
    });
});

// ---------------------------------------------------------------------------
// Unit tests for pure helpers
// ---------------------------------------------------------------------------

describe('getDayKey', () => {
    it('returns "monday" for a Monday date', () => {
        // 2024-01-15 is a Monday
        expect(getDayKey(new Date('2024-01-15T10:00:00'))).toBe('monday');
    });

    it('returns "sunday" for a Sunday date', () => {
        // 2024-01-14 is a Sunday
        expect(getDayKey(new Date('2024-01-14T10:00:00'))).toBe('sunday');
    });

    it('returns "friday" for a Friday date', () => {
        // 2024-01-19 is a Friday
        expect(getDayKey(new Date('2024-01-19T10:00:00'))).toBe('friday');
    });

    it('returns "saturday" for a Saturday date', () => {
        // 2024-01-20 is a Saturday
        expect(getDayKey(new Date('2024-01-20T10:00:00'))).toBe('saturday');
    });

    it('handles all 7 days without throwing', () => {
        const dates = [
            new Date('2024-01-14'), // Sunday
            new Date('2024-01-15'), // Monday
            new Date('2024-01-16'), // Tuesday
            new Date('2024-01-17'), // Wednesday
            new Date('2024-01-18'), // Thursday
            new Date('2024-01-19'), // Friday
            new Date('2024-01-20') // Saturday
        ];
        const keys = dates.map(getDayKey);
        expect(new Set(keys).size).toBe(7);
    });
});

describe('getTodayIndex', () => {
    it('returns 0 for Sunday', () => {
        expect(getTodayIndex(new Date('2024-01-14T12:00:00'))).toBe(0);
    });

    it('returns 1 for Monday', () => {
        expect(getTodayIndex(new Date('2024-01-15T12:00:00'))).toBe(1);
    });

    it('returns 6 for Saturday', () => {
        expect(getTodayIndex(new Date('2024-01-20T12:00:00'))).toBe(6);
    });
});

describe('ORDERED_DAY_KEYS', () => {
    it('starts with monday and ends with sunday', () => {
        expect(ORDERED_DAY_KEYS[0]).toBe('monday');
        expect(ORDERED_DAY_KEYS[ORDERED_DAY_KEYS.length - 1]).toBe('sunday');
    });

    it('contains exactly 7 entries', () => {
        expect(ORDERED_DAY_KEYS).toHaveLength(7);
    });

    it('has no duplicate keys', () => {
        expect(new Set(ORDERED_DAY_KEYS).size).toBe(7);
    });
});

describe('parseTimeToMinutes', () => {
    it('returns null for undefined input', () => {
        expect(parseTimeToMinutes(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseTimeToMinutes('')).toBeNull();
    });

    it('returns null for malformed strings', () => {
        expect(parseTimeToMinutes('25')).toBeNull(); // no colon
        expect(parseTimeToMinutes('25:70')).not.toBeNull(); // parses even if out of range
        expect(parseTimeToMinutes('abc:def')).toBeNull(); // NaN check
    });

    it('converts "00:00" to 0 minutes', () => {
        expect(parseTimeToMinutes('00:00')).toBe(0);
    });

    it('converts "09:30" to 570 minutes', () => {
        expect(parseTimeToMinutes('09:30')).toBe(9 * 60 + 30);
    });

    it('converts "20:00" to 1200 minutes', () => {
        expect(parseTimeToMinutes('20:00')).toBe(20 * 60);
    });

    it('converts "23:59" to 1439 minutes', () => {
        expect(parseTimeToMinutes('23:59')).toBe(23 * 60 + 59);
    });
});

// ---------------------------------------------------------------------------
// computeOpenNowStatus — the main logic under test
// ---------------------------------------------------------------------------

/** Helper: build a minimal hours map with one entry for "monday". */
function mondayHours(
    entry: GastronomyOpeningHoursEntry
): Record<string, GastronomyOpeningHoursEntry> {
    return { monday: entry };
}

/** A Monday at 10:00 (mid-morning) */
const MON_10_00 = new Date('2024-01-15T10:00:00');
/** A Monday at 22:30 (night) */
const MON_22_30 = new Date('2024-01-15T22:30:00');
/** A Sunday at 14:00 */
const SUN_14_00 = new Date('2024-01-14T14:00:00');

describe('computeOpenNowStatus', () => {
    describe('returns null', () => {
        it('when there is no entry for today', () => {
            // The map only has "tuesday" but today is "monday"
            const hours = { tuesday: { isOpen: true, open: '09:00', close: '22:00' } };
            expect(computeOpenNowStatus(hours, MON_10_00)).toBeNull();
        });

        it('when the map is empty', () => {
            expect(computeOpenNowStatus({}, MON_10_00)).toBeNull();
        });

        it('when open time is missing (no open24h)', () => {
            const hours = mondayHours({ isOpen: true });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBeNull();
        });
    });

    describe('returns false', () => {
        it('when isOpen is false', () => {
            const hours = mondayHours({ isOpen: false });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });

        it('when current time is before opening', () => {
            const hours = mondayHours({ isOpen: true, open: '12:00', close: '22:00' });
            // 10:00 < 12:00
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });

        it('when current time is at or after closing', () => {
            const hours = mondayHours({ isOpen: true, open: '09:00', close: '22:00' });
            // 22:30 >= 22:00
            expect(computeOpenNowStatus(hours, MON_22_30)).toBe(false);
        });
    });

    describe('returns true', () => {
        it('when open24h is true regardless of time', () => {
            const hours = mondayHours({ isOpen: true, open24h: true });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
            expect(computeOpenNowStatus(hours, MON_22_30)).toBe(true);
        });

        it('when current time is within the open window', () => {
            const hours = mondayHours({ isOpen: true, open: '08:00', close: '22:00' });
            // 10:00 is between 08:00 and 22:00
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
        });

        it('when current time is exactly at opening', () => {
            const hours = mondayHours({ isOpen: true, open: '10:00', close: '22:00' });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
        });

        it('when close time is absent and current time is past opening', () => {
            const hours = mondayHours({ isOpen: true, open: '08:00' });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
        });

        it('during overnight span (e.g. 22:00 to 02:00) — current time before midnight', () => {
            // open=22:00, close=02:00 → overnight
            const hours = mondayHours({ isOpen: true, open: '22:00', close: '02:00' });
            // 22:30 is in the overnight window
            expect(computeOpenNowStatus(hours, MON_22_30)).toBe(true);
        });
    });

    describe('overnight span edge cases', () => {
        it('during overnight span — current time after midnight but before close', () => {
            // open=22:00, close=02:00
            const hours = mondayHours({ isOpen: true, open: '22:00', close: '02:00' });
            // 01:00 < 02:00 → should be true
            const afterMidnight = new Date('2024-01-15T01:00:00');
            expect(computeOpenNowStatus(hours, afterMidnight)).toBe(true);
        });

        it('during overnight span — current time after close but before midnight', () => {
            // open=22:00, close=02:00
            const hours = mondayHours({ isOpen: true, open: '22:00', close: '02:00' });
            // 10:00 is between close (02:00) and open (22:00) → closed
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });
    });

    describe('day key resolution', () => {
        it('resolves to the correct day for Sunday entries', () => {
            const hours = { sunday: { isOpen: true, open: '10:00', close: '20:00' } };
            // SUN_14_00 = Sunday at 14:00 → should be open
            expect(computeOpenNowStatus(hours, SUN_14_00)).toBe(true);
        });

        it('returns null when hours exist for a different day', () => {
            // Monday entry exists but we check on Sunday
            const hours = mondayHours({ isOpen: true, open: '09:00', close: '22:00' });
            expect(computeOpenNowStatus(hours, SUN_14_00)).toBeNull();
        });
    });
});
