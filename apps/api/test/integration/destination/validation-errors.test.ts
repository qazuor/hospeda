import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Validation Errors', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    const invalidId = 'not-a-uuid';

    it('GET /destinations/:id → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}`);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });

    it('GET /destinations/:id/stats → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}/stats`);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });

    it('GET /destinations/:id/summary → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}/summary`);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });

    it('DELETE /destinations/:id (soft) → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}`, { method: 'DELETE' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });

    it('POST /destinations/:id/restore → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}/restore`, { method: 'POST' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });

    it('DELETE /destinations/:id/hard → 400 for invalid UUID', async () => {
        const res = await app.request(`${base}/${invalidId}/hard`, { method: 'DELETE' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body).toHaveProperty('error');
    });
});
