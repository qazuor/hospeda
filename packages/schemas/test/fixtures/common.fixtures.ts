import { faker } from '@faker-js/faker';
import { ModerationStatusEnum, VisibilityEnum } from '../../src/enums/index.js';
// Types are inferred from the faker values, no explicit imports needed

/**
 * Common fixtures for base field objects and shared schemas
 */

export const createBaseIdFields = () => ({
    id: faker.string.uuid()
});

export const createBaseAuditFields = () => ({
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),
    deletedAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.1 }),
    deletedById: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.1 })
});

export const createBaseLifecycleFields = () => ({
    lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED'])
});

export const createBaseModerationFields = () => ({
    moderationState: faker.helpers.arrayElement(Object.values(ModerationStatusEnum))
});

export const createBaseVisibilityFields = () => ({
    visibility: faker.helpers.arrayElement(Object.values(VisibilityEnum))
});

export const createBaseReviewFields = () => ({
    reviewsCount: faker.number.int({ min: 0, max: 1000 }),
    averageRating: faker.number.float({ min: 1, max: 5, fractionDigits: 1 })
});

export const createBaseSeoFields = () => ({
    seo: faker.helpers.maybe(
        () => ({
            title: faker.lorem.words({ min: 8, max: 12 }).padEnd(30, ' ').slice(0, 60), // 30-60 chars
            description: faker.lorem.paragraph().padEnd(70, ' ').slice(0, 160), // 70-160 chars
            keywords: faker.helpers.multiple(() => faker.lorem.word(), {
                count: { min: 3, max: 8 }
            })
        }),
        { probability: 0.7 }
    )
});

export const createBaseContactFields = () => ({
    contactInfo: faker.helpers.maybe(
        () => ({
            personalEmail: faker.helpers.maybe(() => faker.internet.email(), { probability: 0.6 }),
            workEmail: faker.helpers.maybe(() => faker.internet.email(), { probability: 0.4 }),
            homePhone: faker.helpers.maybe(() => '+15550123', { probability: 0.3 }),
            workPhone: faker.helpers.maybe(() => '+15550456', { probability: 0.4 }),
            mobilePhone: '+15550789', // Required field
            website: faker.helpers.maybe(() => faker.internet.url(), { probability: 0.6 }),
            preferredEmail: faker.helpers.maybe(
                () => faker.helpers.arrayElement(['HOME', 'WORK']),
                { probability: 0.5 }
            ),
            preferredPhone: faker.helpers.maybe(
                () => faker.helpers.arrayElement(['HOME', 'WORK', 'MOBILE']),
                { probability: 0.5 }
            )
        }),
        { probability: 0.8 }
    )
});

export const createBaseLocationFields = () => ({
    location: faker.helpers.maybe(
        () => ({
            state: faker.location.state(),
            zipCode: faker.location.zipCode(),
            country: faker.location.country().slice(0, 50),
            coordinates: {
                lat: faker.location.latitude().toString(),
                long: faker.location.longitude().toString()
            },
            street: faker.location.street(),
            number: faker.number.int({ min: 1, max: 9999 }).toString(),
            floor: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 20 }).toString(), {
                probability: 0.4
            }),
            apartment: faker.helpers.maybe(() => faker.string.alphanumeric(3), {
                probability: 0.3
            }),
            neighborhood: faker.helpers.maybe(() => faker.location.county(), { probability: 0.6 }),
            city: faker.location.city(),
            department: faker.helpers.maybe(() => faker.location.state(), { probability: 0.5 })
        }),
        { probability: 0.9 }
    )
});

export const createBaseMediaFields = () => ({
    media: faker.helpers.maybe(
        () => ({
            featuredImage: faker.helpers.maybe(
                () => ({
                    url: faker.image.url(),
                    caption: faker.helpers.maybe(() => faker.lorem.sentence().slice(0, 100), {
                        probability: 0.7
                    }),
                    description: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 300), {
                        probability: 0.5
                    }),
                    moderationState: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED'])
                }),
                { probability: 0.8 }
            ),
            gallery: faker.helpers.maybe(
                () =>
                    faker.helpers.multiple(
                        () => ({
                            url: faker.image.url(),
                            caption: faker.helpers.maybe(
                                () => faker.lorem.sentence().slice(0, 100),
                                {
                                    probability: 0.6
                                }
                            ),
                            description: faker.helpers.maybe(
                                () => faker.lorem.paragraph().slice(0, 300),
                                {
                                    probability: 0.4
                                }
                            ),
                            moderationState: faker.helpers.arrayElement([
                                'PENDING',
                                'APPROVED',
                                'REJECTED'
                            ])
                        }),
                        { count: { min: 1, max: 5 } }
                    ),
                { probability: 0.8 }
            ),
            videos: faker.helpers.maybe(
                () =>
                    faker.helpers.multiple(
                        () => ({
                            url: faker.internet.url(),
                            caption: faker.helpers.maybe(
                                () => faker.lorem.sentence().slice(0, 100),
                                {
                                    probability: 0.6
                                }
                            ),
                            description: faker.helpers.maybe(
                                () => faker.lorem.paragraph().slice(0, 300),
                                {
                                    probability: 0.4
                                }
                            ),
                            moderationState: faker.helpers.arrayElement([
                                'PENDING',
                                'APPROVED',
                                'REJECTED'
                            ])
                        }),
                        { count: { min: 1, max: 3 } }
                    ),
                { probability: 0.4 }
            )
        }),
        { probability: 0.9 }
    )
});

// createBaseEntityFields removed - entities should define their own specific fields

export const createBaseSocialFields = () => ({
    socialNetworks: faker.helpers.maybe(
        () => ({
            facebook: faker.helpers.maybe(() => 'https://facebook.com/example', {
                probability: 0.5
            }),
            instagram: faker.helpers.maybe(() => 'https://instagram.com/example', {
                probability: 0.6
            }),
            twitter: faker.helpers.maybe(() => 'https://twitter.com/example', { probability: 0.4 }),
            linkedIn: faker.helpers.maybe(() => 'https://linkedin.com/in/example', {
                probability: 0.3
            }),
            tiktok: faker.helpers.maybe(() => 'https://tiktok.com/@example', { probability: 0.3 }),
            youtube: faker.helpers.maybe(() => 'https://youtube.com/c/example', {
                probability: 0.2
            })
        }),
        { probability: 0.6 }
    )
});

export const createBaseTagsFields = () => ({
    tags: faker.helpers.maybe(
        () => faker.helpers.multiple(() => createTagFixture(), { count: { min: 1, max: 8 } }),
        { probability: 0.7 }
    )
});

/**
 * Creates a complete Tag fixture
 */
export const createTagFixture = () => ({
    id: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid(),
    deletedAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.1 }),
    deletedById: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.1 }),
    lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    name: faker.lorem.word().padEnd(2, 'x'), // Ensure minimum 2 characters
    slug: faker.helpers.slugify(faker.lorem.word().padEnd(2, 'x')),
    color: faker.helpers.arrayElement([
        'RED',
        'BLUE',
        'GREEN',
        'YELLOW',
        'PURPLE',
        'ORANGE',
        'PINK',
        'BROWN',
        'GREY',
        'WHITE',
        'CYAN',
        'MAGENTA',
        'LIGHT_BLUE',
        'LIGHT_GREEN'
    ]),
    icon: faker.helpers.maybe(() => faker.lorem.word().padEnd(2, 'x'), { probability: 0.6 }),
    notes: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 300), { probability: 0.4 })
});

export const createBaseAdminFields = () => ({
    adminInfo: faker.helpers.maybe(
        () => ({
            notes: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 300), {
                probability: 0.5
            }),
            favorite: faker.datatype.boolean()
        }),
        { probability: 0.6 }
    )
});

/**
 * Creates FAQ fixtures using the new BaseFaq structure
 * Note: This creates the FAQ data structure without entity-specific IDs
 * Entity-specific fixtures should extend this with their own ID and relation fields
 */
export const createBaseFaqFields = () => ({
    faqs: faker.helpers.maybe(
        () =>
            faker.helpers.multiple(
                () => ({
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
        { probability: 0.6 }
    )
});

// Utility functions for creating invalid data
export const createInvalidEmail = () =>
    faker.helpers.arrayElement([
        'invalid-email',
        '@invalid.com',
        'test@',
        'test..test@example.com',
        ''
    ]);

export const createInvalidUrl = () =>
    faker.helpers.arrayElement([
        'not-a-url',
        'http://',
        'ftp://invalid',
        '',
        'javascript:alert(1)'
    ]);

export const createInvalidUuid = () =>
    faker.helpers.arrayElement(['not-a-uuid', '123', '', 'invalid-uuid-format']);

// Utility functions for string length testing

/**
 * Creates a valid location object for testing
 */
export const createValidLocation = () => ({
    state: faker.location.state(),
    zipCode: faker.location.zipCode(),
    country: faker.location.country().slice(0, 50),
    coordinates: {
        lat: faker.location.latitude().toString(),
        long: faker.location.longitude().toString()
    },
    street: faker.location.street(),
    number: faker.number.int({ min: 1, max: 9999 }).toString(),
    floor: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 20 }).toString(), {
        probability: 0.4
    }),
    apartment: faker.helpers.maybe(() => faker.string.alphanumeric(3), {
        probability: 0.3
    }),
    neighborhood: faker.helpers.maybe(() => faker.location.county(), { probability: 0.6 }),
    city: faker.location.city(),
    department: faker.helpers.maybe(() => faker.location.state(), { probability: 0.5 })
});

export const createTooLongString = (length: number): string => {
    return 'A'.repeat(length);
};

export const createTooShortString = (length?: number): string => {
    return length ? 'A'.repeat(length) : '';
};

export const createBasePaginationParams = () => ({
    page: faker.number.int({ min: 1, max: 10 }),
    pageSize: faker.number.int({ min: 10, max: 50 })
});

/**
 * Creates a complete pagination object for PaginationResultSchema responses
 */
export const createPaginationMetadata = (options?: {
    page?: number;
    pageSize?: number;
    total?: number;
}) => {
    const page = options?.page ?? faker.number.int({ min: 1, max: 10 });
    const pageSize = options?.pageSize ?? faker.number.int({ min: 10, max: 50 });
    const total = options?.total ?? faker.number.int({ min: 0, max: 1000 });
    const totalPages = Math.ceil(total / pageSize);

    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
    };
};

/**
 * Creates a complete paginated response structure
 */
export const createPaginatedResponse = <T>(
    data: T[],
    options?: {
        page?: number;
        pageSize?: number;
        total?: number;
    }
) => ({
    data,
    pagination: createPaginationMetadata({
        ...options,
        total: options?.total ?? data.length
    })
});
