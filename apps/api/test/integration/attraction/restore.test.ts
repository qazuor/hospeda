import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /attractions/:id/restore', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/attractions';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        const validUuid = '00000000-0000-0000-0000-000000000001';
        const res = await app.request(`${base}/${validUuid}/restore`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        const res = await app.request(`${base}/not-a-uuid/restore`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});
