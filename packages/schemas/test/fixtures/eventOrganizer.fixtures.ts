import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseSocialFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * EventOrganizer fixtures for testing
 */

/**
 * Create event organizer-specific entity fields
 */
const createEventOrganizerEntityFields = () => ({
    name: faker.company.name().slice(0, 100),
    description: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 500), {
        probability: 0.7
    }),
    logo: faker.helpers.maybe(() => faker.image.url(), { probability: 0.5 })
});

export const createValidEventOrganizer = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createEventOrganizerEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    ...createBaseContactFields(),
    ...createBaseSocialFields()
});

export const createMinimalEventOrganizer = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    name: faker.company.name().slice(0, 100)
});

export const createComplexEventOrganizer = () => ({
    ...createValidEventOrganizer(),
    description: faker.lorem.paragraphs(3).slice(0, 500),
    logo: faker.image.url(),
    // Ensure contact and social fields are present with valid formats
    contactInfo: {
        mobilePhone: '+15550789', // Valid international format
        personalEmail: faker.internet.email(),
        website: faker.internet.url()
    },
    socialNetworks: {
        facebook: 'https://www.facebook.com/example',
        instagram: 'https://www.instagram.com/example',
        twitter: 'https://www.twitter.com/example'
    }
});

// ============================================================================
// CRUD INPUT FIXTURES
// ============================================================================

export const createValidEventOrganizerCreateInput = () => {
    const { id, createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById, ...input } =
        createValidEventOrganizer();
    return input;
};

export const createMinimalEventOrganizerCreateInput = () => {
    const { id, createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById, ...input } =
        createMinimalEventOrganizer();
    return input;
};

export const createValidEventOrganizerUpdateInput = () => ({
    name: faker.company.name().slice(0, 100),
    description: faker.lorem.paragraph().slice(0, 500),
    logo: faker.image.url()
});

export const createPartialEventOrganizerUpdateInput = () => ({
    name: faker.company.name().slice(0, 100)
});

// ============================================================================
// INVALID CASES
// ============================================================================

export const createEventOrganizerInvalidCases = () => [
    // Name too short
    {
        ...createMinimalEventOrganizer(),
        name: createTooShortString()
    },
    // Name too short (2 chars)
    {
        ...createMinimalEventOrganizer(),
        name: 'AB'
    },
    // Name too long
    {
        ...createMinimalEventOrganizer(),
        name: createTooLongString(100)
    },
    // Description too short (if provided)
    {
        ...createMinimalEventOrganizer(),
        description: 'Short'
    },
    // Description too long
    {
        ...createMinimalEventOrganizer(),
        description: createTooLongString(500)
    },
    // Invalid logo URL
    {
        ...createMinimalEventOrganizer(),
        logo: 'not-a-url'
    },
    // Empty name
    {
        ...createMinimalEventOrganizer(),
        name: ''
    }
];

// ============================================================================
// EDGE CASES
// ============================================================================

export const createEventOrganizerEdgeCases = () => [
    // Minimal with only required fields
    createMinimalEventOrganizer(),

    // With all optional fields undefined
    {
        ...createMinimalEventOrganizer(),
        description: undefined,
        logo: undefined
    },

    // With minimum length strings
    {
        ...createMinimalEventOrganizer(),
        name: 'ABC', // Minimum 3 chars
        description: 'A'.repeat(10) // Minimum 10 chars
    },

    // With maximum length strings
    {
        ...createMinimalEventOrganizer(),
        name: 'A'.repeat(100), // Maximum 100 chars
        description: 'A'.repeat(500) // Maximum 500 chars
    },

    // With empty optional contact/social fields
    {
        ...createMinimalEventOrganizer(),
        contactInfo: undefined,
        socialNetworks: undefined
    }
];

// ============================================================================
// QUERY FIXTURES
// ============================================================================

export const createValidEventOrganizerFilters = () => ({
    name: faker.company.name(),
    q: faker.lorem.words(2)
});

export const createValidEventOrganizerSearchInput = () => ({
    pagination: {
        page: faker.number.int({ min: 1, max: 10 }),
        pageSize: faker.number.int({ min: 10, max: 50 })
    },
    filters: createValidEventOrganizerFilters()
});

export const createValidEventOrganizerListInput = () => ({
    page: faker.number.int({ min: 1, max: 10 }),
    pageSize: faker.number.int({ min: 10, max: 50 }),
    filters: {
        name: faker.helpers.maybe(() => faker.company.name(), { probability: 0.5 })
    }
});

// ============================================================================
// OUTPUT FIXTURES
// ============================================================================

export const createEventOrganizerListOutput = () => ({
    items: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
        id: faker.string.uuid(),
        name: faker.company.name(),
        description: faker.lorem.paragraph().slice(0, 500),
        logo: faker.image.url(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    })),
    total: faker.number.int({ min: 1, max: 100 }),
    page: 1,
    pageSize: 20,
    totalPages: faker.number.int({ min: 1, max: 5 })
});

export const createEventOrganizerSearchOutput = () => ({
    ...createEventOrganizerListOutput(),
    query: faker.lorem.words(2)
});
