import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseMediaFields,
    createBaseModerationFields,
    createBaseReviewFields,
    createBaseSeoFields,
    createBaseTagsFields,
    createBaseVisibilityFields,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

export const createValidDestination = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseReviewFields(),
    ...createBaseSeoFields(),
    ...createBaseContactFields(),
    // Location (required for destinations)
    location: {
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country().slice(0, 50),
        coordinates: {
            lat: faker.location.latitude().toString(),
            long: faker.location.longitude().toString()
        }
    },
    ...createBaseMediaFields(),
    ...createBaseTagsFields(),
    ...createBaseAdminFields(),
    // Note: Destinations don't have FAQs in the current schema
    // If needed in the future, create DestinationFaqSchema similar to AccommodationFaqSchema

    // Destination-specific fields
    name: faker.location.city(),
    slug: faker.helpers.slugify(faker.location.city()).toLowerCase(),
    summary: faker.lorem.paragraph().slice(0, 300),
    description: faker.lorem.paragraphs(3),
    isFeatured: faker.datatype.boolean(),

    // Counts
    accommodationsCount: faker.number.int({ min: 0, max: 500 }),

    // Attractions
    attractions: faker.helpers.maybe(
        () =>
            faker.helpers.multiple(
                () => ({
                    ...createBaseIdFields(),
                    ...createBaseAuditFields(),
                    ...createBaseLifecycleFields(),
                    ...createBaseAdminFields(),
                    name: faker.company.name(),
                    slug: faker.lorem.slug(3),
                    description: faker.lorem.paragraph().slice(0, 500),
                    icon: faker.helpers.arrayElement([
                        'museum',
                        'park',
                        'restaurant',
                        'shopping',
                        'entertainment'
                    ]),
                    destinationId: faker.string.uuid(),
                    isFeatured: faker.datatype.boolean(),
                    isBuiltin: faker.datatype.boolean()
                }),
                { count: { min: 3, max: 15 } }
            ),
        { probability: 0.8 }
    ),

    // Rating breakdown - matching DestinationRatingSchema
    rating: {
        landscape: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        attractions: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        accessibility: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        safety: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        cleanliness: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        hospitality: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        culturalOffer: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        gastronomy: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        affordability: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        nightlife: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        infrastructure: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        environmentalCare: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        wifiAvailability: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        shopping: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        beaches: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        greenSpaces: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        localEvents: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        weatherSatisfaction: faker.number.float({ min: 1, max: 5, fractionDigits: 1 })
    }
});

export const createMinimalDestination = () => ({
    id: faker.string.uuid(),
    slug: faker.lorem.slug(),
    name: faker.location.city(),
    summary: faker.lorem.paragraph({ min: 1, max: 2 }),
    description: faker.lorem.paragraphs(3, '\n\n'),
    location: {
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: faker.location.country(),
        zipCode: faker.location.zipCode(),
        coordinates: {
            lat: faker.location.latitude().toString(),
            long: faker.location.longitude().toString()
        },
        timezone: faker.location.timeZone()
    },

    // Required base fields
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),

    // Required enum fields
    lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    moderationState: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED']),
    visibility: faker.helpers.arrayElement(['PUBLIC', 'PRIVATE', 'RESTRICTED'])
});

export const createInvalidDestination = () => ({
    name: createTooShortString(),
    slug: createTooLongString(100),
    description: createTooShortString(),
    accommodationsCount: -1,
    location: {
        coordinates: {
            latitude: 200,
            longitude: -200
        }
    },
    ratingBreakdown: {
        attractions: 6, // Too high
        accommodation: 0 // Too low
    }
});

/**
 * Creates edge case destination data for testing boundary conditions
 */
export const createDestinationEdgeCases = (): any => ({
    ...createValidDestination(),
    name: 'ABC', // Minimum length (3 chars)
    summary: 'D'.repeat(10), // Minimum length
    description: 'E'.repeat(50), // Minimum length
    isFeatured: false,
    seo: {
        title: 'F'.repeat(30), // Minimum SEO title length
        description: 'G'.repeat(70), // Minimum SEO description length
        keywords: ['min']
    },
    tags: [
        {
            id: faker.string.uuid(),
            name: 'ab',
            slug: 'ab',
            color: 'RED',
            ...createBaseAuditFields(),
            ...createBaseLifecycleFields(),
            ...createBaseAdminFields()
        },
        {
            id: faker.string.uuid(),
            name: 'bc',
            slug: 'bc',
            color: 'GREEN',
            ...createBaseAuditFields(),
            ...createBaseLifecycleFields(),
            ...createBaseAdminFields()
        }
    ],
    attractions: [] // Empty array
});
