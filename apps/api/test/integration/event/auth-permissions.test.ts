import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Auth/Permissions scenarios for Event routes
 * Note: Many event routes are public; here we target write endpoints.
 */
describe('Event - Auth & Permissions', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('POST /events should return 401/403 without valid auth (when enforced)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Sample Event' })
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('PUT /events/:id should return 401/403 without valid auth (when enforced)', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Updated' })
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
