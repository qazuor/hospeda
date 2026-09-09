/**
 * Unit tests: the commerce featured-by-entitlement sync primitive (HOS-1286).
 *
 * This is the ONLY writer of `gastronomies.featured_by_entitlement` and
 * `experiences.featured_by_entitlement`. Every request-body path is closed to
 * that column on purpose (see
 * `packages/schemas/test/entities/commerce-featured-by-entitlement-not-writable.test.ts`),
 * so if this module stops writing it, the column can never become true and the
 * paid boost silently does nothing.
 *
 * **The two halves have to be tested together.** Closing the client path and
 * breaking the system path both produce a listing that is never featured, and
 * only one of them is a fix. These cases are the "the legitimate writer still
 * works" half.
 *
 * @module test/services/commerce/commerce.sync-featured-by-entitlement
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGetDb,
    mockUpdate,
    mockSet,
    mockWhere,
    mockReturning,
    mockSchedule,
    GASTRONOMIES,
    EXPERIENCES
} = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
    mockWhere: vi.fn(),
    mockReturning: vi.fn(),
    mockSchedule: vi.fn(),
    // Hoisted with the mocks: `vi.mock` factories run before module-scope
    // consts, so a table identity declared below is not yet initialised there.
    GASTRONOMIES: { id: 'g.id', slug: 'g.slug', deletedAt: 'g.deleted_at' },
    EXPERIENCES: { id: 'e.id', slug: 'e.slug', deletedAt: 'e.deleted_at' }
}));

vi.mock('@repo/db', () => ({
    gastronomies: GASTRONOMIES,
    experiences: EXPERIENCES,
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: mockGetDb
}));

vi.mock('../../../src/services/commerce/commerce-revalidation.js', () => ({
    scheduleCommerceListingRevalidation: mockSchedule,
    resolveCommerceDestinationSlug: vi.fn(),
    standaloneCommerceRevalidationLogger: { warn: vi.fn() }
}));

import { ProductDomainEnum } from '@repo/schemas';
import { syncFeaturedByEntitlementForCommerceListing } from '../../../src/services/commerce/commerce.sync-featured-by-entitlement.js';

/** One updated row, shaped as the primitive's `.returning()` projection. */
const updatedRow = {
    id: 'listing-1',
    slug: 'listing-slug',
    destinationId: 'dest-1',
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC'
};

beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([updatedRow]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockGetDb.mockReturnValue({ update: mockUpdate });
});

describe('syncFeaturedByEntitlementForCommerceListing', () => {
    it.each([
        [ProductDomainEnum.GASTRONOMY, GASTRONOMIES],
        [ProductDomainEnum.EXPERIENCE, EXPERIENCES]
    ] as const)('writes the column on the %s table', async (entityType, table) => {
        const result = await syncFeaturedByEntitlementForCommerceListing({
            entityType,
            entityId: 'listing-1',
            active: true
        });

        // The table, not just "a table": routing both verticals to one of them
        // features the wrong listings and reports success either way.
        expect(mockUpdate).toHaveBeenCalledWith(table);
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ featuredByEntitlement: true })
        );
        expect(result.updated).toBe(1);
    });

    it.each([
        ProductDomainEnum.GASTRONOMY,
        ProductDomainEnum.EXPERIENCE
    ] as const)('clears the column on %s without consulting any plan', async (entityType) => {
        // Commerce has ONE source. The accommodation twin guards its revoke
        // behind "does the plan still grant it"; here there is no such
        // question, and inventing one would leave an expired boost featured.
        const result = await syncFeaturedByEntitlementForCommerceListing({
            entityType,
            entityId: 'listing-1',
            active: false
        });

        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({ featuredByEntitlement: false })
        );
        expect(result.updated).toBe(1);
    });

    it('writes ONLY the flag and updatedAt, never another column', async () => {
        // The module's stated invariant. A sync that also touched
        // `visibility`, `lifecycleState` or `deletedAt` would publish or bury a
        // listing as a side effect of a billing event.
        await syncFeaturedByEntitlementForCommerceListing({
            entityType: ProductDomainEnum.GASTRONOMY,
            entityId: 'listing-1',
            active: true
        });

        const written = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.keys(written).sort()).toEqual(['featuredByEntitlement', 'updatedAt']);
    });

    it('reports zero updates for a missing or soft-deleted listing', async () => {
        mockReturning.mockResolvedValue([]);

        const result = await syncFeaturedByEntitlementForCommerceListing({
            entityType: ProductDomainEnum.EXPERIENCE,
            entityId: 'gone',
            active: true
        });

        expect(result.updated).toBe(0);
        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('schedules a purge so a paid boost is visible before the edge TTL expires', async () => {
        await syncFeaturedByEntitlementForCommerceListing({
            entityType: ProductDomainEnum.GASTRONOMY,
            entityId: 'listing-1',
            active: true
        });

        expect(mockSchedule).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: ProductDomainEnum.GASTRONOMY,
                entity: updatedRow
            })
        );
    });

    it('uses an injected transaction client when given one', async () => {
        const txUpdate = vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) })
            })
        });

        await syncFeaturedByEntitlementForCommerceListing({
            entityType: ProductDomainEnum.GASTRONOMY,
            entityId: 'listing-1',
            active: true,
            db: { update: txUpdate } as never
        });

        expect(txUpdate).toHaveBeenCalledWith(GASTRONOMIES);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
