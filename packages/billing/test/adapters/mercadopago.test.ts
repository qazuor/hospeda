/**
 * Tests for MercadoPago adapter configuration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMercadoPagoAdapter,
    getDefaultCountry,
    getDefaultCurrency
} from '../../src/adapters/mercadopago';

// Mock @repo/config to avoid resolution issues (dist not built in test)
vi.mock('@repo/config', () => ({
    getEnv: vi.fn((name: string, fallback?: string) => {
        return process.env[name] ?? fallback ?? '';
    }),
    getEnvBoolean: vi.fn((name: string, fallback = false) => {
        const val = process.env[name];
        if (val === undefined) return fallback;
        return val === 'true';
    }),
    getEnvNumber: vi.fn((name: string, fallback?: number) => {
        const val = process.env[name];
        if (val === undefined) return fallback ?? 0;
        return Number(val);
    })
}));

// Mock @repo/logger
vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

// Mock the QZPay MercadoPago adapter
vi.mock('@qazuor/qzpay-mercadopago', () => ({
    createQZPayMercadoPagoAdapter: vi.fn((config: Record<string, unknown>) => ({
        provider: 'mercadopago',
        config,
        customers: {
            create: vi.fn(),
            retrieve: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        subscriptions: {
            create: vi.fn(),
            retrieve: vi.fn(),
            update: vi.fn(),
            cancel: vi.fn()
        },
        payments: {
            create: vi.fn(),
            retrieve: vi.fn(),
            refund: vi.fn()
        },
        checkout: {
            createPreference: vi.fn()
        },
        prices: {
            create: vi.fn(),
            retrieve: vi.fn()
        },
        webhooks: {
            verifySignature: vi.fn(),
            constructEvent: vi.fn()
        }
    }))
}));

// Mock environment variables
const mockEnv = {
    HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-1234567890',
    HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: 'test-webhook-secret',
    HOSPEDA_MERCADO_PAGO_SANDBOX: 'true',
    HOSPEDA_MERCADO_PAGO_TIMEOUT: '10000',
    HOSPEDA_MERCADO_PAGO_PLATFORM_ID: 'test-platform',
    HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID: 'test-integrator'
};

describe('MercadoPago Adapter Configuration', () => {
    beforeEach(() => {
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

        it('should create adapter with production token in production mode', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token-1234567890',
                sandbox: false
            });

            // Assert
            expect(adapter).toBeDefined();
            expect(adapter.provider).toBe('mercadopago');
        });

        it('should allow empty webhook secret in sandbox mode with warning', () => {
            // Arrange
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', '');

            // Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
            // Logger warn is called by the mocked logger (via @repo/logger mock)
        });

        it('should throw error when webhook secret is missing in production mode', () => {
            // Arrange & Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: 'APP_USR-production-token-1234567890',
                    webhookSecret: '',
                    sandbox: false
                });
            }).toThrow('Webhook secret is required in production mode');
        });

        it('should throw error when webhook secret is undefined in production mode', () => {
            // Arrange
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET', '');

            // Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: 'APP_USR-production-token-1234567890',
                    sandbox: false
                });
            }).toThrow('Webhook secret is required in production mode');
        });

        it('should succeed in production mode with valid webhook secret', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                accessToken: 'APP_USR-production-token-1234567890',
                webhookSecret: 'valid-secret-123',
                sandbox: false
            });

            // Assert
            expect(adapter).toBeDefined();
        });

        it('should throw error when accessToken is empty string', () => {
            // Arrange & Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: ''
                });
            }).toThrow('MercadoPago access token is required');
        });

        it('should use default retry configuration', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
            // Retry config is internal, just verify adapter was created successfully
        });

        it('should use custom retry configuration', () => {
            // Arrange & Act
            const adapter = createMercadoPagoAdapter({
                retry: {
                    enabled: true,
                    maxAttempts: 5,
                    initialDelayMs: 2000
                }
            });

            // Assert
            expect(adapter).toBeDefined();
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

    describe('Environment variable handling', () => {
        it('should throw error when access token is missing', () => {
            // Arrange
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', '');

            // Act & Assert
            expect(() => {
                createMercadoPagoAdapter();
            }).toThrow();
        });

        it('should use default values for optional env vars', () => {
            // Arrange
            vi.unstubAllEnvs();
            vi.stubEnv('HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');

            // Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
        });
    });
});
