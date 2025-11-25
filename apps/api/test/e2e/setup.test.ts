import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDb } from './setup/test-database.js';

/**
 * E2E Setup Verification Tests
 * Ensures the E2E testing infrastructure is working correctly
 */
describe('E2E Setup Verification', () => {
    beforeAll(async () => {
        // Setup test database
        await testDb.setup();
    });

    afterAll(async () => {
        // Teardown database
        await testDb.teardown();
    });

    it('should connect to test database', () => {
        const db = testDb.getDb();
        expect(db).toBeDefined();
    });

    it('should create and rollback transaction', async () => {
        const tx = await testDb.beginTransaction();
        expect(tx).toBeDefined();

        // Rollback transaction
        await testDb.rollbackTransaction(tx);
    });

    it('should clean test database', async () => {
        // This test verifies cleanup works without errors
        await testDb.clean();
        expect(true).toBe(true);
    });
});
