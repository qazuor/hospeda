/**
 * Tests for Billing HTTP Adapter
 *
 * Tests the QZPay HTTP Storage Adapter implementation for the Admin app.
 * Covers the live branches (entitlements, limits, plans, transaction),
 * the stubbed branches (customers, subscriptions, payments, promoCodes, etc.),
 * and adapter shape.
 *
 * Background: the adapter was deliberately trimmed in 9585c49c2 to expose only
 * the branches the admin app actually uses. All other branches throw a
 * descriptive "not implemented" error via a Proxy. Tests that previously
 * exercised those removed branches now assert the throw instead.
 */

import type { QZPayPlan } from '@qazuor/qzpay-core';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpBillingAdapter } from '../../src/lib/billing-http-adapter';
import { server } from '../mocks/server';

describe('Billing HTTP Adapter', () => {
    const API_URL = 'http://localhost:3001';
    let mockGetAuthToken: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockGetAuthToken = vi.fn().mockResolvedValue('test-auth-token');
    });

    // -------------------------------------------------------------------------
    // Adapter shape
    // -------------------------------------------------------------------------

    describe('createHttpBillingAdapter', () => {
        it('should create adapter with all storage branches defined', () => {
            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            expect(adapter.customers).toBeDefined();
            expect(adapter.subscriptions).toBeDefined();
            expect(adapter.payments).toBeDefined();
            expect(adapter.paymentMethods).toBeDefined();
            expect(adapter.invoices).toBeDefined();
            expect(adapter.plans).toBeDefined();
            expect(adapter.prices).toBeDefined();
            expect(adapter.promoCodes).toBeDefined();
            expect(adapter.vendors).toBeDefined();
            expect(adapter.entitlements).toBeDefined();
            expect(adapter.limits).toBeDefined();
            expect(adapter.addons).toBeDefined();
            expect(adapter.transaction).toBeDefined();
        });

        it('should work without getAuthToken (session cookies)', () => {
            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL
            });

            expect(adapter.customers).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // Stubbed branches — all methods throw "not implemented"
    // -------------------------------------------------------------------------

    /**
     * The Proxy in createThrowingStorage throws synchronously (not a rejected
     * Promise), so we use `expect(() => ...).toThrow()` rather than
     * `expect(promise).rejects.toThrow()`.
     */
    describe('Stubbed Storage Branches', () => {
        it('customers.findById() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.findById('cus_123')).toThrow(
                'QZPayStorageAdapter.customers.findById() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.create() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() =>
                adapter.customers.create({
                    externalId: 'user_123',
                    email: 'test@example.com',
                    name: 'Test'
                })
            ).toThrow(
                'QZPayStorageAdapter.customers.create() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.update() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.update('cus_123', { name: 'Updated' })).toThrow(
                'QZPayStorageAdapter.customers.update() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.delete() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.delete('cus_123')).toThrow(
                'QZPayStorageAdapter.customers.delete() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.list() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.list()).toThrow(
                'QZPayStorageAdapter.customers.list() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.findByExternalId() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.findByExternalId('ext_123')).toThrow(
                'QZPayStorageAdapter.customers.findByExternalId() is not implemented in the admin app HTTP adapter'
            );
        });

        it('customers.findByEmail() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.customers.findByEmail('test@example.com')).toThrow(
                'QZPayStorageAdapter.customers.findByEmail() is not implemented in the admin app HTTP adapter'
            );
        });

        it('subscriptions.create() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() =>
                adapter.subscriptions.create({
                    customerId: 'cus_123',
                    planId: 'plan_test',
                    priceId: 'price_test'
                })
            ).toThrow(
                'QZPayStorageAdapter.subscriptions.create() is not implemented in the admin app HTTP adapter'
            );
        });

        it('subscriptions.findByCustomerId() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.subscriptions.findByCustomerId('cus_123')).toThrow(
                'QZPayStorageAdapter.subscriptions.findByCustomerId() is not implemented in the admin app HTTP adapter'
            );
        });

        it('payments.findByCustomerId() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.payments.findByCustomerId('cus_123')).toThrow(
                'QZPayStorageAdapter.payments.findByCustomerId() is not implemented in the admin app HTTP adapter'
            );
        });

        it('promoCodes.findByCode() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.promoCodes.findByCode('SAVE20')).toThrow(
                'QZPayStorageAdapter.promoCodes.findByCode() is not implemented in the admin app HTTP adapter'
            );
        });

        it('promoCodes.incrementRedemptions() should throw "not implemented" error', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.promoCodes.incrementRedemptions('promo_123')).toThrow(
                'QZPayStorageAdapter.promoCodes.incrementRedemptions() is not implemented in the admin app HTTP adapter'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Plan Storage — live read methods (findById via admin endpoint)
    // -------------------------------------------------------------------------

    describe('Plan Storage (live)', () => {
        describe('findById', () => {
            it('should find plan by id via admin endpoint', async () => {
                // Arrange
                const planId = 'plan_test123';

                const mockPlan: QZPayPlan = {
                    id: 'plan_test123',
                    name: 'Test Plan',
                    description: 'A test plan',
                    metadata: {},
                    createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date
                };

                server.use(
                    http.get(`${API_URL}/api/v1/admin/billing/plans/${planId}`, () => {
                        return HttpResponse.json({ data: mockPlan });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.plans.findById(planId);

                // Assert
                expect(result).toEqual(mockPlan);
            });
        });

        it('plans.list() should throw "not implemented" (only findById is live)', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.plans.list()).toThrow(
                'QZPayStorageAdapter.plans.list() is not implemented in the admin app HTTP adapter'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Entitlement Storage — live methods
    // -------------------------------------------------------------------------

    describe('Entitlement Storage (live)', () => {
        it('findByCustomerId should fetch entitlements for a customer', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const mockEntitlements = [{ key: 'CREATE_LISTINGS', hasAccess: true }];

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/entitlements/customer/${customerId}`,
                    () => {
                        return HttpResponse.json(mockEntitlements);
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.entitlements.findByCustomerId(customerId);

            // Assert
            expect(result).toEqual(mockEntitlements);
        });

        it('check should return hasAccess boolean for a specific entitlement', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const entitlementKey = 'CREATE_LISTINGS';

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/entitlements/${customerId}/${entitlementKey}/check`,
                    () => {
                        return HttpResponse.json({ hasAccess: true });
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.entitlements.check(customerId, entitlementKey);

            // Assert
            expect(result).toBe(true);
        });

        it('grant() should throw "not implemented" (only getByCustomerId and check are live)', () => {
            const adapter = createHttpBillingAdapter({ apiUrl: API_URL });
            expect(() => adapter.entitlements.grant('cus_123', 'some_key')).toThrow(
                'QZPayStorageAdapter.entitlements.grant() is not implemented'
            );
        });
    });

    // -------------------------------------------------------------------------
    // Limit Storage — live methods
    // -------------------------------------------------------------------------

    describe('Limit Storage (live)', () => {
        it('findByCustomerId should fetch limits for a customer', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const mockLimits = [{ key: 'MAX_LISTINGS', used: 3, limit: 5 }];

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/limits/customer/${customerId}`,
                    () => {
                        return HttpResponse.json(mockLimits);
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.limits.findByCustomerId(customerId);

            // Assert
            expect(result).toEqual(mockLimits);
        });

        it('check should return a limit record for a specific limit key', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const limitKey = 'MAX_LISTINGS';
            const mockLimit = { key: 'MAX_LISTINGS', used: 3, limit: 5 };

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/limits/${customerId}/${limitKey}/check`,
                    () => {
                        return HttpResponse.json(mockLimit);
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.limits.check(customerId, limitKey);

            // Assert
            expect(result).toEqual(mockLimit);
        });
    });

    // -------------------------------------------------------------------------
    // Transaction Wrapper
    // -------------------------------------------------------------------------

    describe('Transaction Wrapper', () => {
        it('should execute transaction function and return result', async () => {
            // Arrange
            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            const mockFn = vi.fn().mockResolvedValue('transaction-result');

            // Act
            const result = await adapter.transaction(mockFn);

            // Assert
            expect(result).toBe('transaction-result');
            expect(mockFn).toHaveBeenCalledOnce();
        });

        it('should propagate errors from transaction function', async () => {
            // Arrange
            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            const error = new Error('Transaction failed');
            const mockFn = vi.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(adapter.transaction(mockFn)).rejects.toThrow('Transaction failed');
        });
    });
});
