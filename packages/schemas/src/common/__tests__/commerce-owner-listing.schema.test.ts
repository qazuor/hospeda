import { describe, expect, it } from 'vitest';
import {
    CommerceOwnerListingListSchema,
    CommerceOwnerListingSummarySchema
} from '../commerce-owner-listing.schema.js';

// ============================================================================
// CommerceOwnerListingSummarySchema (SPEC-249 T-003)
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

describe('CommerceOwnerListingSummarySchema', () => {
    it('parses a gastronomy listing row', () => {
        const result = CommerceOwnerListingSummarySchema.safeParse(gastronomyRow);
        expect(result.success).toBe(true);
    });

    it('parses an experience listing row', () => {
        const result = CommerceOwnerListingSummarySchema.safeParse(experienceRow);
        expect(result.success).toBe(true);
    });

    it('rejects an unknown vertical', () => {
        const result = CommerceOwnerListingSummarySchema.safeParse({
            ...gastronomyRow,
            vertical: 'lodging'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-uuid id', () => {
        const result = CommerceOwnerListingSummarySchema.safeParse({
            ...gastronomyRow,
            id: 'not-a-uuid'
        });
        expect(result.success).toBe(false);
    });
});

describe('CommerceOwnerListingListSchema', () => {
    it('parses a mixed-vertical list under `listings`', () => {
        const result = CommerceOwnerListingListSchema.safeParse({
            listings: [gastronomyRow, experienceRow]
        });
        expect(result.success).toBe(true);
    });

    it('parses an empty list', () => {
        const result = CommerceOwnerListingListSchema.safeParse({ listings: [] });
        expect(result.success).toBe(true);
    });
});
