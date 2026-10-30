/**
 * GET /api/v1/protected/price-alerts — `closedBecauseListingGone` (HOS-1492, V8a row 27).
 */
import { PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAlertsMock = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        AlertSubscriptionService: vi.fn().mockImplementation(function () {
            return { list: listAlertsMock };
        })
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/protected/price-alerts';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ALERT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function headers(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

function alert(args: { isActive: boolean; publicationStatus: PublicationStatusEnum }) {
    return {
        id: ALERT_ID,
        accommodationId: ACCOMMODATION_ID,
        userId: ACTOR_ID,
        basePriceSnapshot: 10000,
        targetPercentDrop: null,
        isActive: args.isActive,
        createdAt: new Date('2026-01-01').toISOString(),
        updatedAt: new Date('2026-01-01').toISOString(),
        deletedAt: null,
        accommodation: {
            id: ACCOMMODATION_ID,
            name: 'Cabaña del Río',
            publicationStatus: args.publicationStatus
        }
    };
}

async function listOne(item: ReturnType<typeof alert>) {
    listAlertsMock.mockResolvedValue({ data: { items: [item], total: 1 } });
    const res = await app.request(BASE, { method: 'GET', headers: headers() });
    const body = (await res.json()) as {
        data: { items: Array<Record<string, unknown>>; total: number };
    };
    return { res, body };
}

let app: AppOpenAPI;

describe('GET /api/v1/protected/price-alerts — closedBecauseListingGone', () => {
    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        vi.clearAllMocks();
    });

    it('TEST:V8a:6 a closed alert on a PURGED listing says the listing is gone', async () => {
        // Act
        const { res, body } = await listOne(
            alert({ isActive: false, publicationStatus: PublicationStatusEnum.PURGED })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.items[0]?.closedBecauseListingGone).toBe(true);
        expect(body.data.items[0]?.isActive).toBe(false);
        expect(body.data.items[0]?.accommodationName).toBe('Cabaña del Río');
        // It never says WHY the listing stopped existing (row 20 is the owner's).
        expect(body.data.items[0]).not.toHaveProperty('accommodation');
    });

    it('a closed alert on a listing that still exists is not "gone"', async () => {
        // Act
        const { res, body } = await listOne(
            alert({ isActive: false, publicationStatus: PublicationStatusEnum.DRAFT })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.items[0]?.closedBecauseListingGone).toBe(false);
    });

    it('an active alert is never "gone"', async () => {
        // Act
        const { res, body } = await listOne(
            alert({ isActive: true, publicationStatus: PublicationStatusEnum.PURGED })
        );

        // Assert
        expect(res.status).toBe(200);
        expect(body.data.items[0]?.closedBecauseListingGone).toBe(false);
    });

    it('answers 401 to a request without an actor', async () => {
        // Act
        const res = await app.request(BASE, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        // Assert
        expect(res.status).toBe(401);
        expect(listAlertsMock).not.toHaveBeenCalled();
    });
});
