import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('POST /destinations', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('validates payload', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 401, 403]).toContain(res.status);
    });
});
