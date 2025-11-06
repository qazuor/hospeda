/**
 * Test Fixtures and Data Factories
 *
 * This file demonstrates patterns for creating reusable test data:
 * - Factory functions for entities
 * - Builder pattern for complex objects
 * - Data generators for realistic test data
 * - Fixture management
 *
 * Using factories and fixtures makes tests more maintainable by
 * centralizing test data creation and providing sensible defaults.
 */

import type { Category, CategoryIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '../../../src/types';

// ============================================================================
// SIMPLE FACTORY FUNCTIONS
// ============================================================================

/**
 * Simple counter for generating unique IDs in tests
 */
let idCounter = 0;

/**
 * Generates a mock ID with optional prefix
 */
export function getMockId(prefix: string = 'test', suffix?: string): string {
    idCounter++;
    return suffix ? `${prefix}_${suffix}` : `${prefix}_${idCounter}`;
}

/**
 * Resets ID counter (call in beforeEach if needed)
 */
export function resetMockIdCounter(): void {
    idCounter = 0;
}

// ============================================================================
// ENTITY FACTORIES - SIMPLE APPROACH
// ============================================================================

/**
 * Creates a mock Category with default values
 * Accepts partial overrides for specific test cases
 */
export function createMockCategory(overrides?: Partial<Category>): Category {
    const now = new Date();

    return {
        // Primary fields
        id: getMockId('category') as CategoryIdType,
        name: 'Test Category',
        slug: 'test-category',
        description: 'A test category for testing purposes',
        isActive: true,

        // Lifecycle
        lifecycleState: 'published',

        // Audit fields
        createdAt: now,
        updatedAt: now,
        createdById: getMockId('user'),
        updatedById: getMockId('user'),
        deletedAt: null,
        deletedById: null,

        // Admin info
        adminInfo: null,

        // Override with provided values
        ...overrides
    };
}

/**
 * Creates multiple mock categories at once
 */
export function createMockCategories(count: number, overrides?: Partial<Category>): Category[] {
    return Array.from({ length: count }, (_, index) =>
        createMockCategory({
            ...overrides,
            name: `Category ${index + 1}`,
            slug: `category-${index + 1}`
        })
    );
}

// ============================================================================
// ACTOR FACTORIES
// ============================================================================

/**
 * Creates a mock Actor with default values
 */
export function createMockActor(overrides?: Partial<Actor>): Actor {
    return {
        id: getMockId('user'),
        role: RoleEnum.USER,
        permissions: [],
        ...overrides
    };
}

/**
 * Creates a mock admin actor
 */
export function createAdminActor(overrides?: Partial<Actor>): Actor {
    return createMockActor({
        id: getMockId('user', 'admin'),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.CATEGORY_CREATE,
            PermissionEnum.CATEGORY_UPDATE,
            PermissionEnum.CATEGORY_DELETE,
            PermissionEnum.CATEGORY_VIEW
        ],
        ...overrides
    });
}

/**
 * Creates a mock guest actor (anonymous)
 */
export function createGuestActor(): Actor {
    return {
        id: '',
        role: RoleEnum.GUEST,
        permissions: []
    };
}

/**
 * Creates a mock host actor
 */
export function createHostActor(overrides?: Partial<Actor>): Actor {
    return createMockActor({
        id: getMockId('user', 'host'),
        role: RoleEnum.HOST,
        permissions: [
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.ACCOMMODATION_DELETE_OWN
        ],
        ...overrides
    });
}

// ============================================================================
// BUILDER PATTERN - FOR COMPLEX OBJECTS
// ============================================================================

/**
 * Builder for creating complex Category objects fluently
 *
 * @example
 * const category = new CategoryBuilder()
 *   .withName('Hotels')
 *   .withSlug('hotels')
 *   .published()
 *   .build();
 */
export class CategoryBuilder {
    private category: Partial<Category> = {};

    constructor() {
        // Start with defaults from factory
        this.category = createMockCategory();
    }

    withId(id: CategoryIdType): this {
        this.category.id = id;
        return this;
    }

    withName(name: string): this {
        this.category.name = name;
        return this;
    }

    withSlug(slug: string): this {
        this.category.slug = slug;
        return this;
    }

    withDescription(description: string): this {
        this.category.description = description;
        return this;
    }

    active(): this {
        this.category.isActive = true;
        return this;
    }

    inactive(): this {
        this.category.isActive = false;
        return this;
    }

    published(): this {
        this.category.lifecycleState = 'published';
        return this;
    }

    draft(): this {
        this.category.lifecycleState = 'draft';
        return this;
    }

    archived(): this {
        this.category.lifecycleState = 'archived';
        return this;
    }

    deleted(): this {
        this.category.deletedAt = new Date();
        this.category.deletedById = getMockId('user');
        return this;
    }

    createdBy(userId: string): this {
        this.category.createdById = userId;
        return this;
    }

    createdAt(date: Date): this {
        this.category.createdAt = date;
        return this;
    }

    build(): Category {
        return this.category as Category;
    }
}

// ============================================================================
// REALISTIC DATA GENERATORS
// ============================================================================

/**
 * List of realistic category names
 */
const CATEGORY_NAMES = [
    'Hotels',
    'Hostels',
    'Apartments',
    'Beach Houses',
    'Mountain Cabins',
    'City Center',
    'Luxury Suites',
    'Budget Friendly',
    'Family Friendly',
    'Pet Friendly'
];

/**
 * Generates a realistic slug from text
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Picks a random item from an array
 */
function pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a realistic category
 */
export function generateRealisticCategory(): Category {
    const name = pickRandom(CATEGORY_NAMES);
    const slug = generateSlug(name);

    return createMockCategory({
        name,
        slug,
        description: `All ${name.toLowerCase()} in the region`,
        isActive: Math.random() > 0.2 // 80% active
    });
}

/**
 * Generates multiple realistic categories
 */
export function generateRealisticCategories(count: number): Category[] {
    return Array.from({ length: count }, () => generateRealisticCategory());
}

// ============================================================================
// FIXTURE SETS - PREDEFINED TEST SCENARIOS
// ============================================================================

/**
 * Fixture set for basic CRUD tests
 */
export const basicCrudFixtures = {
    validCreateData: {
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category for testing'
    },

    validUpdateData: {
        name: 'Updated Category',
        description: 'Updated description'
    },

    existingCategory: createMockCategory({
        id: getMockId('category', 'existing') as CategoryIdType,
        name: 'Existing Category',
        slug: 'existing-category'
    })
};

/**
 * Fixture set for permission tests
 */
export const permissionFixtures = {
    adminActor: createAdminActor(),

    userActor: createMockActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.CATEGORY_VIEW] // Read-only
    }),

    guestActor: createGuestActor(),

    hostActor: createHostActor()
};

/**
 * Fixture set for pagination tests
 */
export const paginationFixtures = {
    smallSet: createMockCategories(5),
    mediumSet: createMockCategories(25),
    largeSet: createMockCategories(100),

    paginationParams: {
        page1: { page: 1, pageSize: 10 },
        page2: { page: 2, pageSize: 10 },
        page3: { page: 3, pageSize: 10 },
        customSize: { page: 1, pageSize: 25 }
    }
};

/**
 * Fixture set for lifecycle state tests
 */
export const lifecycleFixtures = {
    draftCategory: createMockCategory({
        lifecycleState: 'draft',
        isActive: false
    }),

    publishedCategory: createMockCategory({
        lifecycleState: 'published',
        isActive: true
    }),

    archivedCategory: createMockCategory({
        lifecycleState: 'archived',
        isActive: false
    }),

    deletedCategory: createMockCategory({
        lifecycleState: 'published',
        deletedAt: new Date(),
        deletedById: getMockId('user')
    })
};

// ============================================================================
// DATE HELPERS FOR FIXTURES
// ============================================================================

/**
 * Creates a date in the past
 */
export function pastDate(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
}

/**
 * Creates a date in the future
 */
export function futureDate(daysFromNow: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
}

/**
 * Creates a timestamp exactly N hours ago
 */
export function hoursAgo(hours: number): Date {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Simple factory usage
 *
 * const category = createMockCategory({ name: 'Hotels' });
 */

/**
 * Example 2: Builder pattern usage
 *
 * const category = new CategoryBuilder()
 *   .withName('Beach Houses')
 *   .withSlug('beach-houses')
 *   .published()
 *   .active()
 *   .build();
 */

/**
 * Example 3: Using fixtures in tests
 *
 * describe('CategoryService', () => {
 *   it('should allow admin to create category', async () => {
 *     const { adminActor } = permissionFixtures;
 *     const { validCreateData } = basicCrudFixtures;
 *
 *     const result = await service.create(adminActor, validCreateData);
 *
 *     expect(result.data).toBeDefined();
 *   });
 * });
 */

/**
 * Example 4: Generating realistic test data
 *
 * const categories = generateRealisticCategories(10);
 * await Promise.all(categories.map(cat => model.create(cat)));
 */

/**
 * Example 5: Creating multiple variations
 *
 * const categories = [
 *   createMockCategory({ name: 'Hotels', isActive: true }),
 *   createMockCategory({ name: 'Hostels', isActive: true }),
 *   createMockCategory({ name: 'Archived', isActive: false, lifecycleState: 'archived' })
 * ];
 */

/**
 * Example 6: Using date helpers
 *
 * const oldCategory = createMockCategory({
 *   createdAt: pastDate(365), // 1 year ago
 *   updatedAt: pastDate(30)   // 30 days ago
 * });
 */
