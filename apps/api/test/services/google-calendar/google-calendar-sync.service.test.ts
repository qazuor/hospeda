/**
 * Google Calendar Occupancy Sync Service Tests (HOS-157 Phase 2 — Layer 3)
 *
 * Unit tests for `syncAccommodationCalendar`.
 *
 * Mocked collaborators:
 * - credential repository `getGoogleCredential`
 * - token service `getValidGoogleToken`
 * - REST client `listEvents` (error classes kept REAL via importOriginal so the
 *   service's `instanceof` checks work)
 * - `@repo/db` models: `accommodationCalendarSyncModel.updateSyncState` and the
 *   four source-scoped `accommodationOccupancyModel` sync methods.
 *
 * The "sync never overwrites MANUAL" invariant is enforced inside the model's
 * source-scoped methods (covered by the DB model's own tests), so it is not
 * re-asserted here.
 *
 * Scenarios covered (AAA pattern):
 * 1. Skipped: no connection / inactive / no calendar id.
 * 2. Token terminal + transient failure → error result + ERROR sync state.
 * 3. Incremental all-day event → half-open dates upserted + reconciled + OK state.
 * 4. Cancelled event → deleteByExternalEventId, no upsert.
 * 5. Same-day timed event (< 1 day) → no upsert, rows removed.
 * 6. Multi-day timed event → dates derived from dateTime prefixes.
 * 7. 410 stale token → full-sync fallback + orphan cleanup.
 * 8. Full sync orphan cleanup removes events absent from the fetch.
 * 9. Pagination accumulates across pages; final nextSyncToken persisted.
 * 10. API error → error result (kind 'api') + ERROR sync state.
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
    mockDeleteByExternalEventId,
    mockUpsertSyncOccupancy,
    mockDeleteStale,
    mockFindBySource
} = vi.hoisted(() => ({
    mockGetGoogleCredential: vi.fn(),
    mockGetValidGoogleToken: vi.fn(),
    mockListEvents: vi.fn(),
    mockUpdateSyncState: vi.fn().mockResolvedValue(null),
    mockDeleteByExternalEventId: vi.fn().mockResolvedValue(0),
    mockUpsertSyncOccupancy: vi.fn(),
    mockDeleteStale: vi.fn().mockResolvedValue(0),
    mockFindBySource: vi.fn().mockResolvedValue([])
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
        deleteByExternalEventId: mockDeleteByExternalEventId,
        upsertSyncOccupancy: mockUpsertSyncOccupancy,
        deleteStaleSyncByExternalEventId: mockDeleteStale,
        findBySource: mockFindBySource
    }
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const ACCOMMODATION_ID = 'acc-1';

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
    let GoogleCalendarSyncTokenInvalidError: typeof import('../../../src/services/google-calendar/google-calendar-client.js').GoogleCalendarSyncTokenInvalidError;
    let GoogleCalendarApiError: typeof import('../../../src/services/google-calendar/google-calendar-client.js').GoogleCalendarApiError;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockUpdateSyncState.mockResolvedValue(null);
        mockDeleteByExternalEventId.mockResolvedValue(0);
        mockDeleteStale.mockResolvedValue(0);
        mockFindBySource.mockResolvedValue([]);
        mockUpsertSyncOccupancy.mockImplementation(({ dates }: { dates: string[] }) =>
            Promise.resolve(dates.map((date) => ({ date })))
        );
        mockGetValidGoogleToken.mockResolvedValue('access-token');

        ({ syncAccommodationCalendar } = await import(
            '../../../src/services/google-calendar/google-calendar-sync.service.js'
        ));
        ({ GoogleTokenRefreshError } = await import(
            '../../../src/services/google-calendar/google-token.errors.js'
        ));
        ({ GoogleCalendarSyncTokenInvalidError, GoogleCalendarApiError } = await import(
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

    describe('event reconciliation', () => {
        it('should upsert the half-open date range for an all-day event and persist OK + new sync token', async () => {
            // Arrange — incremental sync (stored token), one all-day event Jul10→Jul12.
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'old-tok' }));
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-allday',
                        status: 'confirmed',
                        start: { date: '2026-07-10' },
                        end: { date: '2026-07-12' }
                    }
                ],
                nextSyncToken: 'new-tok'
            });

            // Act
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert — Jul12 (checkout) is free: only Jul10 + Jul11 blocked.
            expect(mockUpsertSyncOccupancy).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                dates: ['2026-07-10', '2026-07-11'],
                source: 'GOOGLE_CALENDAR',
                externalEventId: 'ev-allday',
                createdById: 'host-1'
            });
            expect(mockDeleteStale).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'GOOGLE_CALENDAR',
                externalEventId: 'ev-allday',
                keepDates: ['2026-07-10', '2026-07-11']
            });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({
                    syncToken: 'new-tok',
                    lastSyncStatus: 'OK',
                    lastErrorMessage: null
                })
            );
            // Incremental → no orphan scan.
            expect(mockFindBySource).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                status: 'ok',
                fullSync: false,
                eventsProcessed: 1,
                datesUpserted: 2
            });
        });

        it('should delete occupancy for a cancelled event and never upsert', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'tok' }));
            mockListEvents.mockResolvedValue({
                items: [{ id: 'ev-gone', status: 'cancelled' }],
                nextSyncToken: 'tok2'
            });

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockDeleteByExternalEventId).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'GOOGLE_CALENDAR',
                externalEventId: 'ev-gone'
            });
            expect(mockUpsertSyncOccupancy).not.toHaveBeenCalled();
            expect(result).toMatchObject({ status: 'ok' });
        });

        it('should remove rows for a same-day timed event (< 1 day → empty range)', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'tok' }));
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-short',
                        status: 'confirmed',
                        start: { dateTime: '2026-07-10T14:00:00-03:00' },
                        end: { dateTime: '2026-07-10T16:00:00-03:00' }
                    }
                ],
                nextSyncToken: 'tok2'
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockUpsertSyncOccupancy).not.toHaveBeenCalled();
            expect(mockDeleteByExternalEventId).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'GOOGLE_CALENDAR',
                externalEventId: 'ev-short'
            });
        });

        it('should derive dates from dateTime prefixes for a multi-day timed event', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'tok' }));
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-timed',
                        status: 'confirmed',
                        start: { dateTime: '2026-07-10T22:00:00-03:00' },
                        end: { dateTime: '2026-07-12T09:00:00-03:00' }
                    }
                ],
                nextSyncToken: 'tok2'
            });

            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockUpsertSyncOccupancy).toHaveBeenCalledWith(
                expect.objectContaining({
                    dates: ['2026-07-10', '2026-07-11'],
                    externalEventId: 'ev-timed'
                })
            );
        });
    });

    describe('full sync + orphan cleanup', () => {
        it('should fall back to a full sync when the stored token is stale (410)', async () => {
            // Arrange — first (incremental) call throws stale-token, second (full) succeeds.
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'stale' }));
            mockListEvents
                .mockRejectedValueOnce(new GoogleCalendarSyncTokenInvalidError())
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'ev-1',
                            status: 'confirmed',
                            start: { date: '2026-07-10' },
                            end: { date: '2026-07-11' }
                        }
                    ],
                    nextSyncToken: 'fresh-tok'
                });

            // Act
            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(mockListEvents).toHaveBeenCalledTimes(2);
            // Second call is a full sync: syncToken absent, timeMin present.
            const secondCallArg = mockListEvents.mock.calls[1]?.[0];
            expect(secondCallArg.syncToken).toBeUndefined();
            expect(secondCallArg.timeMin).toBeDefined();
            // Full sync → orphan scan ran.
            expect(mockFindBySource).toHaveBeenCalled();
            expect(result).toMatchObject({ status: 'ok', fullSync: true });
        });

        it('should delete orphaned events absent from a full fetch', async () => {
            // Arrange — no stored token → full sync. Fetch has ev-present; DB also
            // holds a row for ev-orphan (deleted at source while token was invalid).
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: null }));
            mockListEvents.mockResolvedValue({
                items: [
                    {
                        id: 'ev-present',
                        status: 'confirmed',
                        start: { date: '2026-07-10' },
                        end: { date: '2026-07-11' }
                    }
                ],
                nextSyncToken: 'tok'
            });
            mockFindBySource.mockResolvedValue([
                { externalEventId: 'ev-present', date: '2026-07-10' },
                { externalEventId: 'ev-orphan', date: '2026-08-01' }
            ]);

            // Act
            await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            // Assert — only the orphan is deleted, not the present event.
            expect(mockDeleteByExternalEventId).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'GOOGLE_CALENDAR',
                externalEventId: 'ev-orphan'
            });
            expect(mockDeleteByExternalEventId).not.toHaveBeenCalledWith(
                expect.objectContaining({ externalEventId: 'ev-present' })
            );
        });
    });

    describe('pagination + errors', () => {
        it('should accumulate events across pages and persist the final sync token', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'tok' }));
            mockListEvents
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'ev-1',
                            status: 'confirmed',
                            start: { date: '2026-07-10' },
                            end: { date: '2026-07-11' }
                        }
                    ],
                    nextPageToken: 'page-2'
                })
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'ev-2',
                            status: 'confirmed',
                            start: { date: '2026-07-15' },
                            end: { date: '2026-07-16' }
                        }
                    ],
                    nextSyncToken: 'final-tok'
                });

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(mockListEvents).toHaveBeenCalledTimes(2);
            expect(mockListEvents.mock.calls[1]?.[0].pageToken).toBe('page-2');
            expect(mockUpsertSyncOccupancy).toHaveBeenCalledTimes(2);
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({ syncToken: 'final-tok', lastSyncStatus: 'OK' })
            );
            expect(result).toMatchObject({ status: 'ok', eventsProcessed: 2 });
        });

        it('should record ERROR (kind api) when the Calendar API returns a non-2xx', async () => {
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ syncToken: 'tok' }));
            mockListEvents.mockRejectedValue(
                new GoogleCalendarApiError('events.list failed with status 503', 503)
            );

            const result = await syncAccommodationCalendar({ accommodationId: ACCOMMODATION_ID });

            expect(result).toMatchObject({ status: 'error', kind: 'api' });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({ lastSyncStatus: 'ERROR' })
            );
        });
    });
});
