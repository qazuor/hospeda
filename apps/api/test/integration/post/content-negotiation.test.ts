import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Content negotiation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('returns JSON when Accept: application/json', async () => {
        const res = await app.request(base, {
            headers: { accept: 'application/json' }
        });
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('success');
        }
    });

    it('handles text/html gracefully', async () => {
        const res = await app.request(base, {
            headers: { accept: 'text/html' }
        });
        expect([200, 400, 404]).toContain(res.status);
    });
});
