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
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify('x'.repeat(64 * 1024 - 2))
            }
        );
        const overLimit = await app.request(
            '/api/v1/webhooks/mercadopago?topic=payment&id=limit-test',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify('x'.repeat(64 * 1024 - 1))
            }
        );
        const atLimitBody = (await atLimit.json()) as { readonly received?: boolean };

        expect(atLimit.status).not.toBe(413);
        expect(atLimitBody).toMatchObject({ received: false });
        expect(overLimit.status).toBe(413);
        expect(await overLimit.json()).toMatchObject({ success: false });
    });

    it('keeps the global body limit for other routes', async () => {
        const app = initApp();
        const response = await app.request('/api/v1/protected/accommodations', {
            method: 'POST',
            headers: { 'user-agent': 'vitest' },
            body: 'x'.repeat(64 * 1024 + 1)
        });
        const body = (await response.json()) as { readonly error?: { readonly code?: string } };
        expect(response.status).not.toBe(413);
        expect(body.error?.code).not.toBe('REQUEST_TOO_LARGE');
    });
});
