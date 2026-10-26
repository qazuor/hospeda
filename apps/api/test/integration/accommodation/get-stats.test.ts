/**
 * Integration tests for GET /accommodations/:id/stats endpoint
 * Tests response data validation against AccommodationStatsSchema.
 *
 * Payload (see `src/routes/accommodation/public/getStats.ts`): the flat
 * `{ total, totalFeatured, averageRating, totalByType }` shape.
 *
 * Known divergence (HOS-1902): an id that matches no visible accommodation
 * answers `200` with `data: null`, whereas the sibling summary route answers
 * 404. These tests assert the CURRENT behaviour; update them when HOS-1902
 * settles the contract.
 */
import { AccommodationStatsSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

describe('GET /accommodations/:id/stats', () => {
    let app: ReturnType<typeof initApp>;
    const baseUrl = '/api/v1/public/accommodations';
    const nonExistentUuid = '99999999-9999-4999-8999-999999999999';
    const headers = { 'user-agent': 'vitest', Accept: 'application/json' };
    let seeded: SeededPublicAccommodation;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedPublicAccommodation();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('Success Cases (200)', () => {
        it('should return accommodation statistics for a seeded accommodation', async () => {
            const response = await app.request(`${baseUrl}/${seeded.id}/stats`, { headers });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('success', true);
            expect(data.metadata).toHaveProperty('timestamp');
            expect(data.metadata).toHaveProperty('requestId');

            const parsed = AccommodationStatsSchema.safeParse(data.data);
            expect(parsed.success).toBe(true);
            expect(data.data).toMatchObject({
                total: 1,
                totalFeatured: 0,
                averageRating: 0,
                totalByType: { HOTEL: 1 }
            });
        });

        it('should count a featured accommodation in totalFeatured', async () => {
            await testDb.clean();
            const featured = await seedPublicAccommodation({ isFeatured: true });

            const response = await app.request(`${baseUrl}/${featured.id}/stats`, { headers });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data).toMatchObject({ total: 1, totalFeatured: 1 });
        });

        it('should answer 200 with null data for non-existent accommodation', async () => {
            const response = await app.request(`${baseUrl}/${nonExistentUuid}/stats`, { headers });

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
                '12345678-1234-1234-1234-123456789012' // Invalid version
            ];

            for (const invalidUuid of invalidUuids) {
                const response = await app.request(`${baseUrl}/${invalidUuid}/stats`, {
                    headers
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data).toHaveProperty('success', false);
                expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
                expect(JSON.stringify(data.error.details)).toContain(
                    'zodError.common.id.invalidUuid'
                );
            }
        });

        it('should answer 200 with null data for the nil UUID (a valid UUID that matches no row)', async () => {
            const response = await app.request(
                `${baseUrl}/00000000-0000-0000-0000-000000000000/stats`,
                { headers }
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data).toBeNull();
        });

        it('should return 404 for missing ID parameter', async () => {
            const response = await app.request(`${baseUrl}//stats`, { headers });

            expect(response.status).toBe(404);
        });
    });

    describe('Content Negotiation', () => {
        it('should accept application/json content type', async () => {
            const response = await app.request(`${baseUrl}/${seeded.id}/stats`, { headers });

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
        });

        it('should accept wildcard content type', async () => {
            const response = await app.request(`${baseUrl}/${seeded.id}/stats`, {
                headers: { 'user-agent': 'vitest', Accept: '*/*' }
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Data Consistency', () => {
        it('should be consistent with the summary endpoint for the same accommodation', async () => {
            const [summaryResponse, statsResponse] = await Promise.all([
                app.request(`${baseUrl}/${seeded.id}/summary`, { headers }),
                app.request(`${baseUrl}/${seeded.id}/stats`, { headers })
            ]);

            expect(summaryResponse.status).toBe(200);
            expect(statsResponse.status).toBe(200);

            const summaryData = await summaryResponse.json();
            const statsData = await statsResponse.json();

            expect(summaryData.data.id).toBe(seeded.id);
            expect(typeof statsData.data.total).toBe('number');
            expect(typeof statsData.data.totalFeatured).toBe('number');
            expect(summaryData.data.averageRating).toBe(statsData.data.averageRating);
        });
    });

    describe('Performance and Caching', () => {
        it('should handle concurrent requests efficiently', async () => {
            const responses = await Promise.all(
                Array.from({ length: 5 }, () =>
                    app.request(`${baseUrl}/${seeded.id}/stats`, { headers })
                )
            );

            for (const response of responses) {
                expect(response.status).toBe(200);
            }
        });

        it('should serve a normal request under the configured rate limit', async () => {
            // The route has customRateLimit: { requests: 100, windowMs: 60000 }
            const response = await app.request(`${baseUrl}/${seeded.id}/stats`, { headers });

            expect(response.status).toBe(200);
        });
    });
});
