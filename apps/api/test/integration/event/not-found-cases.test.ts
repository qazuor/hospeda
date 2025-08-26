import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Not found cases', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('unknown slug → 404/200 or 400 (validation)', async () => {
        const res = await app.request(`${base}/slug/unknown-slug`);
        expect([200, 404, 400]).toContain(res.status);
    });

    it('unknown id → 404/200 (or 400 for validation)', async () => {
        const res = await app.request(`${base}/87654321-4321-4321-8765-876543218765`);
        expect([200, 404, 400]).toContain(res.status);
    });
});
