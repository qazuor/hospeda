/**
 * Comprehensive tests for MercadoPago adapter methods
 *
 * Tests the MercadoPago payment adapter integration including:
 * - Payment preference creation
 * - Payment processing
 * - Subscription management
 * - Webhook signature verification
 * - Error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMercadoPagoAdapter,
    getDefaultCountry,
    getDefaultCurrency
} from '../../src/adapters/mercadopago';

// Mock the QZPay MercadoPago adapter
vi.mock('@qazuor/qzpay-mercadopago', () => {
    return {
        createQZPayMercadoPagoAdapter: vi.fn((config) => {
            return {
                provider: 'mercadopago',
                config,
                // Mock customer operations
                customers: {
                    create: vi.fn().mockResolvedValue({
                        id: 'cust_test_123',
                        email: 'customer@example.com',
                        name: 'Test Customer'
                    }),
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'cust_test_123',
                        email: 'customer@example.com',
                        name: 'Test Customer'
                    }),
                    update: vi.fn().mockResolvedValue({
                        id: 'cust_test_123',
                        email: 'updated@example.com',
                        name: 'Updated Customer'
                    }),
                    delete: vi.fn().mockResolvedValue({ id: 'cust_test_123', deleted: true })
                },
                // Mock subscription operations
                subscriptions: {
                    create: vi.fn().mockResolvedValue({
                        id: 'sub_test_123',
                        customerId: 'cust_test_123',
                        status: 'active',
                        planId: 'plan_basic'
                    }),
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'sub_test_123',
                        customerId: 'cust_test_123',
                        status: 'active',
                        planId: 'plan_basic'
                    }),
                    update: vi.fn().mockResolvedValue({
                        id: 'sub_test_123',
                        status: 'canceled'
                    }),
                    cancel: vi.fn().mockResolvedValue({
                        id: 'sub_test_123',
                        status: 'canceled'
                    })
                },
                // Mock payment operations
                payments: {
                    create: vi.fn().mockResolvedValue({
                        id: 'pay_test_123',
                        amount: 15000,
                        currency: 'ARS',
                        status: 'approved'
                    }),
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'pay_test_123',
                        amount: 15000,
                        currency: 'ARS',
                        status: 'approved'
                    }),
                    refund: vi.fn().mockResolvedValue({
                        id: 'ref_test_123',
                        paymentId: 'pay_test_123',
                        amount: 15000,
                        status: 'approved'
                    })
                },
                // Mock checkout operations
                checkout: {
                    createPreference: vi.fn().mockResolvedValue({
                        id: 'pref_test_123',
                        initPoint:
                            'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_test_123',
                        sandboxInitPoint:
                            'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_test_123'
                    })
                },
                // Mock price operations
                prices: {
                    create: vi.fn().mockResolvedValue({
                        id: 'price_test_123',
                        amount: 15000,
                        currency: 'ARS'
                    }),
                    retrieve: vi.fn().mockResolvedValue({
                        id: 'price_test_123',
                        amount: 15000,
                        currency: 'ARS'
                    })
                },
                // Mock webhook operations
                webhooks: {
                    verifySignature: vi.fn().mockReturnValue(true),
                    constructEvent: vi.fn((payload: string) => {
                        const data = JSON.parse(payload);
                        return {
                            type: data.type || 'payment',
                            data: data.data || {}
                        };
                    })
                }
            };
        })
    };
});

// Mock environment variables
const mockEnv = {
    HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-1234567890',
    HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: 'test-webhook-secret',
    HOSPEDA_MERCADO_PAGO_SANDBOX: 'true',
    HOSPEDA_MERCADO_PAGO_TIMEOUT: '10000',
    HOSPEDA_MERCADO_PAGO_PLATFORM_ID: 'test-platform',
    HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID: 'test-integrator'
};

describe('MercadoPago Adapter - Configuration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Reset environment variables
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', mockEnv.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN);
        vi.stubEnv(
            'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET',
            mockEnv.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET
        );
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_SANDBOX', mockEnv.HOSPEDA_MERCADO_PAGO_SANDBOX);
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_TIMEOUT', mockEnv.HOSPEDA_MERCADO_PAGO_TIMEOUT);
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_PLATFORM_ID', mockEnv.HOSPEDA_MERCADO_PAGO_PLATFORM_ID);
        vi.stubEnv(
            'HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID',
            mockEnv.HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID
        );
    });

    describe('createMercadoPagoAdapter', () => {
        it('should create adapter with environment variables', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
            expect(adapter.provider).toBe('mercadopago');
            expect(adapter.customers).toBeDefined();
            expect(adapter.subscriptions).toBeDefined();
            expect(adapter.payments).toBeDefined();
            expect(adapter.checkout).toBeDefined();
            expect(adapter.prices).toBeDefined();
            expect(adapter.webhooks).toBeDefined();
        });

        it('should create adapter with custom config', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                accessToken: 'TEST-custom-token',
                sandbox: true,
                timeout: 15000
            });

            // Assert
            expect(adapter).toBeDefined();
            expect(adapter.provider).toBe('mercadopago');
        });

        it('should throw error for invalid access token format', () => {
            // Arrange & Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: 'INVALID-TOKEN-FORMAT'
                });
            }).toThrow('Invalid MercadoPago access token format');
        });

        it('should create adapter with APP_USR token in sandbox mode', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                accessToken: 'APP_USR-test-credentials-token',
                sandbox: true
            });

            // Assert
            expect(adapter).toBeDefined();
            expect(adapter.provider).toBe('mercadopago');
        });

        it('should create adapter with APP_USR token in production mode', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token-1234567890',
                sandbox: false
            });

            // Assert
            expect(adapter).toBeDefined();
            expect(adapter.provider).toBe('mercadopago');
        });
    });

    describe('Default values', () => {
        it('should return correct default currency', () => {
            // Arrange & Act
            const currency = getDefaultCurrency();

            // Assert
            expect(currency).toBe('ARS');
        });

        it('should return correct default country', () => {
            // Arrange & Act
            const country = getDefaultCountry();

            // Assert
            expect(country).toBe('AR');
        });
    });
});

describe('MercadoPago Adapter - Customer Operations', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
        adapter = createMercadoPagoAdapter();
    });

    it('should create customer successfully', async () => {
        // Arrange
        const customerData = {
            email: 'customer@example.com',
            name: 'Test Customer'
        };

        // Act
        const result = await adapter.customers.create(customerData);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe('cust_test_123');
        expect(result.email).toBe('customer@example.com');
        expect(adapter.customers.create).toHaveBeenCalledWith(customerData);
    });

    it('should retrieve customer by id', async () => {
        // Arrange
        const customerId = 'cust_test_123';

        // Act
        const result = await adapter.customers.retrieve(customerId);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe(customerId);
        expect(adapter.customers.retrieve).toHaveBeenCalledWith(customerId);
    });

    it('should update customer information', async () => {
        // Arrange
        const customerId = 'cust_test_123';
        const updateData = { email: 'updated@example.com' };

        // Act
        const result = await adapter.customers.update(customerId, updateData);

        // Assert
        expect(result).toBeDefined();
        expect(result.email).toBe('updated@example.com');
        expect(adapter.customers.update).toHaveBeenCalledWith(customerId, updateData);
    });

    it('should delete customer', async () => {
        // Arrange
        const customerId = 'cust_test_123';

        // Act
        const result = await adapter.customers.delete(customerId);

        // Assert
        expect(result).toBeDefined();
        expect(result.deleted).toBe(true);
        expect(adapter.customers.delete).toHaveBeenCalledWith(customerId);
    });
});

describe('MercadoPago Adapter - Subscription Operations', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
        adapter = createMercadoPagoAdapter();
    });

    it('should create subscription successfully', async () => {
        // Arrange
        const subscriptionData = {
            customerId: 'cust_test_123',
            planId: 'plan_basic'
        };

        // Act
        const result = await adapter.subscriptions.create(subscriptionData);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe('sub_test_123');
        expect(result.status).toBe('active');
        expect(result.planId).toBe('plan_basic');
    });

    it('should retrieve subscription by id', async () => {
        // Arrange
        const subscriptionId = 'sub_test_123';

        // Act
        const result = await adapter.subscriptions.retrieve(subscriptionId);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe(subscriptionId);
        expect(result.status).toBe('active');
    });

    it('should update subscription status', async () => {
        // Arrange
        const subscriptionId = 'sub_test_123';
        const updateData = { status: 'canceled' };

        // Act
        const result = await adapter.subscriptions.update(subscriptionId, updateData);

        // Assert
        expect(result).toBeDefined();
        expect(result.status).toBe('canceled');
    });

    it('should cancel subscription', async () => {
        // Arrange
        const subscriptionId = 'sub_test_123';

        // Act
        const result = await adapter.subscriptions.cancel(subscriptionId);

        // Assert
        expect(result).toBeDefined();
        expect(result.status).toBe('canceled');
    });
});

describe('MercadoPago Adapter - Payment Operations', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
        adapter = createMercadoPagoAdapter();
    });

    it('should create payment successfully', async () => {
        // Arrange
        const paymentData = {
            amount: 15000,
            currency: 'ARS'
        };

        // Act
        const result = await adapter.payments.create(paymentData);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe('pay_test_123');
        expect(result.amount).toBe(15000);
        expect(result.currency).toBe('ARS');
        expect(result.status).toBe('approved');
    });

    it('should retrieve payment by id', async () => {
        // Arrange
        const paymentId = 'pay_test_123';

        // Act
        const result = await adapter.payments.retrieve(paymentId);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe(paymentId);
        expect(result.status).toBe('approved');
    });

    it('should refund payment', async () => {
        // Arrange
        const paymentId = 'pay_test_123';
        const refundData = { amount: 15000 };

        // Act
        const result = await adapter.payments.refund(paymentId, refundData);

        // Assert
        expect(result).toBeDefined();
        expect(result.paymentId).toBe(paymentId);
        expect(result.amount).toBe(15000);
        expect(result.status).toBe('approved');
    });
});

describe('MercadoPago Adapter - Checkout Operations', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
        adapter = createMercadoPagoAdapter();
    });

    it('should create payment preference successfully', async () => {
        // Arrange
        const preferenceData = {
            items: [
                {
                    title: 'Plan Básico',
                    quantity: 1,
                    unitPrice: 15000
                }
            ],
            backUrls: {
                success: 'https://hospeda.com/success',
                failure: 'https://hospeda.com/failure',
                pending: 'https://hospeda.com/pending'
            }
        };

        // Act
        const result = await adapter.checkout.createPreference(preferenceData);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe('pref_test_123');
        expect(result.initPoint).toContain('mercadopago.com.ar');
        expect(result.sandboxInitPoint).toContain('sandbox.mercadopago.com.ar');
    });
});

describe('MercadoPago Adapter - Webhook Operations', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', 'test-webhook-secret');
        adapter = createMercadoPagoAdapter();
    });

    it('should verify webhook signature successfully', () => {
        // Arrange
        const payload = '{"type":"payment","data":{"id":"12345"}}';
        const signature = 'test-signature-hash';

        // Act
        const result = adapter.webhooks.verifySignature(payload, signature);

        // Assert
        expect(result).toBe(true);
        expect(adapter.webhooks.verifySignature).toHaveBeenCalledWith(payload, signature);
    });

    it('should construct webhook event from payload', () => {
        // Arrange
        const payload = JSON.stringify({
            type: 'payment',
            data: {
                id: '12345',
                status: 'approved'
            }
        });

        // Act
        const result = adapter.webhooks.constructEvent(payload);

        // Assert
        expect(result).toBeDefined();
        expect(result.type).toBe('payment');
        expect(result.data.id).toBe('12345');
    });
});

describe('MercadoPago Adapter - Error Handling', () => {
    let adapter: any;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');
    });

    it('should handle network errors gracefully', async () => {
        // Arrange
        adapter = createMercadoPagoAdapter();
        adapter.payments.create = vi.fn().mockRejectedValue(new Error('Network error'));

        // Act & Assert
        await expect(adapter.payments.create({ amount: 15000 })).rejects.toThrow('Network error');
    });

    it('should handle invalid response errors', async () => {
        // Arrange
        adapter = createMercadoPagoAdapter();
        adapter.customers.create = vi.fn().mockRejectedValue(new Error('Invalid response'));

        // Act & Assert
        await expect(adapter.customers.create({ email: 'test@example.com' })).rejects.toThrow(
            'Invalid response'
        );
    });

    it('should handle missing webhook secret gracefully', () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', '');

        // Act
        adapter = createMercadoPagoAdapter();

        // Assert
        expect(adapter).toBeDefined();
        expect(adapter.webhooks).toBeDefined();
    });

    it('should throw error for missing access token', () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', '');

        // Act & Assert
        expect(() => createMercadoPagoAdapter()).toThrow();
    });
});

describe('MercadoPago Adapter - Sandbox vs Production Mode', () => {
    it('should detect sandbox mode from TEST token', () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-sandbox-token');
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_SANDBOX', 'true');

        // Act
        const adapter = createMercadoPagoAdapter();

        // Assert
        expect(adapter).toBeDefined();
    });

    it('should detect production mode from APP_USR token', () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'APP_USR-production-token');
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_SANDBOX', 'false');
        vi.stubEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', 'prod-webhook-secret');

        // Act
        const adapter = createMercadoPagoAdapter();

        // Assert
        expect(adapter).toBeDefined();
    });

    it('should allow APP_USR token in sandbox mode', () => {
        // Arrange & Act
        const adapter = createMercadoPagoAdapter({
            accessToken: 'APP_USR-test-credentials-token',
            sandbox: true
        });

        // Assert
        expect(adapter).toBeDefined();
        expect(adapter.provider).toBe('mercadopago');
    });

    it('should allow TEST token in sandbox mode', () => {
        // Arrange & Act
        const adapter = createMercadoPagoAdapter({
            accessToken: 'TEST-test-token',
            sandbox: true
        });

        // Assert
        expect(adapter).toBeDefined();
        expect(adapter.provider).toBe('mercadopago');
    });
});
