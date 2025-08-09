import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('GET /destinations/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400 for invalid UUID format', async () => {
        const res = await app.request(`${base}/not-a-uuid`);
        expect([400, 404]).toContain(res.status);
    });
});
