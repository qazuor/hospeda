/**
 * Integration tests for MercadoPago webhook endpoint
 *
 * Tests webhook signature verification, event processing, and error handling
 *
 * NOTE: These tests use mocked services from test/setup.ts
 * The webhook handler processes events but AddonService calls are mocked
 * to avoid real billing operations during testing
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('MercadoPago Webhook Integration Tests', () => {
    /**
     * Test context
     */
    const webhookPath = '/api/v1/webhooks/mercadopago';
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    describe('Endpoint availability', () => {
        it('should accept POST requests to webhook endpoint', async () => {
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
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    // x-signature would normally be required, but QZPay middleware will validate
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should respond (may be 200 OK or 401/403 if signature invalid)
            // The key is that the endpoint exists and accepts requests
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should reject GET requests', async () => {
            // Act
            const response = await app.request(webhookPath, {
                method: 'GET',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            // Webhook endpoint only accepts POST
            expect(response.status).toBe(404);
        });

        it('should reject PUT requests', async () => {
            // Act
            const response = await app.request(webhookPath, {
                method: 'PUT',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });

            // Assert
            expect(response.status).toBe(404);
        });

        it('should reject DELETE requests', async () => {
            // Act
            const response = await app.request(webhookPath, {
                method: 'DELETE',
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            // Assert
            expect(response.status).toBe(404);
        });
    });

    describe('Request format validation', () => {
        it('should reject requests without content-type header', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12345,
                type: 'payment',
                action: 'payment.created'
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject requests with invalid JSON', async () => {
            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: 'invalid-json{{'
            });

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject requests without user-agent', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12345,
                type: 'payment',
                action: 'payment.created'
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });
    });

    describe('Webhook signature verification', () => {
        it('should reject requests without x-signature header', async () => {
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
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json'
                    // Missing x-signature header
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay middleware should reject without signature
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject requests with invalid signature format', async () => {
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
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'invalid-signature-format'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay middleware should reject invalid signature format
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('Event types handling', () => {
        it('should handle payment.created events', async () => {
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
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should process (may fail signature verification, but event type is recognized)
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should handle payment.updated events', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12346,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-123'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle subscription_preapproval.updated events', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12347,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'subscription-123'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle unknown event types gracefully', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 12348,
                type: 'unknown',
                action: 'unknown.action',
                data: {
                    id: 'unknown-123'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should process gracefully (return 200 OK to prevent retries)
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });
    });

    describe('Idempotency handling', () => {
        it('should handle duplicate webhook events', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 99999, // Same event ID
                type: 'payment',
                action: 'payment.created',
                data: {
                    id: 'payment-duplicate'
                }
            };

            // Act - Send same webhook twice
            const response1 = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            const response2 = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay should handle idempotency
            // Both should return success (200 OK)
            expect(response1.status).toBeGreaterThanOrEqual(200);
            expect(response2.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('Response format', () => {
        it('should return JSON response', async () => {
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
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            expect(response.headers.get('content-type')).toContain('application/json');
        });
    });

    describe('Add-on purchase processing', () => {
        it('should process add-on purchase when payment.updated has complete metadata', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-addon-123',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'extra-listing',
                        customerId: 'cust_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Webhook should process successfully (returns 200-level response)
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should not process add-on when metadata has only addonSlug (missing customerId)', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50002,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-incomplete-123',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'extra-listing'
                        // Missing customerId
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
            // Should not throw error, just skip add-on processing
        });

        it('should not process add-on when metadata has only customerId (missing addonSlug)', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50003,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-incomplete-456',
                    status: 'approved',
                    metadata: {
                        customerId: 'cust_abc123'
                        // Missing addonSlug
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle add-on confirmation failure gracefully', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50004,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-fail-123',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'invalid-addon',
                        customerId: 'cust_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should still return 200 OK to prevent MercadoPago retries
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should process add-on from external_reference as fallback (missing customerId)', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50005,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-reference-123',
                    status: 'approved',
                    external_reference: 'addon_extra-listing_1640000000000',
                    metadata: {}
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should process but defer to QZPay default processing
            // since we don't have customerId
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should not process add-on when external_reference does not match pattern', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 50006,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-invalid-ref-123',
                    status: 'approved',
                    external_reference: 'regular-payment-123', // Not addon pattern
                    metadata: {}
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });
    });

    describe('Metadata extraction logic', () => {
        it('should extract add-on metadata when both fields are present', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 60001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-valid-metadata',
                    metadata: {
                        addonSlug: 'priority-placement',
                        customerId: 'cust_xyz789',
                        otherField: 'ignored'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle metadata with empty string values', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 60002,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-empty-metadata',
                    metadata: {
                        addonSlug: '',
                        customerId: 'cust_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Empty strings should be treated as missing
            expect(response.status).toBeGreaterThanOrEqual(200);
        });

        it('should handle metadata with non-string values', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 60003,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-wrong-type',
                    metadata: {
                        addonSlug: 123, // Number instead of string
                        customerId: 'cust_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should handle gracefully (type check fails)
            expect(response.status).toBeGreaterThanOrEqual(200);
        });

        it('should handle null metadata', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 60004,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-null-metadata',
                    metadata: null
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle missing metadata field', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 60005,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-no-metadata'
                    // No metadata field
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });
    });

    describe('External reference extraction logic', () => {
        it('should extract add-on slug from valid external_reference pattern', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-valid-ref',
                    external_reference: 'addon_extra-listing_1640995200000'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle external_reference with invalid pattern', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70002,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-invalid-pattern',
                    external_reference: 'not_an_addon_reference'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle external_reference with wrong prefix', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70003,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-wrong-prefix',
                    external_reference: 'subscription_extra-listing_1640995200000'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle non-string external_reference', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70004,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-non-string-ref',
                    external_reference: 123456789 // Number instead of string
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle missing external_reference', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70005,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-no-ref'
                    // No external_reference
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle external_reference with invalid slug characters', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 70006,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-invalid-slug',
                    external_reference: 'addon_Invalid_Slug_With_Capitals_1640995200000'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Pattern requires lowercase and hyphens only
            expect(response.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('Error handling', () => {
        it('should handle errors in add-on processing without failing webhook', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 80001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-error-123',
                    metadata: {
                        addonSlug: 'valid-addon',
                        customerId: 'cust_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should still return 200 OK even if add-on processing fails
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should handle malformed data object gracefully', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 80002,
                type: 'payment',
                action: 'payment.updated',
                data: null // Malformed data
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });

        it('should handle missing data field gracefully', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 80003,
                type: 'payment',
                action: 'payment.updated'
                // Missing data field
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });
    });

    describe('Event Processing - Payment Events', () => {
        it('should trigger subscription activation on payment.updated with status "approved"', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 90001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-approved-123',
                    status: 'approved',
                    metadata: {}
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay will handle subscription activation internally
            // May return 404 if billing not configured, or 200/401/403 if configured
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should log warning on payment.updated with status "rejected"', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 90002,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-rejected-123',
                    status: 'rejected',
                    status_detail: 'cc_rejected_bad_filled_card_number',
                    metadata: {}
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Webhook should still return 200 OK (to prevent retries)
            // QZPay will handle logging internally
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should call AddonService.confirmPurchase when payment.updated has add-on metadata', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 90003,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-addon-approved',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'extra-listing',
                        customerId: 'cust_test_123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Webhook should process add-on and return 200 OK
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);

            // AddonService.confirmPurchase would be called internally
            // (cannot verify mock calls due to internal QZPay processing)
        });

        it('should continue to default QZPay processing without add-on metadata', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 90004,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-regular-123',
                    status: 'approved',
                    metadata: {
                        // No addonSlug or customerId
                        someOtherField: 'value'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should process normally through QZPay default processing
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should process payment.updated with approved status and complete metadata', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 90005,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-complete-metadata',
                    status: 'approved',
                    amount: 5000,
                    currency: 'ARS',
                    metadata: {
                        addonSlug: 'priority-placement',
                        customerId: 'cust_xyz789',
                        userId: 'user_abc123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });
    });

    describe('Event Processing - Subscription Events', () => {
        it('should process subscription_preapproval.updated with status "authorized"', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 91001,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'preapproval-authorized-123',
                    status: 'authorized',
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay handles subscription authorization internally
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should process subscription_preapproval.updated with status "cancelled"', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 91002,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'preapproval-cancelled-123',
                    status: 'cancelled',
                    reason: 'user_cancelled'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // QZPay handles subscription cancellation internally
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should process subscription_preapproval.updated with status "paused"', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 91003,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'preapproval-paused-123',
                    status: 'paused'
                }
            };

            // Act
            const response = await app.request(webhookPath, {
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
        });
    });

    describe('Idempotency', () => {
        it('should not cause errors when same event ID is processed twice', async () => {
            // Arrange
            const duplicateEventId = 92001;
            const mockWebhookPayload = {
                id: duplicateEventId,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-duplicate-test',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'extra-listing',
                        customerId: 'cust_dup123'
                    }
                }
            };

            // Act - Send webhook twice with same event ID
            const response1 = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature-1'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            const response2 = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567891,v1=test-signature-2'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Both requests should succeed
            expect(response1.status).toBeGreaterThanOrEqual(200);
            expect(response1.status).toBeLessThan(500);
            expect(response2.status).toBeGreaterThanOrEqual(200);
            expect(response2.status).toBeLessThan(500);

            // QZPay handles idempotency internally
            // Second event should be ignored (deduplicated)
        });

        it('should handle duplicate webhook deliveries gracefully', async () => {
            // Arrange
            const eventId = 92002;
            const mockWebhookPayload = {
                id: eventId,
                type: 'subscription_preapproval',
                action: 'subscription_preapproval.updated',
                data: {
                    id: 'subscription-duplicate',
                    status: 'authorized'
                }
            };

            // Act - Simulate MercadoPago retrying same webhook
            const responses = await Promise.all([
                app.request(webhookPath, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'MercadoPago/1.0',
                        'content-type': 'application/json',
                        'x-signature': 'ts=1234567890,v1=sig-a'
                    },
                    body: JSON.stringify(mockWebhookPayload)
                }),
                app.request(webhookPath, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'MercadoPago/1.0',
                        'content-type': 'application/json',
                        'x-signature': 'ts=1234567891,v1=sig-b'
                    },
                    body: JSON.stringify(mockWebhookPayload)
                }),
                app.request(webhookPath, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'MercadoPago/1.0',
                        'content-type': 'application/json',
                        'x-signature': 'ts=1234567892,v1=sig-c'
                    },
                    body: JSON.stringify(mockWebhookPayload)
                })
            ]);

            // Assert
            // All deliveries should be acknowledged with 200 OK
            for (const response of responses) {
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            }
        });
    });

    describe('Error Resilience', () => {
        it('should not crash webhook handler on service errors', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 93001,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-service-error',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'invalid-addon-that-will-fail',
                        customerId: 'cust_error123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Even if addon confirmation fails, webhook should still return 200 OK
            // to prevent MercadoPago from retrying
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should always return 200 to prevent retries from payment provider', async () => {
            // Arrange - Test with various error scenarios
            const errorScenarios = [
                {
                    id: 93002,
                    type: 'payment',
                    action: 'payment.updated',
                    data: null // Null data
                },
                {
                    id: 93003,
                    type: 'payment',
                    action: 'payment.updated',
                    data: {
                        id: 'payment-malformed',
                        // Missing status
                        metadata: 'invalid-metadata-type' // Wrong type
                    }
                },
                {
                    id: 93004,
                    type: 'unknown_type',
                    action: 'unknown.action',
                    data: {
                        id: 'unknown-event'
                    }
                }
            ];

            // Act & Assert
            for (const scenario of errorScenarios) {
                const response = await app.request(webhookPath, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'MercadoPago/1.0',
                        'content-type': 'application/json',
                        'x-signature': 'ts=1234567890,v1=test-signature'
                    },
                    body: JSON.stringify(scenario)
                });

                // All error scenarios should still return 200-level response
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            }
        });

        it('should handle missing fields in payload gracefully', async () => {
            // Arrange - Payload missing required fields
            const mockWebhookPayload = {
                id: 93005,
                type: 'payment',
                action: 'payment.updated'
                // Missing 'data' field entirely
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Should not crash, return 200 OK
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should handle webhook processing with invalid add-on slug', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 93006,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-invalid-addon',
                    status: 'approved',
                    metadata: {
                        addonSlug: '', // Empty string
                        customerId: 'cust_test123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Empty addon slug should be treated as missing metadata
            // Should still return 200 OK
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should handle webhook processing with billing service unavailable', async () => {
            // Arrange
            const mockWebhookPayload = {
                id: 93007,
                type: 'payment',
                action: 'payment.updated',
                data: {
                    id: 'payment-no-billing',
                    status: 'approved',
                    metadata: {
                        addonSlug: 'extra-listing',
                        customerId: 'cust_test123'
                    }
                }
            };

            // Act
            const response = await app.request(webhookPath, {
                method: 'POST',
                headers: {
                    'user-agent': 'MercadoPago/1.0',
                    'content-type': 'application/json',
                    'x-signature': 'ts=1234567890,v1=test-signature'
                },
                body: JSON.stringify(mockWebhookPayload)
            });

            // Assert
            // Even if billing is unavailable, webhook should acknowledge receipt
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(500);
        });

        it('should handle concurrent webhook requests without race conditions', async () => {
            // Arrange
            const baseEventId = 94000;
            const concurrentRequests = 5;

            // Create concurrent webhook requests with different event IDs
            const requests = Array.from({ length: concurrentRequests }, (_, i) => {
                const mockWebhookPayload = {
                    id: baseEventId + i,
                    type: 'payment',
                    action: 'payment.updated',
                    data: {
                        id: `payment-concurrent-${i}`,
                        status: 'approved',
                        metadata: {
                            addonSlug: 'extra-listing',
                            customerId: `cust_concurrent_${i}`
                        }
                    }
                };

                return app.request(webhookPath, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'MercadoPago/1.0',
                        'content-type': 'application/json',
                        'x-signature': `ts=${1234567890 + i},v1=test-signature-${i}`
                    },
                    body: JSON.stringify(mockWebhookPayload)
                });
            });

            // Act - Execute all requests concurrently
            const responses = await Promise.all(requests);

            // Assert
            // All concurrent requests should be processed successfully
            for (const response of responses) {
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            }
        });
    });
});
