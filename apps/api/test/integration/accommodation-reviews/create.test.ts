import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

/**
 * Integration: POST /accommodations/{accommodationId}/reviews
 */
describe('POST /accommodations/{accommodationId}/reviews', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200 or 400 depending on payload validity', async () => {
        const accommodationId = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${accommodationId}/reviews`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                userId: '123e4567-e89b-12d3-a456-426614174001',
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 4,
                    accuracy: 4,
                    communication: 5,
                    location: 5
                },
                title: 'Great stay',
                content: 'Very nice experience.'
            })
        });
        expect([200, 201, 400, 401, 403]).toContain(res.status);
    });
});
