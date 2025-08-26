import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Upcoming invalid dates', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('invalid fromDate should return 400', async () => {
        const res = await app.request(`${base}/upcoming?fromDate=not-a-date`);
        expect([400]).toContain(res.status);
    });

    it('invalid toDate should return 400', async () => {
        const from = new Date().toISOString();
        const res = await app.request(
            `${base}/upcoming?fromDate=${encodeURIComponent(from)}&toDate=invalid`
        );
        expect([400]).toContain(res.status);
    });
});
