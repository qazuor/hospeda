import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const HEADERS = { 'user-agent': 'vitest', accept: 'application/json' };

describe('GET /api/v1/public/experiences/filter-options', () => {
    let app: AppOpenAPI;
    beforeAll(() => {
        app = initApp();
    });

    it('is registered and public', async () => {
        const res = await app.request('/api/v1/public/experiences/filter-options', {
            headers: HEADERS
        });
        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(401);
    });

    it('does not fall through to the UUID route', async () => {
        const res = await app.request('/api/v1/public/experiences/filter-options', {
            headers: HEADERS
        });
        expect(await res.text()).not.toContain('invalidUuid');
    });
});

describe('GET /api/v1/public/experiences amenity and feature filters', () => {
    let app: AppOpenAPI;
    const UUID = '11111111-1111-4111-8111-111111111111';
    beforeAll(() => {
        app = initApp();
    });

    it.each(['amenities', 'features'])('accepts ?%s as a UUID list', async (param) => {
        const res = await app.request(`/api/v1/public/experiences?${param}=${UUID},${UUID}`, {
            headers: HEADERS
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it.each(['amenities', 'features'])('rejects a non-UUID in ?%s', async (param) => {
        const res = await app.request(`/api/v1/public/experiences?${param}=not-a-uuid`, {
            headers: HEADERS
        });
        expect(res.status).toBe(400);
    });
});
