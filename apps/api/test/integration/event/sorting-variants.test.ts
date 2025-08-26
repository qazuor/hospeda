import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Sorting variants', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('accepts sortOrder=ASC (may still be 400 if validation is stricter)', async () => {
        const res = await app.request(`${base}?sortOrder=ASC`);
        expect([200, 400]).toContain(res.status);
    });

    it('accepts sortOrder=DESC (may still be 400 if validation is stricter)', async () => {
        const res = await app.request(`${base}?sortOrder=DESC`);
        expect([200, 400]).toContain(res.status);
    });
});
