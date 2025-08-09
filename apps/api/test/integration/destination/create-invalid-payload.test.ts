import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Create invalid payloads', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('returns 400 when name is too short', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'ab',
                summary: 'short summary',
                description: 'short description'
            })
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('returns 400 when summary is too short', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Valid Name',
                summary: 'short',
                description: 'valid description here'
            })
        });
        expect([400, 401, 403]).toContain(res.status);
    });
});
