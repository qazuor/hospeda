import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Performance & Rate Limiting (smoke)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('handles quick consecutive requests without server error', async () => {
        const requests = Array.from({ length: 5 }, () => app.request(base));
        const responses = await Promise.all(requests);
        for (const res of responses) {
            expect([200, 400]).toContain(res.status);
        }
    });
});
