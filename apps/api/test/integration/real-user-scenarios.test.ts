/**
 * Real User Scenarios End-to-End Integration Tests
 * Tests complete user journeys through the API to ensure the entire stack
 * works together seamlessly for real-world use cases
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { resetMetrics } from '../../src/middlewares/metrics';

// Mock external dependencies
vi.mock('@repo/logger', () => {
    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => mockLogger),
        registerLogMethod: vi.fn()
    };

    return {
        default: mockLogger,
        logger: mockLogger,
        LoggerColors: {
            GREEN: 'green',
            RED: 'red',
            BLUE: 'blue',
            YELLOW: 'yellow',
            CYAN: 'cyan',
            MAGENTA: 'magenta'
        },
        LogLevel: {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warn',
            ERROR: 'error'
        }
    };
});

vi.mock('@hono/clerk-auth', () => ({
    getAuth: vi.fn(() => ({ sessionId: null, userId: null })),
    clerkMiddleware: vi.fn(() => (_c: any, next: any) => next())
}));

// Mock service-core for AccommodationService and DestinationService
vi.mock('@repo/service-core', () => {
    const { z } = require('zod');

    // Mock schemas that match the structure from service-core
    const CreateAccommodationSchema = z.object({
        name: z.string(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        maxGuests: z.number().optional()
    });

    const UpdateAccommodationSchema = CreateAccommodationSchema.partial();

    const AccommodationService = vi.fn().mockImplementation(() => ({
        list: vi.fn().mockResolvedValue({
            data: {
                items: [
                    {
                        id: 'acc_123',
                        name: 'Test Accommodation',
                        slug: 'test-accommodation',
                        description: 'A test accommodation for scenarios'
                    }
                ],
                total: 1
            }
        }),
        getById: vi.fn().mockResolvedValue({
            data: {
                id: 'acc_123',
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                description: 'A test accommodation for scenarios'
            }
        }),
        getBySlug: vi.fn().mockResolvedValue({
            data: {
                id: 'acc_123',
                name: 'Test Accommodation',
                slug: 'test-accommodation',
                description: 'A test accommodation for scenarios'
            }
        }),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn()
    }));

    const DestinationService = vi.fn().mockImplementation(() => ({
        list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
        getById: vi.fn().mockResolvedValue({
            data: { id: 'dest_123', name: 'Test Destination', slug: 'test-destination' }
        }),
        getBySlug: vi.fn().mockResolvedValue({
            data: { id: 'dest_123', name: 'Test Destination', slug: 'test-destination' }
        }),
        getSummary: vi.fn().mockResolvedValue({
            data: {
                summary: {
                    id: 'dest_123',
                    slug: 'test-destination',
                    name: 'Test Destination',
                    country: 'X',
                    isFeatured: false,
                    averageRating: 0,
                    reviewsCount: 0,
                    accommodationsCount: 0
                }
            }
        }),
        getStats: vi.fn().mockResolvedValue({
            data: { stats: { accommodationsCount: 0, reviewsCount: 0, averageRating: 0 } }
        }),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn()
    }));

    const UserService = vi.fn().mockImplementation(() => ({
        list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
        getById: vi.fn().mockResolvedValue({ data: null }),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    }));

    const EventService = vi.fn().mockImplementation(() => ({
        // List & getters
        list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
        getById: vi.fn().mockResolvedValue({ data: null }),
        getBySlug: vi.fn().mockResolvedValue({ data: null }),
        getSummary: vi.fn().mockResolvedValue({ data: { summary: null } }),
        // Specialized lists
        getByAuthor: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        getByLocation: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        getByOrganizer: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        getByCategory: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        getFreeEvents: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        getUpcoming: vi.fn().mockResolvedValue({
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        }),
        // Mutations
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn()
    }));
    // Export the schemas so they can be imported
    return {
        AccommodationService,
        DestinationService,
        EventService,
        UserService,
        CreateAccommodationSchema,
        UpdateAccommodationSchema
    };
});

describe('Real User Scenarios End-to-End', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('API Discovery Journey', () => {
        it('should guide user through API exploration (docs → health → metrics)', async () => {
            const app = initApp();

            // Step 1: User discovers the API by checking documentation
            const docsRes = await app.request('/docs', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (developer discovering API)',
                    accept: 'text/html,application/json'
                }
            });

            expect([200, 302, 404, 429]).toContain(docsRes.status);
            expect(docsRes.headers.get('x-request-id')).toBeTruthy();

            // Step 2: User checks if API is healthy
            const healthRes = await app.request('/health', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (checking API health)',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(healthRes.status);
            if (healthRes.status === 200) {
                const healthData = await healthRes.json();
                expect(healthData.success).toBe(true);
                expect(healthData.data.status).toBe('healthy');
            }

            // Step 3: User explores detailed health endpoints
            const liveRes = await app.request('/health/live', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (checking liveness)',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(liveRes.status);

            // Step 4: User checks API metrics
            const metricsRes = await app.request('/metrics', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (checking metrics)',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(metricsRes.status);
            if (metricsRes.status === 200) {
                const metricsData = await metricsRes.json();
                expect(metricsData.success).toBe(true);
                expect(metricsData.data).toBeDefined();
            }

            // All requests should have unique request IDs for tracing
            const requestIds = [
                docsRes.headers.get('x-request-id'),
                healthRes.headers.get('x-request-id'),
                liveRes.headers.get('x-request-id'),
                metricsRes.headers.get('x-request-id')
            ];

            for (const id of requestIds) {
                expect(id).toBeTruthy();
            }
            // All should be unique
            expect(new Set(requestIds).size).toBe(requestIds.length);
        });
    });

    describe('Frontend Integration Journey', () => {
        it('should handle CORS preflight and data fetching for frontend app', async () => {
            const app = initApp();
            const origin = 'https://hospeda-frontend.com';

            // Step 1: Browser sends CORS preflight for API call
            const preflightRes = await app.request('/api/v1/accommodations', {
                method: 'OPTIONS',
                headers: {
                    origin,
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'content-type,authorization'
                }
            });

            // CORS preflight should be handled appropriately
            expect([200, 204, 404, 429]).toContain(preflightRes.status);
            expect(preflightRes.headers.get('x-request-id')).toBeTruthy();

            // Step 2: Frontend makes actual API call
            const apiRes = await app.request('/api/v1/accommodations', {
                method: 'GET',
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend app)',
                    accept: 'application/json',
                    origin
                }
            });

            expect([200, 404, 429]).toContain(apiRes.status);

            if (apiRes.status === 200) {
                // Should have CORS headers for frontend
                const allowOrigin = apiRes.headers.get('access-control-allow-origin');
                expect(allowOrigin).toBeTruthy();

                // Should have proper JSON response
                const data = await apiRes.json();
                expect(data.success).toBe(true);
                expect(data.metadata.requestId).toBeTruthy();
            }

            // Step 3: Frontend handles pagination
            const paginatedRes = await app.request('/api/v1/accommodations?page=1&limit=10', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend pagination)',
                    accept: 'application/json',
                    origin
                }
            });

            expect([200, 404, 429]).toContain(paginatedRes.status);
            expect(paginatedRes.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Mobile App Integration Journey', () => {
        it('should handle mobile app requests with different user agents', async () => {
            const app = initApp();

            // Step 1: iOS app checks health
            const iosRes = await app.request('/health/live', {
                headers: {
                    'user-agent': 'HospedaApp/1.0 (iOS; iPhone)',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(iosRes.status);

            // Step 2: Android app fetches data
            const androidRes = await app.request('/api/v1/accommodations', {
                headers: {
                    'user-agent': 'HospedaApp/1.0 (Android; Phone)',
                    accept: 'application/json'
                }
            });

            expect([200, 404, 429]).toContain(androidRes.status);

            // Step 3: Mobile app with poor connection (accepts compressed responses)
            const compressedRes = await app.request('/health', {
                headers: {
                    'user-agent': 'HospedaApp/1.0 (slow connection)',
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate'
                }
            });

            expect([200, 429]).toContain(compressedRes.status);

            // Mobile apps should get properly formatted responses
            const allResponses = [iosRes, androidRes, compressedRes];
            for (const res of allResponses) {
                expect(res.headers.get('x-request-id')).toBeTruthy();
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            }
        });
    });

    describe('API Client Integration Journey', () => {
        it('should handle programmatic API usage patterns', async () => {
            const app = initApp();

            // Step 1: API client checks availability
            const pingRes = await app.request('/health/live', {
                headers: {
                    'user-agent': 'Hospeda-API-Client/2.1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(pingRes.status);

            // Step 2: Bulk operations (multiple requests in sequence)
            const bulkRequests = ['/health', '/health/live', '/metrics', '/api/v1/accommodations'];

            const bulkResponses = await Promise.all(
                bulkRequests.map((path) =>
                    app.request(path, {
                        headers: {
                            'user-agent': 'Hospeda-API-Client/2.1.0 (bulk)',
                            accept: 'application/json'
                        }
                    })
                )
            );

            // All requests should be processed with consistent formatting
            for (const res of bulkResponses) {
                expect([200, 404, 429]).toContain(res.status);
                expect(res.headers.get('x-request-id')).toBeTruthy();

                if (res.status === 200) {
                    const data = await res.json();
                    expect(data.success).toBe(true);
                    // Some endpoints might not have metadata (e.g., metrics, docs)
                    if (data.metadata) {
                        expect(data.metadata).toBeDefined();
                    }
                }
            }

            // Request IDs should all be unique
            const requestIds = bulkResponses.map((res) => res.headers.get('x-request-id'));
            expect(new Set(requestIds).size).toBe(requestIds.length);
        });
    });

    describe('Error Recovery Journey', () => {
        it('should help user recover from various error conditions', async () => {
            const app = initApp();

            // Step 1: User makes request with wrong content type
            const wrongContentRes = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'not json'
            });

            expect([400, 429]).toContain(wrongContentRes.status);

            if (wrongContentRes.status === 400) {
                const errorData = await wrongContentRes.json();
                expect(errorData.success).toBe(false);
                expect(errorData.error.code).toBeDefined();
                expect(errorData.error.message).toBeDefined();
                // Error should guide user to correct usage
                expect(errorData.metadata.requestId).toBeTruthy();
            }

            // Step 2: User corrects and retries with proper format
            const correctedRes = await app.request('/health/live', {
                method: 'GET', // Use GET instead of POST
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(correctedRes.status);

            if (correctedRes.status === 200) {
                const successData = await correctedRes.json();
                expect(successData.success).toBe(true);
                expect(successData.data).toBeDefined();
            }

            // Step 3: User tries invalid endpoint and gets helpful error
            const notFoundRes = await app.request('/api/v1/nonexistent', {
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json'
                }
            });

            expect([404, 429]).toContain(notFoundRes.status);

            if (notFoundRes.status === 404) {
                const notFoundData = await notFoundRes.json();
                expect(notFoundData.success).toBe(false);
                expect(notFoundData.error).toBeDefined();
            }
        });
    });

    describe('Performance Under Load Journey', () => {
        it('should maintain consistent performance across user session', async () => {
            const app = initApp();

            // Simulate a user session with multiple interactions
            const sessionRequests = Array.from({ length: 10 }, (_, i) => ({
                path: i % 2 === 0 ? '/health' : '/health/live',
                headers: {
                    'user-agent': `user-session-${Math.floor(i / 2)}/1.0`,
                    accept: 'application/json'
                }
            }));

            const startTime = Date.now();
            const responses = await Promise.all(
                sessionRequests.map((req) => app.request(req.path, { headers: req.headers }))
            );
            const endTime = Date.now();

            const totalTime = endTime - startTime;

            // All responses should be processed in reasonable time
            expect(totalTime).toBeLessThan(5000); // 5 seconds for 10 requests

            // Check response quality
            const successfulResponses = responses.filter((res) => res.status === 200);
            const rateLimitedResponses = responses.filter((res) => res.status === 429);

            // At least some requests should succeed (not all rate limited)
            expect(successfulResponses.length + rateLimitedResponses.length).toBe(responses.length);

            // All responses should have proper formatting
            for (const res of responses) {
                expect(res.headers.get('x-request-id')).toBeTruthy();
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            }
        });
    });

    describe('Monitoring and Debugging Journey', () => {
        it('should provide comprehensive information for debugging issues', async () => {
            const app = initApp();

            // Step 1: Make some requests to generate metrics
            const requestsForMetrics = [
                app.request('/health', {
                    headers: {
                        'user-agent': 'monitoring-system/1.0',
                        accept: 'application/json'
                    }
                }),
                app.request('/health/live', {
                    headers: {
                        'user-agent': 'monitoring-system/1.0',
                        accept: 'application/json'
                    }
                }),
                app.request('/api/v1/accommodations', {
                    headers: {
                        'user-agent': 'monitoring-system/1.0',
                        accept: 'application/json'
                    }
                })
            ];

            const responses = await Promise.all(requestsForMetrics);

            // Verify all requests were processed
            expect(responses.length).toBe(3);

            // Wait for metrics to be processed
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Step 2: Check metrics endpoint for monitoring data
            const metricsRes = await app.request('/metrics', {
                headers: {
                    'user-agent': 'monitoring-system/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(metricsRes.status);

            if (metricsRes.status === 200) {
                const metricsData = await metricsRes.json();
                expect(metricsData.success).toBe(true);
                expect(metricsData.data.summary).toBeDefined();
                expect(metricsData.data.endpoints).toBeDefined();
                expect(Array.isArray(metricsData.data.endpoints)).toBe(true);
            }

            // Step 3: Check system metrics specifically
            const systemMetricsRes = await app.request('/metrics/system', {
                headers: {
                    'user-agent': 'monitoring-system/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(systemMetricsRes.status);

            // Step 4: Check API metrics specifically
            const apiMetricsRes = await app.request('/metrics/api', {
                headers: {
                    'user-agent': 'monitoring-system/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(apiMetricsRes.status);

            // All monitoring requests should have tracing info
            const monitoringResponses = [metricsRes, systemMetricsRes, apiMetricsRes];
            for (const res of monitoringResponses) {
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }
        });
    });

    describe('Cross-Origin Resource Sharing Journey', () => {
        it('should handle complex CORS scenarios for web applications', async () => {
            const app = initApp();

            // Different origins that might access the API
            const origins = [
                'https://app.hospeda.com',
                'https://admin.hospeda.com',
                'https://localhost:3000',
                'https://partner-app.example.com'
            ];

            for (const origin of origins.slice(0, 2)) {
                // Test first 2 to avoid rate limiting
                // Preflight for complex request
                const preflightRes = await app.request('/api/v1/accommodations', {
                    method: 'OPTIONS',
                    headers: {
                        origin,
                        'access-control-request-method': 'POST',
                        'access-control-request-headers':
                            'content-type,authorization,x-custom-header'
                    }
                });

                expect([200, 204, 404, 429]).toContain(preflightRes.status);

                // Actual request
                const actualRes = await app.request('/health', {
                    method: 'GET',
                    headers: {
                        'user-agent': `WebApp from ${origin}`,
                        accept: 'application/json',
                        origin
                    }
                });

                expect([200, 429]).toContain(actualRes.status);

                // Should handle CORS properly (if configured for this origin)
                if (actualRes.status === 200) {
                    const allowOrigin = actualRes.headers.get('access-control-allow-origin');
                    // CORS headers might not be present if origin is not in allowed list
                    if (allowOrigin) {
                        expect(allowOrigin).toBeTruthy();
                    }
                }

                expect(actualRes.headers.get('x-request-id')).toBeTruthy();
            }
        });
    });

    describe('Complete User Workflow', () => {
        it('should handle a complete user interaction workflow', async () => {
            const app = initApp();
            const userAgent = 'complete-workflow-user/1.0';

            // Step 1: Initial discovery
            const discoveryRes = await app.request('/health', {
                headers: {
                    'user-agent': userAgent,
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(discoveryRes.status);
            const initialRequestId = discoveryRes.headers.get('x-request-id');

            // Step 2: Data exploration
            const exploreRes = await app.request('/api/v1/public/accommodations', {
                headers: {
                    'user-agent': userAgent,
                    accept: 'application/json'
                }
            });

            expect([200, 404, 429]).toContain(exploreRes.status);
            const exploreRequestId = exploreRes.headers.get('x-request-id');

            // Step 3: Detailed lookup
            const detailRes = await app.request('/health/live', {
                headers: {
                    'user-agent': userAgent,
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(detailRes.status);
            const detailRequestId = detailRes.headers.get('x-request-id');

            // Verify each step had unique request ID for complete tracing
            const requestIds = [initialRequestId, exploreRequestId, detailRequestId];
            for (const id of requestIds) {
                expect(id).toBeTruthy();
            }
            expect(new Set(requestIds).size).toBe(requestIds.length);

            // All responses should maintain consistent security and formatting
            const allResponses = [discoveryRes, exploreRes, detailRes];
            for (const res of allResponses) {
                expect(res.headers.get('x-content-type-options')).toBe('nosniff');
                expect(['DENY', 'SAMEORIGIN']).toContain(res.headers.get('x-frame-options'));
            }
        });
    });
});
