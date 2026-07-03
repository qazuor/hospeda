/**
 * Unit tests for `listPartnerPlansHandler` (HOS-75 T-007).
 *
 * This route had zero test coverage before the raw-SQL → typed-Drizzle
 * migration (found during HOS-75 spec research). `@repo/db` is stubbed so the
 * two typed queries (plans filtered by product_domain='partner', then a bulk
 * price lookup for those plan ids) are inspectable without a live Postgres.
 *
 * @module test/routes/partners/admin/list-plans
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbSelectMock } = vi.hoisted(() => ({ dbSelectMock: vi.fn() }));

// Stub createAdminRoute — the real one wires auth/permission middleware that
// transitively pulls in the full @repo/db mock surface. This module only
// needs the extracted handler, not the actual route registration.
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createAdminRoute: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ select: dbSelectMock })),
    billingPlans: {
        id: 'id',
        name: 'name',
        description: 'description',
        metadata: 'metadata',
        active: 'active',
        productDomain: 'product_domain',
        createdAt: 'created_at'
    },
    billingPrices: {
        planId: 'plan_id',
        unitAmount: 'unit_amount',
        currency: 'currency',
        billingInterval: 'billing_interval',
        intervalCount: 'interval_count',
        active: 'active',
        createdAt: 'created_at'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ op: 'inArray', col, vals }))
}));

import { listPartnerPlansHandler } from '../../../../src/routes/partners/admin/list-plans';

/**
 * A thenable + chainable Drizzle query-builder stub, mirroring the shape used
 * elsewhere in this test suite (see featured-entitlement.resolver.test.ts).
 */
function makeChain(result: unknown) {
    const resolved = Promise.resolve(result);
    const chain: {
        from: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        then: Promise<unknown>['then'];
    } = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
        then: resolved.then.bind(resolved)
    };
    return chain;
}

const PLAN_A = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'partner-basic',
    description: 'Basic partner plan',
    metadata: { displayName: 'Partner Básico' }
};

const PLAN_B = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'partner-pro',
    description: null,
    metadata: null
};

describe('listPartnerPlansHandler', () => {
    beforeEach(() => {
        dbSelectMock.mockReset();
    });

    it('returns mapped plans with slug=name, name=displayName fallback, and monthlyPriceArs from the latest matching price', async () => {
        dbSelectMock.mockReturnValueOnce(makeChain([PLAN_A, PLAN_B])).mockReturnValueOnce(
            makeChain([
                { planId: PLAN_A.id, unitAmount: 500000, createdAt: new Date('2026-01-01') },
                { planId: PLAN_B.id, unitAmount: 750000, createdAt: new Date('2026-02-01') }
            ])
        );

        const result = await listPartnerPlansHandler();

        expect(result).toEqual([
            {
                id: PLAN_A.id,
                slug: 'partner-basic',
                name: 'Partner Básico',
                description: 'Basic partner plan',
                monthlyPriceArs: 500000
            },
            {
                id: PLAN_B.id,
                slug: 'partner-pro',
                name: 'partner-pro',
                description: null,
                monthlyPriceArs: 750000
            }
        ]);
    });

    it('returns an empty array (and skips the price query) when no partner plans exist', async () => {
        dbSelectMock.mockReturnValueOnce(makeChain([]));

        const result = await listPartnerPlansHandler();

        expect(result).toEqual([]);
        expect(dbSelectMock).toHaveBeenCalledTimes(1);
    });

    it('sets monthlyPriceArs to null when no matching monthly ARS price exists for a plan', async () => {
        dbSelectMock.mockReturnValueOnce(makeChain([PLAN_A])).mockReturnValueOnce(makeChain([]));

        const result = await listPartnerPlansHandler();

        expect(result).toEqual([
            {
                id: PLAN_A.id,
                slug: 'partner-basic',
                name: 'Partner Básico',
                description: 'Basic partner plan',
                monthlyPriceArs: null
            }
        ]);
    });

    it('picks the most-recently-created price when multiple active monthly ARS prices exist for a plan (mirrors the original ORDER BY created_at DESC LIMIT 1)', async () => {
        dbSelectMock.mockReturnValueOnce(makeChain([PLAN_A])).mockReturnValueOnce(
            makeChain([
                { planId: PLAN_A.id, unitAmount: 400000, createdAt: new Date('2025-01-01') },
                { planId: PLAN_A.id, unitAmount: 550000, createdAt: new Date('2026-03-01') },
                { planId: PLAN_A.id, unitAmount: 500000, createdAt: new Date('2026-01-01') }
            ])
        );

        const result = await listPartnerPlansHandler();

        expect(result[0]?.monthlyPriceArs).toBe(550000);
    });
});
