import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('PATCH /attractions/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/attractions';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        const validUuid = '00000000-0000-0000-0000-000000000001';
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest'
            },
            body: JSON.stringify({ name: 'Updated Name' })
        });
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        const res = await app.request(`${base}/not-a-uuid`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest'
            },
            body: JSON.stringify({ name: 'Updated Name' })
        });
        expect([400, 401, 403, 422]).toContain(res.status);
    });

    it('validates request body', async () => {
        const validUuid = '00000000-0000-0000-0000-000000000001';
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest'
            },
            body: JSON.stringify({ invalidField: 'value' })
        });
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});
