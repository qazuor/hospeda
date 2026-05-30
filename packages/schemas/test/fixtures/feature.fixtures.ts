import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createPaginatedResponse,
    createTooLongString
} from './common.fixtures.js';

/**
 * Feature fixtures for testing
 */

/**
 * Create feature-specific entity fields.
 * name and description are I18nText objects ({es, en, pt}).
 * All locales default to the same Spanish value as a placeholder.
 */
const createFeatureEntityFields = () => {
    const nameEs = faker.lorem.words({ min: 2, max: 5 }).slice(0, 100);
    const descEs = faker.lorem.paragraph().slice(0, 490);
    return {
        slug: faker.lorem.slug(3),
        name: { es: nameEs, en: nameEs, pt: nameEs },
        description: { es: descEs, en: descEs, pt: descEs },
        icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }),
        isBuiltin: faker.datatype.boolean(),
        isFeatured: faker.datatype.boolean()
    };
};

export const createValidFeature = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createFeatureEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields()
});

export const createMinimalFeature = () => {
    const nameEs = faker.lorem.words({ min: 2, max: 3 });
    return {
        id: faker.string.uuid(),
        slug: faker.lorem.slug(3),
        name: { es: nameEs, en: nameEs, pt: nameEs },
        lifecycleState: 'ACTIVE',
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        createdById: faker.string.uuid(),
        updatedById: faker.string.uuid()
    };
};

export const createComplexFeature = () => {
    const descEs = faker.lorem.sentence().slice(0, 490);
    return {
        ...createValidFeature(),
        description: { es: descEs, en: descEs, pt: descEs },
        icon: 'feature-icon',
        isBuiltin: true,
        isFeatured: true
    };
};

export const createFeatureEdgeCases = () => [
    // Minimum length strings
    {
        ...createMinimalFeature(),
        slug: 'abc', // minimum 3 chars
        name: { es: 'Wi', en: 'Wi', pt: 'Wi' } // minimum 2 chars per locale
    },
    // Maximum length strings
    {
        ...createMinimalFeature(),
        slug: 'a'.repeat(100), // maximum 100 chars
        name: { es: 'A'.repeat(100), en: 'A'.repeat(100), pt: 'A'.repeat(100) }, // maximum 100 chars
        description: { es: 'D'.repeat(500), en: 'D'.repeat(500), pt: 'D'.repeat(500) } // maximum 500 chars
    },
    // All optional fields present
    {
        ...createComplexFeature(),
        icon: 'custom-feature-icon',
        isAvailable: false,
        priority: 'CRITICAL',
        displayOrder: 999
    }
];

export const createInvalidFeature = () => ({
    // Missing required fields
    slug: 'ab', // too short (min 3)
    name: '', // empty
    lifecycleState: 'INVALID_STATE', // invalid enum
    // Invalid types
    isBuiltin: 'not-boolean',
    isFeatured: 'not-boolean',
    // Invalid formats
    id: 'not-uuid',
    createdAt: 'not-date',
    updatedAt: 'not-date',
    createdById: 'not-uuid',
    updatedById: 'not-uuid'
});

export const createFeatureWithInvalidFields = () => [
    // Invalid slug format
    {
        ...createMinimalFeature(),
        slug: 'Invalid Slug With Spaces'
    },
    // Too long strings — name/description are I18nText objects; each locale must violate max
    {
        ...createMinimalFeature(),
        slug: createTooLongString(101),
        name: {
            es: createTooLongString(101),
            en: createTooLongString(101),
            pt: createTooLongString(101)
        },
        description: {
            es: createTooLongString(501),
            en: createTooLongString(501),
            pt: createTooLongString(501)
        }
    },
    // Invalid boolean
    {
        ...createMinimalFeature(),
        isBuiltin: 'not-boolean'
    },
    // Invalid lifecycle state
    {
        ...createMinimalFeature(),
        lifecycleState: 'INVALID_LIFECYCLE'
    }
];

/**
 * Create feature relation data for accommodation-feature relationships
 */
export const createFeatureRelation = () => ({
    accommodationId: faker.string.uuid(),
    featureId: faker.string.uuid(),
    hostReWriteName: faker.helpers.maybe(() => faker.lorem.words({ min: 3, max: 8 }), {
        probability: 0.4
    }),
    hostReWriteDescription: faker.helpers.maybe(() => faker.lorem.paragraph(), {
        probability: 0.3
    }),
    isHighlighted: faker.datatype.boolean(),
    customValue: faker.helpers.maybe(() => faker.lorem.words({ min: 1, max: 3 }), {
        probability: 0.2
    })
});

/**
 * Create multiple features for testing arrays
 */
export const createMultipleFeatures = (count = 3) =>
    Array.from({ length: count }, () => createValidFeature());

/**
 * Create features by priority for testing grouping
 */
export const createFeaturesByPriority = () => ({
    CRITICAL: [
        { ...createValidFeature(), priority: 'CRITICAL' },
        { ...createValidFeature(), priority: 'CRITICAL' }
    ],
    HIGH: [{ ...createValidFeature(), priority: 'HIGH' }],
    MEDIUM: [
        { ...createValidFeature(), priority: 'MEDIUM' },
        { ...createValidFeature(), priority: 'MEDIUM' }
    ],
    LOW: [{ ...createValidFeature(), priority: 'LOW' }]
});

/**
 * Create features by availability for testing filtering
 */
export const createFeaturesByAvailability = () => ({
    available: [
        { ...createValidFeature(), isAvailable: true },
        { ...createValidFeature(), isAvailable: true },
        { ...createValidFeature(), isAvailable: true }
    ],
    unavailable: [
        { ...createValidFeature(), isAvailable: false },
        { ...createValidFeature(), isAvailable: false }
    ]
});

// ============================================================================
// CRUD FIXTURES
// ============================================================================

export const createValidFeatureCreateInput = () => {
    const { id, createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById, ...input } =
        createValidFeature();
    return input;
};

export const createMinimalFeatureCreateInput = () => {
    const { id, createdAt, updatedAt, createdById, updatedById, ...input } = createMinimalFeature();
    return input;
};

export const createValidFeatureUpdateInput = () => {
    const nameEs = faker.lorem.words({ min: 2, max: 5 }).slice(0, 100);
    const descEs = faker.lorem.paragraph().slice(0, 490);
    return {
        name: { es: nameEs, en: nameEs, pt: nameEs },
        description: { es: descEs, en: descEs, pt: descEs },
        icon: faker.lorem.word(),
        isBuiltin: faker.datatype.boolean(),
        isFeatured: faker.datatype.boolean(),
        // TODO usar el enum
        lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    };
};

export const createPartialFeatureUpdateInput = () => {
    const nameEs = faker.lorem.words({ min: 2, max: 3 });
    const descEs = faker.lorem.sentence();
    return {
        name: { es: nameEs, en: nameEs, pt: nameEs },
        description: { es: descEs, en: descEs, pt: descEs }
    };
};

// ============================================================================
// QUERY FIXTURES
// ============================================================================

export const createValidFeatureFilters = () => ({
    category: faker.lorem.word(),
    icon: faker.lorem.word(),
    isBuiltin: faker.datatype.boolean(),
    isFeatured: faker.datatype.boolean(),
    isAvailable: faker.datatype.boolean(),
    q: faker.lorem.words(2)
});

export const createValidFeatureSearchInput = () => ({
    pagination: {
        page: faker.number.int({ min: 1, max: 10 }),
        pageSize: faker.number.int({ min: 10, max: 50 })
    },
    filters: createValidFeatureFilters()
});

export const createValidFeatureListInput = () => ({
    page: faker.number.int({ min: 1, max: 10 }),
    pageSize: faker.number.int({ min: 10, max: 50 }),
    filters: {
        category: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.5 }),
        isBuiltin: faker.helpers.maybe(() => faker.datatype.boolean(), { probability: 0.5 })
    }
});

// ============================================================================
// OUTPUT FIXTURES
// ============================================================================

export const createFeatureListOutput = () => {
    const features = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => {
        const nameEs = faker.lorem.words({ min: 2, max: 5 });
        const descEs = faker.lorem.paragraph().slice(0, 490);
        return {
            id: faker.string.uuid(),
            slug: faker.lorem.slug(3),
            name: { es: nameEs, en: nameEs, pt: nameEs },
            description: { es: descEs, en: descEs, pt: descEs },
            icon: faker.lorem.word(),
            isBuiltin: faker.datatype.boolean(),
            isFeatured: faker.datatype.boolean(),
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
            lifecycleState: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'ARCHIVED'])
        };
    });

    return createPaginatedResponse(features);
};

export const createFeatureSearchOutput = () => ({
    ...createFeatureListOutput(),
    query: faker.lorem.words(2)
});

export const createFeatureSummaryOutput = () => ({
    totalFeatures: faker.number.int({ min: 10, max: 1000 }),
    activeFeatures: faker.number.int({ min: 5, max: 500 }),
    builtinFeatures: faker.number.int({ min: 2, max: 100 }),
    featuredFeatures: faker.number.int({ min: 1, max: 50 })
});

export const createFeatureStatsOutput = () => ({
    totalFeatures: faker.number.int({ min: 0, max: 1000 }),
    availableFeatures: faker.number.int({ min: 0, max: 800 }),
    unavailableFeatures: faker.number.int({ min: 0, max: 200 }),
    unusedFeatures: faker.number.int({ min: 0, max: 100 }),
    totalUsages: faker.number.int({ min: 0, max: 5000 }),
    averageUsagePerFeature: faker.number.float({ min: 0, max: 50, fractionDigits: 2 }),
    averagePriority: faker.number.float({ min: 0, max: 100, fractionDigits: 1 }),
    totalCategories: faker.number.int({ min: 1, max: 20 }),
    priorityDistribution: {
        critical: faker.number.int({ min: 0, max: 10 }),
        high: faker.number.int({ min: 0, max: 20 }),
        medium: faker.number.int({ min: 0, max: 30 }),
        low: faker.number.int({ min: 0, max: 40 }),
        minimal: faker.number.int({ min: 0, max: 50 })
    },
    categoryDistribution: [
        {
            category: faker.lorem.word(),
            count: faker.number.int({ min: 0, max: 100 }),
            availableCount: faker.number.int({ min: 0, max: 80 }),
            totalUsage: faker.number.int({ min: 0, max: 500 }),
            averagePriority: faker.number.float({ min: 0, max: 100, fractionDigits: 1 })
        }
    ],
    mostUsedFeatures: [
        {
            id: faker.string.uuid(),
            name: (() => {
                const n = faker.lorem.words({ min: 2, max: 4 });
                return { es: n, en: n, pt: n };
            })(),
            category: faker.lorem.word(),
            usageCount: faker.number.int({ min: 1, max: 100 }),
            priority: faker.number.int({ min: 0, max: 100 })
        }
    ]
});
