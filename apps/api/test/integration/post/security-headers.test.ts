import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Security headers', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('includes x-content-type-options and x-frame-options', async () => {
        const res = await app.request(base);
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        const xfo = res.headers.get('x-frame-options');
        expect(['DENY', 'SAMEORIGIN', null]).toContain(xfo);
    });
});
