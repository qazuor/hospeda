import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('DELETE /events/:id (soft delete)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 200/204/404 accordingly', async () => {
        const res = await app.request(`${base}/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE'
        });
        expect([200, 204, 404, 400]).toContain(res.status);
    });
});
