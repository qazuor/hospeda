/**
 * @file create.test.ts
 * @description Regression test for `populateActiveAlertsCount` on
 * `POST /api/v1/protected/price-alerts` (prod follow-up: "stop the wasted DB
 * count query on denied price-alert attempts").
 *
 * Before the fix, `populateActiveAlertsCount` ran `AlertSubscriptionService
 * .countActive()` unconditionally, BEFORE `gateAlerts()` checked the
 * `PRICE_ALERTS` entitlement — so an actor about to be rejected still paid
 * for the count query. The fix short-circuits `populateActiveAlertsCount`
 * with an entitlement check so the query is skipped entirely when the actor
 * lacks `PRICE_ALERTS`, while still running (and being consumed by
 * `gateAlerts`'s limit check) for entitled actors.
 *
 * `hasEntitlement` / `getRemainingLimit` are mocked directly (rather than
 * seeding real billing/DB state), following the module-mock convention used
 * across this suite (see `owner-promotion/protected/exclusive-deals-gate.test.ts`).
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Entitlement/limit control
// ---------------------------------------------------------------------------

let mockEntitlements: Set<EntitlementKey>;
let mockMaxActiveAlerts: number;

vi.mock('../../../../src/middlewares/entitlement', async (importOriginal) => {
    const orig = await importOriginal<typeof import('../../../../src/middlewares/entitlement')>();
    return {
        ...orig,
        hasEntitlement: (_c: unknown, key: EntitlementKey) => mockEntitlements.has(key),
        getRemainingLimit: (_c: unknown, key: LimitKey) =>
            key === LimitKey.MAX_ACTIVE_ALERTS ? mockMaxActiveAlerts : -1
    };
});

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const countActiveMock = vi.fn();
const createAlertMock = vi.fn();
const getByIdMock = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        AlertSubscriptionService: vi.fn().mockImplementation(function () {
            return {
                countActive: countActiveMock,
                create: createAlertMock
            };
        }),
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getById: getByIdMock
            };
        })
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE = '/api/v1/protected/price-alerts';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ALERT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

function makeBody(): string {
    return JSON.stringify({ accommodationId: ACCOMMODATION_ID });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/price-alerts — populateActiveAlertsCount short-circuit', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        vi.clearAllMocks();
        mockEntitlements = new Set();
        mockMaxActiveAlerts = -1;
    });

    it('skips the countActive query and returns 403 ENTITLEMENT_REQUIRED when the actor lacks PRICE_ALERTS', async () => {
        mockEntitlements = new Set();

        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: makeBody()
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');

        // The core regression: no wasted DB query for a request about to be rejected.
        expect(countActiveMock).not.toHaveBeenCalled();
        expect(createAlertMock).not.toHaveBeenCalled();
    });

    it('runs the countActive query and creates the alert when the actor has PRICE_ALERTS and is under the limit', async () => {
        mockEntitlements = new Set([EntitlementKey.PRICE_ALERTS]);
        mockMaxActiveAlerts = 5;
        countActiveMock.mockResolvedValue({ data: { count: 1 } });
        createAlertMock.mockResolvedValue({
            data: {
                id: ALERT_ID,
                accommodationId: ACCOMMODATION_ID,
                userId: ACTOR_ID,
                basePriceSnapshot: 10000,
                targetPercentDrop: null,
                isActive: true,
                createdAt: new Date('2026-01-01').toISOString(),
                updatedAt: new Date('2026-01-01').toISOString(),
                deletedAt: null
            }
        });
        getByIdMock.mockResolvedValue({ data: { name: 'Test Accommodation' } });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: makeBody()
        });

        expect([200, 201]).toContain(res.status);

        // Entitled path: gateAlerts needs the count for its limit check, so it
        // must still be populated.
        expect(countActiveMock).toHaveBeenCalledTimes(1);
        expect(createAlertMock).toHaveBeenCalledTimes(1);
    });

    it('runs the countActive query but returns 403 LIMIT_REACHED when the actor has PRICE_ALERTS but is already at the limit', async () => {
        mockEntitlements = new Set([EntitlementKey.PRICE_ALERTS]);
        mockMaxActiveAlerts = 2;
        countActiveMock.mockResolvedValue({ data: { count: 2 } });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: makeBody()
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('LIMIT_REACHED');

        expect(countActiveMock).toHaveBeenCalledTimes(1);
        expect(createAlertMock).not.toHaveBeenCalled();
    });
});
