import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Idempotency for destructive/restore actions', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('soft delete twice should not 500', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const first = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 400]).toContain(first.status);
        const second = await app.request(`${base}/${id}`, { method: 'DELETE' });
        expect([200, 204, 400]).toContain(second.status);
    });

    it('restore twice should not 500', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const first = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 400]).toContain(first.status);
        const second = await app.request(`${base}/${id}/restore`, { method: 'POST' });
        expect([200, 400]).toContain(second.status);
    });
});
