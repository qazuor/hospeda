import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Post - Visibility validation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('GET /posts/featured rejects invalid visibility', async () => {
        const res = await app.request(`${base}/featured?visibility=INVALID`);
        expect([400]).toContain(res.status);
    });
});
