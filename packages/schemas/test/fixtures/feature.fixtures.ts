import { faker } from '@faker-js/faker';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseIdFields,
    createBaseLifecycleFields,
    createTooLongString
} from './common.fixtures.js';

/**
 * Feature fixtures for testing
 */

/**
 * Create feature-specific entity fields
 */
const createFeatureEntityFields = () => ({
    slug: faker.lorem.slug(3),
    name: faker.lorem.words({ min: 2, max: 5 }).slice(0, 100),
    description: faker.lorem.paragraph().slice(0, 500),
    icon: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.7 }),
    isBuiltin: faker.datatype.boolean(),
    isFeatured: faker.datatype.boolean()
});

export const createValidFeature = () => ({
    ...createBaseIdFields(),
    ...createBaseAuditFields(),
    ...createFeatureEntityFields(),
    ...createBaseLifecycleFields(),
    ...createBaseAdminFields()
});

export const createMinimalFeature = () => ({
    id: faker.string.uuid(),
    slug: faker.lorem.slug(3),
    name: faker.lorem.words({ min: 2, max: 3 }),
    lifecycleState: 'ACTIVE',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    createdById: faker.string.uuid(),
    updatedById: faker.string.uuid()
});

export const createComplexFeature = () => ({
    ...createValidFeature(),
    description: faker.lorem.paragraphs(2),
    icon: 'feature-icon',
    isBuiltin: true,
    isFeatured: true
});

export const createFeatureEdgeCases = () => [
    // Minimum length strings
    {
        ...createMinimalFeature(),
        slug: 'abc', // minimum 3 chars
        name: 'Wi' // minimum 2 chars
    },
    // Maximum length strings
    {
        ...createMinimalFeature(),
        slug: 'a'.repeat(100), // maximum 100 chars
        name: 'A'.repeat(100), // maximum 100 chars
        description: 'D'.repeat(500) // maximum 500 chars
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
    // Too long strings
    {
        ...createMinimalFeature(),
        slug: createTooLongString(101),
        name: createTooLongString(101),
        description: createTooLongString(501)
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
