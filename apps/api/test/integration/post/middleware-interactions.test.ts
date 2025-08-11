import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Middleware interactions', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('adds request id header (logging middleware)', async () => {
        const res = await app.request(base);
        expect(res.headers.get('x-request-id')).toBeTruthy();
    });
});
