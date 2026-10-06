import { describe, expect, it } from 'vitest';
import {
    OwnerListingListSchema,
    OwnerListingSummarySchema
} from '../listing-owner-listing.schema.js';

// ============================================================================
// OwnerListingSummarySchema (SPEC-249 T-003)
// ============================================================================

const gastronomyRow = {
    id: '11111111-1111-4111-8111-111111111111',
    vertical: 'gastronomy',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    type: 'restaurant',
    isPublic: true
};

const experienceRow = {
    id: '22222222-2222-4222-8222-222222222222',
    vertical: 'experience',
    name: 'Kayak al atardecer',
    slug: 'kayak-al-atardecer',
    type: 'tour',
    isPublic: false
};

describe('OwnerListingSummarySchema', () => {
    it('parses a gastronomy listing row', () => {
        const result = OwnerListingSummarySchema.safeParse(gastronomyRow);
        expect(result.success).toBe(true);
    });

    it('parses an experience listing row', () => {
        const result = OwnerListingSummarySchema.safeParse(experienceRow);
        expect(result.success).toBe(true);
    });

    it('rejects an unknown vertical', () => {
        const result = OwnerListingSummarySchema.safeParse({
            ...gastronomyRow,
            vertical: 'lodging'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-uuid id', () => {
        const result = OwnerListingSummarySchema.safeParse({
            ...gastronomyRow,
            id: 'not-a-uuid'
        });
        expect(result.success).toBe(false);
    });
});

describe('OwnerListingListSchema', () => {
    it('parses a mixed-vertical list under `listings`', () => {
        const result = OwnerListingListSchema.safeParse({
            listings: [gastronomyRow, experienceRow]
        });
        expect(result.success).toBe(true);
    });

    it('parses an empty list', () => {
        const result = OwnerListingListSchema.safeParse({ listings: [] });
        expect(result.success).toBe(true);
    });
});
