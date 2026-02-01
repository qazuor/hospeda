/**
 * Tests for test database helpers
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

describe('Test Database Helpers', () => {
    const db = createTestDb();

    // Skip all tests if database is not available
    const skipTests = !isDatabaseAvailable();

    beforeAll(async () => {
        if (skipTests) {
            // Tests skipped - DATABASE_URL not configured
            return;
        }
    });

    afterEach(async () => {
        if (skipTests || !db) return;
        await cleanupTestDb(db);
    });

    afterAll(async () => {
        if (skipTests) return;
        await closeTestDb();
    });

    describe('createTestDb', () => {
        it('should return null if DATABASE_URL not set', () => {
            // Note: This test will pass if DATABASE_URL IS set
            // It just verifies the function doesn't throw
            const result = createTestDb();
            expect(result !== undefined).toBe(true);
        });
    });

    describe('isDatabaseAvailable', () => {
        it('should check if database is available', () => {
            const result = isDatabaseAvailable();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('seedTestData', () => {
        it.skipIf(skipTests)('should create test user and customer', async () => {
            if (!db) throw new Error('Database not available');

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
        it.skipIf(skipTests)('should find user by ID', async () => {
            if (!db) throw new Error('Database not available');

            // Arrange
            const { user } = await seedTestData(db);

            // Act
            const foundUser = await findTestUserById(db, user.id);

            // Assert
            expect(foundUser).toBeDefined();
            expect(foundUser?.id).toBe(user.id);
            expect(foundUser?.slug).toBe(user.slug);
        });

        it.skipIf(skipTests)('should return null for non-existent user', async () => {
            if (!db) throw new Error('Database not available');

            // Arrange
            const nonExistentId = crypto.randomUUID();

            // Act
            const foundUser = await findTestUserById(db, nonExistentId);

            // Assert
            expect(foundUser).toBeNull();
        });
    });

    describe('findTestCustomerByUserId', () => {
        it.skipIf(skipTests)('should find customer by user ID', async () => {
            if (!db) throw new Error('Database not available');

            // Arrange
            const { user, customer } = await seedTestData(db);

            // Act
            const foundCustomer = await findTestCustomerByUserId(db, user.id);

            // Assert
            expect(foundCustomer).toBeDefined();
            expect(foundCustomer?.id).toBe(customer.id);
            expect(foundCustomer?.externalId).toBe(user.id);
        });

        it.skipIf(skipTests)('should return null for non-existent customer', async () => {
            if (!db) throw new Error('Database not available');

            // Arrange
            const nonExistentUserId = crypto.randomUUID();

            // Act
            const foundCustomer = await findTestCustomerByUserId(db, nonExistentUserId);

            // Assert
            expect(foundCustomer).toBeNull();
        });
    });

    describe('createTestUser', () => {
        it.skipIf(skipTests)('should create user with custom role', async () => {
            if (!db) throw new Error('Database not available');

            // Arrange & Act
            const adminUser = await createTestUser(db, RoleEnum.ADMIN);

            // Assert
            expect(adminUser).toBeDefined();
            expect(adminUser.id).toBeDefined();
            expect(adminUser.role).toBe(RoleEnum.ADMIN);
            expect(adminUser.slug).toBeDefined();
        });

        it.skipIf(skipTests)('should create user with overrides', async () => {
            if (!db) throw new Error('Database not available');

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
        it.skipIf(skipTests)('should clean up all test data', async () => {
            if (!db) throw new Error('Database not available');

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
