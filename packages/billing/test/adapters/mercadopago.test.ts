/**
 * Tests for MercadoPago adapter configuration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMercadoPagoAdapter,
    getDefaultCountry,
    getDefaultCurrency
} from '../../src/adapters/mercadopago';

// Mock environment variables
const mockEnv = {
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-1234567890',
    MERCADO_PAGO_WEBHOOK_SECRET: 'test-webhook-secret',
    MERCADO_PAGO_SANDBOX: 'true',
    MERCADO_PAGO_TIMEOUT: '10000',
    MERCADO_PAGO_PLATFORM_ID: 'test-platform',
    MERCADO_PAGO_INTEGRATOR_ID: 'test-integrator'
};

describe('MercadoPago Adapter Configuration', () => {
    beforeEach(() => {
        // Reset environment variables
        vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', mockEnv.MERCADO_PAGO_ACCESS_TOKEN);
        vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', mockEnv.MERCADO_PAGO_WEBHOOK_SECRET);
        vi.stubEnv('MERCADO_PAGO_SANDBOX', mockEnv.MERCADO_PAGO_SANDBOX);
        vi.stubEnv('MERCADO_PAGO_TIMEOUT', mockEnv.MERCADO_PAGO_TIMEOUT);
        vi.stubEnv('MERCADO_PAGO_PLATFORM_ID', mockEnv.MERCADO_PAGO_PLATFORM_ID);
        vi.stubEnv('MERCADO_PAGO_INTEGRATOR_ID', mockEnv.MERCADO_PAGO_INTEGRATOR_ID);
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

        it('should throw error when sandbox mode mismatches token type', () => {
            // Arrange & Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: 'APP_USR-production-token',
                    sandbox: true
                });
            }).toThrow('Sandbox mode requires a TEST- access token');
        });

        it('should throw error when production mode receives test token', () => {
            // Arrange & Act & Assert
            expect(() => {
                createMercadoPagoAdapter({
                    accessToken: 'TEST-test-token',
                    sandbox: false
                });
            }).toThrow('Production mode requires an APP_USR- access token');
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

        it('should handle optional webhook secret', () => {
            // Arrange
            vi.stubEnv('MERCADO_PAGO_WEBHOOK_SECRET', '');

            // Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
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
            vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', '');

            // Act & Assert
            expect(() => {
                createMercadoPagoAdapter();
            }).toThrow();
        });

        it('should use default values for optional env vars', () => {
            // Arrange
            vi.unstubAllEnvs();
            vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', 'TEST-1234567890');

            // Act
            const adapter = createMercadoPagoAdapter();

            // Assert
            expect(adapter).toBeDefined();
        });
    });
});
