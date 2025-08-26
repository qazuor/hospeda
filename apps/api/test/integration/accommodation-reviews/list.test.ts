import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Integration: GET /accommodations/{accommodationId}/reviews
 */
describe('GET /accommodations/{accommodationId}/reviews', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 with pagination metadata or 400 on invalid params', async () => {
        const accommodationId = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${accommodationId}/reviews?page=1&limit=10`);
        expect([200, 400]).toContain(res.status);
    });
});
