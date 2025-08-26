import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Category enum validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('invalid category should return 400', async () => {
        const res = await app.request(`${base}/category/NOT_A_CATEGORY`);
        expect(res.status).toBe(400);
    });
});
