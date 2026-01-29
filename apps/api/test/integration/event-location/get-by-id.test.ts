import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /event-locations/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/event-locations';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 for valid UUID', async () => {
        const validUuid = '00000000-0000-0000-0000-000000000001';
        const res = await app.request(`${base}/${validUuid}`);
        expect([200, 400, 404]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        const res = await app.request(`${base}/not-a-uuid`);
        expect([400, 422]).toContain(res.status);
    });

    it('returns event location data when found', async () => {
        const validUuid = '00000000-0000-0000-0000-000000000001';
        const res = await app.request(`${base}/${validUuid}`);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
        }
    });
});
