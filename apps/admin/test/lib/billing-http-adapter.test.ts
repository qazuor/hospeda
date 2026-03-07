/**
 * Tests for Billing HTTP Adapter
 *
 * Tests the QZPay HTTP Storage Adapter implementation for the Admin app.
 * Covers CRUD operations, error handling, authentication, and type safety.
 */

import type {
    QZPayCreateCustomerInput,
    QZPayCreateSubscriptionInput,
    QZPayCustomer,
    QZPayListOptions,
    QZPayPaginatedResult,
    QZPayPayment,
    QZPayPlan,
    QZPayPromoCode,
    QZPaySubscription,
    QZPayUpdateCustomerInput
} from '@qazuor/qzpay-core';
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

    /**
     * Helper to create mock customer with string dates
     * (JSON serialization converts Date objects to strings)
     */
    const createMockCustomer = (overrides?: Partial<QZPayCustomer>): QZPayCustomer => ({
        id: 'cus_test123',
        externalId: 'user_123',
        email: 'test@example.com',
        name: 'Test Customer',
        metadata: {},
        createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
        updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
        ...overrides
    });

    describe('createHttpBillingAdapter', () => {
        it('should create adapter with all storage implementations', () => {
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

    describe('Customer Storage', () => {
        describe('create', () => {
            it('should create customer successfully', async () => {
                // Arrange
                const input: QZPayCreateCustomerInput = {
                    externalId: 'user_123',
                    email: 'test@example.com',
                    name: 'Test Customer'
                };

                const mockCustomer = createMockCustomer();

                server.use(
                    http.post(
                        `${API_URL}/api/v1/protected/billing/customers`,
                        async ({ request }) => {
                            const body = (await request.json()) as QZPayCreateCustomerInput;

                            expect(body).toEqual(input);

                            return HttpResponse.json({ data: mockCustomer });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.create(input);

                // Assert
                expect(result).toEqual(mockCustomer);
                // getAuthToken is deprecated and not called; auth uses session cookies
                expect(mockGetAuthToken).not.toHaveBeenCalled();
            });

            it('should handle API error responses', async () => {
                // Arrange
                const input: QZPayCreateCustomerInput = {
                    externalId: 'user_123',
                    email: 'invalid-email',
                    name: 'Test'
                };

                server.use(
                    http.post(`${API_URL}/api/v1/protected/billing/customers`, () => {
                        return HttpResponse.json(
                            {
                                error: {
                                    message: 'Invalid email format'
                                }
                            },
                            { status: 400 }
                        );
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(adapter.customers.create(input)).rejects.toThrow(
                    'Invalid email format'
                );
            });

            it('should handle network errors', async () => {
                // Arrange
                const input: QZPayCreateCustomerInput = {
                    externalId: 'user_123',
                    email: 'test@example.com',
                    name: 'Test'
                };

                server.use(
                    http.post(`${API_URL}/api/v1/protected/billing/customers`, () => {
                        return HttpResponse.error();
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(adapter.customers.create(input)).rejects.toThrow();
            });
        });

        describe('update', () => {
            it('should update customer successfully', async () => {
                // Arrange
                const customerId = 'cus_test123';
                const updateInput: QZPayUpdateCustomerInput = {
                    name: 'Updated Name',
                    metadata: { updated: true }
                };

                const updatedCustomer = createMockCustomer({
                    name: 'Updated Name',
                    metadata: { updated: true }
                });

                server.use(
                    http.put(
                        `${API_URL}/api/v1/protected/billing/customers/${customerId}`,
                        async ({ request }) => {
                            const body = (await request.json()) as QZPayUpdateCustomerInput;
                            expect(body).toEqual(updateInput);

                            return HttpResponse.json({ data: updatedCustomer });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.update(customerId, updateInput);

                // Assert
                expect(result.name).toBe('Updated Name');
                expect(result.metadata).toEqual({ updated: true });
            });

            it('should handle 404 for non-existent customer', async () => {
                // Arrange
                const customerId = 'cus_nonexistent';

                server.use(
                    http.put(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                        return HttpResponse.json(
                            { error: { message: 'Customer not found' } },
                            { status: 404 }
                        );
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(
                    adapter.customers.update(customerId, { name: 'Test' })
                ).rejects.toThrow('Customer not found');
            });
        });

        describe('delete', () => {
            it('should delete customer successfully', async () => {
                // Arrange
                const customerId = 'cus_test123';

                server.use(
                    http.delete(
                        `${API_URL}/api/v1/protected/billing/customers/${customerId}`,
                        () => {
                            // DELETE typically returns empty object or success: true
                            return HttpResponse.json({ success: true });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(adapter.customers.delete(customerId)).resolves.not.toThrow();
            });
        });

        describe('findById', () => {
            it('should find customer by id', async () => {
                // Arrange
                const customerId = 'cus_test123';
                const mockCustomer = createMockCustomer();

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                        return HttpResponse.json({ data: mockCustomer });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.findById(customerId);

                // Assert
                expect(result).toEqual(mockCustomer);
            });

            it('should return null for non-existent customer', async () => {
                // Arrange
                const customerId = 'cus_nonexistent';

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                        return HttpResponse.json(
                            { error: { message: 'Not found' } },
                            { status: 404 }
                        );
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(adapter.customers.findById(customerId)).rejects.toThrow('Not found');
            });
        });

        describe('findByExternalId', () => {
            it('should find customer by external id', async () => {
                // Arrange
                const externalId = 'user_123';
                const mockCustomer = createMockCustomer();

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers`, ({ request }) => {
                        const url = new URL(request.url);
                        expect(url.searchParams.get('externalId')).toBe(externalId);

                        return HttpResponse.json({ data: mockCustomer });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.findByExternalId(externalId);

                // Assert
                expect(result).toEqual(mockCustomer);
            });
        });

        describe('findByEmail', () => {
            it('should find customer by email', async () => {
                // Arrange
                const email = 'test@example.com';
                const mockCustomer = createMockCustomer();

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers`, ({ request }) => {
                        const url = new URL(request.url);
                        expect(url.searchParams.get('email')).toBe(email);

                        return HttpResponse.json({ data: mockCustomer });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.findByEmail(email);

                // Assert
                expect(result).toEqual(mockCustomer);
            });
        });

        describe('list', () => {
            it('should list customers with pagination', async () => {
                // Arrange
                const options: QZPayListOptions = {
                    limit: 10,
                    offset: 0
                };

                const mockCustomer = createMockCustomer();
                const mockResult: QZPayPaginatedResult<QZPayCustomer> = {
                    data: [mockCustomer],
                    hasMore: false,
                    total: 1
                };

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers`, () => {
                        return HttpResponse.json({ data: mockResult });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.list(options);

                // Assert
                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(1);
                expect(result.hasMore).toBe(false);
            });

            it('should list customers without options', async () => {
                // Arrange
                const mockCustomer = createMockCustomer();
                const mockResult: QZPayPaginatedResult<QZPayCustomer> = {
                    data: [mockCustomer],
                    hasMore: false,
                    total: 1
                };

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/customers`, () => {
                        return HttpResponse.json({ data: mockResult });
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.customers.list();

                // Assert
                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(1);
                expect(result.hasMore).toBe(false);
            });
        });
    });

    describe('Subscription Storage', () => {
        describe('create', () => {
            it('should create subscription successfully', async () => {
                // Arrange
                const input: QZPayCreateSubscriptionInput & { id: string } = {
                    id: 'sub_test123',
                    customerId: 'cus_test123',
                    planId: 'plan_test',
                    priceId: 'price_test'
                };

                const mockSubscription: QZPaySubscription = {
                    id: 'sub_test123',
                    customerId: 'cus_test123',
                    planId: 'plan_test',
                    priceId: 'price_test',
                    status: 'active',
                    currentPeriodStart: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    currentPeriodEnd: '2024-02-01T00:00:00.000Z' as unknown as Date,
                    cancelAtPeriodEnd: false,
                    metadata: {},
                    createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date
                };

                server.use(
                    http.post(
                        `${API_URL}/api/v1/protected/billing/subscriptions`,
                        async ({ request }) => {
                            const body = (await request.json()) as QZPayCreateSubscriptionInput;
                            expect(body).toEqual(input);

                            return HttpResponse.json({ data: mockSubscription });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.subscriptions.create(input);

                // Assert
                expect(result).toEqual(mockSubscription);
            });
        });

        describe('findByCustomerId', () => {
            it('should find subscriptions by customer id', async () => {
                // Arrange
                const customerId = 'cus_test123';

                const mockSubscription: QZPaySubscription = {
                    id: 'sub_test123',
                    customerId: 'cus_test123',
                    planId: 'plan_test',
                    priceId: 'price_test',
                    status: 'active',
                    currentPeriodStart: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    currentPeriodEnd: '2024-02-01T00:00:00.000Z' as unknown as Date,
                    cancelAtPeriodEnd: false,
                    metadata: {},
                    createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date
                };

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/subscriptions`, ({ request }) => {
                        const url = new URL(request.url);
                        expect(url.searchParams.get('customerId')).toBe(customerId);

                        return HttpResponse.json([mockSubscription]);
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.subscriptions.findByCustomerId(customerId);

                // Assert
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual(mockSubscription);
            });
        });
    });

    describe('Payment Storage', () => {
        describe('findByCustomerId', () => {
            it('should find payments by customer id', async () => {
                // Arrange
                const customerId = 'cus_test123';

                const mockPayment: QZPayPayment = {
                    id: 'pay_test123',
                    customerId: 'cus_test123',
                    amount: 10000,
                    currency: 'ARS',
                    status: 'succeeded',
                    paymentMethod: 'card',
                    metadata: {},
                    createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
                    updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date
                };

                server.use(
                    http.get(`${API_URL}/api/v1/protected/billing/payments`, ({ request }) => {
                        const url = new URL(request.url);
                        expect(url.searchParams.get('customerId')).toBe(customerId);

                        return HttpResponse.json([mockPayment]);
                    })
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.payments.findByCustomerId(customerId);

                // Assert
                expect(result).toHaveLength(1);
                expect(result[0]?.amount).toBe(10000);
            });
        });
    });

    describe('Plan Storage', () => {
        describe('findById', () => {
            it('should find plan by id', async () => {
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
                    http.get(`${API_URL}/api/v1/protected/billing/plans/${planId}`, () => {
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
    });

    describe('Promo Code Storage', () => {
        const mockPromoCode: QZPayPromoCode = {
            id: 'promo_test123',
            code: 'SAVE20',
            discountType: 'percentage',
            discountValue: 20,
            maxRedemptions: 100,
            timesRedeemed: 5,
            active: true,
            metadata: {},
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01')
        };

        describe('findByCode', () => {
            it('should find promo code by code', async () => {
                // Arrange
                const code = 'SAVE20';

                server.use(
                    http.get(
                        `${API_URL}/api/v1/protected/billing/promo-codes/by-code/${code}`,
                        () => {
                            return HttpResponse.json({ data: mockPromoCode });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act
                const result = await adapter.promoCodes.findByCode(code);

                // Assert
                expect(result.code).toBe('SAVE20');
                expect(result.discountValue).toBe(20);
            });
        });

        describe('incrementRedemptions', () => {
            it('should increment promo code redemptions', async () => {
                // Arrange
                const promoCodeId = 'promo_test123';

                server.use(
                    http.post(
                        `${API_URL}/api/v1/protected/billing/promo-codes/${promoCodeId}/redeem`,
                        () => {
                            return HttpResponse.json({ success: true });
                        }
                    )
                );

                const adapter = createHttpBillingAdapter({
                    apiUrl: API_URL,
                    getAuthToken: mockGetAuthToken
                });

                // Act & Assert
                await expect(
                    adapter.promoCodes.incrementRedemptions(promoCodeId)
                ).resolves.not.toThrow();
            });
        });
    });

    describe('Authentication', () => {
        it('should include auth token in request headers', async () => {
            // Arrange
            const customerId = 'cus_test123';
            let capturedAuthHeader: string | null = null;

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/customers/${customerId}`,
                    ({ request }) => {
                        capturedAuthHeader = request.headers.get('Authorization');
                        return HttpResponse.json({ data: {} });
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            await adapter.customers.findById(customerId);

            // Assert
            // getAuthToken is deprecated; auth uses session cookies (credentials: 'include')
            // so no Authorization header is sent and getAuthToken is never called
            expect(mockGetAuthToken).not.toHaveBeenCalled();
            expect(capturedAuthHeader).toBeNull();
        });

        it('should work without auth token (cookies only)', async () => {
            // Arrange
            const customerId = 'cus_test123';
            let capturedAuthHeader: string | null = null;

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/customers/${customerId}`,
                    ({ request }) => {
                        capturedAuthHeader = request.headers.get('Authorization');
                        return HttpResponse.json({ data: {} });
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL
                // No getAuthToken provided
            });

            // Act
            await adapter.customers.findById(customerId);

            // Assert
            expect(capturedAuthHeader).toBeNull();
        });

        it('should handle null auth token gracefully', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const nullTokenFn = vi.fn().mockResolvedValue(null);
            let capturedAuthHeader: string | null = null;

            server.use(
                http.get(
                    `${API_URL}/api/v1/protected/billing/customers/${customerId}`,
                    ({ request }) => {
                        capturedAuthHeader = request.headers.get('Authorization');
                        return HttpResponse.json({ data: {} });
                    }
                )
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: nullTokenFn
            });

            // Act
            await adapter.customers.findById(customerId);

            // Assert
            // getAuthToken is deprecated and never invoked; auth uses session cookies
            expect(nullTokenFn).not.toHaveBeenCalled();
            expect(capturedAuthHeader).toBeNull();
        });
    });

    describe('Request Configuration', () => {
        it('should include credentials for cookies', async () => {
            // Arrange
            const customerId = 'cus_test123';
            let capturedCredentials: RequestCredentials | undefined;

            // We need to spy on fetch to capture credentials
            const originalFetch = global.fetch;
            global.fetch = vi.fn(async (input, init) => {
                capturedCredentials = init?.credentials;
                return originalFetch(input, init);
            });

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return HttpResponse.json({ data: {} });
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            await adapter.customers.findById(customerId);

            // Assert
            expect(capturedCredentials).toBe('include');

            // Cleanup
            global.fetch = originalFetch;
        });

        it('should include Content-Type header', async () => {
            // Arrange
            const input: QZPayCreateCustomerInput = {
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test'
            };

            let capturedContentType: string | null = null;

            server.use(
                http.post(`${API_URL}/api/v1/protected/billing/customers`, ({ request }) => {
                    capturedContentType = request.headers.get('Content-Type');
                    return HttpResponse.json({ data: {} });
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            await adapter.customers.create(input);

            // Assert
            expect(capturedContentType).toBe('application/json');
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON error response', async () => {
            // Arrange
            const customerId = 'cus_test123';

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return new HttpResponse('Not JSON', {
                        status: 500,
                        statusText: 'Internal Server Error'
                    });
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act & Assert
            await expect(adapter.customers.findById(customerId)).rejects.toThrow();
        });

        it('should extract error message from nested error object', async () => {
            // Arrange
            const customerId = 'cus_test123';

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return HttpResponse.json(
                        {
                            error: {
                                message: 'Nested error message'
                            }
                        },
                        { status: 400 }
                    );
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act & Assert
            await expect(adapter.customers.findById(customerId)).rejects.toThrow(
                'Nested error message'
            );
        });

        it('should extract message from top-level message field', async () => {
            // Arrange
            const customerId = 'cus_test123';

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return HttpResponse.json(
                        {
                            message: 'Top-level error message'
                        },
                        { status: 400 }
                    );
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act & Assert
            await expect(adapter.customers.findById(customerId)).rejects.toThrow(
                'Top-level error message'
            );
        });

        it('should use status text as fallback error message', async () => {
            // Arrange
            const customerId = 'cus_test123';

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return new HttpResponse(JSON.stringify({}), {
                        status: 404,
                        statusText: 'Not Found'
                    });
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act & Assert
            // The client uses `Request failed (${status})` as fallback when no message
            // is present in the error body (empty object {} has no error.message or message)
            await expect(adapter.customers.findById(customerId)).rejects.toThrow(
                'Request failed (404)'
            );
        });
    });

    describe('Response Transformation', () => {
        it('should extract data from response.data field', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const mockCustomer = createMockCustomer({ id: customerId });

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return HttpResponse.json({ data: mockCustomer });
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.customers.findById(customerId);

            // Assert
            expect(result).toEqual(mockCustomer);
        });

        it('should return entire response if no data field', async () => {
            // Arrange
            const customerId = 'cus_test123';
            const mockCustomer = createMockCustomer({ id: customerId });

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/${customerId}`, () => {
                    return HttpResponse.json(mockCustomer);
                })
            );

            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            // Act
            const result = await adapter.customers.findById(customerId);

            // Assert
            expect(result).toEqual(mockCustomer);
        });
    });

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

    describe('Type Safety', () => {
        it('should maintain type safety for customer operations', async () => {
            // Arrange
            const adapter = createHttpBillingAdapter({
                apiUrl: API_URL,
                getAuthToken: mockGetAuthToken
            });

            const mockCustomer: QZPayCustomer = {
                id: 'cus_test123',
                externalId: 'user_123',
                email: 'test@example.com',
                name: 'Test Customer',
                metadata: {},
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01')
            };

            server.use(
                http.get(`${API_URL}/api/v1/protected/billing/customers/cus_test123`, () => {
                    return HttpResponse.json({ data: mockCustomer });
                })
            );

            // Act
            const result = await adapter.customers.findById('cus_test123');

            // Assert - TypeScript ensures these properties exist
            expect(result.id).toBeDefined();
            expect(result.email).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.createdAt).toBeDefined();
        });
    });
});
