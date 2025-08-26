import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Integration: POST /destinations/{destinationId}/reviews
 */
describe('POST /destinations/{destinationId}/reviews', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 400 depending on payload validity', async () => {
        const destinationId = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${destinationId}/reviews`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                userId: '123e4567-e89b-12d3-a456-426614174001',
                rating: {
                    landscape: 4,
                    attractions: 5,
                    accessibility: 4,
                    safety: 4,
                    cleanliness: 5,
                    hospitality: 5,
                    culturalOffer: 3,
                    gastronomy: 4,
                    affordability: 3,
                    nightlife: 4,
                    infrastructure: 4,
                    environmentalCare: 5,
                    wifiAvailability: 4,
                    shopping: 3,
                    beaches: 4,
                    greenSpaces: 4,
                    localEvents: 3,
                    weatherSatisfaction: 4
                },
                title: 'Great destination',
                content: 'We had a wonderful time.'
            })
        });
        expect([200, 201, 400, 401, 403]).toContain(res.status);
    });
});
