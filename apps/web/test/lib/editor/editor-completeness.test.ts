/**
 * Tests for the editor completeness mapping (HOS-2499, spec HOS-2415 §6.1).
 */

import { describe, expect, it } from 'vitest';
import {
    buildEditorCompleteness,
    resolveAccommodationCompleteness,
    resolveListingEditorCompleteness
} from '@/lib/editor/editor-completeness';

const COMPLETE_ACCOMMODATION = {
    description: 'Una casa frente al río, con parque y parrilla.',
    capacity: 4,
    minNights: 2,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
} as const;

describe('buildEditorCompleteness', () => {
    it('counts sections, not requirements, and lists each incomplete section once', () => {
        // Arrange
        const requirements = [
            { id: 'a', sectionId: 'one' },
            { id: 'b', sectionId: 'two' },
            { id: 'c', sectionId: 'two' },
            { id: 'd', sectionId: 'three' }
        ];

        // Act
        const result = buildEditorCompleteness({ requirements, missingIds: ['b', 'c', 'd'] });

        // Assert
        expect(result).toEqual({
            done: 1,
            total: 3,
            missing: ['two', 'three'],
            requiredSections: ['one', 'two', 'three']
        });
    });

    it('ignores an unmet id that no requirement declares', () => {
        const result = buildEditorCompleteness({
            requirements: [{ id: 'a', sectionId: 'one' }],
            missingIds: ['ghost']
        });

        expect(result).toEqual({ done: 1, total: 1, missing: [], requiredSections: ['one'] });
    });
});

describe('resolveAccommodationCompleteness', () => {
    it('is complete when every publish requirement is met', () => {
        const result = resolveAccommodationCompleteness({ input: COMPLETE_ACCOMMODATION });

        expect(result.missing).toEqual([]);
        expect(result.done).toBe(result.total);
        expect(result.total).toBeGreaterThan(0);
    });

    it('names the section of each unmet requirement', () => {
        const result = resolveAccommodationCompleteness({
            input: { ...COMPLETE_ACCOMMODATION, bathrooms: null, hasMainImage: false }
        });

        expect(result.missing).toEqual(['capacityPricing', 'photos']);
        expect(result.done).toBe(result.total - 2);
    });
});

describe('resolveListingEditorCompleteness', () => {
    it('reports every required section of an empty venue, skipping fields with no section', () => {
        const result = resolveListingEditorCompleteness({ vertical: 'venue', listing: {} });

        expect(result.done).toBe(0);
        expect(result.missing).toEqual(['basicInfo', 'media', 'contact', 'openingHours', 'price']);
        expect(result.total).toBe(5);
    });

    it('does not require opening hours of an experience', () => {
        const result = resolveListingEditorCompleteness({ vertical: 'experience', listing: {} });

        expect(result.missing).not.toContain('openingHours');
        expect(result.missing).toContain('price');
    });

    it('counts a section done once its fields are filled', () => {
        const result = resolveListingEditorCompleteness({
            vertical: 'experience',
            listing: { isPriceOnRequest: true }
        });

        expect(result.missing).not.toContain('price');
        expect(result.done).toBe(1);
    });
});
