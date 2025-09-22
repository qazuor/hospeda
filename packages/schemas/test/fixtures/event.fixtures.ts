import { faker } from '@faker-js/faker';
import type { EventCategoryEnum } from '../../src/enums/index.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseContactFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseMediaFields,
    createBaseModerationFields,
    createBaseSeoFields,
    createBaseTagsFields,
    createBaseVisibilityFields,
    createTooLongString,
    createTooShortString,
    createValidLocation
} from './common.fixtures.js';

/**
 * Creates a valid event with all required and optional fields
 */
export const createValidEvent = (): any => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseSeoFields(),
    ...createBaseTagsFields(),
    ...createBaseMediaFields(),
    ...createBaseContactFields(),

    // Event specific fields
    slug: faker.lorem.slug(3),
    name: faker.lorem.words({ min: 3, max: 8 }),
    summary: faker.lorem.paragraph({ min: 1, max: 2 }).padEnd(10, ' ').slice(0, 300),
    description: faker.lorem.paragraphs(3, '\n\n').padEnd(50, ' ').slice(0, 5000),
    category: faker.helpers.arrayElement([
        'MUSIC',
        'CULTURE',
        'SPORTS',
        'GASTRONOMY',
        'FESTIVAL',
        'NATURE',
        'THEATER',
        'WORKSHOP',
        'OTHER'
    ]),

    // Event date
    date: {
        start: faker.date.future(),
        end: faker.date.future(),
        isAllDay: faker.datatype.boolean(),
        recurrence: faker.helpers.maybe(
            () => faker.helpers.arrayElement(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
            { probability: 0.3 }
        )
    },

    // Event pricing
    pricing: {
        price: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
        currency: faker.helpers.arrayElement(['USD', 'ARS']),
        isFree: faker.datatype.boolean(),
        priceFrom: faker.helpers.maybe(
            () => faker.number.float({ min: 0, max: 500, fractionDigits: 2 }),
            { probability: 0.3 }
        ),
        priceTo: faker.helpers.maybe(
            () => faker.number.float({ min: 500, max: 1000, fractionDigits: 2 }),
            { probability: 0.3 }
        )
    },

    isFeatured: faker.datatype.boolean(),

    // Author
    authorId: faker.string.uuid(),

    // Event location
    location: createValidLocation(),
    venue: faker.company.name(),
    address: faker.location.streetAddress(),

    // Organizer ID
    organizerId: faker.string.uuid(),

    // Event details
    capacity: faker.number.int({ min: 10, max: 10000 }),
    attendeesCount: faker.number.int({ min: 0, max: 500 }),
    isOnline: faker.datatype.boolean(),
    onlineUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.4 }),

    // Requirements
    ageRestriction: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 21 }), {
        probability: 0.3
    }),
    requiresRegistration: faker.datatype.boolean(),
    registrationUrl: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.6 }),
    registrationDeadline: faker.helpers.maybe(() => faker.date.future(), { probability: 0.4 }),

    // Relations
    destinationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.7 }),
    accommodationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),

    // Stats
    likes: faker.number.int({ min: 0, max: 1000 }),
    shares: faker.number.int({ min: 0, max: 100 }),
    views: faker.number.int({ min: 0, max: 10000 }),
    bookmarks: faker.number.int({ min: 0, max: 200 })
});

/**
 * Creates minimal event data with only required fields
 */
export const createMinimalEvent = (): any => ({
    id: faker.string.uuid(),
    slug: faker.lorem.slug(),
    name: faker.lorem.words({ min: 3, max: 8 }),
    summary: faker.lorem.paragraph({ min: 1, max: 2 }).padEnd(10, ' ').slice(0, 300),
    description: faker.lorem.paragraphs(3, '\n\n').padEnd(50, ' ').slice(0, 5000),
    category: 'CULTURE' as EventCategoryEnum,

    // Required date
    date: {
        start: faker.date.future(),
        end: faker.date.future(),
        isAllDay: false
    },

    // Required pricing
    pricing: {
        price: 1.0,
        currency: 'USD',
        isFree: false
    },

    // Required author
    authorId: faker.string.uuid(),

    // Required location
    location: createValidLocation(),
    venue: faker.company.name(),

    // Required organizer ID
    organizerId: faker.string.uuid(),

    // Required base fields
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),

    // Required enum fields
    lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    moderationState: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED']),
    visibility: faker.helpers.arrayElement(['PUBLIC', 'PRIVATE', 'RESTRICTED']),

    // Required stats
    capacity: faker.number.int({ min: 10, max: 1000 }),
    attendeesCount: 0,
    isOnline: false,
    requiresRegistration: false
});

/**
 * Creates invalid event data for testing error cases
 */
export const createInvalidEvent = (): any => ({
    slug: createTooShortString(),
    name: createTooLongString(200),
    summary: createTooShortString(),
    description: createTooShortString(),
    category: 'INVALID_CATEGORY',
    date: {}, // Empty date object
    price: {
        price: -100, // Negative price
        currency: 'INVALID_CURRENCY',
        isFree: 'not-boolean' // Invalid type
    },
    organizerId: 'invalid-uuid', // Invalid UUID format
    capacity: -1, // Negative capacity
    attendeesCount: -1,
    ageRestriction: -1, // Negative age
    likes: -1,
    shares: -1,
    views: -1
});

/**
 * Creates edge case event data for testing boundary conditions
 */
export const createEventEdgeCases = (): any => ({
    ...createValidEvent(),
    name: 'ABC', // Minimum length (3 chars)
    summary: 'D'.repeat(10), // Minimum length
    description: 'E'.repeat(50), // Minimum length
    capacity: 1, // Minimum capacity
    attendeesCount: 0, // Minimum attendees
    ageRestriction: 0, // Minimum age
    price: {
        price: 0.01, // Minimum positive price
        currency: 'USD',
        isFree: false,
        priceFrom: 0.01,
        priceTo: 0.02 // Very small range
    },
    date: {
        start: new Date(),
        end: new Date(Date.now() + 60000), // 1 minute duration
        isAllDay: false
    },
    seo: {
        title: 'F'.repeat(30), // Minimum SEO title length
        description: 'G'.repeat(70), // Minimum SEO description length
        keywords: ['min']
    },
    tags: [
        {
            id: faker.string.uuid(),
            slug: 'tag-a',
            name: 'Tag A',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
            createdById: faker.string.uuid(),
            updatedById: faker.string.uuid()
        },
        {
            id: faker.string.uuid(),
            slug: 'tag-b',
            name: 'Tag B',
            color: 'GREEN',
            lifecycleState: 'ACTIVE',
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
            createdById: faker.string.uuid(),
            updatedById: faker.string.uuid()
        }
    ],
    organizerId: faker.string.uuid()
});

/**
 * Creates event data for performance testing
 */
export const createLargeEvent = (): any => ({
    ...createValidEvent(),
    name: 'A'.repeat(100), // Maximum name length
    summary: 'B'.repeat(300), // Large summary (max 300)
    description: 'C'.repeat(2000), // Large description
    date: {
        start: faker.date.future(),
        end: faker.date.future(),
        isAllDay: faker.datatype.boolean(),
        recurrence: faker.helpers.arrayElement(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
    },
    tags: Array.from({ length: 5 }, () => ({
        id: faker.string.uuid(),
        slug: faker.lorem.slug(2),
        name: faker.lorem.word(),
        color: faker.helpers.arrayElement(['BLUE', 'GREEN', 'RED', 'YELLOW', 'PURPLE']),
        lifecycleState: 'ACTIVE',
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        createdById: faker.string.uuid(),
        updatedById: faker.string.uuid()
    })),
    media: {
        featuredImage: {
            url: faker.internet.url(),
            alt: faker.lorem.sentence(),
            moderationState: 'APPROVED'
        },
        images: Array.from({ length: 30 }, () => ({
            url: faker.internet.url(),
            alt: faker.lorem.sentence(),
            moderationState: 'APPROVED'
        })),
        videos: Array.from({ length: 10 }, () => ({
            url: faker.internet.url(),
            title: faker.lorem.sentence(),
            moderationState: 'APPROVED'
        }))
    },
    capacity: 50000, // Large capacity
    seo: {
        title: 'H'.repeat(60), // Maximum SEO title
        description: 'I'.repeat(160), // Maximum SEO description
        keywords: Array.from({ length: 10 }, () => faker.lorem.word())
    }
});
