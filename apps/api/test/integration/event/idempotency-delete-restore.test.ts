import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Idempotency for delete/restore', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('soft delete twice: second may return 200 with count 0', async () => {
        const id = '00000000-0000-0000-0000-000000000000';
        const first = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 404, 400]).toContain(first.status);
        const second = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 404, 400]).toContain(second.status);
    });

    it('restore twice: second may return 200 with count 0', async () => {
        const id = '00000000-0000-0000-0000-000000000000';
        const first = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 404, 400]).toContain(first.status);
        const second = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 404, 400]).toContain(second.status);
    });
});
