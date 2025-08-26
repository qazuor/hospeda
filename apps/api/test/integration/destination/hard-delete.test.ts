import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('DELETE /destinations/:id/hard', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200/204/404 (or 400 depending on validation)', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000/hard`, {
            method: 'DELETE'
        });
        expect([200, 204, 400, 404]).toContain(res.status);
    });
});
