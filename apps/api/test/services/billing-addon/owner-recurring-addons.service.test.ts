import { afterEach, describe, expect, it, vi } from 'vitest';

const { rows, selections, getDb } = vi.hoisted(() => {
    const rows: Array<Record<string, unknown>> = [];
    const selections: unknown[] = [];
    const query = {
        from: vi.fn(),
        innerJoin: vi.fn(),
        leftJoin: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn()
    };
    const db = {
        select: vi.fn((selection: unknown) => {
            selections.push(selection);
            return query;
        })
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockImplementation(async () => rows);
    return { rows, selections, query, getDb: vi.fn(() => db) };
});

vi.mock('@repo/db', () => ({
    addonInstances: {
        id: {},
        ownerId: {},
        productId: {},
        addonVersionId: {},
        status: {},
        targetId: {},
        createdAt: {}
    },
    addonProducts: { id: {}, chargeKind: {}, cycle: {}, price: {}, currency: {} },
    addons: { id: {}, name: {}, slug: {} },
    addonVersions: { id: {}, scopeType: {}, addonId: {} },
    accommodations: { id: {}, ownerId: {}, deletedAt: {}, name: {} },
    venues: { id: {}, ownerId: {}, deletedAt: {}, name: {} },
    experiences: { id: {}, ownerId: {}, deletedAt: {}, name: {} },
    getDb
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn(),
    asc: vi.fn(),
    eq: vi.fn(),
    inArray: vi.fn(),
    isNull: vi.fn()
}));

import { readOwnerRecurringAddons } from '../../../src/services/billing-addon/owner-recurring-addons.service';

afterEach(() => {
    rows.splice(0, rows.length);
    selections.splice(0, selections.length);
    vi.clearAllMocks();
});

describe('readOwnerRecurringAddons', () => {
    it('returns the catalog slug with the owner addon', async () => {
        rows.push({
            addonInstanceId: '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
            slug: 'extra-experiences-1',
            name: 'Extra Experience Listing (+1)',
            cycle: 'monthly',
            price: 120000,
            status: 'ACTIVE',
            targetId: null,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            accommodationName: null,
            venueName: null,
            experienceName: null
        });

        const result = await readOwnerRecurringAddons({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        expect(selections[0]).toHaveProperty('slug');
        expect(result.items[0]?.slug).toBe('extra-experiences-1');
    });
});
