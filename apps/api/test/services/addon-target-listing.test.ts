/**
 * Unit tests: resolving and authorising a targeted add-on's listing (HOS-1286).
 *
 * `resolveAddonTargetListing` is the PRODUCER gate. If it looks a target up in
 * the wrong table, or lets a request choose the table for itself, then every
 * downstream piece — the polymorphic column, the resolver, the reconcile cron —
 * is impeccable over grants that point at the wrong vertical.
 *
 * Two properties are worth more than the rest and each has its own case below:
 *
 * 1. the vertical comes from the ADD-ON's `productDomain`, never from the
 *    request; and
 * 2. an add-on that declares no vertical is REFUSED, not defaulted to
 *    accommodation.
 *
 * @module test/services/addon-target-listing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAccommodationFindById, mockGastronomyFindById, mockExperienceFindById } = vi.hoisted(
    () => ({
        mockAccommodationFindById: vi.fn(),
        mockGastronomyFindById: vi.fn(),
        mockExperienceFindById: vi.fn()
    })
);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationModel: vi.fn(function () {
            return { findById: mockAccommodationFindById };
        }),
        GastronomyModel: vi.fn(function () {
            return { findById: mockGastronomyFindById };
        }),
        ExperienceModel: vi.fn(function () {
            return { findById: mockExperienceFindById };
        })
    };
});

import {
    resolveAddonTargetId,
    resolveAddonTargetListing
} from '../../src/services/addon-target-listing';

const OWNER = 'user-owner-1';

/** A live listing owned by {@link OWNER}. */
const ownedListing = { ownerId: OWNER, deletedAt: null };

beforeEach(() => {
    vi.clearAllMocks();
    mockAccommodationFindById.mockResolvedValue(ownedListing);
    mockGastronomyFindById.mockResolvedValue(ownedListing);
    mockExperienceFindById.mockResolvedValue(ownedListing);
});

describe('resolveAddonTargetId', () => {
    it('prefers the canonical entityId', () => {
        expect(resolveAddonTargetId({ entityId: 'new', accommodationId: 'old' })).toBe('new');
    });

    it('falls back to the deprecated accommodationId', () => {
        // A MercadoPago checkout created before HOS-1286 stored the target under
        // the old key, and its payer can come back after the deploy. Dropping
        // that fallback is HOS-675 repeated: the grant silently never written.
        expect(resolveAddonTargetId({ accommodationId: 'old' })).toBe('old');
    });

    it('is undefined when neither is set', () => {
        expect(resolveAddonTargetId({})).toBeUndefined();
    });
});

describe('resolveAddonTargetListing — the vertical comes from the add-on', () => {
    it.each([
        ['accommodation', 'visibility-boost-7d'],
        ['gastronomy', 'visibility-boost-gastronomy-7d'],
        ['experience', 'visibility-boost-experience-7d']
    ] as const)('resolves a %s target for %s', async (productDomain, slug) => {
        const result = await resolveAddonTargetListing({
            addon: { slug, productDomain },
            entityId: 'listing-1',
            userId: OWNER
        });

        expect(result).toEqual({
            ok: true,
            target: { entityType: productDomain, entityId: 'listing-1' }
        });
    });

    it('looks a gastronomy add-on up in GASTRONOMIES, and never in accommodations', async () => {
        // The failure this catches is the one the pre-HOS-1286 code would have
        // produced verbatim: `createAddonCheckout` called
        // `accommodationModel.findById` unconditionally, so a restaurant id
        // would have come back missing and the purchase refused with a 404 the
        // owner could do nothing about.
        await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost-gastronomy-30d', productDomain: 'gastronomy' },
            entityId: 'gastro-1',
            userId: OWNER
        });

        expect(mockGastronomyFindById).toHaveBeenCalledWith('gastro-1');
        expect(mockAccommodationFindById).not.toHaveBeenCalled();
        expect(mockExperienceFindById).not.toHaveBeenCalled();
    });

    it('looks an experience add-on up in EXPERIENCES only', async () => {
        await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost-experience-30d', productDomain: 'experience' },
            entityId: 'exp-1',
            userId: OWNER
        });

        expect(mockExperienceFindById).toHaveBeenCalledWith('exp-1');
        expect(mockAccommodationFindById).not.toHaveBeenCalled();
        expect(mockGastronomyFindById).not.toHaveBeenCalled();
    });
});

describe('resolveAddonTargetListing — refusals', () => {
    it('REFUSES an add-on that declares no vertical, rather than defaulting', async () => {
        // An add-on an operator created through the SPEC-168 admin UI. The
        // wrong answer here is not an error message, it is `'accommodation'`:
        // that would write a grant against a table the add-on has nothing to do
        // with, and nothing downstream would complain.
        const result = await resolveAddonTargetListing({
            addon: { slug: 'operator-invented', productDomain: undefined },
            entityId: 'listing-1',
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('ADDON_DOMAIN_UNKNOWN');
        // Nothing was even looked up: the refusal precedes the table choice.
        expect(mockAccommodationFindById).not.toHaveBeenCalled();
        expect(mockGastronomyFindById).not.toHaveBeenCalled();
        expect(mockExperienceFindById).not.toHaveBeenCalled();
    });

    it.each([
        'partner',
        'tourist',
        'addon'
    ] as const)('REFUSES the non-listing domain %s', async (productDomain) => {
        const result = await resolveAddonTargetListing({
            addon: { slug: 'weird-addon', productDomain },
            entityId: 'listing-1',
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('ADDON_DOMAIN_UNKNOWN');
    });

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('requires a target id for a %s add-on', async (productDomain) => {
        const result = await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost', productDomain },
            entityId: undefined,
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('VALIDATION_ERROR');
    });

    it('treats a SOFT-DELETED listing as missing, in every vertical', async () => {
        // `findById` does not filter soft-deleted rows, so without this check a
        // deleted restaurant would be a purchasable target.
        mockGastronomyFindById.mockResolvedValue({ ownerId: OWNER, deletedAt: new Date() });

        const result = await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost-gastronomy-7d', productDomain: 'gastronomy' },
            entityId: 'gastro-deleted',
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('NOT_FOUND');
    });

    it('refuses a listing owned by somebody else, in every vertical', async () => {
        mockExperienceFindById.mockResolvedValue({ ownerId: 'someone-else', deletedAt: null });

        const result = await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost-experience-7d', productDomain: 'experience' },
            entityId: 'exp-not-mine',
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('FORBIDDEN');
    });

    it('refuses a listing that does not exist', async () => {
        mockGastronomyFindById.mockResolvedValue(null);

        const result = await resolveAddonTargetListing({
            addon: { slug: 'visibility-boost-gastronomy-7d', productDomain: 'gastronomy' },
            entityId: 'nope',
            userId: OWNER
        });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.code).toBe('NOT_FOUND');
    });
});
