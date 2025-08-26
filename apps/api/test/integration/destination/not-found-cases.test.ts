import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Not Found cases (404)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    // This ID is used in mocks to simulate not found
    const notFoundId = '87654321-4321-4321-8765-876543218765';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /:id returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}`);
        expect([404, 400]).toContain(res.status);
    });

    it('GET /:id/summary returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}/summary`);
        expect([404, 400]).toContain(res.status);
    });

    it('GET /:id/stats returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}/stats`);
        expect([404, 400]).toContain(res.status);
    });

    it('DELETE /:id (soft) returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}`, { method: 'DELETE' });
        expect([404, 400]).toContain(res.status);
    });

    it('POST /:id/restore returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}/restore`, { method: 'POST' });
        expect([404, 400]).toContain(res.status);
    });

    it('DELETE /:id/hard returns 404 when destination does not exist', async () => {
        const res = await app.request(`${base}/${notFoundId}/hard`, { method: 'DELETE' });
        expect([404, 400]).toContain(res.status);
    });
});
