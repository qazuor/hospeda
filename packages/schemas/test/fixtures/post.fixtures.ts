import { faker } from '@faker-js/faker';
import type { PostCategoryEnum } from '@repo/types';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createBaseMediaFields,
    createBaseModerationFields,
    createBaseSeoFields,
    createBaseTagsFields,
    createBaseVisibilityFields,
    createTagFixture,
    createTooLongString,
    createTooShortString
} from './common.fixtures.js';

export const createValidPost = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseSeoFields(),
    ...createBaseMediaFields(),
    ...createBaseTagsFields(),
    ...createBaseAdminFields(),

    // Post-specific fields
    slug: faker.helpers.slugify(faker.lorem.words(3)).toLowerCase(),
    title: faker.lorem.sentence(),
    summary: faker.lorem.paragraph(),
    content: faker.lorem.paragraphs(5),
    category: faker.helpers.arrayElement([
        'TOURISM',
        'GASTRONOMY',
        'CULTURE',
        'NATURE',
        'TIPS'
    ]) as PostCategoryEnum,
    authorId: faker.string.uuid(),

    // Optional relations
    sponsorshipId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.3 }),
    relatedDestinationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.4 }),
    relatedAccommodationId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.2 }),
    relatedEventId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.1 }),

    // Flags
    isFeatured: faker.datatype.boolean(),
    isNews: faker.datatype.boolean(),
    isFeaturedInWebsite: faker.datatype.boolean(),

    // Dates
    publishedAt: faker.helpers.maybe(() => faker.date.recent(), { probability: 0.8 }),
    expiresAt: faker.helpers.maybe(() => faker.date.future(), { probability: 0.2 }),

    // Stats
    likes: faker.number.int({ min: 0, max: 1000 }),
    comments: faker.number.int({ min: 0, max: 200 }),
    shares: faker.number.int({ min: 0, max: 100 }),
    views: faker.number.int({ min: 0, max: 10000 })
});

export const createMinimalPost = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createBaseLifecycleFields(),
    ...createBaseModerationFields(),
    ...createBaseVisibilityFields(),
    ...createBaseSeoFields(),
    ...createBaseMediaFields(),
    ...createBaseAdminFields(),

    // Post-specific required fields
    slug: faker.lorem.slug(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    summary: faker.lorem.paragraph({ min: 1, max: 2 }),
    content: faker.lorem.paragraphs(5, '\n\n'), // Ensure minimum 100 characters
    category: 'TOURISM' as PostCategoryEnum,
    authorId: faker.string.uuid(),

    // Default values for required fields
    isFeatured: false,
    isFeaturedInWebsite: false,
    isNews: false,
    likes: 0,
    comments: 0,
    shares: 0
});

export const createInvalidPost = () => ({
    slug: createTooShortString(),
    title: createTooLongString(200),
    summary: createTooShortString(),
    content: createTooShortString(),
    category: 'INVALID_CATEGORY',
    authorId: 'invalid-uuid',
    likes: -1,
    comments: -1,
    shares: -1,
    views: -1
});

export const createComplexPost = () => ({
    ...createValidPost(),
    content: faker.lorem.paragraphs(20),
    tags: faker.helpers.multiple(() => createTagFixture(), { count: 15 }),
    sponsorshipId: faker.string.uuid(),
    relatedDestinationId: faker.string.uuid(),
    relatedAccommodationId: faker.string.uuid(),
    relatedEventId: faker.string.uuid(),
    isFeatured: true,
    isNews: true,
    isFeaturedInWebsite: true,
    publishedAt: faker.date.recent(),
    expiresAt: faker.date.future(),
    likes: 5000,
    comments: 500,
    shares: 200,
    views: 50000
});

/**
 * Creates edge case post data for testing boundary conditions
 */
export const createPostEdgeCases = (): any => ({
    ...createValidPost(),
    title: 'A'.repeat(3), // Minimum length
    summary: 'B'.repeat(10), // Minimum length
    content: 'C'.repeat(100), // Minimum length for content
    tags: [createTagFixture(), createTagFixture(), createTagFixture()], // Minimum tag objects
    seo: {
        title: 'D'.repeat(30), // Minimum SEO title length
        description: 'E'.repeat(70), // Minimum SEO description length
        keywords: ['min']
    }
});
