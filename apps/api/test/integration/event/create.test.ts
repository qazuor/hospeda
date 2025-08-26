import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /events (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 415 for wrong content-type', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'not-json'
        });
        expect([400, 415]).toContain(res.status);
    });

    it('returns 400 for invalid payload', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400]).toContain(res.status);
    });
});
