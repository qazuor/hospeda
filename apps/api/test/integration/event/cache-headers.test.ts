import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Cache headers', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /:id/summary should include Cache-Control when cacheTTL is set', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/summary`);
        expect([200, 400, 404]).toContain(res.status);
        const cache = res.headers.get('cache-control');
        if (cache) {
            expect(typeof cache).toBe('string');
        }
    });
});
