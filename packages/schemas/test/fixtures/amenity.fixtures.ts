import { faker } from '@faker-js/faker';
import type { AmenitiesTypeEnum } from '../../src/enums/index.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * Amenity fixtures for testing
 */

/**
 * Create amenity-specific entity fields (SPEC-266: name removed, applicableVerticals added).
 * description is an I18nText object ({es, en, pt}).
 */
const createAmenityEntityFields = () => {
    const descEs = faker.lorem.paragraph().slice(0, 490);
    return {
        slug: faker.lorem.slug(3),
        description: { es: descEs, en: descEs, pt: descEs },
        applicableVerticals: faker.helpers.arrayElements(
            ['accommodation', 'gastronomy', 'experience'] as const,
            { min: 1, max: 3 }
        ),
        icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }),
        type: faker.helpers.arrayElement([
            'CLIMATE_CONTROL',
            'CONNECTIVITY',
            'ENTERTAINMENT',
            'KITCHEN',
            'BED_AND_BATH',
            'OUTDOORS',
            'ACCESSIBILITY',
            'SERVICES',
            'SAFETY',
            'FAMILY_FRIENDLY',
            'WORK_FRIENDLY',
            'GENERAL_APPLIANCES'
        ] as AmenitiesTypeEnum[]),
        isBuiltin: faker.datatype.boolean(),
        isFeatured: faker.datatype.boolean()
    };
};

export const createValidAmenity = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAmenityEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields()
});

export const createMinimalAmenity = () => ({
    id: faker.string.uuid(),
    slug: faker.lorem.slug(3),
    applicableVerticals: ['accommodation'] as const,
    type: 'CLIMATE_CONTROL' as AmenitiesTypeEnum,
    lifecycleState: 'ACTIVE',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexAmenity = () => {
    const descEs = faker.lorem.sentence().slice(0, 490);
    return {
        ...createValidAmenity(),
        description: { es: descEs, en: descEs, pt: descEs },
        icon: 'wifi-icon',
        isBuiltin: true,
        isFeatured: true,
        // Additional metadata
        metadata: {
            source: 'admin_panel',
            lastReviewed: faker.date.recent().toISOString()
        }
    };
};

export const createAmenityEdgeCases = () => [
    // Minimum length strings
    {
        ...createMinimalAmenity(),
        slug: 'abc', // minimum 3 chars
        applicableVerticals: ['accommodation'] as const
    },
    // Maximum length strings
    {
        ...createMinimalAmenity(),
        slug: 'a'.repeat(100), // maximum 100 chars
        applicableVerticals: ['accommodation', 'gastronomy'] as const,
        description: { es: 'D'.repeat(500), en: 'D'.repeat(500), pt: 'D'.repeat(500) } // maximum 500 chars
    },
    // All optional fields present
    {
        ...createComplexAmenity(),
        icon: 'custom-amenity-icon',
        isBuiltin: false,
        isFeatured: false
    }
];

export const createInvalidAmenity = () => ({
    // Missing required fields
    slug: createTooShortString(), // too short
    applicableVerticals: [] as const, // empty array (min 1)
    type: 'INVALID_CATEGORY', // invalid enum
    lifecycleState: 'INVALID_STATE', // invalid enum
    // Invalid types
    isBuiltin: 'not-boolean',
    isFeatured: 'not-boolean',
    // Invalid formats
    id: 'not-uuid',
    createdAt: 'not-date',
    updatedAt: 'not-date',
    createdById: 'not-uuid',
    updatedById: 'not-uuid'
});

export const createAmenityWithInvalidFields = () => [
    // Invalid slug format
    {
        ...createMinimalAmenity(),
        slug: 'Invalid Slug With Spaces'
    },
    // Too long strings — slug and description must violate max
    {
        ...createMinimalAmenity(),
        slug: createTooLongString(101),
        description: {
            es: createTooLongString(501),
            en: createTooLongString(501),
            pt: createTooLongString(501)
        }
    },
    // Invalid category
    {
        ...createMinimalAmenity(),
        type: 'NON_EXISTENT_CATEGORY'
    },
    // Invalid lifecycle state
    {
        ...createMinimalAmenity(),
        lifecycleState: 'INVALID_LIFECYCLE'
    }
];

/**
 * Create amenity relation data for accommodation-amenity relationships
 */
export const createAmenityRelation = () => ({
    accommodationId: faker.string.uuid(),
    amenityId: faker.string.uuid(),
    isOptional: faker.datatype.boolean(),
    additionalCost: faker.helpers.maybe(
        () => ({
            amount: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
            currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP'])
        }),
        { probability: 0.3 }
    ),
    additionalCostPercent: faker.helpers.maybe(
        () => faker.number.float({ min: 0, max: 100, fractionDigits: 1 }),
        { probability: 0.2 }
    )
});

/**
 * Create multiple amenities for testing arrays
 */
export const createMultipleAmenities = (count = 3) =>
    Array.from({ length: count }, () => createValidAmenity());

/**
 * Create amenities by category for testing grouping
 */
export const createAmenitiesByCategory = () => ({
    BASIC: [
        { ...createValidAmenity(), type: 'CLIMATE_CONTROL' as AmenitiesTypeEnum },
        { ...createValidAmenity(), type: 'CONNECTIVITY' as AmenitiesTypeEnum }
    ],
    COMFORT: [{ ...createValidAmenity(), type: 'KITCHEN' as AmenitiesTypeEnum }],
    ENTERTAINMENT: [
        { ...createValidAmenity(), type: 'ENTERTAINMENT' as AmenitiesTypeEnum },
        { ...createValidAmenity(), type: 'ENTERTAINMENT' as AmenitiesTypeEnum },
        { ...createValidAmenity(), type: 'ENTERTAINMENT' as AmenitiesTypeEnum }
    ]
});
