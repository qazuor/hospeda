import { faker } from '@faker-js/faker';
import type { TagColorEnum } from '../../src/enums/index.js';
import {
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString
} from './common.fixtures.js';

// UUID used to represent a "SYSTEM" actor in tests (mirrors SYSTEM_USER_ID constant from D-005)
const TEST_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Tag fixtures for testing
 */

/**
 * Create minimal tag summary for list displays
 */
export const createTagSummary = () => ({
    id: faker.string.uuid(),
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['RED', 'BLUE', 'GREEN', 'YELLOW'] as TagColorEnum[]),
    usageCount: faker.number.int({ min: 0, max: 1000 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
});

/**
 * Create tag-specific entity fields (refactored per SPEC-086 D-018).
 * No `slug` (removed), no `notes` (replaced by `description`), added `type` and `ownerId`.
 */
const createTagEntityFields = () => {
    const type = faker.helpers.arrayElement(['INTERNAL', 'SYSTEM', 'USER'] as const);
    const ownerId = type === 'USER' ? faker.string.uuid() : null;
    return {
        type,
        ownerId,
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
        icon: faker.helpers.maybe(() => faker.lorem.word({ length: { min: 2, max: 20 } }), {
            probability: 0.7
        }),
        description: faker.helpers.maybe(() => faker.lorem.sentence(), {
            probability: 0.6
        })
    };
};

export const createValidTag = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createTagEntityFields(),
    ...createBaseLifecycleFields()
});

export const createMinimalTag = () => ({
    id: faker.string.uuid(),
    type: 'SYSTEM' as const,
    ownerId: null,
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
    icon: faker.lorem.word({ length: { min: 2, max: 20 } }),
    description: faker.lorem.paragraph()
});

export const createSystemTag = () => ({
    ...createValidTag(),
    type: 'SYSTEM' as const,
    ownerId: null,
    name: faker.helpers.arrayElement(['Featured', 'Popular', 'New', 'Trending', 'Recommended']),
    color: 'GREY' as TagColorEnum,
    icon: faker.lorem.word({ length: { min: 2, max: 20 } }),
    description: faker.lorem.sentence()
});

export const createTagEdgeCases = () => [
    // Minimum length name
    {
        ...createMinimalTag(),
        name: 'AB' // minimum 2 chars as per schema
    },
    // Maximum length name
    {
        ...createMinimalTag(),
        name: 'A'.repeat(50), // maximum 50 chars as per schema
        description: 'N'.repeat(200) // description has no hard limit — test a long one
    },
    // All optional fields present (USER tag with ownerId)
    {
        ...createComplexTag(),
        type: 'USER' as const,
        ownerId: faker.string.uuid(),
        icon: 'custom-icon-ok',
        description: faker.lorem.sentences(2)
    }
];

export const createInvalidTag = () => ({
    // Missing required fields (type missing)
    name: 'A', // too short (min 2 chars)
    color: 'INVALID_COLOR', // invalid enum
    lifecycleState: 'INVALID_STATE', // invalid enum
    // Invalid types
    icon: 123, // not string
    description: 456, // not string
    // Invalid formats
    id: 'not-uuid',
    createdAt: 'not-date',
    updatedAt: 'not-date',
    createdById: 'not-uuid',
    updatedById: 'not-uuid'
});

export const createTagWithInvalidFields = () => [
    // Too long name
    {
        ...createMinimalTag(),
        name: createTooLongString(51)
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
    // Invalid icon length (too short)
    {
        ...createMinimalTag(),
        icon: 'A' // too short (min 2 chars)
    },
    // Invalid type
    {
        ...createMinimalTag(),
        type: 'INVALID_TYPE'
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
 * Create tags grouped by tag type for testing filtering (D-002).
 */
export const createTagsByType = () => ({
    INTERNAL: [
        { ...createMinimalTag(), type: 'INTERNAL' as const, ownerId: null },
        { ...createMinimalTag(), type: 'INTERNAL' as const, ownerId: null }
    ],
    SYSTEM: [
        { ...createMinimalTag(), type: 'SYSTEM' as const, ownerId: null },
        { ...createMinimalTag(), type: 'SYSTEM' as const, ownerId: null }
    ],
    USER: [
        { ...createMinimalTag(), type: 'USER' as const, ownerId: faker.string.uuid() },
        { ...createMinimalTag(), type: 'USER' as const, ownerId: faker.string.uuid() }
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
 * Create tag create input for CRUD testing (SYSTEM type — no ownerId required).
 */
export const createTagCreateInput = () => ({
    type: 'SYSTEM' as const,
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
    icon: faker.helpers.maybe(() => faker.lorem.word({ length: { min: 2, max: 20 } }), {
        probability: 0.7
    }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 })
});

/**
 * Create USER tag create input for CRUD testing — ownerId is required.
 */
export const createUserTagCreateInput = (ownerId?: string) => ({
    type: 'USER' as const,
    ownerId: ownerId ?? faker.string.uuid(),
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['BLUE', 'GREEN', 'PURPLE'] as TagColorEnum[]),
    lifecycleState: 'ACTIVE',
    icon: faker.helpers.maybe(() => faker.lorem.word({ length: { min: 2, max: 20 } }), {
        probability: 0.5
    }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 })
});

/**
 * Create INTERNAL tag create input for CRUD testing — ownerId must be absent/null.
 */
export const createInternalTagCreateInput = () => ({
    type: 'INTERNAL' as const,
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['RED', 'ORANGE'] as TagColorEnum[]),
    lifecycleState: 'ACTIVE',
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 })
});

/**
 * System user ID constant — mirrors SYSTEM_USER_ID from D-005, used in test assignments.
 */
export { TEST_SYSTEM_USER_ID };

/**
 * Create tag update input for CRUD testing.
 * Note: `type` and `ownerId` are intentionally absent — they are immutable (D-018).
 */
export const createTagUpdateInput = () => ({
    name: faker.lorem.words({ min: 2, max: 3 }).slice(0, 50),
    color: faker.helpers.arrayElement(['BLUE', 'GREEN', 'PURPLE'] as TagColorEnum[]),
    icon: faker.lorem.word({ length: { min: 2, max: 20 } }),
    description: faker.lorem.sentence()
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
