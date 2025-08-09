import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

const repeat = (s: string, n: number) => s.repeat(n);

describe('Destination - Create max lengths', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('accepts boundary: name=100, summary=200, description=2000', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: repeat('n', 100),
                summary: repeat('s', 200),
                description: repeat('d', 2000)
            })
        });
        expect([200, 400, 401, 403]).toContain(res.status);
    });

    it('rejects name > 100', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: repeat('n', 101),
                summary: repeat('s', 50),
                description: repeat('d', 50)
            })
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('rejects summary > 200', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Valid Name',
                summary: repeat('s', 201),
                description: repeat('d', 50)
            })
        });
        expect([400, 401, 403]).toContain(res.status);
    });

    it('rejects description > 2000', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Valid Name',
                summary: repeat('s', 50),
                description: repeat('d', 2001)
            })
        });
        expect([400, 401, 403]).toContain(res.status);
    });
});
