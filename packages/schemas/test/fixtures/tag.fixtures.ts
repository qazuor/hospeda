import { faker } from '@faker-js/faker';
import type { TagColorEnum } from '@repo/types';
import {
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString
} from './common.fixtures.js';

/**
 * Tag fixtures for testing
 */

/**
 * Create tag-specific entity fields
 */
const createTagEntityFields = () => ({
    slug: faker.lorem.slug(2),
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50), // min 2 chars as per schema
    color: faker.helpers.arrayElement([
        'RED',
        'BLUE',
        'GREEN',
        'YELLOW',
        'ORANGE',
        'PURPLE',
        'PINK',
        'BROWN',
        'GREY',
        'WHITE',
        'CYAN',
        'MAGENTA',
        'LIGHT_BLUE',
        'LIGHT_GREEN'
    ] as TagColorEnum[]),
    icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }),
    notes: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 300), {
        probability: 0.6
    })
});

export const createValidTag = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createTagEntityFields(),
    ...createBaseLifecycleFields()
});

export const createMinimalTag = () => ({
    id: faker.string.uuid(),
    slug: faker.lorem.slug(2),
    name: faker.lorem.words({ min: 2, max: 2 }), // min 2 chars as per schema
    color: 'BLUE' as TagColorEnum,
    lifecycleState: 'ACTIVE',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexTag = () => ({
    ...createValidTag(),
    icon: faker.lorem.word(),
    notes: faker.lorem.paragraph().slice(0, 300)
});

export const createSystemTag = () => ({
    ...createValidTag(),
    name: faker.helpers.arrayElement(['Featured', 'Popular', 'New', 'Trending', 'Recommended']),
    color: 'GREY' as TagColorEnum,
    icon: faker.lorem.word(),
    notes: faker.lorem.sentence()
});

export const createTagEdgeCases = () => [
    // Minimum length strings
    {
        ...createMinimalTag(),
        slug: 'a', // minimum 1 char as per schema
        name: 'AB' // minimum 2 chars as per schema
    },
    // Maximum length strings
    {
        ...createMinimalTag(),
        slug: 'a'.repeat(50), // reasonable length
        name: 'A'.repeat(50), // maximum 50 chars as per schema
        notes: 'N'.repeat(300) // maximum 300 chars as per schema
    },
    // All optional fields present
    {
        ...createComplexTag(),
        icon: 'custom-icon',
        notes: faker.lorem.sentences(3).slice(0, 300)
    }
];

export const createInvalidTag = () => ({
    // Missing required fields
    slug: '', // empty (too short)
    name: 'A', // too short (min 2 chars)
    color: 'INVALID_COLOR', // invalid enum
    lifecycleState: 'INVALID_STATE', // invalid enum
    // Invalid types
    icon: 123, // not string
    notes: 456, // not string
    // Invalid formats
    id: 'not-uuid',
    createdAt: 'not-date',
    updatedAt: 'not-date',
    createdById: 'not-uuid',
    updatedById: 'not-uuid'
});

export const createTagWithInvalidFields = () => [
    // Too long strings
    {
        ...createMinimalTag(),
        name: createTooLongString(51),
        notes: createTooLongString(301)
    },
    // Invalid color
    {
        ...createMinimalTag(),
        color: 'RAINBOW'
    },
    // Invalid lifecycle state
    {
        ...createMinimalTag(),
        lifecycleState: 'INVALID_LIFECYCLE'
    },
    // Invalid icon length
    {
        ...createMinimalTag(),
        icon: 'A' // too short (min 2 chars)
    }
];

/**
 * Create multiple tags for testing arrays
 */
export const createMultipleTags = (count = 5) =>
    Array.from({ length: count }, () => createValidTag());

/**
 * Create tags by color for testing grouping
 */
export const createTagsByColor = () => ({
    RED: [
        { ...createValidTag(), color: 'RED' as TagColorEnum },
        { ...createValidTag(), color: 'RED' as TagColorEnum }
    ],
    BLUE: [{ ...createValidTag(), color: 'BLUE' as TagColorEnum }],
    GREEN: [
        { ...createValidTag(), color: 'GREEN' as TagColorEnum },
        { ...createValidTag(), color: 'GREEN' as TagColorEnum },
        { ...createValidTag(), color: 'GREEN' as TagColorEnum }
    ]
});

/**
 * Create tags by type for testing filtering
 */
export const createTagsByType = () => ({
    withIcon: [
        { ...createValidTag(), icon: 'icon1' },
        { ...createValidTag(), icon: 'icon2' }
    ],
    withNotes: [
        { ...createValidTag(), notes: 'Note 1' },
        { ...createValidTag(), notes: 'Note 2' },
        { ...createValidTag(), notes: 'Note 3' }
    ]
});

/**
 * Create tags with different characteristics for testing
 */
export const createTagsByCharacteristics = () => [
    { ...createValidTag(), name: 'Short Tag', color: 'RED' as TagColorEnum },
    { ...createValidTag(), name: 'Medium Length Tag', color: 'BLUE' as TagColorEnum },
    { ...createValidTag(), name: 'Very Long Tag Name Here', color: 'GREEN' as TagColorEnum },
    { ...createValidTag(), name: 'Another Tag', color: 'YELLOW' as TagColorEnum },
    { ...createValidTag(), name: 'Final Tag', color: 'PURPLE' as TagColorEnum }
];

/**
 * Create tag relation data for entity-tag relationships
 */
export const createTagRelation = (entityType = 'accommodation') => ({
    entityId: faker.string.uuid(),
    entityType,
    tagId: faker.string.uuid(),
    addedAt: faker.date.recent(),
    addedById: faker.string.uuid()
});

/**
 * Create tag create input for CRUD testing
 */
export const createTagCreateInput = () => ({
    slug: faker.lorem.slug(2),
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement([
        'RED',
        'BLUE',
        'GREEN',
        'YELLOW',
        'ORANGE',
        'PURPLE'
    ] as TagColorEnum[]),
    lifecycleState: 'ACTIVE',
    icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }),
    notes: faker.helpers.maybe(() => faker.lorem.paragraph().slice(0, 300), {
        probability: 0.6
    })
});

/**
 * Create tag update input for CRUD testing
 */
export const createTagUpdateInput = () => ({
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['BLUE', 'GREEN', 'PURPLE'] as TagColorEnum[]),
    icon: faker.lorem.word(),
    notes: faker.lorem.sentence().slice(0, 300)
});

/**
 * Create tag entity relation for testing
 */
export const createTagEntityRelation = () => ({
    tagId: faker.string.uuid(),
    entityId: faker.string.uuid(),
    entityType: faker.helpers.arrayElement([
        'accommodation',
        'destination',
        'post',
        'event',
        'user'
    ])
});

/**
 * Create tag summary for query testing
 */
export const createTagSummary = () => ({
    id: faker.string.uuid(),
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['RED', 'BLUE', 'GREEN', 'YELLOW'] as TagColorEnum[]),
    usageCount: faker.number.int({ min: 0, max: 1000 })
});

/**
 * Create tag filters for query testing
 */
export const createTagFilters = () => ({
    color: faker.helpers.maybe(
        () => `#${faker.color.rgb({ format: 'hex', casing: 'upper' }).slice(1)}`
    ),
    minUsageCount: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 10 })),
    maxUsageCount: faker.helpers.maybe(() => faker.number.int({ min: 50, max: 100 })),
    isUnused: faker.helpers.maybe(() => faker.datatype.boolean()),
    usedInAccommodations: faker.helpers.maybe(() => faker.datatype.boolean()),
    usedInDestinations: faker.helpers.maybe(() => faker.datatype.boolean()),
    usedInPosts: faker.helpers.maybe(() => faker.datatype.boolean()),
    nameStartsWith: faker.helpers.maybe(() => faker.lorem.word()),
    nameContains: faker.helpers.maybe(() => faker.lorem.word())
});

/**
 * Create tag stats for testing
 */
export const createTagStats = () => ({
    totalTags: faker.number.int({ min: 0, max: 1000 }),
    unusedTags: faker.number.int({ min: 0, max: 100 }),
    totalUsages: faker.number.int({ min: 0, max: 5000 }),
    averageUsagePerTag: faker.number.float({ min: 0, max: 50, fractionDigits: 2 }),
    tagsCreatedToday: faker.number.int({ min: 0, max: 10 }),
    tagsCreatedThisWeek: faker.number.int({ min: 0, max: 50 }),
    tagsCreatedThisMonth: faker.number.int({ min: 0, max: 200 }),
    averageNameLength: faker.number.float({ min: 5, max: 25, fractionDigits: 1 })
});
