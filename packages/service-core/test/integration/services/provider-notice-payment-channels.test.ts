import { emailOutbox, eq, payments, providerNotifications } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const orders = [
    ['W', 'W', 'I'],
    ['W', 'I', 'W'],
    ['I', 'W', 'W']
] as const;

function url(token: string, channel: 'W' | 'I') {
    return channel === 'W'
        ? `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`
        : `https://api.example.test/api/v1/webhooks/mercadopago?topic=payment&t=${token}`;
}

function approvedDelivery(chargeId: string): NoticeDelivery {
    const encoded = encodeFakeNotice({
        notice: { resourceKind: 'charge', resourceId: chargeId, version: '1' },
        format: 'json'
    });
    return { headers: { 'content-type': encoded.contentType }, body: encoded.body };
}

describe('TEST:B5:21 payment notice channel deduplication', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:21 records one payment for every ordering of two webhooks and one IPN',
        async () => {
            for (const order of orders) {
                const fixture = await paymentFixture();
                const { chargeId } = await fixture.provider.charge({
                    authorizationId: fixture.started.authorizationId,
                    amount: { amountMinor: 250000, currency: 'ARS' },
                    reference: fixture.started.subscriptionId
                });
                const token = crypto.randomUUID();
                const delivery = approvedDelivery(chargeId);
                let webhookCount = 0;
                const outcomes = [];
                for (const channel of order) {
                    if (channel === 'W') {
                        webhookCount += 1;
                        if (webhookCount === 2) fixture.clock.advance({ ms: 500 });
                    } else if (webhookCount > 0) {
                        fixture.clock.advance({ ms: 250 });
                    }
                    outcomes.push(
                        await receiveProviderDelivery(
                            { url: url(token, channel), delivery },
                            {
                                provider: fixture.provider,
                                clock: fixture.clock,
                                beforeCancelNotice,
                                coverageNotices: fixture.coverageNotices,
                                promoCharges: fixture.promoCharges,
                                promoExhaustion: fixture.promoExhaustion
                            }
                        )
                    );
                }
                await assertEffects({ fixture, chargeId, token, outcomes });
            }
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:21 accepts the two webhooks in parallel and stores both deliveries',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const token = crypto.randomUUID();
            const delivery = approvedDelivery(chargeId);
            const results = await Promise.all(
                [1, 2].map(() =>
                    receiveProviderDelivery(
                        {
                            url: url(token, 'W'),
                            delivery
                        },
                        {
                            provider: fixture.provider,
                            clock: fixture.clock,
                            beforeCancelNotice,
                            coverageNotices: fixture.coverageNotices,
                            promoCharges: fixture.promoCharges,
                            promoExhaustion: fixture.promoExhaustion
                        }
                    )
                )
            );
            await assertEffects({ fixture, chargeId, token, outcomes: results });
        }
    );
});

async function assertEffects(args: {
    readonly fixture: Awaited<ReturnType<typeof paymentFixture>>;
    readonly chargeId: string;
    readonly token: string;
    readonly outcomes: readonly { readonly outcome: string }[];
}) {
    const { fixture, chargeId, token, outcomes } = args;
    const rows = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, chargeId));
    const emailRows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, fixture.user.id));
    const webhooks = await getServiceTestDb()
        .select()
        .from(providerNotifications)
        .where(eq(providerNotifications.url, url(token, 'W')));
    const ipn = await getServiceTestDb()
        .select()
        .from(providerNotifications)
        .where(eq(providerNotifications.url, url(token, 'I')));
    const ownEmails = emailRows.filter(
        (row) => (row.payload as { paymentId?: string }).paymentId === rows[0]?.id
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'SUCCEEDED', version: 2 });
    expect(ownEmails).toHaveLength(1);
    expect(ownEmails[0]?.template).toBe('billing.payment-credited');
    expect(fixture.coverageNotices.emitCoverageChanged).toHaveBeenCalledTimes(1);
    expect(webhooks).toHaveLength(outcomes.length === 2 ? 2 : 2);
    expect(webhooks.every((row) => row.channel === 'WEBHOOKS')).toBe(true);
    expect(ipn).toHaveLength(outcomes.length === 2 ? 0 : 1);
    expect(ipn[0]?.channel).toBe(outcomes.length === 2 ? undefined : 'IPN');
    expect(outcomes.filter((result) => result.outcome === 'IPN_NOT_PROCESSED')).toHaveLength(
        outcomes.length === 2 ? 0 : 1
    );
}
