/**
 * @file OpeningHoursSection.test.ts
 * @description Unit tests for the opening-hours pipeline (SPEC-239 T-054, Bug B8):
 * the pure helpers in `gastronomy-hours.ts`, the `normalizeOpeningHours`
 * transform (via the exported `toGastronomyCardProps`), and source-read
 * assertions for `OpeningHoursSection.astro`.
 *
 * The Astro component cannot be rendered in Vitest so we:
 * 1. Unit-test the pure helpers (getDayKey, getTodayIndex, parseTimeToMinutes,
 *    computeOpenNowStatus) with an injectable `now` parameter.
 * 2. Verify the normalizer reads the real `{ days: { mon: { closed, shifts } } }`
 *    schema shape and preserves multiple shifts.
 * 3. Source-read the component to assert structural correctness.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { GastronomyOpeningHoursEntry } from '../../src/data/types';
import { toGastronomyCardProps } from '../../src/lib/api/transforms';
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

    it('renders each shift window from the shifts array', () => {
        expect(src).toContain('shifts');
        expect(src).toContain('.map(');
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
// computeOpenNowStatus — the main logic under test (multi-shift, Bug B8)
// ---------------------------------------------------------------------------

/** Helper: build a single-day "monday" entry from a list of shifts. */
function day(shifts: ReadonlyArray<{ open: string; close: string }>): GastronomyOpeningHoursEntry {
    return { isOpen: shifts.length > 0, shifts };
}

/** Helper: a minimal hours map with one entry for "monday". */
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
            const hours = { tuesday: day([{ open: '09:00', close: '22:00' }]) };
            expect(computeOpenNowStatus(hours, MON_10_00)).toBeNull();
        });

        it('when the map is empty', () => {
            expect(computeOpenNowStatus({}, MON_10_00)).toBeNull();
        });
    });

    describe('returns false', () => {
        it('when the day is closed (isOpen false)', () => {
            const hours = mondayHours({ isOpen: false, shifts: [] });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });

        it('when the day is open but has no shifts', () => {
            const hours = mondayHours({ isOpen: true, shifts: [] });
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });

        it('when current time is before opening', () => {
            const hours = mondayHours(day([{ open: '12:00', close: '22:00' }]));
            // 10:00 < 12:00
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(false);
        });

        it('when current time is at or after closing', () => {
            const hours = mondayHours(day([{ open: '09:00', close: '22:00' }]));
            // 22:30 >= 22:00
            expect(computeOpenNowStatus(hours, MON_22_30)).toBe(false);
        });
    });

    describe('returns true', () => {
        it('when current time is within the open window', () => {
            const hours = mondayHours(day([{ open: '08:00', close: '22:00' }]));
            // 10:00 is between 08:00 and 22:00
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
        });

        it('when current time is exactly at opening (inclusive boundary)', () => {
            const hours = mondayHours(day([{ open: '10:00', close: '22:00' }]));
            expect(computeOpenNowStatus(hours, MON_10_00)).toBe(true);
        });
    });

    describe('split schedule (multiple shifts)', () => {
        const split = mondayHours(
            day([
                { open: '12:00', close: '15:00' },
                { open: '20:00', close: '23:59' }
            ])
        );

        it('is open during the midday shift', () => {
            expect(computeOpenNowStatus(split, new Date('2024-01-15T13:00:00'))).toBe(true);
        });

        it('is CLOSED between shifts (afternoon gap)', () => {
            expect(computeOpenNowStatus(split, new Date('2024-01-15T17:00:00'))).toBe(false);
        });

        it('is open again during the night shift', () => {
            expect(computeOpenNowStatus(split, new Date('2024-01-15T21:00:00'))).toBe(true);
        });
    });

    describe('overnight span (defensive — the schema normally forbids it)', () => {
        const overnight = mondayHours(day([{ open: '22:00', close: '02:00' }]));

        it('is open before midnight', () => {
            // 22:30 is in the overnight window
            expect(computeOpenNowStatus(overnight, MON_22_30)).toBe(true);
        });

        it('is open after midnight but before close', () => {
            const afterMidnight = new Date('2024-01-15T01:00:00');
            expect(computeOpenNowStatus(overnight, afterMidnight)).toBe(true);
        });

        it('is closed after close but before open', () => {
            // 10:00 is between close (02:00) and open (22:00) → closed
            expect(computeOpenNowStatus(overnight, MON_10_00)).toBe(false);
        });
    });

    describe('day key resolution', () => {
        it('resolves to the correct day for Sunday entries', () => {
            const hours = { sunday: day([{ open: '10:00', close: '20:00' }]) };
            // SUN_14_00 = Sunday at 14:00 → should be open
            expect(computeOpenNowStatus(hours, SUN_14_00)).toBe(true);
        });

        it('returns null when hours exist for a different day', () => {
            // Monday entry exists but we check on Sunday
            const hours = mondayHours(day([{ open: '09:00', close: '22:00' }]));
            expect(computeOpenNowStatus(hours, SUN_14_00)).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// normalizeOpeningHours (exercised via the exported toGastronomyCardProps)
// ---------------------------------------------------------------------------

describe('normalizeOpeningHours (via toGastronomyCardProps)', () => {
    const baseItem = {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'la-parrilla',
        name: 'La Parrilla',
        type: 'PARRILLA'
    };

    it('reads the nested days map and preserves every shift', () => {
        const card = toGastronomyCardProps({
            item: {
                ...baseItem,
                openingHours: {
                    timezone: 'America/Argentina/Buenos_Aires',
                    days: {
                        mon: {
                            closed: false,
                            shifts: [
                                { open: '12:00', close: '15:00' },
                                { open: '20:00', close: '23:59' }
                            ]
                        },
                        tue: { closed: true, shifts: [] }
                    }
                }
            }
        });

        expect(card.openingHours).not.toBeNull();
        expect(card.openingHours?.monday).toEqual({
            isOpen: true,
            shifts: [
                { open: '12:00', close: '15:00' },
                { open: '20:00', close: '23:59' }
            ]
        });
        expect(card.openingHours?.tuesday).toEqual({ isOpen: false, shifts: [] });
    });

    it('returns null when openingHours is absent', () => {
        const card = toGastronomyCardProps({ item: baseItem });
        expect(card.openingHours).toBeNull();
    });

    it('returns null for the legacy top-level shape (no days key)', () => {
        const card = toGastronomyCardProps({
            item: {
                ...baseItem,
                openingHours: { monday: { isOpen: true, open: '09:00', close: '18:00' } }
            }
        });
        expect(card.openingHours).toBeNull();
    });
});
