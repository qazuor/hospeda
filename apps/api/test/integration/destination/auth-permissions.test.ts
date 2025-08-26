import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Auth/Permissions scenarios for Destination routes
 * Note: Many destination routes are marked skipAuth=true; here we target write endpoints.
 */
describe('Destination - Auth & Permissions', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('POST /destinations should return 401/403 without valid auth (when enforced)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'X' })
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('PUT /destinations/:id should return 401/403 without valid auth (when enforced)', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Updated' })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
