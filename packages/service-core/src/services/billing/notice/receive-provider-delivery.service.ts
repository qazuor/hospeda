import { createLogger } from '@repo/logger';
import type { NoticeDelivery } from '@repo/payments';
import { z } from 'zod';
import type { ProcessProviderNoticePorts } from './process-provider-notice.service.js';
import { processProviderNotice } from './process-provider-notice.service.js';
import { deliveryChannelFromUrl } from './provider-delivery-channel.js';

const logger = createLogger('provider-delivery-receiver');
const inputSchema = z.strictObject({
    url: z.string().min(1),
    delivery: z.strictObject({ headers: z.record(z.string(), z.string()), body: z.string() })
});
type ProcessOutcome = Awaited<ReturnType<typeof processProviderNotice>>['outcome'];

/** Stores every delivery before handing webhooks to the existing by-id receiver. */
export async function receiveProviderDelivery(
    input: { readonly url: string; readonly delivery: NoticeDelivery },
    ports: ProcessProviderNoticePorts
): Promise<{
    readonly ack: 'OK' | 'ERROR';
    readonly outcome: ProcessOutcome | 'DELIVERY_NOT_SAVED' | 'INVALID_DELIVERY';
}> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ack: 'ERROR', outcome: 'INVALID_DELIVERY' };
    const channel = deliveryChannelFromUrl({ url: parsed.data.url });
    const receivedAt = ports.clock.now();
    try {
        const { providerNotificationModel } = await import('@repo/db');
        await providerNotificationModel.insertDelivery({
            channel,
            url: parsed.data.url,
            body: parsed.data.delivery.body,
            receivedAt
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ channel, message }, 'Provider delivery could not be saved');
        return { ack: 'ERROR', outcome: 'DELIVERY_NOT_SAVED' };
    }
    return await processProviderNotice({ channel, delivery: parsed.data.delivery }, ports);
}
