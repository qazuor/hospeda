import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /posts/event/:eventId', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 depending on eventId', async () => {
        const res = await app.request(`${base}/event/00000000-0000-0000-0000-000000000000`);
        expect([200, 400, 404]).toContain(res.status);
    });
});
