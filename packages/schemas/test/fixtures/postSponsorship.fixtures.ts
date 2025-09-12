import { faker } from '@faker-js/faker';
import type { PriceCurrencyEnum } from '@repo/types';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString
} from './common.fixtures.js';

/**
 * Creates a valid PostSponsorship fixture with all required and optional fields
 */
export const createValidPostSponsorship = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),

    // PostSponsorship-specific fields
    sponsorId: faker.string.uuid(),
    postId: faker.string.uuid(),

    // Optional message
    message: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),

    // Required description
    description: faker.lorem.paragraph(),

    // Price information
    paid: {
        price: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
        currency: faker.helpers.arrayElement(['USD', 'ARS']) as PriceCurrencyEnum
    },

    // Optional dates
    paidAt: faker.helpers.maybe(() => faker.date.past(), { probability: 0.7 }),
    fromDate: faker.helpers.maybe(() => faker.date.future(), { probability: 0.8 }),
    toDate: faker.helpers.maybe(() => faker.date.future(), { probability: 0.8 }),

    // Highlight flag
    isHighlighted: faker.datatype.boolean()
});

/**
 * Creates a minimal PostSponsorship with only required fields
 */
export const createMinimalPostSponsorship = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),

    // Required fields only
    sponsorId: faker.string.uuid(),
    postId: faker.string.uuid(),
    description: faker.lorem.paragraph(),
    paid: {
        price: faker.number.float({ min: 100, max: 1000, fractionDigits: 2 }),
        currency: 'USD' as PriceCurrencyEnum
    },
    isHighlighted: false
});

/**
 * Creates PostSponsorship with edge case values for testing boundaries
 */
export const createPostSponsorshipEdgeCases = () => ({
    ...createMinimalPostSponsorship(),

    // Edge case values
    message: 'Hello', // Minimum length (5 chars)
    description: 'A'.repeat(10), // Minimum length (10 chars)
    paid: {
        price: 0.01, // Minimum positive price
        currency: 'USD' as PriceCurrencyEnum
    }
});

/**
 * Creates PostSponsorship with maximum length values
 */
export const createPostSponsorshipMaxValues = () => ({
    ...createMinimalPostSponsorship(),

    // Maximum length values
    message: 'A'.repeat(300), // Maximum length (300 chars)
    description: 'A'.repeat(500), // Maximum length (500 chars)
    paid: {
        price: 999999.99, // Large price
        currency: 'ARS' as PriceCurrencyEnum
    },
    paidAt: new Date(),
    fromDate: new Date(),
    toDate: faker.date.future(),
    isHighlighted: true
});

/**
 * Creates PostSponsorship with invalid data for negative testing
 */
export const createInvalidPostSponsorship = () => ({
    ...createMinimalPostSponsorship(),

    // Invalid values
    sponsorId: 'invalid-uuid',
    postId: 'invalid-uuid',
    message: 'Hi', // Too short (min 5)
    description: 'Short', // Too short (min 10)
    paid: {
        price: -100, // Negative price (should be positive)
        currency: 'INVALID' as PriceCurrencyEnum
    }
});

/**
 * Creates PostSponsorship with values that are too long
 */
export const createPostSponsorshipTooLong = () => ({
    ...createMinimalPostSponsorship(),

    // Too long values
    message: createTooLongString(301), // Too long (max 300)
    description: createTooLongString(501), // Too long (max 500)
    paid: {
        price: faker.number.float({ min: 100, max: 1000 }),
        currency: 'USD' as PriceCurrencyEnum
    }
});

/**
 * Creates PostSponsorship for CRUD input testing (without auto-generated fields)
 */
export const createPostSponsorshipCreateInput = () => {
    const sponsorship = createValidPostSponsorship();

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
    } = sponsorship;

    return createInput;
};

/**
 * Creates PostSponsorship update input with partial data
 */
export const createPostSponsorshipUpdateInput = () => ({
    message: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    paid: {
        price: faker.number.float({ min: 200, max: 2000, fractionDigits: 2 }),
        currency: faker.helpers.arrayElement(['USD', 'ARS']) as PriceCurrencyEnum
    },
    isHighlighted: faker.datatype.boolean()
});

/**
 * Creates search parameters for PostSponsorship
 */
export const createPostSponsorshipSearchParams = () => ({
    sponsorId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    postId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    fromDate: faker.helpers.maybe(() => faker.date.past().toISOString(), { probability: 0.3 }),
    toDate: faker.helpers.maybe(() => faker.date.future().toISOString(), { probability: 0.3 }),
    isHighlighted: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.5 })
});

/**
 * Creates PostSponsorship with date range for testing
 */
export const createPostSponsorshipWithDateRange = () => {
    const baseSponsorship = createValidPostSponsorship();
    const startDate = faker.date.future();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

    return {
        ...baseSponsorship,
        fromDate: startDate,
        toDate: endDate,
        paidAt: faker.date.past()
    };
};
