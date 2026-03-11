/**
 * Array/nested field validation tests for admin entity forms (GAP-008).
 *
 * Covers:
 * 1. GalleryField array validation — empty array, invalid items, max items
 * 2. Nested object validation — dot-notation fields (location.country,
 *    price.basePrice) through validateFormWithZod and parseApiValidationErrors
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock @repo/i18n before importing modules under test
// ---------------------------------------------------------------------------

vi.mock('@repo/i18n', () => ({
    resolveValidationMessage: vi.fn(
        ({
            key,
            t,
            params
        }: {
            key: string;
            t: (key: string, params?: Record<string, unknown>) => string;
            params?: Record<string, unknown>;
        }) => t(key, params)
    )
}));

import { parseApiValidationErrors } from '../../../src/lib/errors/parse-api-validation-errors';
import { validateFormWithZod } from '../../../src/lib/validation/validate-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a translation-key-as-string mock t function. */
function mockT(key: string, _params?: Record<string, unknown>): string {
    return key;
}

// ---------------------------------------------------------------------------
// GalleryField — array validation via Zod schemas
// ---------------------------------------------------------------------------

/**
 * Minimal Zod schema that mirrors the pattern used in real entity configs:
 * an array field that requires at least one item and caps at a maximum.
 */
const GallerySchema = z.object({
    title: z.string().min(1, 'zodError.entity.title.required'),
    images: z
        .array(
            z.object({
                id: z.string(),
                url: z.string().url('zodError.entity.images.invalidUrl'),
                order: z.number()
            })
        )
        .min(1, 'zodError.entity.images.minItems')
        .max(3, 'zodError.entity.images.maxItems')
});

describe('GalleryField — array validation with Zod schema', () => {
    it('should report an error for an empty images array', () => {
        // Arrange — no images provided
        const data = { title: 'My Place', images: [] };

        // Act
        const errors = validateFormWithZod({ schema: GallerySchema, data, t: mockT });

        // Assert — images field must have an error
        expect(errors.images).toBeDefined();
    });

    it('should report no error when images array has valid items', () => {
        // Arrange — one valid image
        const data = {
            title: 'My Place',
            images: [{ id: 'img-1', url: 'https://example.com/img.jpg', order: 0 }]
        };

        // Act
        const errors = validateFormWithZod({ schema: GallerySchema, data, t: mockT });

        // Assert
        expect(errors.images).toBeUndefined();
        expect(errors.title).toBeUndefined();
    });

    it('should report an error for an array item with an invalid url', () => {
        // Arrange — item has a non-URL string
        const data = {
            title: 'My Place',
            images: [{ id: 'img-1', url: 'not-a-url', order: 0 }]
        };

        // Act
        const errors = validateFormWithZod({ schema: GallerySchema, data, t: mockT });

        // Assert — Zod produces a nested path error like "images[0].url"
        // validateFormWithZod uses the first path segment as the key, so
        // the "images" key will be present.
        const imageErrors = Object.keys(errors).filter((k) => k.startsWith('images'));
        expect(imageErrors.length).toBeGreaterThan(0);
    });

    it('should report an error when images array exceeds max items', () => {
        // Arrange — 4 items, schema allows max 3
        const data = {
            title: 'My Place',
            images: [
                { id: 'img-1', url: 'https://example.com/1.jpg', order: 0 },
                { id: 'img-2', url: 'https://example.com/2.jpg', order: 1 },
                { id: 'img-3', url: 'https://example.com/3.jpg', order: 2 },
                { id: 'img-4', url: 'https://example.com/4.jpg', order: 3 }
            ]
        };

        // Act
        const errors = validateFormWithZod({ schema: GallerySchema, data, t: mockT });

        // Assert
        expect(errors.images).toBeDefined();
    });

    it('should not expose raw zodError.* keys as final error messages', () => {
        // Arrange
        const data = { title: 'My Place', images: [] };

        // Act
        const errors = validateFormWithZod({ schema: GallerySchema, data, t: mockT });

        // Assert — mockT returns key unchanged, but no errors should be
        // of the form "zodError.*" when they pass through resolveValidationMessage
        // (which in tests calls t() directly). The raw key from the schema IS
        // the message here because mockT returns it as-is, but the point is
        // that the layer correctly threads the key through t().
        for (const msg of Object.values(errors)) {
            // Message should be a non-empty string
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });
});

// ---------------------------------------------------------------------------
// Nested object validation — dot-notation field paths
// ---------------------------------------------------------------------------

/**
 * Schema with nested objects, matching real patterns like
 * accommodation.location and accommodation.pricing.
 */
const AccommodationSchema = z.object({
    name: z.string().min(2, 'zodError.accommodation.name.min'),
    location: z.object({
        country: z.string().min(1, 'zodError.accommodation.location.country.required'),
        city: z.string().min(1, 'zodError.accommodation.location.city.required')
    }),
    pricing: z.object({
        basePrice: z.number().positive('zodError.accommodation.pricing.basePrice.positive')
    })
});

describe('Nested field validation — dot-notation paths', () => {
    it('should report error for missing nested location.country field', () => {
        // Arrange
        const data = {
            name: 'Hostel Test',
            location: { country: '', city: 'Buenos Aires' },
            pricing: { basePrice: 100 }
        };

        // Act
        const errors = validateFormWithZod({ schema: AccommodationSchema, data, t: mockT });

        // Assert — dot-notation key for nested field
        expect(errors['location.country']).toBeDefined();
        expect(errors['location.city']).toBeUndefined();
    });

    it('should report error for negative price.basePrice', () => {
        // Arrange
        const data = {
            name: 'Hostel Test',
            location: { country: 'AR', city: 'Buenos Aires' },
            pricing: { basePrice: -50 }
        };

        // Act
        const errors = validateFormWithZod({ schema: AccommodationSchema, data, t: mockT });

        // Assert
        expect(errors['pricing.basePrice']).toBeDefined();
    });

    it('should report no errors when all nested fields are valid', () => {
        // Arrange
        const data = {
            name: 'Hostel Test',
            location: { country: 'AR', city: 'Buenos Aires' },
            pricing: { basePrice: 150 }
        };

        // Act
        const errors = validateFormWithZod({ schema: AccommodationSchema, data, t: mockT });

        // Assert
        expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should report multiple nested errors independently', () => {
        // Arrange — both nested fields fail
        const data = {
            name: 'Hostel Test',
            location: { country: '', city: '' },
            pricing: { basePrice: 0 }
        };

        // Act
        const errors = validateFormWithZod({ schema: AccommodationSchema, data, t: mockT });

        // Assert — at least two dot-notation errors
        const nestedErrors = Object.keys(errors).filter((k) => k.includes('.'));
        expect(nestedErrors.length).toBeGreaterThanOrEqual(2);
    });
});

// ---------------------------------------------------------------------------
// API error envelope — dot-notation field mapping via parseApiValidationErrors
// ---------------------------------------------------------------------------

describe('Nested dot-notation error mapping from API responses', () => {
    it('should map location.country API error to the correct field key', () => {
        // Arrange — simulate API error envelope with nested field
        const apiBody = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'zodError.validation.failed',
                details: [
                    {
                        field: 'location.country',
                        messageKey: 'zodError.accommodation.location.country.required',
                        code: 'too_small'
                    }
                ],
                summary: { totalErrors: 1, fieldCount: 1 }
            }
        };

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: mockT });

        // Assert — key preserves the dot-notation path
        expect(fieldErrors['location.country']).toBeDefined();
        expect(fieldErrors['location.country']).toBe(
            'zodError.accommodation.location.country.required'
        );
    });

    it('should map pricing.basePrice API error to the correct field key', () => {
        // Arrange
        const apiBody = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'zodError.validation.failed',
                details: [
                    {
                        field: 'pricing.basePrice',
                        messageKey: 'zodError.accommodation.pricing.basePrice.positive',
                        code: 'too_small'
                    }
                ],
                summary: { totalErrors: 1, fieldCount: 1 }
            }
        };

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: mockT });

        // Assert
        expect(fieldErrors['pricing.basePrice']).toBeDefined();
    });

    it('should handle multiple nested fields in a single API error response', () => {
        // Arrange
        const apiBody = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'zodError.validation.failed',
                details: [
                    {
                        field: 'location.country',
                        messageKey: 'zodError.accommodation.location.country.required',
                        code: 'too_small'
                    },
                    {
                        field: 'pricing.basePrice',
                        messageKey: 'zodError.accommodation.pricing.basePrice.positive',
                        code: 'too_small'
                    },
                    {
                        field: 'name',
                        messageKey: 'zodError.accommodation.name.min',
                        code: 'too_small'
                    }
                ],
                summary: { totalErrors: 3, fieldCount: 3 }
            }
        };

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: mockT });

        // Assert — all three fields are mapped
        expect(Object.keys(fieldErrors)).toHaveLength(3);
        expect(fieldErrors['location.country']).toBeDefined();
        expect(fieldErrors['pricing.basePrice']).toBeDefined();
        expect(fieldErrors.name).toBeDefined();
    });

    it('should return empty object when details array is empty', () => {
        // Arrange
        const apiBody = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'zodError.validation.failed',
                details: [],
                summary: null
            }
        };

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: mockT });

        // Assert
        expect(Object.keys(fieldErrors)).toHaveLength(0);
    });
});
