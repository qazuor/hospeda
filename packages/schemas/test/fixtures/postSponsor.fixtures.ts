import { faker } from '@faker-js/faker';
import type { ClientTypeEnum } from '../../src/enums/index.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseSocialFields,
    createTooLongString
} from './common.fixtures.js';

/**
 * Creates a valid PostSponsor fixture with all required and optional fields
 */
export const createValidPostSponsor = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    ...createBaseContactFields(),
    ...createBaseSocialFields(),

    // PostSponsor-specific fields
    name: faker.company.name(),
    type: faker.helpers.arrayElement(['POST_SPONSOR', 'ADVERTISER', 'HOST']) as ClientTypeEnum,
    description: faker.lorem.paragraph(),

    // Logo (optional)
    logo: faker.helpers.maybe(
        () => ({
            url: faker.image.url(),
            caption: faker.lorem.sentence(),
            description: faker.lorem.sentence(),
            moderationState: faker.helpers.arrayElement(['APPROVED', 'PENDING', 'REJECTED'])
        }),
        { probability: 0.7 }
    )
});

/**
 * Creates a minimal PostSponsor with only required fields
 */
export const createMinimalPostSponsor = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),

    // Required fields only
    name: faker.company.name(),
    type: 'POST_SPONSOR' as ClientTypeEnum,
    description: faker.lorem.paragraph()
});

/**
 * Creates PostSponsor with edge case values for testing boundaries
 */
export const createPostSponsorEdgeCases = () => ({
    ...createMinimalPostSponsor(),

    // Edge case values
    name: 'ABC', // Minimum length (3 chars)
    description: 'A'.repeat(10), // Minimum length (10 chars)
    type: 'ADVERTISER' as ClientTypeEnum
});

/**
 * Creates PostSponsor with maximum length values
 */
export const createPostSponsorMaxValues = () => ({
    ...createMinimalPostSponsor(),

    // Maximum length values
    name: 'A'.repeat(100), // Maximum length (100 chars)
    description: 'A'.repeat(500), // Maximum length (500 chars)
    type: 'HOST' as ClientTypeEnum,

    // Full logo object
    logo: {
        url: 'https://example.com/very-long-logo-url-that-is-still-valid.jpg',
        caption: faker.lorem.sentence(),
        description: faker.lorem.paragraph(),
        moderationState: 'APPROVED'
    }
});

/**
 * Creates PostSponsor with invalid data for negative testing
 */
export const createInvalidPostSponsor = () => ({
    ...createMinimalPostSponsor(),

    // Invalid values
    name: 'AB', // Too short (min 3)
    description: 'Short', // Too short (min 10)
    type: 'INVALID_TYPE' as ClientTypeEnum
});

/**
 * Creates PostSponsor with values that are too long
 */
export const createPostSponsorTooLong = () => ({
    ...createMinimalPostSponsor(),

    // Too long values
    name: createTooLongString(101), // Too long (max 100)
    description: createTooLongString(501), // Too long (max 500)
    type: 'POST_SPONSOR' as ClientTypeEnum
});

/**
 * Creates PostSponsor for CRUD input testing (without auto-generated fields)
 */
export const createPostSponsorCreateInput = () => {
    const sponsor = createValidPostSponsor();

    // Remove auto-generated fields for create input
    const {
        id,
        createdAt,
        updatedAt,
        createdById,
        updatedById,
        deletedAt,
        deletedById,
        adminInfo,
        lifecycleState,
        ...createInput
    } = sponsor;

    return createInput;
};

/**
 * Creates PostSponsor update input with partial data
 */
export const createPostSponsorUpdateInput = () => ({
    name: faker.company.name(),
    description: faker.lorem.paragraph(),
    logo: {
        url: faker.image.url(),
        caption: faker.lorem.sentence()
    }
});

/**
 * Creates search filters for PostSponsor
 */
export const createPostSponsorSearchFilters = () => ({
    name: faker.helpers.maybe(() => faker.company.name(), { probability: 0.5 }),
    type: faker.helpers.maybe(
        () => faker.helpers.arrayElement(['POST_SPONSOR', 'ADVERTISER', 'HOST']) as ClientTypeEnum,
        { probability: 0.5 }
    ),
    q: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.3 })
});
