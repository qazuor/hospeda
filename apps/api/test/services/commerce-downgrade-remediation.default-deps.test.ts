/**
 * Unit tests for `defaultCommerceDowngradeDeps` — the PRODUCTION wiring of the
 * commerce downgrade remediation (HOS-1122).
 *
 * ## Why this file had to exist, and why its absence was the bug
 *
 * `commerce-downgrade-remediation.test.ts` next door injects its own `deps` into
 * every call, so it never touches this object. That was noted in the object's
 * own docblock — "without a test that drives this object directly it would never
 * execute in CI at all" — and then the test was not written. The result is the
 * fifth instance of a pattern this epic has hit repeatedly: a documented defence
 * that does not exist.
 *
 * What it let through: `getListings` called `BaseModel.findByIds`, whose
 * contract states in as many words that "no soft-delete filtering is applied …
 * Callers that need to exclude soft-deleted rows must filter the result
 * themselves". This caller did not. Three facts turned that into lost revenue:
 *
 *   1. `softDelete` writes `{ deletedAt, updatedAt }`, so deleting a listing
 *      makes it the MOST recently updated one the owner has;
 *   2. `compareByRecency` sorts `updatedAt` DESC and marks the first `cap`
 *      entries `keepByDefault`, so deleted listings enter the keep band FIRST;
 *   3. nothing removes the `entity_subscriptions` row when a commerce listing is
 *      soft-deleted — the cron that prunes orphans is scoped to
 *      `entityType = 'accommodation'`.
 *
 * A provider with 8 created / 5 deleted / 3 live listings, downgrading from a
 * cap of 10 to a cap of 5, therefore counted 8, kept the 5 DELETED ones and
 * restricted all 3 LIVE ones — under a tier whose cap covered them — and
 * reported `restrictedCount: 3` as a success.
 *
 * @module test/services/commerce-downgrade-remediation.default-deps
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const { gastronomyFindByIds, experienceFindByIds } = vi.hoisted(() => ({
    gastronomyFindByIds: vi.fn(),
    experienceFindByIds: vi.fn()
}));

// The models are stubbed at the `@repo/db` boundary rather than the whole
// module being replaced: `defaultCommerceDowngradeDeps` also imports
// `entitySubscriptions`, `and`, `eq`, `getDb` and `inArray` from here, and a
// wholesale mock would leave those `undefined` — a green suite whose subject
// never ran (the exact shape this file exists to stop).
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        gastronomyModel: { findByIds: gastronomyFindByIds },
        experienceModel: { findByIds: experienceFindByIds }
    };
});

import { defaultCommerceDowngradeDeps } from '../../src/services/commerce-downgrade-remediation.service';

const LIVE = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cantina Viva',
    slug: 'cantina-viva',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    lifecycleState: 'ACTIVE'
};

/**
 * A soft-deleted listing. `updatedAt` is LATER than the live one on purpose —
 * that is what `softDelete` actually does, and it is what put deleted rows at
 * the head of the keep band.
 */
const DELETED = {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Cantina Borrada',
    slug: 'cantina-borrada',
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: new Date('2026-06-01T00:00:00.000Z'),
    lifecycleState: 'ACTIVE'
};

/** Deactivated by the owner, but NOT deleted — still theirs, still on quota. */
const INACTIVE = {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Cantina Dormida',
    slug: 'cantina-dormida',
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    deletedAt: null,
    lifecycleState: 'INACTIVE'
};

describe('defaultCommerceDowngradeDeps.getListings (HOS-1122)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        gastronomyFindByIds.mockResolvedValue([LIVE, DELETED, INACTIVE]);
        experienceFindByIds.mockResolvedValue([LIVE, DELETED, INACTIVE]);
    });

    it('DROPS a soft-deleted listing that the model happily returned', async () => {
        const result = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'gastronomy',
            ids: [LIVE.id, DELETED.id, INACTIVE.id]
        });

        expect(result.map((listing) => listing.id)).not.toContain(DELETED.id);
        expect(result.map((listing) => listing.id)).toContain(LIVE.id);
    });

    it('KEEPS a merely deactivated listing — it still occupies the owner`s quota', async () => {
        // Deliberately NOT the accommodation twin's `lifecycleState: 'ACTIVE'`
        // filter. `countOwnListings` counts every non-deleted listing, so
        // excluding an INACTIVE one here would compute an excess smaller than
        // the cap actually enforces: the owner reactivates it later and sits
        // over the cap with nothing to notice it.
        const result = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'gastronomy',
            ids: [LIVE.id, INACTIVE.id]
        });

        expect(result.map((listing) => listing.id)).toContain(INACTIVE.id);
    });

    it('filters the EXPERIENCE vertical too, not just gastronomy', async () => {
        // The two verticals go through the same helper, but a filter applied in
        // only one branch of the switch would pass a gastronomy-only test.
        //
        // Stubbed narrowly here: the shared `beforeEach` stub ignores the ids it
        // is handed and always returns all three rows, so asserting an exact
        // list against it would be asserting the stub rather than the filter.
        experienceFindByIds.mockResolvedValue([LIVE, DELETED]);

        const result = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'experience',
            ids: [LIVE.id, DELETED.id]
        });

        expect(experienceFindByIds).toHaveBeenCalledOnce();
        expect(gastronomyFindByIds).not.toHaveBeenCalled();
        expect(result.map((listing) => listing.id)).toEqual([LIVE.id]);
    });

    it('maps the fields the excess computation reads', async () => {
        gastronomyFindByIds.mockResolvedValue([LIVE]);

        const [listing] = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'gastronomy',
            ids: [LIVE.id]
        });

        expect(listing).toEqual({
            id: LIVE.id,
            name: 'Cantina Viva',
            updatedAt: LIVE.updatedAt,
            slug: 'cantina-viva'
        });
    });

    it('short-circuits on an empty id list without touching the database', async () => {
        const result = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'gastronomy',
            ids: []
        });

        expect(result).toEqual([]);
        expect(gastronomyFindByIds).not.toHaveBeenCalled();
    });

    it('survives a row whose name is missing, falling back to the slug', async () => {
        gastronomyFindByIds.mockResolvedValue([{ ...LIVE, name: undefined }]);

        const [listing] = await defaultCommerceDowngradeDeps.getListings({
            vertical: 'gastronomy',
            ids: [LIVE.id]
        });

        expect(listing?.name).toBe('cantina-viva');
    });
});
