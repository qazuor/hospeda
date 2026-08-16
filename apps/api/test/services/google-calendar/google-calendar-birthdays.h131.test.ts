/**
 * Regression suite for H-131 — "connecting Google Calendar blocks the
 * accommodation on 150 days up to 2056, because it imports birthdays".
 *
 * ## What was measured in production (2026-08-15)
 *
 * `accommodation_occupancy` held **302** rows with `source = GOOGLE_CALENDAR`
 * across two accommodations, reaching `2056-04-26`. Grouped by `event_title`:
 *
 * ```
 * Delfina Asrilevich - Cumpleaños   60 rows   2026-09-12 → 2055-09-12
 * Joaquin Asrilevich - Cumpleaños   60 rows   2027-04-26 → 2056-04-26
 * Judith Asrilevich - Cumpleaños    60 rows   2027-01-12 → 2056-01-12
 * Nicolas Potente - Cumpleaños      60 rows   2027-04-10 → 2056-04-10
 * ¡Feliz cumpleaños!                60 rows   2027-03-27 → 2056-03-27
 * ```
 *
 * Five contact birthdays, each expanded 30 years forward. A blocked day removes
 * the listing from date searches, so a host who connects their personal
 * calendar disappears from results on those days every year, forever.
 *
 * ## Two independent causes, both covered here
 *
 * 1. **What is imported** — the sync treated every non-cancelled entry on the
 *    host's PRIMARY calendar as a booking.
 * 2. **How far** — the fetch had a `timeMin` but no `timeMax`, so
 *    `singleEvents=true` expanded each yearly recurrence for the life of its
 *    rule.
 *
 * Fixing only one leaves the bug: without the filter, a 24-month window still
 * blocks five days a year; without the window, filtering birthdays still lets
 * any other recurring entry run to 2056.
 *
 * ## Clock discipline
 *
 * This suite freezes `Date` exactly like its sibling
 * `google-calendar-sync.service.test.ts`. That file documents six tests that
 * failed on 2026-08-05 because a shard straddled midnight AR while reading the
 * wall clock in two places. Every date here derives from `FROZEN_NOW`; nothing
 * calls `new Date()` for "now".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCredential } from '../../../src/services/google-calendar/google-calendar-credential.repository.js';
import { classifyOccupancyEvent } from '../../../src/services/google-calendar/google-calendar-occupancy-filter.js';
import { syncAccommodationCalendar } from '../../../src/services/google-calendar/google-calendar-sync.service.js';

// ---------------------------------------------------------------------------
// Hoisted mocks (mirrors google-calendar-sync.service.test.ts)
// ---------------------------------------------------------------------------

const {
    mockGetGoogleCredential,
    mockGetValidGoogleToken,
    mockListEvents,
    mockUpdateSyncState,
    mockReplaceFutureSyncOccupancy
} = vi.hoisted(() => ({
    mockGetGoogleCredential: vi.fn(),
    mockGetValidGoogleToken: vi.fn(),
    mockListEvents: vi.fn(),
    mockUpdateSyncState: vi.fn().mockResolvedValue(null),
    mockReplaceFutureSyncOccupancy: vi.fn()
}));

vi.mock('../../../src/services/google-calendar/google-calendar-credential.repository.js', () => ({
    getGoogleCredential: mockGetGoogleCredential
}));

vi.mock('../../../src/services/google-calendar/google-token.service.js', () => ({
    getValidGoogleToken: mockGetValidGoogleToken
}));

vi.mock(
    '../../../src/services/google-calendar/google-calendar-client.js',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../../src/services/google-calendar/google-calendar-client.js')
            >();
        return { ...actual, listEvents: mockListEvents };
    }
);

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: { updateSyncState: mockUpdateSyncState },
    accommodationOccupancyModel: {
        replaceFutureSyncOccupancy: mockReplaceFutureSyncOccupancy
    }
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const ACCOMMODATION_ID = 'acc-1';

/** The instant every test in this file runs at. See "Clock discipline" above. */
const FROZEN_NOW = new Date('2026-03-15T15:00:00.000Z');

const buildCredential = (overrides?: Partial<GoogleCredential>): GoogleCredential => ({
    accessToken: 'cached',
    refreshToken: 'refresh',
    expiresAt: new Date(FROZEN_NOW.getTime() + 60 * 60 * 1000),
    externalCalendarId: 'primary',
    syncToken: null,
    isActive: true,
    createdById: 'host-1',
    ...overrides
});

/**
 * One expansion of a Google contact birthday, as `events.list` returns it with
 * `singleEvents=true`: an all-day entry, `eventType: 'birthday'`, and marked
 * transparent because it does not occupy the owner's own time.
 */
const birthdayEvent = (input: { id: string; date: string; summary: string }) => ({
    id: input.id,
    summary: input.summary,
    status: 'confirmed',
    eventType: 'birthday',
    transparency: 'transparent',
    start: { date: input.date },
    // Google's all-day `end.date` is exclusive: a one-day event ends the next day.
    end: {
        date: new Date(Date.parse(`${input.date}T00:00:00Z`) + 86_400_000)
            .toISOString()
            .slice(0, 10)
    }
});

/** A genuine multi-day booking the host entered by hand. */
const bookingEvent = (input: { id: string; start: string; end: string }) => ({
    id: input.id,
    summary: 'Reserva - Familia Gómez',
    status: 'confirmed',
    eventType: 'default',
    transparency: 'opaque',
    start: { date: input.start },
    end: { date: input.end }
});

/** The rows the service asked the model to write this run. */
function writtenRows(): { date: string; eventTitle: string | null }[] {
    const call = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0] as
        | { rows: { date: string; eventTitle: string | null }[] }
        | undefined;
    return call?.rows ?? [];
}

/** The query params the service asked the Calendar API for. */
function firstListEventsCall(): Record<string, unknown> {
    return (mockListEvents.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    vi.clearAllMocks();
    mockGetGoogleCredential.mockResolvedValue(buildCredential());
    mockGetValidGoogleToken.mockResolvedValue('access-token');
    mockUpdateSyncState.mockResolvedValue(null);
    mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 0, inserted: 0 });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('H-131 — a birthday is not a booking', () => {
    describe('the event filter', () => {
        it('excludes a contact birthday', () => {
            const result = classifyOccupancyEvent({
                event: birthdayEvent({
                    id: 'b1',
                    date: '2026-09-12',
                    summary: 'Delfina Asrilevich - Cumpleaños'
                })
            });

            expect(result).toEqual({ include: false, reason: 'non-occupying-type' });
        });

        it('excludes any entry the owner marked as free on their own calendar', () => {
            const result = classifyOccupancyEvent({
                event: {
                    id: 'x',
                    eventType: 'default',
                    transparency: 'transparent',
                    start: { date: '2026-04-01' },
                    end: { date: '2026-04-05' }
                }
            });

            expect(result).toEqual({ include: false, reason: 'transparent' });
        });

        it('excludes Google-synthesised working-location and focus-time entries', () => {
            for (const eventType of ['workingLocation', 'focusTime', 'fromGmail']) {
                expect(classifyOccupancyEvent({ event: { id: 'x', eventType } }).include).toBe(
                    false
                );
            }
        });

        it('INCLUDES a real booking', () => {
            const result = classifyOccupancyEvent({
                event: bookingEvent({ id: 'r1', start: '2026-04-01', end: '2026-04-05' })
            });

            expect(result).toEqual({ include: true });
        });

        it('INCLUDES an out-of-office block — the host being away plausibly means unavailable', () => {
            expect(
                classifyOccupancyEvent({ event: { id: 'o1', eventType: 'outOfOffice' } }).include
            ).toBe(true);
        });

        it('INCLUDES an entry from an older response that declares neither field', () => {
            // Absent eventType means 'default'; absent transparency means 'opaque'.
            expect(classifyOccupancyEvent({ event: { id: 'legacy' } }).include).toBe(true);
        });
    });

    describe('the sync run', () => {
        it('writes no occupancy for a calendar that holds only birthdays', async () => {
            mockListEvents.mockResolvedValue({
                items: [
                    birthdayEvent({
                        id: 'b1',
                        date: '2026-09-12',
                        summary: 'Delfina Asrilevich - Cumpleaños'
                    }),
                    birthdayEvent({
                        id: 'b2',
                        date: '2027-01-12',
                        summary: 'Judith Asrilevich - Cumpleaños'
                    })
                ]
            });

            const result = await syncAccommodationCalendar({
                accommodationId: ACCOMMODATION_ID
            });

            expect(writtenRows()).toHaveLength(0);
            expect(result).toMatchObject({ status: 'ok', eventsExcluded: 2 });
        });

        it('keeps the real booking and drops the birthday from the same calendar', async () => {
            mockListEvents.mockResolvedValue({
                items: [
                    birthdayEvent({
                        id: 'b1',
                        date: '2026-04-10',
                        summary: 'Nicolas Potente - Cumpleaños'
                    }),
                    bookingEvent({ id: 'r1', start: '2026-04-01', end: '2026-04-04' })
                ]
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const dates = writtenRows().map((r) => r.date);
            // The booking blocks 01-03; the 04 checkout day stays free.
            expect(dates).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
            expect(dates).not.toContain('2026-04-10');
        });

        it('does not count cancelled events as exclusions — they were never candidates', async () => {
            mockListEvents.mockResolvedValue({
                items: [
                    { id: 'c1', status: 'cancelled', eventType: 'default' },
                    birthdayEvent({ id: 'b1', date: '2026-09-12', summary: 'Cumpleaños' })
                ]
            });

            const result = await syncAccommodationCalendar({
                accommodationId: ACCOMMODATION_ID
            });

            expect(result).toMatchObject({ eventsExcluded: 1 });
        });
    });

    describe('the fetch window', () => {
        it('bounds the request with a timeMax so recurrences cannot expand forever', async () => {
            mockListEvents.mockResolvedValue({ items: [] });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const call = firstListEventsCall();
            expect(call.timeMax).toBeTypeOf('string');
            // Without this bound, production reached 2056-04-26.
            expect(Date.parse(call.timeMax as string)).toBeLessThan(
                Date.parse('2029-01-01T00:00:00Z')
            );
        });

        it('opens the window 24 months after the start of today in the market zone', async () => {
            mockListEvents.mockResolvedValue({ items: [] });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const call = firstListEventsCall();
            const expectedStart = new Date('2026-03-15T00:00:00-03:00');
            const expectedEnd = new Date(expectedStart);
            expectedEnd.setMonth(expectedEnd.getMonth() + 24);

            expect(call.timeMin).toBe(expectedStart.toISOString());
            expect(call.timeMax).toBe(expectedEnd.toISOString());
        });

        it('keeps the window wide enough for a booking well over a year out', async () => {
            mockListEvents.mockResolvedValue({ items: [] });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const timeMax = Date.parse(firstListEventsCall().timeMax as string);
            // A reservation 18 months ahead must still fall inside the window.
            expect(timeMax).toBeGreaterThan(Date.parse('2027-09-15T00:00:00Z'));
        });
    });
});
