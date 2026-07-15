/**
 * iCal Feed Occupancy Sync Service Tests (HOS-162 Phase 3 — Layer C)
 *
 * Unit tests for `syncAccommodationIcalCalendar`, the declarative
 * full-window reconcile mirroring `google-calendar-sync.service.test.ts` but
 * for the simpler (no-token-refresh, no-pagination) iCal feed shape.
 *
 * Mocked collaborators:
 * - credential repository `getIcalCredential`
 * - parser `fetchAndParseIcsFeed`
 * - `@repo/db` models: `accommodationCalendarSyncModel.updateSyncState`,
 *   `accommodationOccupancyModel.replaceFutureSyncOccupancy`,
 *   `userModel.findById`, `accommodationModel.findById`
 * - `@repo/notifications` / notification-helper `sendNotification`
 *
 * The "sync never overwrites MANUAL / another provider" invariant is
 * enforced inside the model's source-scoped `replaceFutureSyncOccupancy`
 * (covered by the DB model's own tests), so it is not re-asserted here.
 *
 * Scenarios covered (AAA pattern):
 * 1. Skipped: no connection / inactive connection.
 * 2. Happy path: parsed rows → replaceFutureSyncOccupancy called with
 *    source=provider + OK sync state persisted; no host notification sent.
 * 3. Broken feed (fetch_error / parse_error / empty) → ERROR sync state,
 *    host notification dispatched with the right type/recipient/provider,
 *    no occupancy write, typed error result.
 * 4. A notification failure never masks the sync's own error result.
 * 5. A `replaceFutureSyncOccupancy` DB failure → ERROR state with kind unknown.
 * 6. Provider parameterization: AIRBNB / BOOKING / OTHER all flow through
 *    identically with `source` set to the given provider.
 *
 * @module test/services/ical-calendar/ical-calendar-sync.service
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    IcalCredential,
    IcalProvider
} from '../../../src/services/ical-calendar/ical-credential.repository.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockGetIcalCredential,
    mockFetchAndParseIcsFeed,
    mockUpdateSyncState,
    mockReplaceFutureSyncOccupancy,
    mockSendNotification,
    mockUserFindById,
    mockAccommodationFindById
} = vi.hoisted(() => ({
    mockGetIcalCredential: vi.fn(),
    mockFetchAndParseIcsFeed: vi.fn(),
    mockUpdateSyncState: vi.fn().mockResolvedValue(null),
    mockReplaceFutureSyncOccupancy: vi.fn(),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    mockUserFindById: vi.fn(),
    mockAccommodationFindById: vi.fn()
}));

vi.mock('../../../src/services/ical-calendar/ical-credential.repository.js', () => ({
    getIcalCredential: mockGetIcalCredential
}));

vi.mock('../../../src/services/ical-calendar/ical-parser.js', () => ({
    fetchAndParseIcsFeed: mockFetchAndParseIcsFeed
}));

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: { updateSyncState: mockUpdateSyncState },
    accommodationOccupancyModel: {
        replaceFutureSyncOccupancy: mockReplaceFutureSyncOccupancy
    },
    userModel: { findById: mockUserFindById },
    accommodationModel: { findById: mockAccommodationFindById }
}));

vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const ACCOMMODATION_ID = 'acc-1';

const HOST_USER = {
    id: 'host-1',
    email: 'host@example.com',
    displayName: 'Juan Pérez',
    firstName: 'Juan'
};

const ACCOMMODATION_ROW = {
    id: ACCOMMODATION_ID,
    name: 'Cabañas del Río',
    slug: 'cabanas-del-rio'
};

/**
 * Today's `YYYY-MM-DD` in the AR market zone, computed EXACTLY like
 * `getTodayInMarketTimezone` (`Intl.DateTimeFormat('en-CA', { timeZone:
 * 'America/Argentina/Buenos_Aires' })`).
 */
const todayFromDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires'
}).format(new Date());

const buildCredential = (overrides?: Partial<IcalCredential>): IcalCredential => ({
    feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc',
    isActive: true,
    createdById: 'host-1',
    ...overrides
});

describe('ical-calendar-sync.service', () => {
    let syncAccommodationIcalCalendar: typeof import('../../../src/services/ical-calendar/ical-calendar-sync.service.js').syncAccommodationIcalCalendar;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockUpdateSyncState.mockResolvedValue(null);
        mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 0, inserted: 0 });
        mockSendNotification.mockResolvedValue(undefined);
        mockUserFindById.mockResolvedValue(HOST_USER);
        mockAccommodationFindById.mockResolvedValue(ACCOMMODATION_ROW);

        ({ syncAccommodationIcalCalendar } = await import(
            '../../../src/services/ical-calendar/ical-calendar-sync.service.js'
        ));
    });

    describe('skips', () => {
        it('should skip when no connection exists', async () => {
            mockGetIcalCredential.mockResolvedValue(null);

            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            expect(result).toEqual({ status: 'skipped', reason: 'no-connection' });
            expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
        });

        it('should skip an inactive connection', async () => {
            mockGetIcalCredential.mockResolvedValue(buildCredential({ isActive: false }));

            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            expect(result).toEqual({ status: 'skipped', reason: 'inactive' });
            expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
        });
    });

    describe('happy path', () => {
        it('should replace future rows with the parsed set and persist OK', async () => {
            // Arrange
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: true,
                rows: [
                    { date: todayFromDate, externalEventId: 'evt-1@airbnb.com' },
                    { date: '2026-08-01', externalEventId: 'evt-2@airbnb.com' }
                ]
            });
            mockReplaceFutureSyncOccupancy.mockResolvedValue({ removed: 1, inserted: 2 });

            // Act
            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            // Assert
            expect(mockFetchAndParseIcsFeed).toHaveBeenCalledWith({
                feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics?s=abc',
                fromDate: todayFromDate
            });
            expect(mockReplaceFutureSyncOccupancy).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                source: 'AIRBNB',
                fromDate: todayFromDate,
                rows: [
                    { date: todayFromDate, externalEventId: 'evt-1@airbnb.com' },
                    { date: '2026-08-01', externalEventId: 'evt-2@airbnb.com' }
                ],
                createdById: 'host-1'
            });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({
                    accommodationId: ACCOMMODATION_ID,
                    provider: 'AIRBNB',
                    lastSyncStatus: 'OK',
                    lastErrorMessage: null
                })
            );
            expect(result).toEqual({ status: 'ok', removed: 1, inserted: 2 });
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it.each<IcalProvider>([
            OccupancySourceEnum.AIRBNB,
            OccupancySourceEnum.BOOKING,
            OccupancySourceEnum.OTHER
        ])('should reconcile with source=%s for each provider', async (provider) => {
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({ ok: true, rows: [] });

            await syncAccommodationIcalCalendar({ accommodationId: ACCOMMODATION_ID, provider });

            expect(mockReplaceFutureSyncOccupancy).toHaveBeenCalledWith(
                expect.objectContaining({ source: provider })
            );
            expect(mockGetIcalCredential).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                provider
            });
        });
    });

    describe('broken feed', () => {
        it('should record ERROR and notify the host on a fetch_error, without writing occupancy', async () => {
            // Arrange
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: false,
                kind: 'fetch_error',
                message: 'timed out after 8000ms'
            });

            // Act
            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            // Assert
            expect(result).toEqual({
                status: 'error',
                kind: 'fetch_error',
                message: 'timed out after 8000ms'
            });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({
                    accommodationId: ACCOMMODATION_ID,
                    provider: 'AIRBNB',
                    lastSyncStatus: 'ERROR',
                    lastErrorMessage: 'timed out after 8000ms'
                })
            );
            expect(mockReplaceFutureSyncOccupancy).not.toHaveBeenCalled();
            // Fire-and-forget notification was attempted — flush the microtask queue.
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            expect(mockUserFindById).toHaveBeenCalledWith('host-1');
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'accommodation_calendar_feed_broken',
                    recipientEmail: HOST_USER.email,
                    userId: 'host-1',
                    accommodationName: ACCOMMODATION_ROW.name,
                    providerLabel: 'Airbnb',
                    reconnectUrl: expect.stringContaining(
                        `/mi-cuenta/propiedades/${ACCOMMODATION_ID}/editar`
                    )
                })
            );
            // Raw technical failure detail must never reach the host payload.
            expect(mockSendNotification).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: expect.anything()
                })
            );
        });

        it('should not notify the host when the host has no email on file', async () => {
            // Arrange
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: false,
                kind: 'fetch_error',
                message: 'timed out after 8000ms'
            });
            mockUserFindById.mockResolvedValue(null);

            // Act
            await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should record ERROR on a parse_error result', async () => {
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: false,
                kind: 'parse_error',
                message: 'Invalid ICS syntax'
            });

            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.BOOKING
            });

            expect(result).toMatchObject({ status: 'error', kind: 'parse_error' });
        });

        it('should record ERROR on an empty-feed result', async () => {
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: false,
                kind: 'empty',
                message: 'No events found in the calendar feed'
            });

            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.OTHER
            });

            expect(result).toMatchObject({ status: 'error', kind: 'empty' });
        });

        it('should still return the ERROR result even when the host notification itself fails', async () => {
            // Arrange
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({
                ok: false,
                kind: 'fetch_error',
                message: 'DNS resolution failed'
            });
            mockSendNotification.mockRejectedValue(new Error('email transport down'));

            // Act
            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            // Assert — the sync's own error result is unaffected.
            expect(result).toEqual({
                status: 'error',
                kind: 'fetch_error',
                message: 'DNS resolution failed'
            });
        });
    });

    describe('reconcile DB failure', () => {
        it('should record ERROR (kind unknown) when replaceFutureSyncOccupancy throws', async () => {
            mockGetIcalCredential.mockResolvedValue(buildCredential());
            mockFetchAndParseIcsFeed.mockResolvedValue({ ok: true, rows: [] });
            mockReplaceFutureSyncOccupancy.mockRejectedValue(new Error('connection reset'));

            const result = await syncAccommodationIcalCalendar({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            expect(result).toEqual({
                status: 'error',
                kind: 'unknown',
                message: 'connection reset'
            });
            expect(mockUpdateSyncState).toHaveBeenCalledWith(
                expect.objectContaining({ lastSyncStatus: 'ERROR' })
            );
        });
    });
});
