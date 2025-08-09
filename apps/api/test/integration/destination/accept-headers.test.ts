import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Accept headers variations', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('handles missing Accept header gracefully', async () => {
        const res = await app.request(base);
        expect([200, 400]).toContain(res.status);
    });

    it('handles Accept: text/plain with 400/406/200 depending on negotiation', async () => {
        const res = await app.request(base, { headers: { Accept: 'text/plain' } });
        expect([200, 400, 406]).toContain(res.status);
    });
});
