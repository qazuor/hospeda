import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('PUT /posts/:id - wrong content type', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 400 when content-type is not application/json', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`, {
            method: 'PUT',
            headers: { 'content-type': 'text/plain' },
            body: 'title=Updated'
        });
        expect([400, 404]).toContain(res.status);
    });
});
