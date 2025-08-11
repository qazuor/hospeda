import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Post - Performance / Rate limit', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/posts';

    beforeAll(() => {
        app = initApp();
    });

    it('handles burst of list requests', async () => {
        const requests = Array.from({ length: 5 }, () =>
            app.request(base, { headers: { 'user-agent': 'perf' } })
        );
        const responses = await Promise.all(requests);
        for (const res of responses) {
            expect([200, 400, 429]).toContain(res.status);
        }
    });
});
