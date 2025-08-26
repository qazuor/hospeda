import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Create with wrong Content-Type', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('POST should return 400/401/403/415 when Content-Type is text/plain', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'name=Invalid'
        });
        expect([400, 401, 403, 415]).toContain(res.status);
    });
});
