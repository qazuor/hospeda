/**
 * Test database helpers for API tests
 *
 * Provides utilities to create test database connections, seed minimal data,
 * and cleanup between tests.
 *
 * @module test/helpers/test-db
 */

import { billingCustomers, eq, type getDb, initializeDb } from '@repo/db';
import { users } from '@repo/db/schemas';
import { RoleEnum } from '@repo/schemas';
import { Pool } from 'pg';

/**
 * Test database instance
 * Null until initialized
 */
let testDbInstance: ReturnType<typeof getDb> | null = null;

/**
 * PostgreSQL connection pool for tests
 */
let testPool: Pool | null = null;

/**
 * Check if DATABASE_URL is available for testing
 * @returns True if database is available
 */
export function isDatabaseAvailable(): boolean {
    return Boolean(process.env.HOSPEDA_DATABASE_URL);
}

/**
 * Creates or returns existing test database connection
 *
 * @returns Database instance or null if DATABASE_URL not set
 *
 * @example
 * ```typescript
 * const db = createTestDb();
 * if (!db) {
 *   console.log('Skipping test - no database available');
 *   return;
 * }
 * ```
 */
export function createTestDb(): ReturnType<typeof getDb> | null {
    // If database is not available, return null (tests will skip)
    if (!isDatabaseAvailable()) {
        return null;
    }

    // Return existing instance if already initialized
    if (testDbInstance) {
        return testDbInstance;
    }

    try {
        // Create connection pool
        testPool = new Pool({
            connectionString: process.env.HOSPEDA_DATABASE_URL,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });

        // Initialize database
        testDbInstance = initializeDb(testPool);

        return testDbInstance;
    } catch (error) {
        console.error('Error creating test database:', error);
        // Return null if initialization fails
        return null;
    }
}

/**
 * Returns the current test database instance
 * Uses getDb() for consistency with production code
 *
 * @returns Database instance
 * @throws Error if database not initialized
 */
export function getTestDb(): ReturnType<typeof getDb> {
    if (!testDbInstance) {
        const db = createTestDb();
        if (!db) {
            throw new Error(
                'Test database not available. Set HOSPEDA_DATABASE_URL environment variable.'
            );
        }
        return db;
    }
    return testDbInstance;
}

/**
 * Test user data structure
 */
export interface TestUser {
    id: string;
    slug: string;
    role: RoleEnum;
    displayName: string;
    firstName: string;
    lastName: string;
    authProviderUserId: string;
}

/**
 * Test customer data structure (from QZPay)
 */
export interface TestCustomer {
    id: string;
    externalId: string;
    email: string;
}

/**
 * Seeds minimal test data (user and billing customer)
 *
 * @param db - Database instance
 * @returns Object with created test user and customer
 *
 * @example
 * ```typescript
 * const { user, customer } = await seedTestData(db);
 * console.log('Test user ID:', user.id);
 * ```
 */
export async function seedTestData(
    db: ReturnType<typeof getDb>
): Promise<{ user: TestUser; customer: TestCustomer }> {
    // Create test user
    const testUserId = crypto.randomUUID();
    const testSlug = `test-user-${Date.now()}`;

    const createdUserResult = await db
        .insert(users)
        .values({
            id: testUserId,
            slug: testSlug,
            authProviderUserId: `better_auth_test_${testUserId}`,
            displayName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            role: RoleEnum.USER as string,
            settings: {
                language: 'es',
                notifications: {
                    enabled: true,
                    allowEmails: true,
                    allowSms: false,
                    allowPush: false
                }
            }
        } as typeof users.$inferInsert)
        .returning();

    const createdUser = (createdUserResult as any[])[0];

    // Create test billing customer
    const testCustomerId = crypto.randomUUID();

    const createdCustomerResult = await db
        .insert(billingCustomers)
        .values({
            id: testCustomerId,
            externalId: testUserId,
            email: 'test@example.com',
            name: 'Test User',
            metadata: {}
        } as any)
        .returning();

    const createdCustomer = (createdCustomerResult as any[])[0];

    return {
        user: {
            id: createdUser.id,
            slug: createdUser.slug,
            role: createdUser.role,
            displayName: createdUser.displayName || '',
            firstName: createdUser.firstName || '',
            lastName: createdUser.lastName || '',
            authProviderUserId: createdUser.authProviderUserId || ''
        },
        customer: {
            id: createdCustomer.id,
            externalId: createdCustomer.externalId,
            email: createdCustomer.email || ''
        }
    };
}

/**
 * Cleans up test data from database
 *
 * @param db - Database instance
 *
 * @example
 * ```typescript
 * afterEach(async () => {
 *   await cleanupTestDb(db);
 * });
 * ```
 */
export async function cleanupTestDb(db: ReturnType<typeof getDb>): Promise<void> {
    // Delete in correct order to avoid foreign key violations
    // Delete billing customers first (references users)
    await db.delete(billingCustomers);

    // Delete users
    await db.delete(users);
}

/**
 * Closes test database connection pool
 * Should be called in afterAll() hook
 *
 * @example
 * ```typescript
 * afterAll(async () => {
 *   await closeTestDb();
 * });
 * ```
 */
export async function closeTestDb(): Promise<void> {
    if (testPool) {
        await testPool.end();
        testPool = null;
        testDbInstance = null;
    }
}

/**
 * Type-safe wrapper for finding user by ID
 *
 * @param db - Database instance
 * @param userId - User ID to find
 * @returns User or null
 */
export async function findTestUserById(
    db: ReturnType<typeof getDb>,
    userId: string
): Promise<TestUser | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        slug: user.slug,
        role: user.role as unknown as RoleEnum,
        displayName: user.displayName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        authProviderUserId: user.authProviderUserId || ''
    };
}

/**
 * Type-safe wrapper for finding customer by user ID
 *
 * @param db - Database instance
 * @param userId - User ID to find customer for
 * @returns Customer or null
 */
export async function findTestCustomerByUserId(
    db: ReturnType<typeof getDb>,
    userId: string
): Promise<TestCustomer | null> {
    const [customer] = await db
        .select()
        .from(billingCustomers)
        .where(eq(billingCustomers.externalId, userId))
        .limit(1);

    if (!customer) {
        return null;
    }

    return {
        id: customer.id,
        externalId: customer.externalId,
        email: customer.email || ''
    };
}

/**
 * Creates a test user with custom role
 *
 * @param db - Database instance
 * @param role - User role
 * @param overrides - Optional field overrides
 * @returns Created test user
 */
export async function createTestUser(
    db: ReturnType<typeof getDb>,
    role: RoleEnum,
    overrides?: Partial<typeof users.$inferInsert>
): Promise<TestUser> {
    const testUserId = crypto.randomUUID();
    const testSlug = `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const createdUserResult = await db
        .insert(users)
        .values({
            id: testUserId,
            slug: testSlug,
            authProviderUserId: `better_auth_test_${testUserId}`,
            displayName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            role: role as string,
            settings: {
                language: 'es',
                notifications: {
                    enabled: true,
                    allowEmails: true,
                    allowSms: false,
                    allowPush: false
                }
            },
            ...overrides
        } as typeof users.$inferInsert)
        .returning();

    const createdUser = (createdUserResult as any[])[0];

    return {
        id: createdUser.id,
        slug: createdUser.slug,
        role: createdUser.role as unknown as RoleEnum,
        displayName: createdUser.displayName || '',
        firstName: createdUser.firstName || '',
        lastName: createdUser.lastName || '',
        authProviderUserId: createdUser.authProviderUserId || ''
    };
}
