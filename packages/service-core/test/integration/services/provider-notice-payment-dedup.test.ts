import { coveredPeriods, emailOutbox, eq, payments, providerNotifications } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import {
    encodeFakeNotice,
    FAKE_NOTICE_CHANNEL_HEADER,
    FAKE_NOTICE_DELAY_MS
} from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

function url(token: string, channel: 'primary' | 'secondary') {
    return channel === 'primary'
        ? `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`
        : `https://api.example.test/api/v1/webhooks/mercadopago?topic=payment&t=${token}`;
}

function encodeCharge(chargeId: string, version: string, format: 'json' | 'form'): NoticeDelivery {
    const encoded = encodeFakeNotice({
        notice: { resourceKind: 'charge', resourceId: chargeId, version },
        format
    });
    return {
        headers: {
            'content-type': encoded.contentType,
            [FAKE_NOTICE_CHANNEL_HEADER]: format === 'json' ? 'primary' : 'secondary'
        },
        body: encoded.body
    };
}

async function deliver(
    fixture: Awaited<ReturnType<typeof paymentFixture>>,
    token: string,
    delivery: NoticeDelivery,
    channel: 'primary' | 'secondary'
) {
    return receiveProviderDelivery(
        { url: url(token, channel), delivery },
        {
            provider: fixture.provider,
            clock: fixture.clock,
            beforeCancelNotice,
            coverageNotices: fixture.coverageNotices,
            promoCharges: fixture.promoCharges,
            promoExhaustion: fixture.promoExhaustion
        }
    );
}

describe('TEST:B5:2 provider payment fact deduplication', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:2 ignores three fake refund notices and three measured payment-id notices',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const token = crypto.randomUUID();
            await deliver(fixture, token, encodeCharge(chargeId, '1', 'json'), 'primary');
            fixture.provider.takeDeliveries();
            const before = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(before).toHaveLength(1);
            const refunded = await fixture.provider.refund({
                chargeId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: crypto.randomUUID()
            });
            const immediate = fixture.provider.takeDeliveries().deliveries;
            fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const delayed = fixture.provider.takeDeliveries().deliveries;
            const fakeDeliveries = [];
            for (const delivery of [...immediate, ...delayed]) {
                const notice = await fixture.provider.decodeNotice(delivery);
                if (notice.resourceId === refunded.refundId) fakeDeliveries.push(delivery);
            }
            expect(fakeDeliveries).toHaveLength(3);
            for (const delivery of fakeDeliveries) {
                const channel = delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] as
                    | 'primary'
                    | 'secondary';
                const result = await deliver(fixture, token, delivery, channel);
                expect(result.outcome).toBe(
                    channel === 'secondary' ? 'IPN_NOT_PROCESSED' : 'RESOURCE_KIND_NOT_HANDLED'
                );
            }
            expect(refunded.refundId).toBeTruthy();
            const fakeRows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(fakeRows).toHaveLength(1);
            expect(fakeRows[0]).toMatchObject({
                id: before[0]?.id,
                status: before[0]?.status,
                version: before[0]?.version
            });

            const measuredToken = crypto.randomUUID();
            const measured = [
                encodeCharge(chargeId, '2', 'json'),
                encodeCharge(chargeId, '2', 'json'),
                encodeCharge(chargeId, '2', 'form')
            ];
            for (const [index, delivery] of measured.entries()) {
                const channel = index === 2 ? 'secondary' : 'primary';
                await deliver(fixture, measuredToken, delivery, channel);
            }
            const measuredRows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(measuredRows).toHaveLength(1);
            expect(measuredRows[0]).toMatchObject({
                id: before[0]?.id,
                status: before[0]?.status,
                version: before[0]?.version
            });
            const rows = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url(measuredToken, 'primary')));
            const ownRows = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url(measuredToken, 'secondary')));
            expect([...rows, ...ownRows]).toHaveLength(3);
            expect(rows).toHaveLength(2);
            expect(ownRows).toHaveLength(1);
            expect(ownRows[0]?.channel).toBe('IPN');
            expect(rows.every((row) => row.channel === 'WEBHOOKS')).toBe(true);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:2 approves the same pending fact on retry after M8 and records its coverage',
        async () => {
            const fixture = await paymentFixture({ honestM8: false });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const token = crypto.randomUUID();
            const pending = await deliver(
                fixture,
                token,
                encodeCharge(chargeId, '1', 'json'),
                'primary'
            );
            expect(pending.outcome).toBe('PAYMENT_RECORDED');
            fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS + 2 * 60 * 60 * 1000 });
            const due = fixture.provider.takeDeliveries().deliveries;
            let approved: NoticeDelivery | undefined;
            for (const item of due) {
                const notice = await fixture.provider.decodeNotice(item);
                if (
                    notice.resourceKind === 'charge' &&
                    notice.resourceId === chargeId &&
                    notice.version === '2' &&
                    item.headers[FAKE_NOTICE_CHANNEL_HEADER] === 'primary'
                ) {
                    approved = item;
                    break;
                }
            }
            expect(approved).toBeDefined();
            const result = await deliver(fixture, token, approved!, 'primary');
            const rows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            const coverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, rows[0]?.id ?? ''));
            expect(result.outcome).toBe('PAYMENT_CREDITED');
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ status: 'SUCCEEDED', version: 2 });
            expect(coverage).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:2 records but does not reapply an older approved fact after the newest notice',
        async () => {
            const fixture = await paymentFixture({
                honestM8: false,
                simulate: [
                    {
                        simulation: 'noticesOutOfOrder',
                        why: 'TEST:B5:2 exercises a stale charge notice'
                    }
                ]
            });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const token = crypto.randomUUID();
            await deliver(fixture, token, encodeCharge(chargeId, '1', 'json'), 'primary');
            fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS + 2 * 60 * 60 * 1000 });
            const due = fixture.provider.takeDeliveries().deliveries;
            const webhookByVersion = new Map<string, NoticeDelivery>();
            for (const item of due) {
                if (item.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'primary') continue;
                const decoded = await fixture.provider.decodeNotice(item);
                if (decoded.resourceKind !== 'charge' || decoded.resourceId !== chargeId) continue;
                webhookByVersion.set(decoded.version, item);
            }
            const newest = webhookByVersion.get('2');
            const older = webhookByVersion.get('1');
            expect(newest).toBeDefined();
            expect(older).toBeDefined();
            await deliver(fixture, token, newest!, 'primary');
            const [afterNewest] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            const oldResult = await deliver(fixture, token, older!, 'primary');
            const [afterOld] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            const emails = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            const notices = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url(token, 'primary')));
            const coverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, afterOld?.id ?? ''));
            expect(oldResult.outcome).toBe('PAYMENT_ALREADY_CREDITED');
            expect(afterOld).toMatchObject({ status: 'SUCCEEDED', version: afterNewest?.version });
            expect(afterOld?.updatedAt).toEqual(afterNewest?.updatedAt);
            expect(
                emails.filter(
                    (row) => (row.payload as { paymentId?: string }).paymentId === afterOld?.id
                )
            ).toHaveLength(1);
            expect(fixture.coverageEvents).toHaveLength(1);
            expect(coverage).toHaveLength(1);
            expect(notices).toHaveLength(3);
        }
    );
});
