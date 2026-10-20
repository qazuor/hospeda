import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { decodeFakeNotice } from '../fake/fake-notice';
import { FAKE_NOTICE_CHANNEL_HEADER } from '../fake/fake-outbox';
import type { NoticeDelivery } from '../provider/payment-provider';

export interface MercadoPagoDelivery {
    readonly channel: 'WEBHOOKS' | 'IPN';
    readonly query: string;
    readonly headers: Record<string, string>;
    readonly body: string;
}

export interface MercadoPagoDeliveriesResult {
    readonly deliveries: MercadoPagoDelivery[];
    readonly skipped: number;
}

/** Translate only the fake notice's kind, id and version into measured MP wire shapes. */
export function translateMercadoPagoDeliveries(args: {
    readonly deliveries: readonly NoticeDelivery[];
    readonly now: Date;
    readonly webhookSecret?: string;
}): MercadoPagoDeliveriesResult {
    const deliveries: MercadoPagoDelivery[] = [];
    let skipped = 0;
    for (const delivery of args.deliveries) {
        const { notice } = decodeFakeNotice({ delivery });
        const channel = Object.entries(delivery.headers).find(
            ([name]) => name.toLowerCase() === FAKE_NOTICE_CHANNEL_HEADER
        )?.[1];
        if (
            notice.resourceKind === 'refund' ||
            (channel === 'secondary' && notice.resourceKind !== 'charge')
        ) {
            skipped += 1;
            continue;
        }
        const type =
            notice.resourceKind === 'authorization' ? 'subscription_preapproval' : 'payment';
        if (channel === 'secondary') {
            const query = new URLSearchParams({
                topic: 'payment',
                id: notice.resourceId
            }).toString();
            deliveries.push({
                channel: 'IPN',
                query,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ resource: notice.resourceId, topic: 'payment' })
            });
            continue;
        }
        if (channel !== 'primary') {
            skipped += 1;
            continue;
        }
        const requestId = randomUUID();
        const timestamp = Math.floor(args.now.getTime() / 1000).toString();
        const dataId = /^[a-z0-9]+$/i.test(notice.resourceId)
            ? notice.resourceId.toLowerCase()
            : notice.resourceId;
        const query = new URLSearchParams({
            source_news: 'webhooks',
            'data.id': notice.resourceId,
            type
        }).toString();
        const version = /^\d+$/.test(notice.version) ? Number(notice.version) : notice.version;
        const body = JSON.stringify({
            action: 'updated',
            api_version: 'v1',
            data: { id: dataId },
            date: args.now.toISOString(),
            id: randomInt(1, 2_147_483_647),
            type,
            version,
            live_mode: false
        });
        const headers: Record<string, string> = {
            'content-type': 'application/json',
            'x-request-id': requestId
        };
        if (args.webhookSecret !== undefined) {
            const manifestId = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
            const manifest = `id:${manifestId};request-id:${requestId};ts:${timestamp};`;
            const signature = createHmac('sha256', args.webhookSecret)
                .update(manifest)
                .digest('hex');
            headers['x-signature'] = `ts=${timestamp},v1=${signature}`;
        }
        deliveries.push({ channel: 'WEBHOOKS', query, headers, body });
    }
    return { deliveries, skipped };
}
