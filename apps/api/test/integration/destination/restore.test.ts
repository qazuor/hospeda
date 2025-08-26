import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /destinations/:id/restore', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200/404 (or 400 depending on validation)', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000/restore`, {
            method: 'POST'
        });
        expect([200, 400, 404]).toContain(res.status);
    });
});
