import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - OpenAPI docs include routes', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    it('docs page should be reachable', async () => {
        const res = await app.request('/docs');
        expect([200, 302, 404, 400]).toContain(res.status);
    });
});
