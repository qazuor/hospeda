import { beforeEach, describe, expect, it, vi } from 'vitest';

const { receive } = vi.hoisted(() => ({ receive: vi.fn() }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return { ...original, receiveProviderDelivery: receive };
});
vi.mock('../../../src/routes/webhooks/mercadopago-ports', () => ({
    buildMercadoPagoNoticePorts: () => ({})
}));

import { mercadoPagoWebhookRoutes } from '../../../src/routes/webhooks/mercadopago';

// IPN channel: no signature is required, so the test reaches the receiver directly.
const IPN_URL = 'http://localhost/?topic=payment&id=186806989292';

function deliver() {
    return mercadoPagoWebhookRoutes.request(IPN_URL, { method: 'POST', body: '{}' });
}

describe('TEST:1968 Mercado Pago webhook answers a deferred notice with a retryable status', () => {
    beforeEach(() => receive.mockReset());

    it('answers 503 with Retry-After for a record still being written', async () => {
        receive.mockResolvedValue({ ack: 'ERROR', outcome: 'DEFERRED' });
        const response = await deliver();
        expect(response.status).toBe(503);
        expect(response.headers.get('Retry-After')).toBe('60');
        expect(await response.json()).toEqual({ received: false, deferred: true });
    });

    it('keeps 500 for a genuine processing failure', async () => {
        receive.mockResolvedValue({ ack: 'ERROR', outcome: 'FAILED' });
        const response = await deliver();
        expect(response.status).toBe(500);
        expect(response.headers.get('Retry-After')).toBeNull();
    });

    it('keeps 200 for an acknowledged notice', async () => {
        receive.mockResolvedValue({ ack: 'OK', outcome: 'PAYMENT_RECORDED' });
        const response = await deliver();
        expect(response.status).toBe(200);
    });
});
