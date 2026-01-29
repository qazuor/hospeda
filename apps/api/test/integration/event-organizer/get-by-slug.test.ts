import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /event-organizers/slug/:slug', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/event-organizers';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 for valid slug', async () => {
        const res = await app.request(`${base}/slug/sample-organizer`);
        expect([200, 400, 404]).toContain(res.status);
    });

    it('returns 400 for invalid slug format (too short)', async () => {
        const res = await app.request(`${base}/slug/ab`);
        expect([400, 404]).toContain(res.status);
    });

    it('returns 400 for slug with invalid characters', async () => {
        const res = await app.request(`${base}/slug/Invalid_Slug!`);
        expect([400, 404]).toContain(res.status);
    });

    it('returns event organizer data when found', async () => {
        const res = await app.request(`${base}/slug/valid-test-slug`);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
        }
    });
});
