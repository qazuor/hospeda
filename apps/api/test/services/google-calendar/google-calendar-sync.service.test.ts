/**
 * Google Calendar Occupancy Sync Service Tests (HOS-157 Phase 2 — Layer 3)
 *
 * Unit tests for `syncAccommodationCalendar`, the DECLARATIVE full-window
 * reconcile: fetch all live events from start-of-today forward, compute the
 * desired blocked-date set (one row per date, first event wins provenance), and
 * atomically replace future `GOOGLE_CALENDAR` occupancy rows.
 *
 * Mocked collaborators:
 * - credential repository `getGoogleCredential`
 * - token service `getValidGoogleToken`
 * - REST client `listEvents` (error classes kept REAL via importOriginal so the
 *   service's `instanceof` checks work)
 * - `@repo/db` models: `accommodationCalendarSyncModel.updateSyncState` and the
 *   single `accommodationOccupancyModel.replaceFutureSyncOccupancy` primitive.
 *
 * The "sync never overwrites MANUAL" invariant is enforced inside the model's
 * source-scoped `replaceFutureSyncOccupancy` (covered by the DB model's own
 * tests), so it is not re-asserted here.
 *
 * Scenarios covered (AAA pattern):
 * 1. Skipped: no connection / inactive / no calendar id.
 * 2. Token terminal + transient failure → error result + ERROR sync state.
 * 3. Happy path: all-day event → half-open desired rows + OK state (no syncToken).
 * 4. OVERLAP double-booking regression: two overlapping events → one row per
 *    date, shared date attributed to the first event.
 * 5. Cancelled events excluded from the desired set.
 * 6. Same-day timed event (< 1 day) contributes no rows.
 * 7. Multi-day timed event derives dates from dateTime prefixes.
 * 8. Pagination accumulates across pages into one desired set.
 * 9. listEvents 503 → error kind 'api'; 401 → error kind 'terminal'; both ERROR.
 *
 * @module test/services/google-calendar/google-calendar-sync.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCredential } from '../../../src/services/google-calendar/google-calendar-credential.repository.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
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

/**
 * Today's `YYYY-MM-DD` in the AR market zone, computed EXACTLY like the
 * service's `fromDate` (`Intl.DateTimeFormat('en-CA', { timeZone:
 * 'America/Argentina/Buenos_Aires' })`). A plain UTC computation would be
 * off-by-one during 00:00-03:00 UTC, since AR is a fixed UTC-3 offset.
 */
const todayFromDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires'
}).format(new Date());

/** Adds (or subtracts, via a negative `days`) whole days to a `YYYY-MM-DD` string using UTC date math. */
const addDaysUtc = (date: string, days: number): string => {
    const ms = Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
};

const buildCredential = (overrides?: Partial<GoogleCredential>): GoogleCredential => ({
    accessToken: 'cached',
    refreshToken: 'refresh',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    externalCalendarId: 'primary',
    syncToken: null,
    isActive: true,
    createdById: 'host-1',
    ...overrides
});

describe('google-calendar-sync.service', () => {
    let syncAccommodationCalendar: typeof import('../../../src/services/google-calendar/google-calendar-sync.service.js').syncAccommodationCalendar;
    let GoogleTokenRefreshError: typeof import('../../../src/services/google-calendar/google-token.errors.js').GoogleTokenRefreshError;
    let GoogleCalendarApiError: typeof import('../../../src/services/google-calendar/google-calendar-client.js').GoogleCalendarApiError;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockUpdateSyncState.mockResolvedValue(null);
        mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 0, inserted: 0 });
        mockGetValidGoogleToken.mockResolvedValue('access-token');

        ({ syncAccommodationCalendar } = await import(
            '../../../src/services/google-calendar/google-calendar-sync.service.js'
        ));
        ({ GoogleTokenRefreshError } = await import(
            '../../../src/services/google-calendar/google-token.errors.js'
        ));
        ({ GoogleCalendarApiError } = await import(
            '../../../src/services/google-calendar/google-calendar-client.js'
        ));
    });

    describe('skips', () => {
        it('should skip when no connection exists', async () => {
            mockGetGoogleCredential.mockResolvedValue(null);
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });
            expect(result).toEqual({ status: 'skipped', reason: 'no-connection' });
            expect(mockListEvents).not.toHaveBeenCalled();
        });

        it('should skip an inactive connection', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ isActive: false }));
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });
            expect(result).toEqual({ status: 'skipped', reason: 'inactive' });
        });

        it('should skip a connection with no calendar id', async () => {
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ externalCalendarId: null })
            );
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });
            expect(result).toEqual({ status: 'skipped', reason: 'no-calendar-id' });
            expect(mockReplaceFutureSyncOccupancy).not.toHaveBeenCalled();
        });
    });

    describe('token failures', () => {
        it('should record ERROR and return a terminal error when the token refresh is terminal', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockGetValidGoogleToken.mockRejectedValue(
                new GoogleTokenRefreshError('reconnect required', 'terminal')
            );

            // Act
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result).toMatchObject({ status: 'error', kind: 'terminal' });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({
                    accommodationId: ACCOMMODATION_ID,
                    provider: 'GOOGLE_CALENDAR',
                    lastSyncStatus: 'ERROR',
                    lastErrorMessage: 'reconnect required'
                })
            );
            expect(mockListEvents).not.toHaveBeenCalled();
        });

        it('should record ERROR with kind transient on a transient token failure', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockGetValidGoogleToken.mockRejectedValue(
                new GoogleTokenRefreshError('network blip', 'transient')
            );
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });
            expect(result).toMatchObject({ status: 'error', kind: 'transient' });
        });
    });

    describe('declarative reconcile', () => {
        it('should replace future rows with the half-open desired set and persist OK (no syncToken)', async () => {
            // Arrange — one all-day event today→(today+2) (checkout day free).
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev',
                        status: 'confirmed',
                        summary: 'Familia García',
                        start: { date: todayFromDate },
                        end: { date: addDaysUtc(todayFromDate, 2) }
                    }
                ]
            });
            mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 3, inserted: 2 });

            // Act
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert — desired rows are today + (today+1), attributed to `ev`.
            expect(mockReplaceFutureSyncOccupancy).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'GOOGLE_CALENDAR',
                fromDate: todayFromDate,
                rows: [
                    { date: todayFromDate, externalEventId: 'ev', eventTitle: 'Familia García' },
                    {
                        date: addDaysUtc(todayFromDate, 1),
                        externalEventId: 'ev',
                        eventTitle: 'Familia García'
                    }
                ],
                createdById: 'host-1'
            });
            // Google normalizes timed events to the AR market zone.
            expect(mockListEvents.mock.calls[0]?.[0]).toMatchObject({
                timeZone: 'America/Argentina/Buenos_Aires',
                timeMin: expect.any(String)
            });
            // OK sync state with NO syncToken key.
            const stateArg = mockUpdateSyncState.mock.calls.at(-1)?.[0];
            expect(stateArg).toMatchObject({
                lastSyncStatus: 'OK',
                lastErrorMessage: null
            });
            expect(stateArg).not.toHaveProperty('syncToken');
            // Result maps removed/inserted to datesRemoved/datesUpserted.
            expect(result).toMatchObject({
                status: 'ok',
                fullSync: true,
                eventsProcessed: 1,
                datesUpserted: 2,
                datesRemoved: 3
            });
        });

        it('should collapse overlapping events to one row per date (double-booking regression)', async () => {
            // Arrange — ev-A covers today..(today+2), ev-B covers (today+1)..(today+3)
            // (shared date: today+1).
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-A',
                        status: 'confirmed',
                        start: { date: todayFromDate },
                        end: { date: addDaysUtc(todayFromDate, 2) }
                    },
                    {
                        id: 'ev-B',
                        status: 'confirmed',
                        start: { date: addDaysUtc(todayFromDate, 1) },
                        end: { date: addDaysUtc(todayFromDate, 3) }
                    }
                ]
            });
            mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 0, inserted: 3 });

            // Act
            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert — exactly one row per date; the shared date wins ev-A (first).
            const callArg = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0];
            expect(callArg.rows).toEqual([
                { date: todayFromDate, externalEventId: 'ev-A', eventTitle: null },
                { date: addDaysUtc(todayFromDate, 1), externalEventId: 'ev-A', eventTitle: null },
                { date: addDaysUtc(todayFromDate, 2), externalEventId: 'ev-B', eventTitle: null }
            ]);
            // No duplicate dates.
            const dates = callArg.rows.map((r: { date: string }) => r.date);
            expect(new Set(dates).size).toBe(dates.length);
        });

        it('should exclude cancelled events from the desired set', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    { id: 'ev-gone', status: 'cancelled' },
                    {
                        id: 'ev-live',
                        status: 'confirmed',
                        start: { date: todayFromDate },
                        end: { date: addDaysUtc(todayFromDate, 1) }
                    }
                ]
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const callArg = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0];
            expect(callArg.rows).toEqual([
                { date: todayFromDate, externalEventId: 'ev-live', eventTitle: null }
            ]);
        });

        it('should contribute no rows for a same-day timed event (< 1 day → empty range)', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-short',
                        status: 'confirmed',
                        start: { dateTime: '2026-07-10T14:00:00-03:00' },
                        end: { dateTime: '2026-07-10T16:00:00-03:00' }
                    }
                ]
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockReplaceFutureSyncOccupancy).toHaveBeenCalledWith(
                expect.objectContaining({ rows: [] })
            );
        });

        it('should derive dates from dateTime prefixes for a multi-day timed event', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-timed',
                        status: 'confirmed',
                        start: { dateTime: `${todayFromDate}T22:00:00-03:00` },
                        end: { dateTime: `${addDaysUtc(todayFromDate, 2)}T09:00:00-03:00` }
                    }
                ]
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            const callArg = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0];
            expect(callArg.rows).toEqual([
                { date: todayFromDate, externalEventId: 'ev-timed', eventTitle: null },
                {
                    date: addDaysUtc(todayFromDate, 1),
                    externalEventId: 'ev-timed',
                    eventTitle: null
                }
            ]);
        });

        it('should clamp out a past date from an in-progress event, keeping only date >= fromDate', async () => {
            // Arrange — an all-day event that started yesterday and ends tomorrow
            // (still "in progress"). Google returns it in full since `timeMin`
            // filters by event END, not START, so its half-open dates are
            // [yesterday, today]. The past date (yesterday) must be clamped out
            // before the rows reach `replaceFutureSyncOccupancy`.
            const yesterday = addDaysUtc(todayFromDate, -1);
            const tomorrow = addDaysUtc(todayFromDate, 1);
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-in-progress',
                        status: 'confirmed',
                        start: { date: yesterday },
                        end: { date: tomorrow }
                    }
                ]
            });

            // Act
            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert — only today survives; yesterday is dropped.
            const callArg = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0];
            expect(callArg.rows).toEqual([
                { date: todayFromDate, externalEventId: 'ev-in-progress', eventTitle: null }
            ]);
        });
    });

    describe('pagination + errors', () => {
        it('should accumulate events across pages into one desired set', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'ev-1',
                            status: 'confirmed',
                            start: { date: todayFromDate },
                            end: { date: addDaysUtc(todayFromDate, 1) }
                        }
                    ],
                    nextPageToken: 'page-2'
                })
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'ev-2',
                            status: 'confirmed',
                            start: { date: addDaysUtc(todayFromDate, 5) },
                            end: { date: addDaysUtc(todayFromDate, 6) }
                        }
                    ]
                });
            mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 0, inserted: 2 });

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockListEvents).toHaveBeenCalledTimes(2);
            expect(mockListEvents.mock.calls[1]?.[0].pageToken).toBe('page-2');
            const callArg = mockReplaceFutureSyncOccupancy.mock.calls[0]?.[0];
            expect(callArg.rows).toEqual([
                { date: todayFromDate, externalEventId: 'ev-1', eventTitle: null },
                { date: addDaysUtc(todayFromDate, 5), externalEventId: 'ev-2', eventTitle: null }
            ]);
            expect(result).toMatchObject({ status: 'ok', eventsProcessed: 2 });
        });

        it('should record ERROR (kind api) when the Calendar API returns a 503', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockRejectedValue(
                new GoogleCalendarApiError('events.list failed with status 503', 503)
            );

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(result).toMatchObject({ status: 'error', kind: 'api' });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({ lastSyncStatus: 'ERROR' })
            );
            expect(mockReplaceFutureSyncOccupancy).not.toHaveBeenCalled();
        });

        it('should record ERROR (kind terminal) when the Calendar API returns a 401 (grant revoked)', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential());
            mockListEvents.mockRejectedValue(
                new GoogleCalendarApiError('events.list failed with status 401', 401)
            );

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(result).toMatchObject({ status: 'error', kind: 'terminal' });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({ lastSyncStatus: 'ERROR' })
            );
        });
    });
});
