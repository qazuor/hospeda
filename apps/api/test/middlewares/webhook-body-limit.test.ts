import { beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

describe('Mercado Pago webhook body limit', () => {
    beforeEach(() => {
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = '';
        validateApiEnv();
    });

    it('lets a 64 KiB body reach the webhook handler and rejects 64 KiB plus one', async () => {
        const app = initApp();
        const atLimit = await app.request(
            '/api/v1/webhooks/mercadopago?topic=payment&id=limit-test',
            { method: 'POST', body: 'x'.repeat(64 * 1024) }
        );
        const overLimit = await app.request(
            '/api/v1/webhooks/mercadopago?topic=payment&id=limit-test',
            { method: 'POST', body: 'x'.repeat(64 * 1024 + 1) }
        );

        expect(atLimit.status).not.toBe(413);
        expect(overLimit.status).toBe(413);
        expect(await overLimit.json()).toMatchObject({ success: false });
    });

    it('keeps the global body limit for other routes', async () => {
        const app = initApp();
        const response = await app.request('/api/v1/protected/accommodations', {
            method: 'POST',
            body: 'x'.repeat(64 * 1024 + 1)
        });
        expect(response.status).not.toBe(413);
    });
});
