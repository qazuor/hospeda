import { faker } from '@faker-js/faker';
import type { AccommodationTypeEnum } from '../../src/enums/index.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseLocationFields,
    createBaseMediaFields,
    createBaseModerationFields,
    createBaseReviewFields,
    createBaseSeoFields,
    createBaseTagsFields,
    createBaseVisibilityFields,
    createInvalidEmail,
    createInvalidUrl,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

/**
 * Accommodation fixtures for testing
 */

/**
 * Create accommodation-specific entity fields
 */
const createAccommodationEntityFields = () => ({
    slug: faker.lorem.slug(3),
    name: faker.lorem.words({ min: 3, max: 10 }).slice(0, 100),
    summary: faker.lorem.paragraph().slice(0, 300),
    description: faker.lorem.paragraphs(3).slice(0, 2000),
    isFeatured: faker.datatype.boolean()
});

export const createValidAccommodation = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAccommodationEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseReviewFields(),
    ...createBaseSeoFields(),
    ...createBaseContactFields(),
    ...createBaseLocationFields(),
    ...createBaseMediaFields(),
    ...createBaseTagsFields(),
    ...createBaseAdminFields(),
    // FAQs - specific to accommodation
    faqs: faker.helpers.maybe(
        () =>
            faker.helpers.multiple(
                () => ({
                    id: faker.string.uuid(), // AccommodationFaqId
                    accommodationId: faker.string.uuid(), // Will be set by the accommodation
                    // Base audit fields
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                    createdById: faker.string.uuid(),
                    updatedById: faker.string.uuid(),
                    deletedAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.1 }),
                    deletedById: faker.helpers.maybe(() => faker.string.uuid(), {
                        probability: 0.1
                    }),
                    // Base lifecycle fields
                    lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED']),
                    // Base admin fields
                    adminNotes: faker.helpers.maybe(() => faker.lorem.sentence(), {
                        probability: 0.3
                    }),
                    // FAQ-specific fields
                    question: faker.lorem.sentence().slice(0, 300),
                    answer: faker.lorem.paragraph().slice(0, 2000),
                    category: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.6 })
                }),
                { count: { min: 1, max: 5 } }
            ),
        { probability: 0.7 }
    ),

    // Accommodation-specific fields
    type: faker.helpers.arrayElement([
        'HOTEL',
        'CABIN',
        'HOSTEL',
        'APARTMENT',
        'HOUSE'
    ]) as AccommodationTypeEnum,
    destinationId: faker.string.uuid(),
    ownerId: faker.string.uuid(),

    // IA Data
    iaData: faker.helpers.maybe(
        () => [
            {
                id: faker.string.uuid(),
                accommodationId: faker.string.uuid(),
                title: faker.lorem.sentence(),
                content: faker.lorem.paragraph(),
                category: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.5 }),
                ...createBaseAuditFields(),
                ...createBaseLifecycleFields(),
                ...createBaseAdminFields()
            }
        ],
        { probability: 0.7 }
    ),

    // Pricing
    price: {
        price: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
        currency: faker.helpers.arrayElement(['USD', 'ARS'])
    },

    // Schedule
    schedule: faker.helpers.maybe(
        () => ({
            checkInTime: faker.helpers.maybe(
                () => faker.helpers.arrayElement(['14:00', '15:00', '16:00']),
                { probability: 0.8 }
            ),
            checkOutTime: faker.helpers.maybe(
                () => faker.helpers.arrayElement(['10:00', '11:00', '12:00']),
                { probability: 0.8 }
            ),
            minStay: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 7 }), {
                probability: 0.6
            }),
            maxStay: faker.helpers.maybe(() => faker.number.int({ min: 7, max: 30 }), {
                probability: 0.4
            }),
            availability: faker.helpers.maybe(
                () =>
                    faker.helpers.multiple(
                        () => ({
                            date: faker.date.future(),
                            isAvailable: faker.datatype.boolean(),
                            price: faker.helpers.maybe(
                                () => faker.number.float({ min: 50, max: 500 }),
                                { probability: 0.5 }
                            )
                        }),
                        { count: { min: 1, max: 10 } }
                    ),
                { probability: 0.5 }
            )
        }),
        { probability: 0.8 }
    ),

    // Extra info
    extraInfo: faker.helpers.maybe(
        () => ({
            capacity: faker.number.int({ min: 1, max: 20 }),
            minNights: faker.number.int({ min: 1, max: 7 }),
            maxNights: faker.helpers.maybe(() => faker.number.int({ min: 7, max: 30 }), {
                probability: 0.6
            }),
            bedrooms: faker.number.int({ min: 1, max: 8 }),
            beds: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 10 }), {
                probability: 0.8
            }),
            bathrooms: faker.number.int({ min: 1, max: 5 }),
            smokingAllowed: faker.helpers.maybe(() => faker.datatype.boolean(), {
                probability: 0.7
            }),
            extraInfo: faker.helpers.maybe(
                () =>
                    faker.helpers.multiple(() => faker.lorem.sentence(), {
                        count: { min: 1, max: 3 }
                    }),
                { probability: 0.5 }
            )
        }),
        { probability: 0.9 }
    )
});

// Create variations for different test scenarios
export const createMinimalAccommodation = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAccommodationEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseReviewFields(),

    type: 'HOTEL' as AccommodationTypeEnum,
    destinationId: faker.string.uuid(),
    ownerId: faker.string.uuid()
});

// Invalid data for error testing
export const createInvalidAccommodation = () => ({
    id: 'invalid-uuid', // Invalid UUID
    name: createTooShortString(), // Too short
    slug: '', // Too short
    summary: createTooShortString(), // Too short
    description: createTooShortString(), // Too short
    type: 'INVALID_TYPE', // Invalid enum
    destinationId: 'invalid-uuid', // Invalid UUID
    ownerId: '', // Empty required field
    lifecycleState: 'INVALID_STATE', // Invalid enum
    moderationState: 'INVALID_STATE', // Invalid enum
    visibility: 'INVALID_VISIBILITY', // Invalid enum
    contact: {
        mobilePhone: 'invalid-phone', // Invalid phone format
        personalEmail: createInvalidEmail(),
        website: createInvalidUrl()
    },
    location: {
        state: '', // Too short
        zipCode: '', // Too short
        country: '', // Too short
        street: '', // Too short
        number: '', // Too short
        city: '', // Too short
        coordinates: {
            lat: '200', // Invalid latitude
            long: '-200' // Invalid longitude
        }
    },
    price: {
        price: -100, // Negative price
        currency: 'INVALID' // Invalid currency
    }
});

// Edge cases
export const createAccommodationEdgeCases = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createAccommodationEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseReviewFields(),

    // Maximum length strings
    name: createTooLongString(100),

    type: 'HOTEL' as AccommodationTypeEnum,
    destinationId: faker.string.uuid(),
    ownerId: faker.string.uuid(),

    // Boundary values
    price: {
        price: 0.01, // Minimum price
        currency: 'USD'
    },

    extraInfo: {
        capacity: 1, // Minimum capacity
        minNights: 1, // Minimum
        bedrooms: 1, // Minimum
        bathrooms: 1 // Minimum
    },

    // Empty arrays
    tags: []

    // Counts
});

// Complex accommodation with all optional fields populated
export const createComplexAccommodation = () => ({
    ...createValidAccommodation(),

    // Enhanced IA Data
    iaData: [
        {
            id: faker.string.uuid(),
            accommodationId: faker.string.uuid(),
            title: faker.lorem.sentence(),
            content: faker.lorem.paragraphs(2),
            category: faker.lorem.word(),
            ...createBaseAuditFields(),
            ...createBaseLifecycleFields(),
            ...createBaseAdminFields()
        }
    ],

    // Complete schedule information
    schedule: {
        checkInTime: '15:00',
        checkOutTime: '11:00',
        minStay: faker.number.int({ min: 1, max: 3 }),
        maxStay: faker.number.int({ min: 7, max: 30 }),
        availability: faker.helpers.multiple(
            () => ({
                date: faker.date.future(),
                isAvailable: faker.datatype.boolean(),
                price: faker.helpers.maybe(() => faker.number.float({ min: 50, max: 500 }), {
                    probability: 0.7
                })
            }),
            { count: { min: 5, max: 15 } }
        )
    },

    // Complete extra info
    extraInfo: {
        capacity: faker.number.int({ min: 2, max: 12 }),
        minNights: faker.number.int({ min: 1, max: 3 }),
        maxNights: faker.number.int({ min: 7, max: 30 }),
        bedrooms: faker.number.int({ min: 1, max: 5 }),
        beds: faker.number.int({ min: 1, max: 8 }),
        bathrooms: faker.number.int({ min: 1, max: 3 }),
        smokingAllowed: faker.datatype.boolean(),
        extraInfo: faker.helpers.multiple(() => faker.lorem.sentence(), {
            count: { min: 2, max: 5 }
        })
    }

    // Higher counts for complex accommodation
});
