/**
 * @file webhooks/mercadopago.ts
 * Receives POST /api/v1/webhooks/mercadopago for Webhooks and IPN. Webhooks
 * are identified by `source_news=webhooks` or the `data.id` plus `type` query shape and require a valid signature (401 when invalid, 500 when no secret is configured);
 * IPN is stored without processing. The body cap answers 413, successful
 * storage/processing answers 200, failed storage or rereading answers 500
 * (D2, D3), and a provider record still being written answers 503 with
 * `Retry-After` (HOS-1968).
 */
import { deliveryChannelFromUrl, receiveProviderDelivery } from '@repo/service-core';
import { createSuccessResponse } from '../../middlewares/response';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { buildMercadoPagoNoticePorts } from './mercadopago-ports';
import { verifyMercadoPagoSignature } from './mercadopago-signature';

/** Retry-After (seconds) sent with a deferred notice; Mercado Pago's own schedule decides the real delay. */
const DEFERRED_RETRY_AFTER_SECONDS = '60';

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
    // HOS-1968: a record the provider is still writing is a deliberate "ask again", not a fault.
    // Mercado Pago retries every non-2xx, so 503 keeps the notice alive; a 200 would drop it.
    if (result.outcome === 'DEFERRED') {
        return c.json({ received: false, deferred: true }, 503, {
            'Retry-After': DEFERRED_RETRY_AFTER_SECONDS
        });
    }
    return c.json({ received: false }, 500);
});
