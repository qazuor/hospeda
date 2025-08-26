import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /destinations/:id/accommodations', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns accommodations list or 404 (or 400 depending on validation)', async () => {
        const res = await app.request(
            `${base}/00000000-0000-0000-0000-000000000000/accommodations`
        );
        expect([200, 400, 404]).toContain(res.status);
    });
});
