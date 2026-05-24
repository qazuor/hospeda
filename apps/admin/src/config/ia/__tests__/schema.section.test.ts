/**
 * Tests for SectionSchema (T-002)
 *
 * Covers:
 * - Valid section with sidebar=null
 * - Valid section with sidebar set to a string
 * - Rejection of route without leading slash
 * - defaultRoute optional — omitted is valid, present is valid
 */

import { describe, expect, it } from 'vitest';
import { SectionSchema } from '../schema';

// ============================================================================
// SectionSchema
// ============================================================================

const validBase = {
    id: 'catalogo',
    label: { es: 'Catálogo', en: 'Catalog', pt: 'Catálogo' },
    icon: 'package',
    route: '/catalogo',
    sidebar: null
} as const;

describe('SectionSchema', () => {
    describe('when given valid input', () => {
        it('should accept a section with sidebar=null (no sidebar)', () => {
            // Arrange
            const input = { ...validBase, sidebar: null };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a section with a sidebar string reference', () => {
            // Arrange
            const input = { ...validBase, sidebar: 'inicioSidebar' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a section without defaultRoute (field is optional)', () => {
            // Arrange — no defaultRoute key at all
            const input = { ...validBase };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultRoute).toBeUndefined();
            }
        });

        it('should accept a section with a valid defaultRoute', () => {
            // Arrange
            const input = { ...validBase, defaultRoute: '/catalogo/dashboard' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultRoute).toBe('/catalogo/dashboard');
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject a route without a leading slash', () => {
            // Arrange
            const input = { ...validBase, route: 'catalogo' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a defaultRoute without a leading slash', () => {
            // Arrange
            const input = { ...validBase, defaultRoute: 'catalogo/dashboard' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty id', () => {
            // Arrange
            const input = { ...validBase, id: '' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty icon', () => {
            // Arrange
            const input = { ...validBase, icon: '' };

            // Act
            const result = SectionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a missing label', () => {
            // Arrange
            const { label: _label, ...inputWithoutLabel } = validBase;

            // Act
            const result = SectionSchema.safeParse(inputWithoutLabel);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
