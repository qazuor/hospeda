import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Performance and rate limit', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('handles multiple quick requests without crashing', async () => {
        const requests = Array.from({ length: 5 }).map((_, i) =>
            app.request(`${base}?page=${i + 1}&limit=1`)
        );
        const responses = await Promise.all(requests);
        for (const res of responses) {
            expect([200, 400, 429]).toContain(res.status);
        }
    });
});
