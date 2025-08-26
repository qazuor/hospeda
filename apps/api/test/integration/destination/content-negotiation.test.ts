import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Destination - Content Negotiation', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
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
