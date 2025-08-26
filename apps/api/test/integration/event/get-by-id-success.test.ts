import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /events/:id (success shape)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('when 200, returns an object with expected fields', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`);
        expect([200, 404, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
            const ev = body.data;
            expect(ev).toHaveProperty('id');
            expect(ev).toHaveProperty('slug');
            expect(ev).toHaveProperty('name');
        }
    });
});
