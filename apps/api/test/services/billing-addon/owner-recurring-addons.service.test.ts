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
        createdAt: {},
        endsAt: {}
    },
    addonProducts: {
        id: {},
        chargeKind: {},
        cycle: {},
        price: {},
        currency: {},
        compatibleVerticals: {}
    },
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

import {
    readOwnerAddonHoldings,
    readOwnerRecurringAddons
} from '../../../src/services/billing-addon/owner-recurring-addons.service';

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

/** A row of the shared query, with the columns only the holdings reader maps. */
function holdingRow(overrides: Record<string, unknown>) {
    return {
        addonInstanceId: '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
        slug: 'extra-photos-20',
        name: 'Extra photos',
        chargeKind: 'PERIODICO',
        cycle: 'monthly',
        price: 1,
        currency: 'ARS',
        status: 'ACTIVE',
        targetId: null,
        scopeType: 'USER',
        accommodationName: null,
        venueName: null,
        experienceName: null,
        endsAt: null,
        compatibleVerticals: ['accommodation', 'venue'],
        accommodationId: null,
        venueId: null,
        experienceId: null,
        ...overrides
    };
}

describe('readOwnerAddonHoldings (HOS-2328)', () => {
    it('keeps a null end date (renews with the subscription) and spans the compatible verticals of a user-wide add-on', async () => {
        // Arrange
        rows.push(holdingRow({}));

        // Act
        const result = await readOwnerAddonHoldings({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        // Assert
        expect(result).toEqual([
            {
                slug: 'extra-photos-20',
                name: 'Extra photos',
                status: 'ACTIVE',
                endsAt: null,
                verticals: ['accommodation', 'venue'],
                listingGone: false
            }
        ]);
        expect(selections[0]).toHaveProperty('endsAt');
        expect(selections[0]).toHaveProperty('compatibleVerticals');
    });

    it('places a listing add-on in its target listing vertical, with its end date', async () => {
        // Arrange
        const endsAt = new Date('2026-12-01T00:00:00.000Z');
        rows.push(
            holdingRow({
                scopeType: 'LISTING',
                targetId: '4f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                venueId: '4f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                venueName: 'Bar',
                endsAt
            })
        );

        // Act
        const [holding] = await readOwnerAddonHoldings({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        // Assert
        expect(holding?.verticals).toEqual(['venue']);
        expect(holding?.endsAt).toBe(endsAt);
    });

    it('keeps a listing add-on whose listing is gone, flagged, in its only compatible vertical', async () => {
        // Arrange: the target join found no live listing (soft-deleted); billing may still charge it
        rows.push(
            holdingRow({
                scopeType: 'LISTING',
                targetId: '4f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                compatibleVerticals: ['venue']
            })
        );

        // Act
        const result = await readOwnerAddonHoldings({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        // Assert
        expect(result).toEqual([
            {
                slug: 'extra-photos-20',
                name: 'Extra photos',
                status: 'ACTIVE',
                endsAt: null,
                verticals: ['venue'],
                listingGone: true
            }
        ]);
    });

    it('keeps a listing add-on whose listing is gone with no vertical when its product fits several', async () => {
        // Arrange
        rows.push(
            holdingRow({
                scopeType: 'LISTING',
                targetId: '4f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
                compatibleVerticals: ['accommodation', 'venue']
            })
        );

        // Act
        const [holding] = await readOwnerAddonHoldings({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        // Assert: never spread to every compatible vertical, never dropped
        expect(holding?.verticals).toEqual([]);
        expect(holding?.listingGone).toBe(true);
    });

    it('answers the instances route exactly as before: no holdings-only column leaks', async () => {
        // Arrange
        rows.push(holdingRow({}));

        // Act
        const result = await readOwnerRecurringAddons({
            userId: '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11'
        });

        // Assert
        expect(Object.keys(result.items[0] ?? {})).toEqual([
            'addonInstanceId',
            'slug',
            'name',
            'chargeKind',
            'cycle',
            'price',
            'currency',
            'status',
            'targetId',
            'targetName'
        ]);
    });
});
