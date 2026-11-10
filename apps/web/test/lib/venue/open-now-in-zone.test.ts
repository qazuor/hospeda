/**
 * @file open-now-in-zone.test.ts
 * @description Unit tests for the venue-zone "open now" evaluation
 * (HOS-1787 leaf 6.3, AC:6:7).
 *
 * The file is expected to pass identically under `TZ=UTC`,
 * `TZ=Asia/Tokyo` and `TZ=America/Argentina/Buenos_Aires`: if the
 * implementation ever falls back to the process clock, the Tokyo run fails on
 * the overnight cases below while the other two stay green.
 */

import { describe, expect, it } from 'vitest';
import type { VenueOpeningHoursEntry } from '../../../src/data/types';
import {
    computeOpenNowInZone,
    todayIndexInZone,
    VENUE_OPEN_NOW_TIME_ZONE
} from '../../../src/lib/venue/open-now-in-zone';

const closedDay: VenueOpeningHoursEntry = { isOpen: false, shifts: [] };

/** Friday + Saturday 23:30 → 06:00, the DEC-FAC-052 calendar. */
const overnight: VenueOpeningHoursEntry = {
    isOpen: true,
    shifts: [{ open: '23:30', close: '06:00' }]
};

const WEEKEND_OVERNIGHT: Record<string, VenueOpeningHoursEntry> = {
    friday: overnight,
    saturday: overnight
};

/**
 * Builds the `Date` for a UTC instant.
 *
 * @param iso - ISO 8601 timestamp with a `Z` suffix.
 * @returns The parsed date.
 */
function at(iso: string): Date {
    return new Date(iso);
}

describe('computeOpenNowInZone', () => {
    it('reads the Buenos Aires weekday across the UTC date boundary', () => {
        expect(
            todayIndexInZone({
                now: at('2026-11-09T02:30:00Z'),
                timeZone: VENUE_OPEN_NOW_TIME_ZONE
            })
        ).toBe(0);
        expect(
            todayIndexInZone({
                now: at('2026-11-09T03:30:00Z'),
                timeZone: VENUE_OPEN_NOW_TIME_ZONE
            })
        ).toBe(1);
    });

    it('pins the venue-zone constant to the schema default', () => {
        expect(VENUE_OPEN_NOW_TIME_ZONE).toBe('America/Argentina/Buenos_Aires');
    });

    describe('DEC-FAC-052 overnight calendar (Friday/Saturday 23:30-06:00)', () => {
        // Argentina is UTC-3 all year, so 03:00 local is 06:00 UTC.
        it('is open on Saturday 03:00 ART — Friday’s shift is still running', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-06T06:00:00.000Z')
                })
            ).toBe(true);
        });

        it('is open on Sunday 03:00 ART — Saturday’s shift is still running', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-07T06:00:00.000Z')
                })
            ).toBe(true);
        });

        it('is closed on Friday 03:00 ART — no shift started the day before', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-05T06:00:00.000Z')
                })
            ).toBe(false);
        });

        it('is open on Saturday 23:45 ART even though UTC is already Sunday', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-07T02:45:00.000Z')
                })
            ).toBe(true);
        });

        it('is closed exactly at 06:00 ART (close is exclusive, today opens late)', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-06T09:00:00.000Z')
                })
            ).toBe(false);
        });

        it('is closed on Sunday 06:00 ART once Saturday’s wrap ended', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: { ...WEEKEND_OVERNIGHT, sunday: closedDay },
                    now: at('2024-01-07T09:00:00.000Z')
                })
            ).toBe(false);
        });
    });

    describe('missing data', () => {
        it('returns null when the venue has no entry for the zone day', () => {
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-08T15:00:00.000Z')
                })
            ).toBeNull();
        });
    });

    describe('timeZone option', () => {
        it('evaluates the instant in the requested zone', () => {
            // 2024-01-06T06:00Z is Saturday 03:00 in Buenos Aires but
            // Saturday 15:00 in Tokyo, where no shift covers it.
            expect(
                computeOpenNowInZone({
                    openingHours: WEEKEND_OVERNIGHT,
                    now: at('2024-01-06T06:00:00.000Z'),
                    timeZone: 'Asia/Tokyo'
                })
            ).toBe(false);
        });
    });
});
