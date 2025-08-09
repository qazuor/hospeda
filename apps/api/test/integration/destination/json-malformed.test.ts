import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Malformed JSON bodies', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('POST returns 400/401/403 when JSON is malformed', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // invalid JSON
            body: '{ name: "Invalid" ' // missing closing brace
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('PUT returns 400/401/403/404 when JSON is malformed', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';
        const res = await app.request(`${base}/${id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: '{ slug: invalid }'
        });
        expect([400, 401, 403, 404]).toContain(res.status);
    });
});
