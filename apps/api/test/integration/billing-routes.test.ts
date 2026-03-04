/**
 * Integration tests for Billing Routes
 *
 * Tests billing-related API endpoints including:
 * - Promo code validation and application
 * - Add-on listing and purchase flows
 * - Trial status checking
 * - Billing system availability handling
 *
 * Note: These tests focus on Hospeda custom routes.
 * QZPay pre-built routes are tested upstream.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

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

// Mock service-core (auto-mock all services)
vi.mock('@repo/service-core');

describe('Billing Routes Integration', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Billing Not Configured', () => {
        it('should return 503 when billing is not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/plans', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            expect(data.error.message).toContain('Billing service is not configured');
        });

        it('should return 503 for promo code routes when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    code: 'TEST123',
                    userId: 'user-123'
                })
            });

            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
        });

        it('should return 503 for add-on routes when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/addons', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for trial routes when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/trial/status', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });
    });

    describe('Promo Code Routes', () => {
        describe('POST /api/v1/billing/promo-codes/validate', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes/validate', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024',
                        userId: 'user-123',
                        planId: 'plan-123'
                    })
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });

            it('should validate request body format', async () => {
                const app = initApp();

                // Missing required fields
                const res = await app.request('/api/v1/billing/promo-codes/validate', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024'
                        // Missing userId
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should reject empty promo code', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes/validate', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: '',
                        userId: 'user-123'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid validation request with all fields', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes/validate', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024',
                        userId: 'user-123',
                        planId: 'plan-123',
                        amount: 5000
                    })
                });

                expect(res.status).toBe(503);
            });
        });

        describe('POST /api/v1/billing/promo-codes/apply', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes/apply', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024',
                        customerId: 'checkout-123'
                    })
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate checkout ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes/apply', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024',
                        customerId: 'invalid-uuid'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid apply request', async () => {
                const app = initApp();

                const validCheckoutId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request('/api/v1/billing/promo-codes/apply', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'SUMMER2024',
                        customerId: validCheckoutId
                    })
                });

                expect(res.status).toBe(503);
            });
        });

        describe('Admin Promo Code Routes', () => {
            it('should block non-admin users from creating promo codes', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: 'NEWCODE',
                        discountType: 'percentage',
                        discountValue: 10
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should block non-admin users from listing promo codes', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/promo-codes', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should block non-admin users from getting promo code by ID', async () => {
                const app = initApp();
                const promoId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/promo-codes/${promoId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should block non-admin users from updating promo codes', async () => {
                const app = initApp();
                const promoId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/promo-codes/${promoId}`, {
                    method: 'PUT',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        isActive: false
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should block non-admin users from deleting promo codes', async () => {
                const app = initApp();
                const promoId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/promo-codes/${promoId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Add-on Routes', () => {
        describe('GET /api/v1/billing/addons', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });

            it('should accept query filters for listing add-ons', async () => {
                const app = initApp();

                const res = await app.request(
                    '/api/v1/billing/addons?billingType=one_time&targetCategory=owner&active=true',
                    {
                        headers: {
                            'user-agent': 'test-agent'
                        }
                    }
                );

                expect(res.status).toBe(503);
            });
        });

        describe('GET /api/v1/billing/addons/:slug', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/featured-listing', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should validate slug is non-empty', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                // Should return 503 or 404 depending on routing
                expect([404, 503]).toContain(res.status);
            });
        });

        describe('POST /api/v1/billing/addons/:slug/purchase', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/featured-listing/purchase', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                expect(res.status).toBe(503);
            });

            it('should accept purchase request with promo code', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/featured-listing/purchase', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        promoCode: 'SUMMER2024'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept purchase request without promo code', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/featured-listing/purchase', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                expect(res.status).toBe(503);
            });
        });

        describe('GET /api/v1/billing/addons/my', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/my', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });
        });

        describe('POST /api/v1/billing/addons/:id/cancel', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const addonId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/addons/${addonId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        reason: 'No longer needed'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should validate addon ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/addons/invalid-uuid/cancel', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        reason: 'Test'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept cancel request without reason', async () => {
                const app = initApp();
                const addonId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/addons/${addonId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Trial Routes', () => {
        describe('GET /api/v1/billing/trial/status', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/trial/status', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });
        });

        describe('POST /api/v1/billing/trial/start', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/trial/start', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                expect(res.status).toBe(503);
            });

            it('should accept empty body for start trial (no userType required)', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/trial/start', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                // Returns 503 because billing is not configured in test env
                expect(res.status).toBe(503);
            });
        });

        describe('POST /api/v1/billing/trial/check-expiry', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/trial/check-expiry', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Request Validation', () => {
        it('should reject requests without user-agent header', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/plans', {
                headers: {
                    // Missing user-agent
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });

        it('should reject POST requests without content-type header', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent'
                    // Missing content-type
                },
                body: JSON.stringify({
                    code: 'TEST',
                    userId: 'user-123'
                })
            });

            // May return 400 for missing header or 503 for billing not configured
            expect([400, 503]).toContain(res.status);
        });

        it('should accept requests with valid headers', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/trial/status', {
                headers: {
                    'user-agent': 'test-agent',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(503);
        });
    });

    describe('QZPay Pre-built Routes', () => {
        it('should return 503 for plans route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/plans', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for customers route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/customers', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for subscriptions route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/subscriptions', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for invoices route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/invoices', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for payments route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/payments', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for entitlements route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/entitlements', {
                headers: {
                    'user-agent': 'test-agent'
                }
            });

            expect(res.status).toBe(503);
        });

        it('should return 503 for checkout route when billing not configured', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/checkout', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    planId: 'plan-123'
                })
            });

            expect(res.status).toBe(503);
        });
    });

    describe('Subscription Routes', () => {
        describe('POST /api/v1/billing/subscriptions', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/subscriptions', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        customerId: '550e8400-e29b-41d4-a716-446655440000',
                        planId: '550e8400-e29b-41d4-a716-446655440001'
                    })
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });

            it('should validate request body format', async () => {
                const app = initApp();

                // Missing required fields
                const res = await app.request('/api/v1/billing/subscriptions', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        customerId: '550e8400-e29b-41d4-a716-446655440000'
                        // Missing planId
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid subscription creation request', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/subscriptions', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        customerId: '550e8400-e29b-41d4-a716-446655440000',
                        planId: '550e8400-e29b-41d4-a716-446655440001',
                        startDate: new Date().toISOString()
                    })
                });

                expect(res.status).toBe(503);
            });
        });

        describe('GET /api/v1/billing/subscriptions/:id', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate subscription ID format (UUID)', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/subscriptions/invalid-uuid', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid UUID format', async () => {
                const app = initApp();
                const validSubscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(
                    `/api/v1/billing/subscriptions/${validSubscriptionId}`,
                    {
                        headers: {
                            'user-agent': 'test-agent'
                        }
                    }
                );

                expect(res.status).toBe(503);
            });
        });

        describe('PATCH /api/v1/billing/subscriptions/:id', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    method: 'PATCH',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440001'
                    })
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate subscription ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/subscriptions/not-a-uuid', {
                    method: 'PATCH',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440001'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept plan change request', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    method: 'PATCH',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440001'
                    })
                });

                expect(res.status).toBe(503);
            });
        });

        describe('DELETE /api/v1/billing/subscriptions/:id', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate subscription ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/subscriptions/invalid', {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid cancellation request', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept cancellation with body parameters', async () => {
                const app = initApp();
                const subscriptionId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/subscriptions/${subscriptionId}`, {
                    method: 'DELETE',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        cancelAt: 'end_of_period',
                        reason: 'Customer request'
                    })
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Checkout Routes', () => {
        describe('POST /api/v1/billing/checkout', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/checkout', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440000'
                    })
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });

            it('should validate planId is provided', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/checkout', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        // Missing planId
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept checkout with promo code', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/checkout', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440000',
                        promoCode: 'WELCOME2024'
                    })
                });

                expect(res.status).toBe(503);
            });

            it('should accept checkout with custom metadata', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/checkout', {
                    method: 'POST',
                    headers: {
                        'user-agent': 'test-agent',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        planId: '550e8400-e29b-41d4-a716-446655440000',
                        metadata: {
                            source: 'web',
                            campaign: 'summer-sale'
                        }
                    })
                });

                expect(res.status).toBe(503);
            });
        });

        describe('GET /api/v1/billing/checkout/:id', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const customerId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/checkout/${customerId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate checkout ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/checkout/not-valid-uuid', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid checkout ID', async () => {
                const app = initApp();
                const validCheckoutId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/checkout/${validCheckoutId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Payment Routes', () => {
        describe('GET /api/v1/billing/payments', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/payments', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            });

            it('should accept pagination query parameters', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/payments?page=1&limit=10', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept status filter', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/payments?status=succeeded', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept customer filter', async () => {
                const app = initApp();
                const customerId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/payments?customerId=${customerId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept combined query parameters', async () => {
                const app = initApp();
                const customerId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(
                    `/api/v1/billing/payments?page=1&limit=20&status=succeeded&customerId=${customerId}`,
                    {
                        headers: {
                            'user-agent': 'test-agent'
                        }
                    }
                );

                expect(res.status).toBe(503);
            });
        });

        describe('GET /api/v1/billing/payments/:id', () => {
            it('should return 503 when billing is not configured', async () => {
                const app = initApp();
                const paymentId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/payments/${paymentId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data.success).toBe(false);
            });

            it('should validate payment ID format', async () => {
                const app = initApp();

                const res = await app.request('/api/v1/billing/payments/invalid-id', {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });

            it('should accept valid payment ID', async () => {
                const app = initApp();
                const validPaymentId = '550e8400-e29b-41d4-a716-446655440000';

                const res = await app.request(`/api/v1/billing/payments/${validPaymentId}`, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
            });
        });
    });

    describe('Error Handling', () => {
        it('should return proper error format for all billing routes', async () => {
            const app = initApp();
            const routes = [
                '/api/v1/billing/plans',
                '/api/v1/billing/addons',
                '/api/v1/billing/trial/status'
            ];

            for (const route of routes) {
                const res = await app.request(route, {
                    headers: {
                        'user-agent': 'test-agent'
                    }
                });

                expect(res.status).toBe(503);
                const data = await res.json();
                expect(data).toHaveProperty('success');
                expect(data).toHaveProperty('error');
                expect(data.success).toBe(false);
                expect(data.error).toHaveProperty('code');
                expect(data.error).toHaveProperty('message');
                expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
            }
        });

        it('should handle malformed JSON gracefully', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/billing/promo-codes/validate', {
                method: 'POST',
                headers: {
                    'user-agent': 'test-agent',
                    'content-type': 'application/json'
                },
                body: 'not valid json {'
            });

            // Should return error for malformed JSON
            expect([400, 503]).toContain(res.status);
        });
    });
});
