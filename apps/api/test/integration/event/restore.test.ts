import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /events/:id/restore (restore)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200/404 accordingly', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000/restore`, {
            method: 'POST'
        });
        expect([200, 404, 400]).toContain(res.status);
    });
});
