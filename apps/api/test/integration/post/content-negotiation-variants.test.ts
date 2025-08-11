import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Content negotiation variants', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('accept: */* is tolerated', async () => {
        const res = await app.request(base, { headers: { accept: '*/*' } });
        expect([200, 400]).toContain(res.status);
    });

    it('accept: application/* is tolerated', async () => {
        const res = await app.request(base, { headers: { accept: 'application/*' } });
        expect([200, 400]).toContain(res.status);
    });
});
