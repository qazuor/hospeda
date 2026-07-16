/**
 * Route wiring smoke test for the iCal calendar-sync endpoints (HOS-162
 * Phase 3 — Layer D) plus the widened multi-provider `sync`/`status`/
 * `disconnect` routes.
 *
 * Routes under test:
 *   POST   /:id/calendar-sync/connect-ical
 *   POST   /:id/calendar-sync/sync           (widened — provider dispatch)
 *   GET    /:id/calendar-sync/status         (widened — multi-provider array)
 *   DELETE /:id/calendar-sync/:provider      (widened — 4 provider tokens)
 *
 * Mock strategy mirrors `occupancy.test.ts` / `featured-toggle.test.ts`: a
 * minimal Hono app with `actor` + `userEntitlements` injected directly into
 * context, `@repo/service-core`'s `assertOccupancyManageAccess` /
 * `assertOccupancyReadAccess` replaced with controllable mocks (importActual
 * for everything else so `ServiceError` stays real), `@repo/db`'s
 * `accommodationCalendarSyncModel` fully mocked, and the iCal/Google service
 * modules fully mocked.
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockAssertOccupancyManageAccess,
    mockAssertOccupancyReadAccess,
    mockFindByAccommodationAndProvider,
    mockDeactivate,
    mockFetchAndParseIcsFeed,
    mockSaveIcalConnection,
    mockSyncAccommodationIcalCalendar,
    mockSyncAccommodationCalendar
} = vi.hoisted(() => ({
    mockAssertOccupancyManageAccess: vi.fn(),
    mockAssertOccupancyReadAccess: vi.fn(),
    mockFindByAccommodationAndProvider: vi.fn(),
    mockDeactivate: vi.fn(),
    mockFetchAndParseIcsFeed: vi.fn(),
    mockSaveIcalConnection: vi.fn(),
    mockSyncAccommodationIcalCalendar: vi.fn(),
    mockSyncAccommodationCalendar: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        assertOccupancyManageAccess: mockAssertOccupancyManageAccess,
        assertOccupancyReadAccess: mockAssertOccupancyReadAccess
    };
});

vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        accommodationCalendarSyncModel: {
            findByAccommodationAndProvider: mockFindByAccommodationAndProvider,
            deactivate: mockDeactivate
        }
    };
});

vi.mock('../../../../src/services/ical-calendar/ical-parser.js', () => ({
    fetchAndParseIcsFeed: mockFetchAndParseIcsFeed
}));

vi.mock('../../../../src/services/ical-calendar/ical-credential.repository.js', () => ({
    saveIcalConnection: mockSaveIcalConnection
}));

vi.mock('../../../../src/services/ical-calendar/ical-calendar-sync.service.js', () => ({
    syncAccommodationIcalCalendar: mockSyncAccommodationIcalCalendar
}));

vi.mock('../../../../src/services/google-calendar/google-calendar-sync.service.js', () => ({
    syncAccommodationCalendar: mockSyncAccommodationCalendar
}));

// Dynamic import AFTER vi.mock calls.
const {
    protectedCalendarConnectIcalRoute,
    protectedCalendarSyncRoute,
    protectedCalendarSyncStatusRoute,
    protectedCalendarDisconnectRoute
} = await (async () => {
    const [connectIcalMod, syncMod, statusMod, disconnectMod] = await Promise.all([
        import('../../../../src/routes/accommodation/protected/calendarConnectIcal.js'),
        import('../../../../src/routes/accommodation/protected/calendarSync.js'),
        import('../../../../src/routes/accommodation/protected/calendarSyncStatus.js'),
        import('../../../../src/routes/accommodation/protected/calendarDisconnect.js')
    ]);
    return {
        protectedCalendarConnectIcalRoute: connectIcalMod.protectedCalendarConnectIcalRoute,
        protectedCalendarSyncRoute: syncMod.protectedCalendarSyncRoute,
        protectedCalendarSyncStatusRoute: statusMod.protectedCalendarSyncStatusRoute,
        protectedCalendarDisconnectRoute: disconnectMod.protectedCalendarDisconnectRoute
    };
})();

// ---------------------------------------------------------------------------
// Error handler + app builder (mirrors occupancy.test.ts)
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
}

type ActorOptions = { id: string; role: RoleEnum; permissions: PermissionEnum[] };

function buildApp(
    actor: ActorOptions,
    routes: ReturnType<typeof import('../../../../src/utils/create-app.js').createRouter>[],
    options?: { entitlements?: EntitlementKey[] }
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    app.use((c, next) => {
        c.set('actor', actor);
        c.set(
            'userEntitlements',
            new Set(options?.entitlements ?? [EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR])
        );
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
    for (const route of routes) {
        app.route('/', route);
    }
    return app;
}

const ownerActor: ActorOptions = {
    id: OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE]
};
const guestActor: ActorOptions = { id: GUEST_ID, role: RoleEnum.GUEST, permissions: [] };

function makeConnectionRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'conn-1',
        accommodationId: ACCOMMODATION_ID,
        provider: 'AIRBNB',
        externalCalendarId: null,
        syncToken: null,
        lastSyncAt: null,
        lastSyncStatus: 'PENDING',
        lastErrorMessage: null,
        isActive: true,
        createdById: OWNER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

beforeEach(() => {
    mockAssertOccupancyManageAccess.mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: OWNER_ID });
    mockAssertOccupancyReadAccess.mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: OWNER_ID });
    mockFetchAndParseIcsFeed.mockResolvedValue({ ok: true, rows: [] });
    mockSaveIcalConnection.mockResolvedValue(undefined);
    mockFindByAccommodationAndProvider.mockResolvedValue(makeConnectionRow());
    mockDeactivate.mockResolvedValue(makeConnectionRow({ isActive: false }));
    mockSyncAccommodationIcalCalendar.mockResolvedValue({ status: 'ok', removed: 0, inserted: 2 });
    mockSyncAccommodationCalendar.mockResolvedValue({
        status: 'ok',
        eventsProcessed: 3,
        datesUpserted: 2,
        datesRemoved: 0,
        fullSync: true
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /:id/calendar-sync/connect-ical
// ---------------------------------------------------------------------------

describe('POST /:id/calendar-sync/connect-ical (protected)', () => {
    it('probes the feed, saves the connection, and returns its status on success', async () => {
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc'
            })
        });

        // POST defaults to 201 (route-factory convention, no successStatusCode override).
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.connected).toBe(true);
        expect(mockFetchAndParseIcsFeed).toHaveBeenCalledWith(
            expect.objectContaining({ feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc' })
        );
        expect(mockSaveIcalConnection).toHaveBeenCalledWith(
            expect.objectContaining({
                accommodationId: ACCOMMODATION_ID,
                provider: 'AIRBNB',
                feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc',
                createdById: OWNER_ID
            })
        );
    });

    it('triggers an immediate first sync after saving the connection (Fix #5)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc'
            })
        });

        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledTimes(1);
        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: 'AIRBNB'
        });
        // The sync ran AFTER the connection was saved, and the status row is
        // re-read AFTER the sync so the response reflects the fresh state.
        const saveOrder = mockSaveIcalConnection.mock.invocationCallOrder[0];
        const syncOrder = mockSyncAccommodationIcalCalendar.mock.invocationCallOrder[0];
        expect(saveOrder).toBeDefined();
        expect(syncOrder).toBeDefined();
        expect(saveOrder as number).toBeLessThan(syncOrder as number);
    });

    it('saves the connection and returns 201 for a well-formed feed with zero VEVENTs (Fix A1)', async () => {
        mockFetchAndParseIcsFeed.mockResolvedValue({ ok: true, rows: [] });
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc'
            })
        });

        expect(res.status).toBe(201);
        expect(mockSaveIcalConnection).toHaveBeenCalled();
    });

    it('does not fail the connect response when the immediate first sync throws', async () => {
        mockSyncAccommodationIcalCalendar.mockRejectedValue(new Error('unexpected sync crash'));
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://www.airbnb.com/calendar/ical/1.ics?s=abc'
            })
        });

        expect(res.status).toBe(201);
        expect(mockSaveIcalConnection).toHaveBeenCalled();
    });

    it('returns 400 and never saves when the feed probe fails', async () => {
        mockFetchAndParseIcsFeed.mockResolvedValue({
            ok: false,
            kind: 'fetch_error',
            message: 'timed out'
        });
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'booking',
                feedUrl: 'https://www.booking.com/ical/1.ics'
            })
        });

        expect(res.status).toBe(400);
        expect(mockSaveIcalConnection).not.toHaveBeenCalled();
    });

    it('rejects provider=google at the schema layer (400, never reaches the handler)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: 'google', feedUrl: 'https://example.com/cal.ics' })
        });

        expect(res.status).toBe(400);
        expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
    });

    it('rejects a non-https feed url at the schema layer (400)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: 'other', feedUrl: 'http://example.com/cal.ics' })
        });

        expect(res.status).toBe(400);
        expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://example.com/cal.ics'
            })
        });
        expect([401, 403]).toContain(res.status);
        expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_SYNC_EXTERNAL_CALENDAR', async () => {
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://example.com/cal.ics'
            })
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
        expect(mockAssertOccupancyManageAccess).not.toHaveBeenCalled();
    });

    it('propagates a FORBIDDEN from assertOccupancyManageAccess as HTTP 403 (non-owner)', async () => {
        mockAssertOccupancyManageAccess.mockRejectedValue(
            new ServiceError(ServiceErrorCode.FORBIDDEN, 'Not the owner')
        );
        const app = buildApp(ownerActor, [protectedCalendarConnectIcalRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/connect-ical`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                provider: 'airbnb',
                feedUrl: 'https://example.com/cal.ics'
            })
        });
        expect(res.status).toBe(403);
        expect(mockFetchAndParseIcsFeed).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// POST /:id/calendar-sync/sync (widened provider dispatch)
// ---------------------------------------------------------------------------

describe('POST /:id/calendar-sync/sync (protected, widened)', () => {
    it('defaults to google when the body omits provider (backward-compatible)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarSyncRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });

        // POST defaults to 201 (route-factory convention, no successStatusCode override).
        expect(res.status).toBe(201);
        expect(mockSyncAccommodationCalendar).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID
        });
        expect(mockSyncAccommodationIcalCalendar).not.toHaveBeenCalled();
    });

    it('dispatches to the iCal sync service with the mapped provider', async () => {
        const app = buildApp(ownerActor, [protectedCalendarSyncRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: 'airbnb' })
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data).toEqual({ status: 'ok', removed: 0, inserted: 2 });
        expect(mockSyncAccommodationIcalCalendar).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: 'AIRBNB'
        });
        expect(mockSyncAccommodationCalendar).not.toHaveBeenCalled();
    });

    it('returns 403 ENTITLEMENT_REQUIRED when the owner lacks CAN_SYNC_EXTERNAL_CALENDAR', async () => {
        const app = buildApp(ownerActor, [protectedCalendarSyncRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: 'booking' })
        });
        expect(res.status).toBe(403);
        expect(mockSyncAccommodationIcalCalendar).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// GET /:id/calendar-sync/status (widened, multi-provider)
// ---------------------------------------------------------------------------

describe('GET /:id/calendar-sync/status (protected, widened multi-provider)', () => {
    it('returns one row per provider that has EVER connected, omitting the rest', async () => {
        mockFindByAccommodationAndProvider.mockImplementation(
            async ({ provider }: { provider: string }) => {
                if (provider === 'GOOGLE_CALENDAR') {
                    return makeConnectionRow({
                        provider: 'GOOGLE_CALENDAR',
                        isActive: true,
                        lastSyncStatus: 'OK'
                    });
                }
                if (provider === 'AIRBNB') {
                    return makeConnectionRow({
                        provider: 'AIRBNB',
                        isActive: false,
                        lastSyncStatus: 'ERROR',
                        lastErrorMessage: 'feed unreachable'
                    });
                }
                return null;
            }
        );

        const app = buildApp(ownerActor, [protectedCalendarSyncStatusRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/status`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.connections).toHaveLength(2);
        expect(body.data.connections).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ provider: 'GOOGLE_CALENDAR', connected: true }),
                expect.objectContaining({
                    provider: 'AIRBNB',
                    connected: false,
                    lastErrorMessage: 'feed unreachable'
                })
            ])
        );
    });

    it('returns an empty array when the host never connected anything', async () => {
        mockFindByAccommodationAndProvider.mockResolvedValue(null);
        const app = buildApp(ownerActor, [protectedCalendarSyncStatusRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/status`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.connections).toEqual([]);
    });

    it('does NOT require the CAN_SYNC_EXTERNAL_CALENDAR entitlement (downgraded host can still read)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarSyncStatusRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/status`);
        expect(res.status).toBe(200);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedCalendarSyncStatusRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/status`);
        expect([401, 403]).toContain(res.status);
    });
});

// ---------------------------------------------------------------------------
// DELETE /:id/calendar-sync/:provider (widened, 4 tokens)
// ---------------------------------------------------------------------------

describe('DELETE /:id/calendar-sync/:provider (protected, widened)', () => {
    it.each([
        ['google', 'GOOGLE_CALENDAR'],
        ['airbnb', 'AIRBNB'],
        ['booking', 'BOOKING'],
        ['other', 'OTHER']
    ])('soft-disconnects the %s provider', async (token, expectedProvider) => {
        const app = buildApp(ownerActor, [protectedCalendarDisconnectRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/${token}`, {
            method: 'DELETE'
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ disconnected: true });
        expect(mockDeactivate).toHaveBeenCalledWith({
            accommodationId: ACCOMMODATION_ID,
            provider: expectedProvider
        });
    });

    it('rejects an unknown provider token at the schema layer (400)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarDisconnectRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/vrbo`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(400);
        expect(mockDeactivate).not.toHaveBeenCalled();
    });

    it('does NOT require the CAN_SYNC_EXTERNAL_CALENDAR entitlement (downgraded host can still disconnect)', async () => {
        const app = buildApp(ownerActor, [protectedCalendarDisconnectRoute], { entitlements: [] });
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/airbnb`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(200);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, [protectedCalendarDisconnectRoute]);
        const res = await app.request(`/${ACCOMMODATION_ID}/calendar-sync/airbnb`, {
            method: 'DELETE'
        });
        expect([401, 403]).toContain(res.status);
        expect(mockDeactivate).not.toHaveBeenCalled();
    });
});
