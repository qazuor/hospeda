/**
 * @file webhooks/mercadopago.ts
 * Receives POST /api/v1/webhooks/mercadopago for Webhooks and IPN. Webhooks
 * require a valid signature (401 when invalid, 500 when no secret is configured);
 * IPN is stored without processing. The body cap answers 413, successful
 * storage/processing answers 200, and failed storage or rereading answers 500
 * (D2, D3).
 */
import { deliveryChannelFromUrl, receiveProviderDelivery } from '@repo/service-core';
import { createSuccessResponse } from '../../middlewares/response';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { buildMercadoPagoNoticePorts } from './mercadopago-ports';
import { verifyMercadoPagoSignature } from './mercadopago-signature';

export const mercadoPagoWebhookRoutes = createRouter();

mercadoPagoWebhookRoutes.post('/', async (c) => {
    const url = c.req.url;
    const channel = deliveryChannelFromUrl({ url });
    if (channel === 'WEBHOOKS') {
        const requestId = c.req.header('x-request-id');
        const secret = env?.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET;
        if (!secret) {
            apiLogger.error({ channel, message: 'Mercado Pago Webhooks secret is not configured' });
            return c.json({ received: false }, 500);
        }
        if (
            !verifyMercadoPagoSignature({
                signatureHeader: c.req.header('x-signature'),
                requestId,
                dataId: c.req.query('data.id'),
                secret
            })
        ) {
            apiLogger.warn({
                requestId,
                channel,
                message: 'Invalid Mercado Pago Webhooks signature'
            });
            return c.json({ received: false }, 401);
        }
    }

    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const result = await receiveProviderDelivery(
        { url, delivery: { headers, body } },
        buildMercadoPagoNoticePorts()
    );
    apiLogger.info({ channel, outcome: result.outcome }, 'Mercado Pago delivery received');
    if (result.ack === 'OK') return c.json(createSuccessResponse({ received: true }), 200);
    return c.json({ received: false }, 500);
});
