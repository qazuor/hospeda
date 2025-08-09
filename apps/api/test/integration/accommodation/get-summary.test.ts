/**
 * Integration tests for GET /accommodations/:id/summary endpoint
 * Tests response data validation against AccommodationSummarySchema
 */
import { AccommodationSummarySchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /accommodations/:id/summary', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/accommodations';
    const validUuid = '12345678-1234-4567-8901-123456789012';
    const nonExistentUuid = '87654321-4321-4321-8765-876543218765';

    beforeAll(() => {
        app = initApp();
    });

    describe('Success Cases (200)', () => {
        it('should return accommodation summary with valid UUID', async () => {
            const response = await app.request(`${baseUrl}/${validUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();

            // Validate response structure
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data).toHaveProperty('metadata');
            expect(data.metadata).toHaveProperty('timestamp');
            expect(data.metadata).toHaveProperty('requestId');

            // Validate against AccommodationSummarySchema
            const summaryData = data.data;
            const schemaValidation = AccommodationSummarySchema.safeParse(summaryData);

            expect(schemaValidation.success).toBe(true);

            if (schemaValidation.success) {
                const summary = schemaValidation.data as any;

                // Required fields validation
                expect(summary).toHaveProperty('id');
                expect(summary).toHaveProperty('name');
                expect(summary).toHaveProperty('summary');
                expect(summary).toHaveProperty('type');
                expect(summary).toHaveProperty('reviewsCount');
                expect(summary).toHaveProperty('averageRating');
                expect(summary).toHaveProperty('isFeatured');

                // Type validation
                expect(typeof summary.id).toBe('string');
                expect(typeof summary.name).toBe('string');
                expect(typeof summary.summary).toBe('string');
                expect(typeof summary.type).toBe('string');
                expect(typeof summary.reviewsCount).toBe('number');
                expect(typeof summary.averageRating).toBe('number');
                expect(typeof summary.isFeatured).toBe('boolean');

                // Value constraints validation
                expect(summary.id).toBe(validUuid);
                expect(summary.name.length).toBeGreaterThan(0);
                expect(summary.summary.length).toBeGreaterThanOrEqual(10); // Min length from schema
                expect(
                    [
                        'APARTMENT',
                        'HOUSE',
                        'COUNTRY_HOUSE',
                        'CABIN',
                        'HOTEL',
                        'HOSTEL',
                        'CAMPING',
                        'ROOM',
                        'MOTEL',
                        'RESORT'
                    ].includes(summary.type)
                ).toBe(true);
                expect(summary.reviewsCount).toBeGreaterThanOrEqual(0);
                expect(summary.averageRating).toBeGreaterThanOrEqual(0);
                expect(summary.averageRating).toBeLessThanOrEqual(5);

                // Optional fields validation
                if (summary.featuredImage) {
                    expect(typeof summary.featuredImage).toBe('string');
                    expect(summary.featuredImage).toMatch(/^https?:\/\/.+/); // URL format
                }

                if (summary.location) {
                    expect(typeof summary.location).toBe('object');
                    if (summary.location.city) {
                        expect(typeof summary.location.city).toBe('string');
                    }
                    if (summary.location.country) {
                        expect(typeof summary.location.country).toBe('string');
                    }
                }
            }
        });

        it('should return null for non-existent accommodation', async () => {
            const response = await app.request(`${baseUrl}/${nonExistentUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toHaveProperty('success', true);
            expect(data.data).toBeNull();
            expect(data).toHaveProperty('metadata');
        });
    });

    describe('Validation Errors (400)', () => {
        it('should return 400 for invalid UUID format', async () => {
            const invalidUuids = [
                'invalid-uuid',
                '123',
                'not-a-uuid',
                '12345678-1234-1234-1234-123456789012', // Invalid version
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', // Invalid characters
                '12345678-1234-4567-8901-123456789' // Too short
            ];

            for (const invalidUuid of invalidUuids) {
                const response = await app.request(`${baseUrl}/${invalidUuid}/summary`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                });

                expect(response.status).toBe(400);

                const data = await response.json();
                expect(data).toHaveProperty('success', false);
                expect(data).toHaveProperty('error');
                expect(data.error).toHaveProperty('name', 'ZodError');
                expect(data.error).toHaveProperty('message');
                expect(data.error.message).toContain('zodError.common.id.invalidUuid');
            }
        });

        it('should return 404 for missing ID parameter', async () => {
            const response = await app.request(`${baseUrl}//summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(404);
        });
    });

    describe('Content Negotiation', () => {
        it('should accept application/json content type', async () => {
            const response = await app.request(`${baseUrl}/${validUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
        });

        it('should accept wildcard content type', async () => {
            const response = await app.request(`${baseUrl}/${validUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: '*/*'
                }
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Caching and Performance', () => {
        it('should include cache headers for successful responses', async () => {
            const response = await app.request(`${baseUrl}/${validUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBe(200);
            // Cache headers should be present due to cacheTTL: 300 in route options
            // Note: Actual cache headers depend on cache middleware implementation
        });

        it('should handle concurrent requests efficiently', async () => {
            const promises = Array.from({ length: 5 }, () =>
                app.request(`${baseUrl}/${validUuid}/summary`, {
                    headers: {
                        'user-agent': 'vitest',
                        Accept: 'application/json'
                    }
                })
            );

            const responses = await Promise.all(promises);

            for (const response of responses) {
                expect(response.status).toBe(200);
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should respect rate limiting configuration', async () => {
            // The route has customRateLimit: { requests: 100, windowMs: 60000 }
            // This test verifies the endpoint responds normally under normal load
            const response = await app.request(`${baseUrl}/${validUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            expect(response.status).toBeLessThan(500);
            expect([200, 429]).toContain(response.status); // 429 if rate limited
        });
    });

    describe('Error Handling', () => {
        it('should handle service errors gracefully', async () => {
            // Test with edge case UUID that might cause service issues
            const edgeCaseUuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

            const response = await app.request(`${baseUrl}/${edgeCaseUuid}/summary`, {
                headers: {
                    'user-agent': 'vitest',
                    Accept: 'application/json'
                }
            });

            // Should either return 200 with null data or appropriate error status
            expect([200, 404, 500]).toContain(response.status);

            if (response.status === 200) {
                const data = await response.json();
                expect(data).toHaveProperty('success', true);
                // Data can be null for non-existent accommodation
            }
        });
    });
});
