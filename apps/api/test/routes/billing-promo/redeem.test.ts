import { beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('TEST:B9b:2 AC:B9b:2 protected promo redemption route', () => {
    beforeEach(() => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    });

    it('requires an authenticated actor before processing a redemption', async () => {
        const app = initApp();
        const response = await app.request('/api/v1/protected/billing/promo-codes/redeem', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ code: 'SAVE', vertical: 'accommodation' })
        });
        expect(response.status).toBe(401);
    });
});
