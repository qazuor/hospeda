/**
 * iCal Feed Parser/Adapter Tests (HOS-162 Phase 3 — Layer B).
 *
 * Unit tests for `parseIcsToRows` (pure, in-memory `.ics` text → occupancy
 * rows) and `fetchAndParseIcsFeed` (the thin SSRF-guarded fetch + parse
 * wrapper). Uses inline Airbnb/Booking-style all-day `VEVENT` fixtures — no
 * network I/O for `parseIcsToRows`; `safeExternalFetch` is mocked for
 * `fetchAndParseIcsFeed`.
 *
 * Scenarios covered (AAA pattern):
 * 1. Single all-day reservation — `DTEND` is EXCLUSIVE, checkout day free.
 * 2. Multi-day reservation enumerated across every occupied day.
 * 3. Two overlapping VEVENTs collapse to one row per date (first wins).
 * 4. A `STATUS:CANCELLED` VEVENT is excluded from the desired set.
 * 5. A feed with zero VEVENT components → typed `empty` error (not thrown).
 * 6. A feed `node-ical` cannot parse at all → typed `parse_error` (not thrown).
 * 7. Midnight-edge / timezone case — an all-day date is recovered correctly
 *    regardless of the process's `TZ` (the `node-ical` local-midnight quirk).
 * 8. `date >= fromDate` filtering drops past-dated occupied days.
 * 9. `fetchAndParseIcsFeed` delegates to `parseIcsToRows` on a successful
 *    `safeExternalFetch`, and maps a blocked/failed fetch to `fetch_error`.
 *
 * @module test/services/ical-calendar/ical-parser
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: vi.fn()
}));

// Import after vi.mock so we get the mocked version.
import { safeExternalFetch } from '@repo/utils/safe-fetch';
import {
    fetchAndParseIcsFeed,
    parseIcsToRows
} from '../../../src/services/ical-calendar/ical-parser.js';

const mockFetch = vi.mocked(safeExternalFetch);

/** Wraps a set of `VEVENT` blocks in a minimal but realistic VCALENDAR envelope. */
const buildIcs = (events: string): string =>
    [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN',
        'CALSCALE:GREGORIAN',
        'X-WR-CALNAME:Airbnb',
        events.trim(),
        'END:VCALENDAR'
    ].join('\n');

/** Builds a single all-day `VEVENT` block, `DTEND` exclusive per RFC 5545. */
const allDayEvent = (input: {
    uid: string;
    dtstart: string;
    dtend: string;
    status?: string;
    summary?: string;
}): string =>
    [
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${input.dtstart}`,
        `DTEND;VALUE=DATE:${input.dtend}`,
        'DTSTAMP:20260701T120000Z',
        `UID:${input.uid}`,
        `SUMMARY:${input.summary ?? 'Reserved'}`,
        ...(input.status === undefined ? [] : [`STATUS:${input.status}`]),
        'END:VEVENT'
    ].join('\n');

describe('ical-parser', () => {
    describe('parseIcsToRows', () => {
        it('should leave the checkout day free for a single all-day reservation', async () => {
            // Arrange — Jul-10 to Jul-12 (DTEND exclusive) blocks Jul-10 and Jul-11 only.
            const icsText = buildIcs(
                allDayEvent({ uid: 'evt-1@airbnb.com', dtstart: '20260710', dtend: '20260712' })
            );

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result).toEqual({
                ok: true,
                rows: [
                    { date: '2026-07-10', externalEventId: 'evt-1@airbnb.com' },
                    { date: '2026-07-11', externalEventId: 'evt-1@airbnb.com' }
                ]
            });
        });

        it('should enumerate every occupied day of a multi-day reservation', async () => {
            // Arrange — a 5-night stay, Jul-10 to Jul-15.
            const icsText = buildIcs(
                allDayEvent({
                    uid: 'evt-multi@booking.com',
                    dtstart: '20260710',
                    dtend: '20260715'
                })
            );

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result.ok).toBe(true);
            const rows = result.ok ? result.rows : [];
            expect(rows.map((r) => r.date)).toEqual([
                '2026-07-10',
                '2026-07-11',
                '2026-07-12',
                '2026-07-13',
                '2026-07-14'
            ]);
            expect(rows.every((r) => r.externalEventId === 'evt-multi@booking.com')).toBe(true);
        });

        it('should collapse two overlapping VEVENTs to one row per date, first event winning the shared date', async () => {
            // Arrange — evt-A covers Jul-10..Jul-12, evt-B covers Jul-11..Jul-13
            // (shared date: Jul-11).
            const icsText = buildIcs(
                [
                    allDayEvent({
                        uid: 'evt-A@airbnb.com',
                        dtstart: '20260710',
                        dtend: '20260712'
                    }),
                    allDayEvent({ uid: 'evt-B@airbnb.com', dtstart: '20260711', dtend: '20260713' })
                ].join('\n')
            );

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert — exactly one row per date; the shared date wins evt-A (first in feed order).
            expect(result).toEqual({
                ok: true,
                rows: [
                    { date: '2026-07-10', externalEventId: 'evt-A@airbnb.com' },
                    { date: '2026-07-11', externalEventId: 'evt-A@airbnb.com' },
                    { date: '2026-07-12', externalEventId: 'evt-B@airbnb.com' }
                ]
            });
            const rows = result.ok ? result.rows : [];
            const dates = rows.map((r) => r.date);
            expect(new Set(dates).size).toBe(dates.length);
        });

        it('should exclude a CANCELLED VEVENT from the desired set', async () => {
            // Arrange — one live reservation, one cancelled reservation.
            const icsText = buildIcs(
                [
                    allDayEvent({
                        uid: 'evt-gone@airbnb.com',
                        dtstart: '20260720',
                        dtend: '20260722',
                        status: 'CANCELLED'
                    }),
                    allDayEvent({
                        uid: 'evt-live@airbnb.com',
                        dtstart: '20260710',
                        dtend: '20260711'
                    })
                ].join('\n')
            );

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result).toEqual({
                ok: true,
                rows: [{ date: '2026-07-10', externalEventId: 'evt-live@airbnb.com' }]
            });
        });

        it('should return a typed empty error for a feed with zero VEVENT components (not throw)', async () => {
            // Arrange — a syntactically-valid VCALENDAR with no reservations.
            const icsText = buildIcs('');

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result).toEqual({
                ok: false,
                kind: 'empty',
                message: expect.any(String)
            });
        });

        it('should return a typed empty error for garbage, non-calendar text (not throw)', async () => {
            // Arrange
            const icsText = 'this is not an iCal feed at all, just garbage text';

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.kind).toBe('empty');
        });

        it('should return a typed parse_error when node-ical cannot parse the input at all (not throw)', async () => {
            // Arrange — a non-string value node-ical's own parser throws on internally.
            // @ts-expect-error Testing runtime robustness against a value the type
            // signature already forbids (defense against a caller bypassing TS).
            const icsText: string = null;

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

            // Assert
            expect(result).toEqual({
                ok: false,
                kind: 'parse_error',
                message: expect.any(String)
            });
        });

        it('should recover the exact calendar day for an all-day marker regardless of process TZ (midnight edge)', async () => {
            // Arrange — node-ical constructs all-day markers at LOCAL PROCESS
            // midnight; a positive-UTC-offset zone (Asia/Tokyo) is the case where
            // naive UTC-based extraction would silently return the PREVIOUS day.
            const originalTz = process.env.TZ;
            const icsText = buildIcs(
                allDayEvent({ uid: 'evt-edge@airbnb.com', dtstart: '20260710', dtend: '20260711' })
            );

            try {
                // Act — Tokyo is UTC+9; local midnight Jul-10 there is Jul-09T15:00:00Z.
                process.env.TZ = 'Asia/Tokyo';
                const tokyoResult = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

                // Act — UTC has no offset; local midnight Jul-10 there is Jul-10T00:00:00Z.
                process.env.TZ = 'UTC';
                const utcResult = await parseIcsToRows({ icsText, fromDate: '2026-01-01' });

                // Assert — both process timezones recover the SAME intended calendar day.
                expect(tokyoResult).toEqual({
                    ok: true,
                    rows: [{ date: '2026-07-10', externalEventId: 'evt-edge@airbnb.com' }]
                });
                expect(utcResult).toEqual({
                    ok: true,
                    rows: [{ date: '2026-07-10', externalEventId: 'evt-edge@airbnb.com' }]
                });
            } finally {
                // Restore so this test never leaks its TZ override into siblings.
                if (originalTz === undefined) {
                    delete process.env.TZ;
                } else {
                    process.env.TZ = originalTz;
                }
            }
        });

        it('should filter out rows dated before fromDate', async () => {
            // Arrange — a reservation spanning Jul-10..Jul-13; fromDate cuts off Jul-10 and Jul-11.
            const icsText = buildIcs(
                allDayEvent({
                    uid: 'evt-cutoff@airbnb.com',
                    dtstart: '20260710',
                    dtend: '20260713'
                })
            );

            // Act
            const result = await parseIcsToRows({ icsText, fromDate: '2026-07-12' });

            // Assert
            expect(result).toEqual({
                ok: true,
                rows: [{ date: '2026-07-12', externalEventId: 'evt-cutoff@airbnb.com' }]
            });
        });
    });

    describe('fetchAndParseIcsFeed', () => {
        beforeEach(() => {
            mockFetch.mockReset();
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should fetch through safeExternalFetch and delegate to parseIcsToRows on success', async () => {
            // Arrange
            const icsText = buildIcs(
                allDayEvent({
                    uid: 'evt-fetched@airbnb.com',
                    dtstart: '20260710',
                    dtend: '20260711'
                })
            );
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: icsText,
                finalUrl: 'https://www.airbnb.com/calendar/ical/123.ics'
            });

            // Act
            const result = await fetchAndParseIcsFeed({
                feedUrl: 'https://www.airbnb.com/calendar/ical/123.ics',
                fromDate: '2026-01-01'
            });

            // Assert
            expect(mockFetch).toHaveBeenCalledWith(
                expect.objectContaining({ url: 'https://www.airbnb.com/calendar/ical/123.ics' })
            );
            expect(result).toEqual({
                ok: true,
                rows: [{ date: '2026-07-10', externalEventId: 'evt-fetched@airbnb.com' }]
            });
        });

        it('should map a blocked/failed fetch to a typed fetch_error (never call node-ical)', async () => {
            // Arrange — safeExternalFetch blocked the URL (e.g. SSRF policy).
            mockFetch.mockResolvedValue({
                ok: false,
                status: 0,
                error: 'Hostname resolves to a blocked private address',
                blocked: true
            });

            // Act
            const result = await fetchAndParseIcsFeed({
                feedUrl: 'https://internal.example/feed.ics',
                fromDate: '2026-01-01'
            });

            // Assert
            expect(result).toEqual({
                ok: false,
                kind: 'fetch_error',
                message: 'Hostname resolves to a blocked private address'
            });
        });

        it('should forward timeoutMs and maxBytes to safeExternalFetch when provided', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: false,
                status: 0,
                error: 'Request timed out after 5000 ms',
                blocked: true
            });

            // Act
            await fetchAndParseIcsFeed({
                feedUrl: 'https://www.booking.com/ical.ics',
                fromDate: '2026-01-01',
                timeoutMs: 5000,
                maxBytes: 1_000_000
            });

            // Assert
            expect(mockFetch).toHaveBeenCalledWith(
                expect.objectContaining({ timeoutMs: 5000, maxBytes: 1_000_000 })
            );
        });
    });
});
