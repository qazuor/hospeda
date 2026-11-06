/**
 * HOS-2058 -- catalog model: feature category and accommodation-amenity
 * relation attributes (`scope`, `availability`).
 *
 * Release N of an expand/contract: every new field is nullable/optional, and
 * NULL means "not declared". These tests pin that contract at the schema layer.
 */
import { describe, expect, it } from 'vitest';
import { AccommodationPublicSchema } from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationUpdateInputSchema } from '../../../src/entities/accommodation/accommodation.crud.schema.js';
import {
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationUpdate
} from '../../../src/entities/accommodation/accommodation.http.schema.js';
import { AmenityCreateHttpSchema } from '../../../src/entities/amenity/amenity.http.schema.js';
import {
    AccommodationAmenityAttributesListSchema,
    AccommodationAmenityRelationSchema
} from '../../../src/entities/amenity/amenity.schema.js';
import {
    FeatureProtectedSchema,
    FeaturePublicSchema
} from '../../../src/entities/feature/feature.access.schema.js';
import {
    FeatureCreateInputSchema,
    FeatureUpdateInputSchema
} from '../../../src/entities/feature/feature.crud.schema.js';
import {
    FeatureCreateHttpSchema,
    httpToDomainFeatureCreate,
    httpToDomainFeatureUpdate
} from '../../../src/entities/feature/feature.http.schema.js';
import { FeatureSchema } from '../../../src/entities/feature/feature.schema.js';
import { FeatureCategoryEnum } from '../../../src/enums/feature-category.enum.js';
import { createValidFeature } from '../../fixtures/feature.fixtures.js';

const AMENITY_A = '11111111-1111-4111-8111-111111111111';
const AMENITY_B = '22222222-2222-4222-8222-222222222222';
const ACCOMMODATION = '33333333-3333-4333-8333-333333333333';

describe('FeatureSchema.category (HOS-2058)', () => {
    it('accepts a FeatureCategoryEnum value', () => {
        const result = FeatureSchema.safeParse({
            ...createValidFeature(),
            category: FeatureCategoryEnum.VIEW
        });
        expect(result.success).toBe(true);
    });

    it('stays optional and nullable in release N', () => {
        const { category: _omit, ...withoutCategory } = {
            ...createValidFeature(),
            category: undefined
        };
        expect(FeatureSchema.safeParse(withoutCategory).success).toBe(true);
        expect(FeatureSchema.safeParse({ ...createValidFeature(), category: null }).success).toBe(
            true
        );
    });

    it('rejects a value outside the enum', () => {
        const result = FeatureSchema.safeParse({ ...createValidFeature(), category: 'SECURITY' });
        expect(result.success).toBe(false);
    });

    it('is exposed by the public and protected access schemas', () => {
        expect(Object.keys(FeaturePublicSchema.shape)).toContain('category');
        expect(Object.keys(FeatureProtectedSchema.shape)).toContain('category');
    });
});

describe('feature create/update domain input category (HOS-2058, admin routes)', () => {
    it('the strict create input accepts category and rejects an unknown one', () => {
        const base = { applicableVerticals: ['accommodation'] };
        expect(FeatureCreateInputSchema.safeParse({ ...base, category: 'STYLE' }).success).toBe(
            true
        );
        expect(FeatureCreateInputSchema.safeParse({ ...base, category: 'beach' }).success).toBe(
            false
        );
    });

    it('the update input accepts a category change and a clear to null', () => {
        expect(FeatureUpdateInputSchema.safeParse({ category: 'ACCESS' }).success).toBe(true);
        expect(FeatureUpdateInputSchema.safeParse({ category: null }).success).toBe(true);
    });
});

describe('feature create/update HTTP category (HOS-2058, reused dead field)', () => {
    it('validates category against FeatureCategoryEnum', () => {
        expect(FeatureCreateHttpSchema.safeParse({ category: 'LOCATION' }).success).toBe(true);
        expect(FeatureCreateHttpSchema.safeParse({ category: 'beach' }).success).toBe(false);
    });

    it('passes category through to the domain create and update inputs', () => {
        const http = FeatureCreateHttpSchema.parse({ category: 'CUISINE' });
        expect(httpToDomainFeatureCreate(http).category).toBe(FeatureCategoryEnum.CUISINE);
        expect(httpToDomainFeatureUpdate({ category: FeatureCategoryEnum.DIETARY }).category).toBe(
            FeatureCategoryEnum.DIETARY
        );
    });

    it('omits category from the domain update when the HTTP body does not send it', () => {
        expect(httpToDomainFeatureUpdate({}).category).toBeUndefined();
        expect('category' in httpToDomainFeatureUpdate({})).toBe(false);
    });
});

describe('dead amenity create category (HOS-2058 AC-2)', () => {
    it('no longer declares a free-string category next to type', () => {
        expect(Object.keys(AmenityCreateHttpSchema.shape)).not.toContain('category');
    });
});

describe('AccommodationAmenityRelationSchema scope/availability (HOS-2058)', () => {
    it('accepts declared values and treats null/absent as not declared', () => {
        const base = { accommodationId: ACCOMMODATION, amenityId: AMENITY_A };
        expect(
            AccommodationAmenityRelationSchema.safeParse({
                ...base,
                scope: 'private',
                availability: 'seasonal'
            }).success
        ).toBe(true);
        expect(
            AccommodationAmenityRelationSchema.safeParse({
                ...base,
                scope: null,
                availability: null
            }).success
        ).toBe(true);
        expect(AccommodationAmenityRelationSchema.safeParse(base).success).toBe(true);
    });

    it('rejects values outside the enums', () => {
        const base = { accommodationId: ACCOMMODATION, amenityId: AMENITY_A };
        expect(
            AccommodationAmenityRelationSchema.safeParse({ ...base, scope: 'public' }).success
        ).toBe(false);
        expect(
            AccommodationAmenityRelationSchema.safeParse({ ...base, availability: 'summer' })
                .success
        ).toBe(false);
    });
});

describe('AccommodationAmenityAttributesListSchema (HOS-2058)', () => {
    it('accepts one entry per amenity', () => {
        const result = AccommodationAmenityAttributesListSchema.safeParse([
            { amenityId: AMENITY_A, scope: 'shared' },
            { amenityId: AMENITY_B, availability: 'year_round', scope: null }
        ]);
        expect(result.success).toBe(true);
    });

    it('rejects a duplicated amenityId with the duplicate key', () => {
        const result = AccommodationAmenityAttributesListSchema.safeParse([
            { amenityId: AMENITY_A, scope: 'shared' },
            { amenityId: AMENITY_A, scope: 'private' }
        ]);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.accommodationAmenity.attributes.duplicate'
            );
        }
    });
});

describe('accommodation update carries amenityAttributes (HOS-2058)', () => {
    it('HTTP update accepts the list and the converter passes it to the domain input', () => {
        // Arrange
        const body = AccommodationUpdateHttpSchema.parse({
            amenityIds: [AMENITY_A],
            amenityAttributes: [{ amenityId: AMENITY_A, scope: 'private', availability: null }]
        });

        // Act
        const domain = httpToDomainAccommodationUpdate(body);

        // Assert
        expect(domain.amenityAttributes).toEqual([
            { amenityId: AMENITY_A, scope: 'private', availability: null }
        ]);
        expect(AccommodationUpdateInputSchema.safeParse(domain).success).toBe(true);
    });

    it('converter omits amenityAttributes when the body does not send it', () => {
        const domain = httpToDomainAccommodationUpdate(AccommodationUpdateHttpSchema.parse({}));
        expect('amenityAttributes' in domain).toBe(false);
    });
});

describe('AccommodationPublicSchema relation attributes (HOS-2058)', () => {
    it('lets amenities carry scope/availability and features carry category', () => {
        const parsed = AccommodationPublicSchema.shape.amenities.safeParse([
            {
                amenityId: AMENITY_A,
                slug: 'pool',
                icon: null,
                isOptional: false,
                additionalCost: null,
                scope: 'shared',
                availability: 'seasonal'
            }
        ]);
        expect(parsed.success).toBe(true);

        const features = AccommodationPublicSchema.shape.features.safeParse([
            {
                featureId: AMENITY_B,
                slug: 'river_front',
                icon: null,
                category: 'LOCATION',
                hostReWriteName: null,
                comments: null
            }
        ]);
        expect(features.success).toBe(true);
    });
});
