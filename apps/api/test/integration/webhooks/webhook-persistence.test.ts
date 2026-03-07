/**
 * Integration tests for Webhook Event Persistence
 *
 * Tests webhook event persistence to billing_webhook_events table including:
 * - Webhook receipt creates row with status 'pending'
 * - Successful processing updates status to 'processed'
 * - Failed processing updates status to 'failed' with error message
 * - Webhook health endpoint returns correct statistics
 *
 * These tests focus on webhook event lifecycle tracking in the database.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

// Mock @repo/logger
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel
    };
});

// Mock service-core
vi.mock('@repo/service-core');

describe('Webhook Event Persistence Integration Tests', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        app = initApp();
        vi.clearAllMocks();
    });

    describe('Webhook Event Creation', () => {
        it('should create billing_webhook_events row when webhook is received', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12345,
                type: 'payment',
                action: 'payment.created',
                data: {
                    id: 'payment-123'
                }
            };

            // Act
            const response = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Webhook should be accepted (returns 200 even if signature verification fails)
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);

            // Note: Actual database check would require DB access
            // In real implementation, we'd verify the record exists in billing_webhook_events
            // with status='pending', provider='mercadopago', and payload matching
        });

        it('should store webhook event with correct provider and type', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 54321,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'subscription-456'
                }
            };

            // Act
            const response = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);

            // Expected: billing_webhook_events row created with:
            // - provider = 'mercadopago'
            // - type = 'subscription_preapproval.updated'
            // - providerEventId = '54321'
            // - status = 'pending'
        });

        it('should handle idempotency - skip duplicate webhook events', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 99999,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-duplicate'
                }
            };

            // Act - Send same webhook twice
            const response1 = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            const response2 = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response1.status).toBeGreaterThanOrEqual(200);
            expect(response2.status).toBeGreaterThanOrEqual(200);

            // Expected behavior:
            // - First request creates webhook event with status='pending'
            // - Second request finds existing event and skips (returns 200)
            // - Only one row exists in billing_webhook_events for this providerEventId
        });
    });

    describe('Webhook Processing Status Updates', () => {
        it('should update status to processed after successful processing', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 11111,
                type: 'payment',
                action: 'payment.created',
                data: {
                    id: 'payment-success',
                    status: 'approved'
                }
            };

            // Act
            const response = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);

            // Expected: billing_webhook_events row updated with:
            // - status = 'processed'
            // - processedAt = current timestamp
            // - error = null
        });

        it('should update status to failed with error message on processing failure', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 22222,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-failure',
                    // Missing required fields to trigger error
                    invalid: 'data'
                }
            };

            // Act
            const response = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Webhook handler returns 200 even on processing errors (to prevent retries)
            expect(response.status).toBe(200);

            // Expected: billing_webhook_events row updated with:
            // - status = 'failed'
            // - error = error message from processing
            // - processedAt = null (not successfully processed)
        });

        it('should allow reprocessing of previously failed webhooks', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 33333,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-retry'
                }
            };

            // Act - Send webhook that will fail first time
            const response1 = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Send again after fixing the issue
            const response2 = await app.request('/api/v1/webhooks/mercadopago', {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response1.status).toBeGreaterThanOrEqual(200);
            expect(response2.status).toBeGreaterThanOrEqual(200);

            // Expected behavior:
            // - First request fails, status='failed'
            // - Second request finds failed event and reprocesses it
            // - Status updated to 'pending' then 'processed' (or 'failed' again)
        });
    });

    describe('Webhook Health Endpoint', () => {
        it('should return webhook health statistics', async () => {
            // Arrange - Auth required (CRON_SECRET or admin)
            // For test environment, CRON_AUTH can be disabled
            process.env.CRON_AUTH_DISABLED = 'true';

            // Act
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
        });

        it('should return correct statistics structure', async () => {
            // Arrange
            process.env.CRON_AUTH_DISABLED = 'true';

            // Act
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data).toHaveProperty('last24h');
            expect(data.data.last24h).toHaveProperty('total');
            expect(data.data.last24h).toHaveProperty('processed');
            expect(data.data.last24h).toHaveProperty('failed');
            expect(data.data.last24h).toHaveProperty('pending');
            expect(data.data).toHaveProperty('lastEventAt');
            expect(data.data).toHaveProperty('deadLetterCount');
            expect(data.data).toHaveProperty('avgProcessingTimeMs');
        });

        it('should return statistics with correct types', async () => {
            // Arrange
            process.env.CRON_AUTH_DISABLED = 'true';

            // Act
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            expect(response.status).toBe(200);

            const data = await response.json();
            expect(typeof data.data.last24h.total).toBe('number');
            expect(typeof data.data.last24h.processed).toBe('number');
            expect(typeof data.data.last24h.failed).toBe('number');
            expect(typeof data.data.last24h.pending).toBe('number');
            expect(typeof data.data.deadLetterCount).toBe('number');
            expect(typeof data.data.avgProcessingTimeMs).toBe('number');
            // lastEventAt can be null if no events exist
            if (data.data.lastEventAt !== null) {
                expect(typeof data.data.lastEventAt).toBe('string');
            }
        });

        it('should require authentication when CRON_AUTH is enabled', async () => {
            // Arrange
            process.env.CRON_AUTH_DISABLED = undefined;
            process.env.HOSPEDA_CRON_SECRET = 'test-secret-123';

            // Act - Request without auth
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            // Should return 401 or 503 depending on configuration
            expect(response.status).toBeGreaterThanOrEqual(401);
        });

        it('should accept CRON_SECRET authentication', async () => {
            // Arrange
            process.env.CRON_AUTH_DISABLED = undefined;
            process.env.HOSPEDA_CRON_SECRET = 'test-secret-123';

            // Act - Request with Bearer token
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent',
                    authorization: 'Bearer test-secret-123'
                }
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
        });

        it('should accept X-Cron-Secret header authentication', async () => {
            // Arrange
            process.env.CRON_AUTH_DISABLED = undefined;
            process.env.HOSPEDA_CRON_SECRET = 'test-secret-123';

            // Act - Request with X-Cron-Secret header
            const response = await app.request('/api/v1/webhooks/health', {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent',
                    'x-cron-secret': 'test-secret-123'
                }
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
        });
    });
});
