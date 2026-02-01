/**
 * Billing Routes Smoke Tests
 *
 * Real database smoke tests for billing API routes.
 * Verifies basic functionality of billing endpoints with actual DB operations.
 *
 * These tests are skipped if DATABASE_URL is not available.
 *
 * @module test/integration/billing-routes-smoke
 */

import { billingCustomers, eq } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import type { AppOpenAPI } from '../../src/types';
import {
    cleanupTestDb,
    closeTestDb,
    createTestDb,
    createTestUser,
    isDatabaseAvailable
} from '../helpers/test-db';

describe.skipIf(!isDatabaseAvailable())('Billing Routes - Smoke Tests', () => {
    let app: AppOpenAPI;
    let db: ReturnType<typeof createTestDb>;
    let testUserId: string;
    let testCustomerId: string;

    beforeAll(async () => {
        // Initialize app
        app = initApp();

        // Create test database connection
        db = createTestDb();

        if (!db) {
            throw new Error('Failed to create test database');
        }

        // Create test user
        const testUser = await createTestUser(db, RoleEnum.HOST);
        testUserId = testUser.id;

        // Create billing customer for test user
        const customerResult = await db
            .insert(billingCustomers)
            .values({
                id: crypto.randomUUID(),
                externalId: testUserId,
                email: 'test-billing@example.com',
                name: 'Test Billing User',
                metadata: {}
            } as any)
            .returning();

        const customer = (customerResult as any[])[0];
        testCustomerId = customer.id;
    });

    afterAll(async () => {
        if (db) {
            await cleanupTestDb(db);
        }
        await closeTestDb();
    });

    it('GET /api/v1/billing/plans - should return plans list or 404', async () => {
        const response = await app.request('/api/v1/billing/plans', {
            method: 'GET'
        });

        // Either returns plans or 404 if no plans seeded
        expect([200, 404, 503]).toContain(response.status);

        if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
        }
    });

    it('GET /api/v1/billing/subscriptions - should handle request without auth', async () => {
        const response = await app.request('/api/v1/billing/subscriptions', {
            method: 'GET'
        });

        // Should require authentication or billing to be enabled
        expect([401, 503]).toContain(response.status);
    });

    it('GET /api/v1/billing/usage - should handle request without auth', async () => {
        const response = await app.request('/api/v1/billing/usage', {
            method: 'GET'
        });

        // Should require authentication or billing to be enabled
        expect([401, 503]).toContain(response.status);
    });

    it('GET /api/v1/billing/addons - should return addons list or error', async () => {
        const response = await app.request('/api/v1/billing/addons', {
            method: 'GET'
        });

        // Either returns addons or error if billing not configured
        expect([200, 404, 503]).toContain(response.status);

        if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
        }
    });

    it('should verify billing customer was created correctly', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        const [customer] = await db
            .select()
            .from(billingCustomers)
            .where(eq(billingCustomers.id, testCustomerId))
            .limit(1);

        expect(customer).toBeDefined();
        expect(customer!.id).toBe(testCustomerId);
        expect(customer!.email).toBe('test-billing@example.com');
    });

    it('should handle customer creation for new user', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Create another test user
        const newUser = await createTestUser(db, RoleEnum.USER);

        // Create billing customer
        const newCustomerResult = await db
            .insert(billingCustomers)
            .values({
                id: crypto.randomUUID(),
                externalId: newUser.id,
                email: `test-${Date.now()}@example.com`,
                name: 'New Test User',
                metadata: {}
            } as any)
            .returning();

        const newCustomer = (newCustomerResult as any[])[0];
        expect(newCustomer).toBeDefined();
        expect(newCustomer.externalId).toBe(newUser.id);

        // Verify customer can be found by ID
        const [foundCustomer] = await db
            .select()
            .from(billingCustomers)
            .where(eq(billingCustomers.id, newCustomer.id))
            .limit(1);

        expect(foundCustomer).toBeDefined();
        expect(foundCustomer!.id).toBe(newCustomer.id);
    });

    it('GET /api/v1/billing/trial - should handle trial status check', async () => {
        const response = await app.request('/api/v1/billing/trial', {
            method: 'GET'
        });

        // Either returns trial status or requires auth
        expect([200, 401, 404, 503]).toContain(response.status);
    });

    it('should verify database connection is working', async () => {
        if (!db) {
            throw new Error('Database not initialized');
        }

        // Simple query to verify DB connectivity
        const customers = await db.select().from(billingCustomers).limit(1);

        expect(Array.isArray(customers)).toBe(true);
    });
});
