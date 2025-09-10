import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * Attraction fixtures for testing
 */

/**
 * Create attraction-specific entity fields
 */
const createAttractionEntityFields = () => ({
    slug: faker.lorem.slug(3),
    name: faker.lorem.words({ min: 2, max: 5 }).slice(0, 100),
    description: faker.lorem.paragraph().slice(0, 500),
    icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }) || 'default-icon',
    destinationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.8 }),
    isBuiltin: faker.datatype.boolean(),
    isFeatured: faker.datatype.boolean()
});

export const createValidAttraction = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAttractionEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields()
});

export const createMinimalAttraction = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    slug: 'minimal-attraction',
    name: 'Minimal Attraction',
    description: 'A minimal attraction for testing purposes',
    icon: 'minimal-icon',
    isBuiltin: false,
    isFeatured: false
});

export const createComplexAttraction = () => ({
    ...createValidAttraction(),
    name: 'Complex Attraction with Many Features',
    description: faker.lorem.paragraphs(3).slice(0, 500),
    icon: 'complex-attraction-icon',
    destinationId: faker.string.uuid(),
    isFeatured: true,
    isBuiltin: false
});

export const createAttractionEdgeCases = () => [
    // Minimum length strings
    {
        ...createMinimalAttraction(),
        name: 'Min', // 3 chars minimum
        slug: 'min', // 3 chars minimum
        description: 'A'.repeat(10), // 10 chars minimum
        icon: 'i' // 1 char minimum
    },
    // Maximum length strings
    {
        ...createMinimalAttraction(),
        name: 'A'.repeat(100), // 100 chars maximum
        slug: 'a'.repeat(100), // 100 chars maximum
        description: 'A'.repeat(500), // 500 chars maximum
        icon: 'A'.repeat(100) // 100 chars maximum
    },
    // Valid slug patterns
    {
        ...createMinimalAttraction(),
        slug: 'valid-slug-123'
    },
    // Optional destinationId
    {
        ...createMinimalAttraction(),
        destinationId: undefined
    },
    // Boolean edge cases
    {
        ...createMinimalAttraction(),
        isBuiltin: true,
        isFeatured: true
    },
    {
        ...createMinimalAttraction(),
        isBuiltin: false,
        isFeatured: false
    }
];

export const createInvalidAttraction = () => ({
    ...createValidAttraction(),
    id: 'invalid-uuid', // Invalid UUID
    name: '', // Too short
    slug: '', // Too short
    description: 'short', // Too short
    icon: '', // Too short
    destinationId: 'invalid-uuid', // Invalid UUID
    isBuiltin: 'not-boolean', // Invalid type
    isFeatured: 'not-boolean' // Invalid type
});

export const createAttractionWithInvalidFields = () => [
    // Invalid name
    {
        ...createValidAttraction(),
        name: createTooShortString() // Less than 3 chars
    },
    {
        ...createValidAttraction(),
        name: createTooLongString(101) // More than 100 chars
    },
    {
        ...createValidAttraction(),
        name: 123 // Wrong type
    },
    // Invalid slug
    {
        ...createValidAttraction(),
        slug: createTooShortString() // Less than 3 chars
    },
    {
        ...createValidAttraction(),
        slug: createTooLongString(101) // More than 100 chars
    },
    {
        ...createValidAttraction(),
        slug: 'Invalid Slug With Spaces' // Invalid pattern
    },
    {
        ...createValidAttraction(),
        slug: 'invalid_slug_with_underscores' // Invalid pattern
    },
    // Invalid description
    {
        ...createValidAttraction(),
        description: createTooShortString() // Less than 10 chars
    },
    {
        ...createValidAttraction(),
        description: createTooLongString(501) // More than 500 chars
    },
    {
        ...createValidAttraction(),
        description: 123 // Wrong type
    },
    // Invalid icon
    {
        ...createValidAttraction(),
        icon: '' // Empty string
    },
    {
        ...createValidAttraction(),
        icon: createTooLongString(101) // More than 100 chars
    },
    {
        ...createValidAttraction(),
        icon: 123 // Wrong type
    },
    // Invalid destinationId
    {
        ...createValidAttraction(),
        destinationId: 'invalid-uuid' // Invalid UUID format
    },
    {
        ...createValidAttraction(),
        destinationId: 123 // Wrong type
    },
    // Invalid boolean fields
    {
        ...createValidAttraction(),
        isBuiltin: 'not-boolean' // Wrong type
    },
    {
        ...createValidAttraction(),
        isFeatured: 'not-boolean' // Wrong type
    }
];

/**
 * Create input fixtures for CRUD operations
 */
export const createValidAttractionCreateInput = () => {
    const attraction = createValidAttraction();
    // Remove server-generated fields
    const {
        id,
        createdAt,
        updatedAt,
        createdById,
        updatedById,
        deletedAt,
        deletedById,
        ...createInput
    } = attraction;

    return {
        ...createInput,
        slug: faker.helpers.maybe(() => faker.lorem.slug(3), { probability: 0.5 }) // Optional on create
    };
};

export const createValidAttractionUpdateInput = () => {
    const createInput = createValidAttractionCreateInput();
    // Make all fields optional for update
    return {
        name: faker.helpers.maybe(() => createInput.name, { probability: 0.7 }),
        description: faker.helpers.maybe(() => createInput.description, { probability: 0.7 }),
        icon: faker.helpers.maybe(() => createInput.icon, { probability: 0.7 }),
        isFeatured: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.5 })
    };
};

/**
 * Create relation fixtures
 */
export const createValidAttractionDestinationRelation = () => ({
    destinationId: faker.string.uuid(),
    attractionId: faker.string.uuid(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent()
});

export const createAttractionWithDestinationCount = () => ({
    ...createValidAttraction(),
    destinationCount: faker.number.int({ min: 0, max: 50 })
});
