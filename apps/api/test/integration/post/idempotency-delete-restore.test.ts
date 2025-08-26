import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Idempotency for delete/restore', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';
    const id = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('soft delete twice → second should still be 200/204/404 (idempotent-ish)', async () => {
        const first = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 400, 404]).toContain(first.status);
        const second = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 400, 404]).toContain(second.status);
    });

    it('restore twice → second should still be 200/404 (idempotent-ish)', async () => {
        const first = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 400, 404]).toContain(first.status);
        const second = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 400, 404]).toContain(second.status);
    });
});
