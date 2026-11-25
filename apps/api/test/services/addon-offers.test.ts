import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAddonOffers } from '../../src/services/addon-offers/addon-offers.service';

const { tx, policy } = vi.hoisted(() => ({
    tx: { select: vi.fn() },
    policy: vi.fn()
}));
vi.mock('@repo/db', () => ({
    addonProducts: {
        id: 'product-id',
        versionId: 'version-id',
        addonId: 'addon-id',
        retiredAt: 'retired',
        chargeKind: 'kind',
        cycle: 'cycle',
        price: 'price',
        currency: 'currency',
        compatibleVerticals: 'verticals'
    },
    addons: { id: 'addon-id', slug: 'slug', name: 'name', description: 'description' },
    addonVersionEntitlements: { addonVersionId: 'entitlement-version', key: 'entitlement-key' },
    addonVersionLimits: { addonVersionId: 'limit-version', key: 'limit-key' },
    planCatalogModel: {},
    getDb: () => ({
        transaction: async (read: (transaction: typeof tx) => Promise<unknown>) => read(tx)
    })
}));
vi.mock('@repo/service-core', () => ({ findIncludesAddonsAnchor: async () => null }));
vi.mock('@repo/verticals', () => ({ createPlanCatalogInverse: () => ({ addonPolicy: policy }) }));
vi.mock('drizzle-orm', () => ({ asc: vi.fn(), eq: vi.fn(), inArray: vi.fn(), isNull: vi.fn() }));

const ownerId = '123e4567-e89b-42d3-a456-426614174000';
const firstVersion = '123e4567-e89b-42d3-a456-426614174001';
const secondVersion = '123e4567-e89b-42d3-a456-426614174002';
const row = (versionId: string, productId: string) => ({
    productId,
    addonVersionId: versionId,
    addonId: 'addon',
    slug: 'test-addon',
    name: 'Test addon',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1,
    currency: 'ARS',
    compatibleVerticals: ['accommodation']
});
const query = (rows: unknown[]) => {
    const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
    chain.from.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(Object.assign(Promise.resolve(rows), chain));
    chain.orderBy.mockResolvedValue(rows);
    return chain;
};

beforeEach(() => {
    vi.clearAllMocks();
    policy.mockResolvedValue({
        addonId: 'addon',
        scopeType: 'VERTICAL_SUBSCRIPTION',
        validity: 'WHILE_SUBSCRIPTION_ALIVE',
        validityDays: null
    });
});

describe('readAddonOffers grants', () => {
    it('batches each grant table once and groups grants by immutable version, including shared versions', async () => {
        tx.select
            .mockReturnValueOnce(
                query([
                    row(firstVersion, '123e4567-e89b-42d3-a456-426614174010'),
                    row(secondVersion, '123e4567-e89b-42d3-a456-426614174011'),
                    row(firstVersion, '123e4567-e89b-42d3-a456-426614174012')
                ])
            )
            .mockReturnValueOnce(query([{ addonVersionId: firstVersion, key: 'featured_listing' }]))
            .mockReturnValueOnce(
                query([
                    { addonVersionId: firstVersion, key: 'max_accommodations' },
                    { addonVersionId: secondVersion, key: 'max_photos_per_accommodation' }
                ])
            );
        const result = await readAddonOffers({ ownerId });
        expect(tx.select).toHaveBeenCalledTimes(3);
        expect(result.items.map((item) => item.grantedKeys)).toEqual([
            ['featured_listing', 'max_accommodations'],
            ['max_photos_per_accommodation'],
            ['featured_listing', 'max_accommodations']
        ]);
    });

    it('returns empty grants for a version with no grants and skips grant reads for an empty catalog', async () => {
        tx.select
            .mockReturnValueOnce(query([row(firstVersion, '123e4567-e89b-42d3-a456-426614174010')]))
            .mockReturnValueOnce(query([]))
            .mockReturnValueOnce(query([]));
        expect((await readAddonOffers({ ownerId })).items[0]?.grantedKeys).toEqual([]);
        tx.select.mockClear().mockReturnValueOnce(query([]));
        expect(await readAddonOffers({ ownerId })).toEqual({ items: [] });
        expect(tx.select).toHaveBeenCalledTimes(1);
    });
});
