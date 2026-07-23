/**
 * commerce-completeness.test.ts
 *
 * Unit tests for the publish-readiness ("complete") contract (HOS-166 §6.6).
 * Pure function — no DB, no mocks needed.
 */

import { CommerceEntityTypeEnum, ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type CommerceListingCompletenessListing,
    resolveListingCompleteness
} from '../../../src/services/commerce/commerce-completeness';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = '00000000-0000-4000-a000-000000000001';
const DESTINATION_ID = '00000000-0000-4000-a000-000000000002';

/** A fully-complete gastronomy listing snapshot. */
function makeCompleteGastronomyListing(): CommerceListingCompletenessListing {
    return {
        name: 'La Parrilla del Puerto',
        summary: 'A riverside parrilla with fresh grilled fish and steak.',
        description:
            'La Parrilla del Puerto has served the Concepción del Uruguay waterfront for over a decade, specializing in grilled fish and classic Argentine asado.',
        destinationId: DESTINATION_ID,
        ownerId: OWNER_ID,
        type: 'RESTAURANT',
        media: {
            featuredImage: {
                url: 'https://example.com/img.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        contactInfo: { mobilePhone: '+5493441234567' },
        openingHours: {
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                tue: { closed: true, shifts: [] },
                wed: { closed: true, shifts: [] },
                thu: { closed: true, shifts: [] },
                fri: { closed: true, shifts: [] },
                sat: { closed: true, shifts: [] },
                sun: { closed: true, shifts: [] }
            }
        },
        priceRange: 'MODERATE'
    };
}

/** A fully-complete experience listing snapshot (shared block only). */
function makeCompleteExperienceListing(): CommerceListingCompletenessListing {
    return {
        name: 'Kayak tour on the Uruguay river',
        summary: 'A guided two-hour kayak tour along the riverside.',
        description:
            'Explore the Uruguay river coastline by kayak with a certified local guide, including all safety equipment and a light snack.',
        destinationId: DESTINATION_ID,
        ownerId: OWNER_ID,
        type: 'TOUR_GUIDE',
        media: {
            featuredImage: {
                url: 'https://example.com/kayak.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        },
        contactInfo: { personalEmail: 'guide@example.com' }
    };
}

// ---------------------------------------------------------------------------
// resolveListingCompleteness — gastronomy
// ---------------------------------------------------------------------------

describe('resolveListingCompleteness — gastronomy', () => {
    it('should return complete=true and missing=[] for a fully-complete listing', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: makeCompleteGastronomyListing()
        });

        expect(result.complete).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('should report "name" missing when name is empty', () => {
        const listing = { ...makeCompleteGastronomyListing(), name: '' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toContain('name');
    });

    it('should report "name" missing when name is null', () => {
        const listing = { ...makeCompleteGastronomyListing(), name: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('name');
    });

    it('should report "summary" missing when summary is below the minimum length', () => {
        const listing = { ...makeCompleteGastronomyListing(), summary: 'too short' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('summary');
    });

    it('should report "description" missing when description is below the minimum length', () => {
        const listing = { ...makeCompleteGastronomyListing(), description: 'too short' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('description');
    });

    it('should report "destinationId" missing when destinationId is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), destinationId: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('destinationId');
    });

    it('should report "ownerId" missing when ownerId is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), ownerId: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('ownerId');
    });

    it('should report "type" missing when type is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), type: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('type');
    });

    it('should report "media.featuredImage" missing when media is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), media: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('media.featuredImage');
    });

    it('should report "media.featuredImage" missing when featuredImage is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), media: {} };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('media.featuredImage');
    });

    it('should report "contactInfo" missing when no phone or email is set', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            contactInfo: { website: 'https://example.com' }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('contactInfo');
    });

    it('should NOT report "contactInfo" missing when only an email is set', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            contactInfo: { personalEmail: 'owner@example.com' }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).not.toContain('contactInfo');
    });

    it('should report "openingHours" missing when no day has a shift', () => {
        const listing = {
            ...makeCompleteGastronomyListing(),
            openingHours: {
                timezone: 'America/Argentina/Buenos_Aires',
                days: {
                    mon: { closed: true, shifts: [] },
                    tue: { closed: true, shifts: [] },
                    wed: { closed: true, shifts: [] },
                    thu: { closed: true, shifts: [] },
                    fri: { closed: true, shifts: [] },
                    sat: { closed: true, shifts: [] },
                    sun: { closed: true, shifts: [] }
                }
            }
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('openingHours');
    });

    it('should report "openingHours" missing when openingHours is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), openingHours: undefined };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('openingHours');
    });

    it('should report "priceRange" missing when priceRange is absent', () => {
        const listing = { ...makeCompleteGastronomyListing(), priceRange: null };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing
        });

        expect(result.missing).toContain('priceRange');
    });

    it('should NOT require menuUrl, richDescription, or socialNetworks', () => {
        // These fields do not even exist on CommerceListingCompletenessListing —
        // this test documents the deliberate exclusion (spec §6.6) by asserting
        // a listing missing them entirely is still complete.
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: makeCompleteGastronomyListing()
        });

        expect(result.complete).toBe(true);
    });

    it('should accumulate every missing field, not stop at the first', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            listing: {}
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toEqual([
            'name',
            'summary',
            'description',
            'destinationId',
            'ownerId',
            'type',
            'media.featuredImage',
            'contactInfo',
            'openingHours',
            'priceRange'
        ]);
    });
});

// ---------------------------------------------------------------------------
// resolveListingCompleteness — experience
// ---------------------------------------------------------------------------

describe('resolveListingCompleteness — experience', () => {
    it('should return complete=true and missing=[] for a fully-complete listing', () => {
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: makeCompleteExperienceListing()
        });

        expect(result.complete).toBe(true);
        expect(result.missing).toEqual([]);
    });

    it('should NOT require openingHours or priceRange (gastronomy-only fields)', () => {
        const listing = {
            ...makeCompleteExperienceListing(),
            openingHours: undefined,
            priceRange: undefined
        };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing
        });

        expect(result.complete).toBe(true);
        expect(result.missing).not.toContain('openingHours');
        expect(result.missing).not.toContain('priceRange');
    });

    it('should report shared-block fields missing the same way as gastronomy', () => {
        const listing = { ...makeCompleteExperienceListing(), name: '' };
        const result = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toEqual(['name']);
    });
});
