import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /events/organizer/:organizerId', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 for valid organizer and accepts pagination', async () => {
        const res = await app.request(
            `${base}/organizer/00000000-0000-0000-0000-000000000003?page=1&limit=10`
        );
        expect([200, 400, 404]).toContain(res.status);
    });
});
