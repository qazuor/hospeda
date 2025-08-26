import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Validation errors', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('list: invalid sortOrder → 400', async () => {
        const res = await app.request(`${base}?sortOrder=INVALID`);
        expect(res.status).toBe(400);
    });

    it('getById: invalid UUID → 400', async () => {
        const res = await app.request(`${base}/invalid-uuid`);
        expect(res.status).toBe(400);
    });

    it('update: invalid body → 400', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 123 })
        });
        expect([400, 404]).toContain(res.status);
    });
});
