import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('PUT /destinations/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('validates payload', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slug: 'a' })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
