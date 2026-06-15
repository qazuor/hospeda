import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { CommerceIdentityFields } from '../../src/common/commerce-identity.schema.js';

// ============================================================================
// CommerceIdentityFields — SPEC-239 T-006
// ============================================================================

/** Inline schema built from the spread const, as entity schemas do. */
const CommerceIdentitySchema = z.object({
    ...CommerceIdentityFields
});

/** A fully valid identity payload. */
const validIdentity = {
    name: 'La Parrilla del Centro',
    slug: 'la-parrilla-del-centro',
    summary: 'Authentic Argentine grill in the heart of the city.',
    description:
        'A family-run parrilla offering the finest cuts of Argentine beef, served with classic chimichurri and salads.'
};

describe('CommerceIdentityFields', () => {
    describe('valid inputs', () => {
        it('should parse a valid identity with required fields only', () => {
            // Arrange / Act
            const result = CommerceIdentitySchema.safeParse(validIdentity);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a valid identity with all optional fields included', () => {
            // Arrange
            const input = {
                ...validIdentity,
                richDescription: '## La Parrilla\n\nExcelente carne...',
                nameI18n: {
                    es: 'La Parrilla del Centro',
                    en: 'The Central Grill',
                    pt: 'A Grelha Central'
                },
                summaryI18n: {
                    es: 'Parrilla auténtica',
                    en: 'Authentic grill',
                    pt: 'Grelha autêntica'
                },
                descriptionI18n: { es: 'Descripción...', en: 'Description...', pt: 'Descrição...' },
                richDescriptionI18n: {
                    es: '## La Parrilla',
                    en: '## The Grill',
                    pt: '## A Grelha'
                },
                translationMeta: {}
            };
            // Act
            const result = CommerceIdentitySchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should allow richDescription to be null (nullable)', () => {
            // Arrange
            const input = { ...validIdentity, richDescription: null };
            // Act
            const result = CommerceIdentitySchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('missing required fields', () => {
        it('should reject when name is missing', () => {
            // Arrange
            const { name: _n, ...inputWithoutName } = validIdentity;
            // Act
            const result = CommerceIdentitySchema.safeParse(inputWithoutName);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject when slug is missing', () => {
            // Arrange
            const { slug: _s, ...inputWithoutSlug } = validIdentity;
            // Act
            const result = CommerceIdentitySchema.safeParse(inputWithoutSlug);
            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when summary is missing', () => {
            // Arrange
            const { summary: _s, ...inputWithoutSummary } = validIdentity;
            // Act
            const result = CommerceIdentitySchema.safeParse(inputWithoutSummary);
            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when description is missing', () => {
            // Arrange
            const { description: _d, ...inputWithoutDescription } = validIdentity;
            // Act
            const result = CommerceIdentitySchema.safeParse(inputWithoutDescription);
            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('should reject name shorter than 2 characters', () => {
            const result = CommerceIdentitySchema.safeParse({ ...validIdentity, name: 'A' });
            expect(result.success).toBe(false);
        });

        it('should reject name longer than 100 characters', () => {
            const result = CommerceIdentitySchema.safeParse({
                ...validIdentity,
                name: 'A'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('should reject summary shorter than 10 characters', () => {
            const result = CommerceIdentitySchema.safeParse({
                ...validIdentity,
                summary: 'Short'
            });
            expect(result.success).toBe(false);
        });

        it('should reject description shorter than 20 characters', () => {
            const result = CommerceIdentitySchema.safeParse({
                ...validIdentity,
                description: 'Too short'
            });
            expect(result.success).toBe(false);
        });
    });
});
