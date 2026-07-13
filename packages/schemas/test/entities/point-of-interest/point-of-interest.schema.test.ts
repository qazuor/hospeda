import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PointOfInterestSchema } from '../../../src/entities/point-of-interest/point-of-interest.schema.js';
import { PointOfInterestTypeEnum } from '../../../src/enums/point-of-interest-type.enum.js';
import {
    createComplexPointOfInterest,
    createInvalidPointOfInterest,
    createMinimalPointOfInterest,
    createPointOfInterestEdgeCases,
    createPointOfInterestWithInvalidFields,
    createValidPointOfInterest
} from '../../fixtures/point-of-interest.fixtures.js';

describe('PointOfInterestSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid point of interest', () => {
            const validData = createValidPointOfInterest();

            expect(() => PointOfInterestSchema.parse(validData)).not.toThrow();

            const result = PointOfInterestSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required point of interest data', () => {
            const minimalData = createMinimalPointOfInterest();

            expect(() => PointOfInterestSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested point of interest', () => {
            const complexData = createComplexPointOfInterest();

            expect(() => PointOfInterestSchema.parse(complexData)).not.toThrow();

            const result = PointOfInterestSchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.icon).toBeDefined();
            expect(result.isBuiltin).toBeDefined();
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createPointOfInterestEdgeCases();

            for (const [index, edgeCase] of edgeCases.entries()) {
                expect(
                    () => PointOfInterestSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            }
        });

        it('should apply default values correctly', () => {
            const minimalData = createMinimalPointOfInterest();
            const result = PointOfInterestSchema.parse(minimalData);

            expect(result.isFeatured).toBe(false);
            expect(result.isBuiltin).toBe(false);
            expect(result.displayWeight).toBe(50);
        });

        it('should accept every PointOfInterestTypeEnum value', () => {
            for (const type of Object.values(PointOfInterestTypeEnum)) {
                const data = { ...createMinimalPointOfInterest(), type };
                expect(() => PointOfInterestSchema.parse(data), `type ${type}`).not.toThrow();
            }
        });
    });

    describe('No `name` field (HOS-113 OQ-2)', () => {
        it('should not require a name field', () => {
            const dataWithoutName = createMinimalPointOfInterest();
            expect(dataWithoutName).not.toHaveProperty('name');

            expect(() => PointOfInterestSchema.parse(dataWithoutName)).not.toThrow();
        });

        it('should ignore an extraneous name field if present (not part of the schema shape)', () => {
            const dataWithName = { ...createMinimalPointOfInterest(), name: 'Should be ignored' };
            const result = PointOfInterestSchema.parse(dataWithName);

            expect(result).not.toHaveProperty('name');
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid point of interest data', () => {
            const invalidData = createInvalidPointOfInterest();

            expect(() => PointOfInterestSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject points of interest with invalid individual fields', () => {
            const invalidFields = createPointOfInterestWithInvalidFields();

            for (const [index, invalidField] of invalidFields.entries()) {
                expect(
                    () => PointOfInterestSchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            }
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                id: 'valid-uuid-here'
                // Missing slug, lat, long, type
            };

            expect(() => PointOfInterestSchema.parse(incompleteData)).toThrow(ZodError);
        });
    });

    describe('slug validation', () => {
        const baseData = createMinimalPointOfInterest;

        it('should reject a slug shorter than 3 chars', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), slug: 'ab' })).toThrow(
                ZodError
            );
        });

        it('should reject a slug longer than 100 chars', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), slug: 'a'.repeat(101) })
            ).toThrow(ZodError);
        });

        it('should reject slugs with spaces', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), slug: 'invalid slug' })
            ).toThrow(ZodError);
        });

        it('should reject slugs with uppercase letters', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), slug: 'Invalid-Slug' })
            ).toThrow(ZodError);
        });

        it('should accept slugs with underscores (SPEC-266 discipline)', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), slug: 'autodromo_ciudad' })
            ).not.toThrow();
        });

        it('should accept slugs with hyphens', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), slug: 'playa-banco-pelay' })
            ).not.toThrow();
        });
    });

    describe('lat/long range validation', () => {
        const baseData = createMinimalPointOfInterest;

        it('should accept lat at the lower boundary (-90)', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), lat: -90 })).not.toThrow();
        });

        it('should accept lat at the upper boundary (90)', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), lat: 90 })).not.toThrow();
        });

        it('should reject lat below -90', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), lat: -90.1 })).toThrow(
                ZodError
            );
        });

        it('should reject lat above 90', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), lat: 90.1 })).toThrow(
                ZodError
            );
        });

        it('should accept long at the lower boundary (-180)', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), long: -180 })).not.toThrow();
        });

        it('should accept long at the upper boundary (180)', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), long: 180 })).not.toThrow();
        });

        it('should reject long below -180', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), long: -180.1 })).toThrow(
                ZodError
            );
        });

        it('should reject long above 180', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), long: 180.1 })).toThrow(
                ZodError
            );
        });

        it('should reject a non-numeric lat', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), lat: 'not-a-number' })
            ).toThrow(ZodError);
        });

        it('should reject a non-numeric long', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), long: 'not-a-number' })
            ).toThrow(ZodError);
        });
    });

    describe('type validation (closed enum, HOS-113 OQ-3)', () => {
        const baseData = createMinimalPointOfInterest;

        it('should require type to be present', () => {
            const { type, ...rest } = baseData();
            expect(() => PointOfInterestSchema.parse(rest)).toThrow(ZodError);
        });

        it('should reject a type not in the closed enum', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), type: 'WATERFALL' })).toThrow(
                ZodError
            );
        });

        it('should reject a lowercase type value', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), type: 'beach' })).toThrow(
                ZodError
            );
        });
    });

    describe('displayWeight validation', () => {
        it('should apply default value of 50 when displayWeight is not provided', () => {
            const data = createMinimalPointOfInterest();
            const result = PointOfInterestSchema.parse(data);

            expect(result.displayWeight).toBe(50);
        });

        it('should accept minimum boundary value of 1', () => {
            const data = { ...createMinimalPointOfInterest(), displayWeight: 1 };

            const result = PointOfInterestSchema.parse(data);
            expect(result.displayWeight).toBe(1);
        });

        it('should accept maximum boundary value of 100', () => {
            const data = { ...createMinimalPointOfInterest(), displayWeight: 100 };

            const result = PointOfInterestSchema.parse(data);
            expect(result.displayWeight).toBe(100);
        });

        it('should reject a non-integer value (1.5)', () => {
            const data = { ...createMinimalPointOfInterest(), displayWeight: 1.5 };

            expect(() => PointOfInterestSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject value below minimum (0)', () => {
            const data = { ...createMinimalPointOfInterest(), displayWeight: 0 };

            expect(() => PointOfInterestSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject value above maximum (101)', () => {
            const data = { ...createMinimalPointOfInterest(), displayWeight: 101 };

            expect(() => PointOfInterestSchema.parse(data)).toThrow(ZodError);
        });
    });

    describe('POI v2 fields (HOS-138, AC-2)', () => {
        const baseData = createMinimalPointOfInterest;

        it('should accept null lat and null long (nullable coordinates)', () => {
            expect(() =>
                PointOfInterestSchema.parse({ ...baseData(), lat: null, long: null })
            ).not.toThrow();

            const result = PointOfInterestSchema.parse({ ...baseData(), lat: null, long: null });
            expect(result.lat).toBeNull();
            expect(result.long).toBeNull();
        });

        it('should still validate lat/long bounds when a coordinate IS provided', () => {
            expect(() => PointOfInterestSchema.parse({ ...baseData(), lat: 91, long: 0 })).toThrow(
                ZodError
            );
        });

        it('should accept nameI18n / descriptionI18n as I18nText objects', () => {
            const data = {
                ...baseData(),
                nameI18n: { es: 'Palacio San José', en: 'San José Palace', pt: 'Palácio San José' },
                descriptionI18n: { es: 'Museo', en: 'Museum', pt: 'Museu' }
            };
            const result = PointOfInterestSchema.parse(data);
            expect(result.nameI18n?.en).toBe('San José Palace');
            expect(result.descriptionI18n?.pt).toBe('Museu');
        });

        it('should accept translationMeta metadata', () => {
            const data = {
                ...baseData(),
                translationMeta: {
                    name: {
                        es: { autoTranslated: false, translatedAt: '2026-07-12T00:00:00.000Z' }
                    }
                }
            };
            expect(() => PointOfInterestSchema.parse(data)).not.toThrow();
        });

        it('should accept address, keywords, hasOwnPage, and curation fields', () => {
            const data = {
                ...baseData(),
                address: 'Ruta 39 km 128',
                keywords: ['museo', 'historia', 'urquiza'],
                hasOwnPage: true,
                verified: true,
                verifiedAt: new Date('2026-07-12T00:00:00.000Z'),
                source: 'chatgpt-dataset-2026-07',
                notes: 'Curated by ops'
            };
            const result = PointOfInterestSchema.parse(data);
            expect(result.address).toBe('Ruta 39 km 128');
            expect(result.keywords).toEqual(['museo', 'historia', 'urquiza']);
            expect(result.hasOwnPage).toBe(true);
            expect(result.verified).toBe(true);
            expect(result.source).toBe('chatgpt-dataset-2026-07');
        });

        it('should default hasOwnPage and verified to false when omitted', () => {
            const result = PointOfInterestSchema.parse(baseData());
            expect(result.hasOwnPage).toBe(false);
            expect(result.verified).toBe(false);
        });

        it('should reject more than 30 keywords', () => {
            const data = { ...baseData(), keywords: Array.from({ length: 31 }, (_, i) => `k${i}`) };
            expect(() => PointOfInterestSchema.parse(data)).toThrow(ZodError);
        });
    });

    describe('Schema Composition', () => {
        it('should include all base field schemas', () => {
            const validData = createValidPointOfInterest();
            const result = PointOfInterestSchema.parse(validData);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');
            expect(result).toHaveProperty('lifecycleState');
            expect(result).toHaveProperty('adminInfo');
            expect(result).toHaveProperty('lat');
            expect(result).toHaveProperty('long');
            expect(result).toHaveProperty('type');
        });
    });
});
