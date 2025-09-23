import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Pagination bounds', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('page must be >= 1', async () => {
        const res = await app.request(`${base}?page=0`);
        expect([400]).toContain(res.status);
    });

    it('pageSize must be within bounds', async () => {
        const tooHigh = await app.request(`${base}?pageSize=1000`);
        expect([400]).toContain(tooHigh.status);

        const negative = await app.request(`${base}?pageSize=-5`);
        expect([400]).toContain(negative.status);
    });
});
