/**
 * Tests for test database helpers.
 *
 * These tests require a live PostgreSQL instance. They are skipped automatically
 * when the database is unreachable (e.g., CI or local dev without Docker).
 */

import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    cleanupTestDb,
    closeTestDb,
    createTestDb,
    createTestUser,
    findTestCustomerByUserId,
    findTestUserById,
    isDatabaseAvailable,
    seedTestData
} from './test-db';

/**
 * Checks if the database is truly reachable (not just env var set).
 * Must be synchronous for describe.skipIf; we probe via a fast TCP check.
 */
function canReachDatabase(): boolean {
    // In unit-test mode, the env var is always set by test/setup.ts
    // but there is no running database. Use a heuristic: if the URL
    // points to a well-known test placeholder, skip.
    const url = process.env.HOSPEDA_DATABASE_URL;
    if (!url) return false;

    // The test setup always sets this exact placeholder value
    if (url === 'postgresql://test:test@localhost:5432/test_db') return false;

    return isDatabaseAvailable();
}

const dbAvailable = canReachDatabase();

describe.skipIf(!dbAvailable)('Test Database Helpers', () => {
    let db: any = null;

    beforeAll(async () => {
        db = createTestDb();
    });

    afterEach(async () => {
        if (!db) return;
        await cleanupTestDb(db);
    });

    afterAll(async () => {
        await closeTestDb();
    });

    describe('createTestDb', () => {
        it('should not throw when called', () => {
            // This test verifies the function doesn't throw
            // Actual database initialization is tested by other tests that use the db
            expect(() => createTestDb()).not.toThrow();
        });
    });

    describe('isDatabaseAvailable', () => {
        it('should check if database is available', () => {
            const result = isDatabaseAvailable();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('seedTestData', () => {
        it('should create test user and customer', async () => {
            // Arrange & Act
            const { user, customer } = await seedTestData(db);

            // Assert
            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.slug).toBeDefined();
            expect(user.role).toBe(RoleEnum.USER);
            expect(user.displayName).toBe('Test User');

            expect(customer).toBeDefined();
            expect(customer.id).toBeDefined();
            expect(customer.externalId).toBe(user.id);
            expect(customer.email).toBe('test@example.com');
        });
    });

    describe('findTestUserById', () => {
        it('should find user by ID', async () => {
            // Arrange
            const { user } = await seedTestData(db);

            // Act
            const foundUser = await findTestUserById(db, user.id);

            // Assert
            expect(foundUser).toBeDefined();
            expect(foundUser?.id).toBe(user.id);
            expect(foundUser?.slug).toBe(user.slug);
        });

        it('should return null for non-existent user', async () => {
            // Arrange
            const nonExistentId = crypto.randomUUID();

            // Act
            const foundUser = await findTestUserById(db, nonExistentId);

            // Assert
            expect(foundUser).toBeNull();
        });
    });

    describe('findTestCustomerByUserId', () => {
        it('should find customer by user ID', async () => {
            // Arrange
            const { user, customer } = await seedTestData(db);

            // Act
            const foundCustomer = await findTestCustomerByUserId(db, user.id);

            // Assert
            expect(foundCustomer).toBeDefined();
            expect(foundCustomer?.id).toBe(customer.id);
            expect(foundCustomer?.externalId).toBe(user.id);
        });

        it('should return null for non-existent customer', async () => {
            // Arrange
            const nonExistentUserId = crypto.randomUUID();

            // Act
            const foundCustomer = await findTestCustomerByUserId(db, nonExistentUserId);

            // Assert
            expect(foundCustomer).toBeNull();
        });
    });

    describe('createTestUser', () => {
        it('should create user with custom role', async () => {
            // Arrange & Act
            const adminUser = await createTestUser(db, RoleEnum.ADMIN);

            // Assert
            expect(adminUser).toBeDefined();
            expect(adminUser.id).toBeDefined();
            expect(adminUser.role).toBe(RoleEnum.ADMIN);
            expect(adminUser.slug).toBeDefined();
        });

        it('should create user with overrides', async () => {
            // Arrange & Act
            const customUser = await createTestUser(db, RoleEnum.USER, {
                displayName: 'Custom User',
                firstName: 'Custom'
            });

            // Assert
            expect(customUser).toBeDefined();
            expect(customUser.displayName).toBe('Custom User');
            expect(customUser.firstName).toBe('Custom');
        });
    });

    describe('cleanupTestDb', () => {
        it('should clean up all test data', async () => {
            // Arrange
            const { user } = await seedTestData(db);

            // Act
            await cleanupTestDb(db);

            // Assert
            const foundUser = await findTestUserById(db, user.id);
            expect(foundUser).toBeNull();
        });
    });
});
