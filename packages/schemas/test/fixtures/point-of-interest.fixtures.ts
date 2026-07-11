import { faker } from '@faker-js/faker';
import { PointOfInterestTypeEnum } from '../../src/enums/point-of-interest-type.enum.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * Point of interest fixtures for testing (HOS-113)
 */

/**
 * Create point-of-interest-specific entity fields.
 * No `name` field (HOS-113 OQ-2) — display resolves via i18n by `slug`.
 */
const createPointOfInterestEntityFields = () => ({
    slug: faker.lorem.slug(3).replace(/-/g, faker.helpers.arrayElement(['-', '_'])),
    lat: faker.location.latitude(),
    long: faker.location.longitude(),
    type: faker.helpers.arrayElement(Object.values(PointOfInterestTypeEnum)),
    description: faker.lorem.paragraph().slice(0, 500),
    icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }) || 'default-icon',
    isBuiltin: faker.datatype.boolean(),
    isFeatured: faker.datatype.boolean()
});

export const createValidPointOfInterest = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createPointOfInterestEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields()
});

export const createMinimalPointOfInterest = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    slug: 'minimal-poi',
    lat: -32.4833,
    long: -58.2333,
    type: PointOfInterestTypeEnum.PLAZA,
    description: 'A minimal point of interest for testing purposes',
    icon: 'minimal-icon',
    isBuiltin: false,
    isFeatured: false
});

export const createComplexPointOfInterest = () => ({
    ...createValidPointOfInterest(),
    slug: 'complex-point-of-interest-with-many-features',
    description: faker.lorem.paragraphs(3).slice(0, 500),
    icon: 'complex-poi-icon',
    isFeatured: true,
    isBuiltin: false
});

export const createPointOfInterestEdgeCases = () => [
    // Minimum length slug
    {
        ...createMinimalPointOfInterest(),
        slug: 'min' // 3 chars minimum
    },
    // Maximum length slug
    {
        ...createMinimalPointOfInterest(),
        slug: `${'a'.repeat(97)}xyz` // 100 chars maximum
    },
    // Valid slug patterns (hyphens and underscores)
    {
        ...createMinimalPointOfInterest(),
        slug: 'valid-slug_123'
    },
    // Latitude/longitude boundary values
    {
        ...createMinimalPointOfInterest(),
        lat: 90,
        long: 180
    },
    {
        ...createMinimalPointOfInterest(),
        lat: -90,
        long: -180
    },
    // Boolean edge cases
    {
        ...createMinimalPointOfInterest(),
        isBuiltin: true,
        isFeatured: true
    },
    {
        ...createMinimalPointOfInterest(),
        isBuiltin: false,
        isFeatured: false
    }
];

export const createInvalidPointOfInterest = () => ({
    ...createValidPointOfInterest(),
    id: 'invalid-uuid', // Invalid UUID
    slug: '', // Too short
    lat: 200, // Out of range
    long: -200, // Out of range
    type: 'NOT_A_TYPE', // Invalid enum value
    description: 'short', // Too short
    icon: '', // Too short
    isBuiltin: 'not-boolean', // Invalid type
    isFeatured: 'not-boolean' // Invalid type
});

export const createPointOfInterestWithInvalidFields = () => [
    // Invalid slug
    {
        ...createValidPointOfInterest(),
        slug: createTooShortString() // Less than 3 chars
    },
    {
        ...createValidPointOfInterest(),
        slug: createTooLongString(101) // More than 100 chars
    },
    {
        ...createValidPointOfInterest(),
        slug: 'Invalid Slug With Spaces' // Invalid pattern
    },
    {
        ...createValidPointOfInterest(),
        slug: 'Invalid-Slug' // Invalid pattern (uppercase)
    },
    // Missing slug (no name to fall back on — HOS-113 OQ-2)
    (() => {
        const { slug, ...rest } = createValidPointOfInterest();
        return rest;
    })(),
    // Invalid lat
    {
        ...createValidPointOfInterest(),
        lat: 91 // Out of range
    },
    {
        ...createValidPointOfInterest(),
        lat: -91 // Out of range
    },
    {
        ...createValidPointOfInterest(),
        lat: 'not-a-number' // Wrong type
    },
    // Invalid long
    {
        ...createValidPointOfInterest(),
        long: 181 // Out of range
    },
    {
        ...createValidPointOfInterest(),
        long: -181 // Out of range
    },
    {
        ...createValidPointOfInterest(),
        long: 'not-a-number' // Wrong type
    },
    // Invalid type
    {
        ...createValidPointOfInterest(),
        type: 'WATERFALL' // Not part of the closed enum
    },
    // Missing type (required, no default)
    (() => {
        const { type, ...rest } = createValidPointOfInterest();
        return rest;
    })(),
    // Invalid description
    {
        ...createValidPointOfInterest(),
        description: createTooShortString() // Less than 10 chars
    },
    {
        ...createValidPointOfInterest(),
        description: createTooLongString(501) // More than 500 chars
    },
    // Invalid icon
    {
        ...createValidPointOfInterest(),
        icon: '' // Empty string
    },
    {
        ...createValidPointOfInterest(),
        icon: createTooLongString(101) // More than 100 chars
    },
    // Invalid boolean fields
    {
        ...createValidPointOfInterest(),
        isBuiltin: 'not-boolean' // Wrong type
    },
    {
        ...createValidPointOfInterest(),
        isFeatured: 'not-boolean' // Wrong type
    }
];

/**
 * Create input fixtures for CRUD operations
 */
export const createValidPointOfInterestCreateInput = () => {
    const poi = createValidPointOfInterest();
    // Remove server-generated fields
    const { id, createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById, ...createInput } =
        poi;

    return createInput;
};

export const createValidPointOfInterestUpdateInput = () => {
    const createInput = createValidPointOfInterestCreateInput();
    return {
        description: faker.helpers.maybe(() => createInput.description, { probability: 0.7 }),
        icon: faker.helpers.maybe(() => createInput.icon, { probability: 0.7 }),
        isFeatured: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.5 })
    };
};

/**
 * Create relation fixtures
 */
export const createValidPointOfInterestDestinationRelation = () => ({
    destinationId: faker.string.uuid(),
    pointOfInterestId: faker.string.uuid(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
});

export const createPointOfInterestWithDestinationCount = () => ({
    ...createValidPointOfInterest(),
    destinationCount: faker.number.int({ min: 0, max: 50 })
});
