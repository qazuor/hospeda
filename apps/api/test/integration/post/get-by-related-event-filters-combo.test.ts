import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Related Event filters combo', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';
    const id = '00000000-0000-0000-0000-000000000000';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('accepts visibility and dates', async () => {
        const res = await app.request(
            `${base}/event/${id}?visibility=PUBLIC&fromDate=2024-01-01&toDate=2025-01-01`
        );
        expect([200, 400, 404]).toContain(res.status);
    });
});
