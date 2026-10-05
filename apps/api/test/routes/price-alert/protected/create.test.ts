/** Price-alert route regression after removal of the legacy plan gate. */
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('POST /api/v1/protected/price-alerts — legacy plan removed', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        vi.clearAllMocks();
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
    });

    it('creates the alert without querying an obsolete plan counter', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: makeBody()
        });

        expect([200, 201]).toContain(res.status);
        expect(countActiveMock).not.toHaveBeenCalled();
        expect(createAlertMock).toHaveBeenCalledTimes(1);
        const body = await res.json();
        expect(body.data.accommodationName).toBe('Test Accommodation');
    });

    it('still requires a valid accommodation id', async () => {
        const res = await app.request(BASE, {
            method: 'POST',
            headers: makeHeaders(),
            body: JSON.stringify({ accommodationId: 'invalid' })
        });
        expect(res.status).toBe(400);
        expect(createAlertMock).not.toHaveBeenCalled();
    });
});
