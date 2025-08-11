import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Middleware stack', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('GET /posts goes through middlewares without crashing', async () => {
        const res = await app.request(base, { headers: { 'user-agent': 'middleware-stack' } });
        expect([200, 400]).toContain(res.status);
    });
});
