import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Event - Content Negotiation variants', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    const endpoints = [
        `${base}`,
        `${base}/slug/some-slug`,
        `${base}/123e4567-e89b-12d3-a456-426614174000`,
        `${base}/123e4567-e89b-12d3-a456-426614174000/summary`,
        `${base}/category/CONCERT`,
        `${base}/author/00000000-0000-0000-0000-000000000001`,
        `${base}/location/00000000-0000-0000-0000-000000000002`,
        `${base}/organizer/00000000-0000-0000-0000-000000000003`,
        `${base}/free`,
        `${base}/upcoming`
    ];

    it('accepts application/json on multiple endpoints', async () => {
        for (const url of endpoints) {
            const res = await app.request(url, { headers: { Accept: 'application/json' } });
            expect([200, 400, 404]).toContain(res.status);
        }
    });

    it('accepts */* on multiple endpoints', async () => {
        for (const url of endpoints) {
            const res = await app.request(url, { headers: { Accept: '*/*' } });
            expect([200, 400, 404]).toContain(res.status);
        }
    });
});
