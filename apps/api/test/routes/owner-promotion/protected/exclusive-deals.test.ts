import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findExclusiveDeals = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            override findExclusiveDeals = findExclusiveDeals;
        }
    };
});

const { initApp } = await import('../../../../src/app.js');
type AppOpenAPI = Awaited<ReturnType<typeof initApp>>;

const BASE = '/api/v1/protected/owner-promotions/exclusive-deals';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

describe('GET /api/v1/protected/owner-promotions/exclusive-deals (HOS-21 T-008)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        app = initApp() as unknown as AppOpenAPI;
        findExclusiveDeals.mockClear();
    });

    it('is registered and reachable (not 404)', async () => {
        const res = await app.request(BASE, { headers: makeHeaders() });
        expect(res.status).not.toBe(404);
    });

    it('returns 401 for an unauthenticated request', async () => {
        const res = await app.request(BASE, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(401);
    });

    // HOS-1352: transitional until V3 (HOS-1357), see PR
    it('returns 200 with an empty collection', async () => {
        const res = await app.request(BASE, { headers: makeHeaders() });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination.total).toBe(0);
    });

    it('preserves requested pagination', async () => {
        const res = await app.request(`${BASE}?page=2&pageSize=5`, { headers: makeHeaders() });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination.page).toBe(2);
        expect(body.data.pagination.pageSize).toBe(5);
    });

    it('does not query exclusive deals', async () => {
        await app.request(BASE, { headers: makeHeaders() });
        expect(findExclusiveDeals).not.toHaveBeenCalled();
    });

    it('rejects an invalid accommodationId', async () => {
        const res = await app.request(`${BASE}?accommodationId=invalid`, {
            headers: makeHeaders()
        });
        expect(res.status).toBe(400);
    });
});
