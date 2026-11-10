import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('GET /api/v1/public/venues/filter-options', () => {
    let app: AppOpenAPI;
    beforeAll(() => {
        app = initApp();
    });

    it('is registered and public', async () => {
        const res = await app.request('/api/v1/public/venues/filter-options', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(401);
    });

    it('rejects an invalid business line', async () => {
        const res = await app.request('/api/v1/public/venues/filter-options?businessLine=x', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).toBe(400);
    });

    it('does not fall through to the UUID route', async () => {
        const res = await app.request('/api/v1/public/venues/filter-options', {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(await res.text()).not.toContain('invalidUuid');
    });
});
