import { RoleEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    findExclusiveDeals: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        OwnerPromotionService: class MockOwnerPromotionService extends orig.OwnerPromotionService {
            override findExclusiveDeals = mocks.findExclusiveDeals;
        }
    };
});

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

const { initApp } = await import('../../../../src/app.js');

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

describe('GET /owner-promotions/exclusive-deals', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: true,
                    entries: [{ key: 'exclusive_deals', value: 1, strategy: 'MAX' as const }]
                })
        );
        mocks.findExclusiveDeals.mockReset().mockResolvedValue({
            data: { items: [], total: 0 },
            error: undefined
        });
    });

    it('returns the empty service collection to an entitled authenticated tourist', async () => {
        const app = initApp();
        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination.total).toBe(0);
    });
});
