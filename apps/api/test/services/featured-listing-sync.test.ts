/**
 * Unit tests: grant → column dispatch (HOS-1286).
 *
 * `syncFeaturedForGrantTarget` is the one place a grant becomes a column write.
 * It hides a real asymmetry — accommodation needs its owner resolved because a
 * PLAN can grant featuring owner-wide, commerce does not — and the failure
 * mode of getting it wrong is silence: the wrong primitive is called, the
 * listing is never flagged, and the purchase still reports success.
 *
 * @module test/services/featured-listing-sync
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSyncAccommodation, mockSyncCommerce, mockGetDb, mockSelect, mockLoggerError } =
    vi.hoisted(() => ({
        mockSyncAccommodation: vi.fn(),
        mockSyncCommerce: vi.fn(),
        mockGetDb: vi.fn(),
        mockSelect: vi.fn(),
        mockLoggerError: vi.fn()
    }));

// `test/setup.ts` already installs a global `@repo/db` mock, so `importOriginal`
// here resolves to THAT rather than the real package — which is why the two
// symbols this module reads are declared explicitly instead of relied on from
// the spread.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodations: { id: 'id', ownerId: 'owner_id' },
        eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
        getDb: mockGetDb
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        syncFeaturedByEntitlementForAccommodation: mockSyncAccommodation,
        syncFeaturedByEntitlementForCommerceListing: mockSyncCommerce
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import { syncFeaturedForGrantTarget } from '../../src/services/featured-listing-sync';

/** Chainable stub for `select(...).from(...).where(...)`, awaited directly. */
function ownerChain(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const chain: Record<string, unknown> = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable Drizzle stub
        then: resolved.then.bind(resolved)
    };
    return chain;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockReturnValue({ select: mockSelect });
    mockSyncAccommodation.mockResolvedValue({ updated: 1, rows: [] });
    mockSyncCommerce.mockResolvedValue({ updated: 1, rows: [] });
});

describe('syncFeaturedForGrantTarget', () => {
    it('resolves the OWNER before flipping an accommodation', async () => {
        // The owner is not decoration: the accommodation primitive uses it to
        // ask whether the owner's PLAN still grants FEATURED_LISTING, which is
        // what stops an expiring addon from clearing featuring a plan pays for.
        mockSelect.mockReturnValueOnce(ownerChain([{ ownerId: 'owner-9' }]));

        const wrote = await syncFeaturedForGrantTarget({
            entityType: 'accommodation',
            entityId: 'acc-1',
            active: true
        });

        expect(wrote).toBe(true);
        expect(mockSyncAccommodation).toHaveBeenCalledWith({
            accommodationId: 'acc-1',
            active: true,
            ownerId: 'owner-9'
        });
        expect(mockSyncCommerce).not.toHaveBeenCalled();
    });

    it.each([
        'gastronomy',
        'experience'
    ] as const)('flips a %s listing WITHOUT an owner lookup', async (entityType) => {
        const wrote = await syncFeaturedForGrantTarget({
            entityType,
            entityId: 'listing-1',
            active: true
        });

        expect(wrote).toBe(true);
        expect(mockSyncCommerce).toHaveBeenCalledWith({
            entityType,
            entityId: 'listing-1',
            active: true
        });
        // No commerce plan grants FEATURED_LISTING, so there is no
        // plan-still-grants question to ask and no owner to ask it about.
        // A stray owner query here would be a wasted round-trip on every
        // commerce boost — and, worse, would suggest a guard that does not
        // exist.
        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockSyncAccommodation).not.toHaveBeenCalled();
    });

    it('never routes one vertical to another vertical primitive', async () => {
        // The over-wide failure: a dispatch that treated "not accommodation" as
        // "commerce", or vice versa, passes every single-vertical test above.
        await syncFeaturedForGrantTarget({
            entityType: 'gastronomy',
            entityId: 'g-1',
            active: false
        });

        expect(mockSyncCommerce).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'gastronomy' })
        );
        expect(mockSyncCommerce).not.toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'experience' })
        );
    });

    it('is a NO-OP for an orphan grant whose accommodation is gone', async () => {
        // With the foreign key dropped, orphans are expected rather than a bug:
        // a hard-deleted listing no longer takes its grants with it. The
        // required behaviour is "write nothing", not "throw".
        mockSelect.mockReturnValueOnce(ownerChain([]));

        const wrote = await syncFeaturedForGrantTarget({
            entityType: 'accommodation',
            entityId: 'acc-gone',
            active: false
        });

        expect(wrote).toBe(false);
        expect(mockSyncAccommodation).not.toHaveBeenCalled();
    });

    it('REFUSES an entity type this platform cannot feature, loudly', async () => {
        // `entity_type` is a varchar with no default and no enum, so a row
        // written by another deploy or by hand can name anything. Writing
        // nothing is right; writing nothing SILENTLY is not — a paid boost that
        // never appears and never complains is the worst outcome available.
        const wrote = await syncFeaturedForGrantTarget({
            entityType: 'commerce',
            entityId: 'legacy-1',
            active: true
        });

        expect(wrote).toBe(false);
        expect(mockSyncAccommodation).not.toHaveBeenCalled();
        expect(mockSyncCommerce).not.toHaveBeenCalled();
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });

    it('reports false when the write matched no row', async () => {
        mockSyncCommerce.mockResolvedValue({ updated: 0, rows: [] });

        await expect(
            syncFeaturedForGrantTarget({
                entityType: 'experience',
                entityId: 'exp-deleted',
                active: true
            })
        ).resolves.toBe(false);
    });
});
