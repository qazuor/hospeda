import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Event - Content Negotiation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/events';

    beforeAll(() => {
        app = initApp();
    });

    it('accepts application/json', async () => {
        const res = await app.request(base, { headers: { Accept: 'application/json' } });
        expect([200, 400]).toContain(res.status);
    });

    it('accepts */*', async () => {
        const res = await app.request(base, { headers: { Accept: '*/*' } });
        expect([200, 400]).toContain(res.status);
    });
});
