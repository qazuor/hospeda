import {
    coveredPeriods,
    emailOutbox,
    eq,
    payments,
    providerNotifications,
    receipts,
    subscriptions
} from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, describe, expect, it } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

function url(token: string, channel: 'WEBHOOKS' | 'IPN') {
    return channel === 'WEBHOOKS'
        ? `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${token}`
        : `https://api.example.test/api/v1/webhooks/mercadopago?topic=payment&t=${token}`;
}

function delivery(chargeId: string): NoticeDelivery {
    const encoded = encodeFakeNotice({
        notice: { resourceKind: 'charge', resourceId: chargeId, version: '1' },
        format: 'json'
    });
    return { headers: { 'content-type': encoded.contentType }, body: encoded.body };
}

describe('TEST:B5:24 RP12 card validation receiver', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'keeps approve card validation only in the provider delivery rows',
        async () => {
            const fixture = await paymentFixture({ withoutRP12: false });
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const providerDeliveries = fixture.provider.takeDeliveries().deliveries;
            const decoded = await Promise.all(
                providerDeliveries.map((item) => fixture.provider.decodeNotice(item))
            );
            const validation = decoded.find((item) => item.resourceKind === 'charge');
            expect(validation).toBeDefined();
            const charge = (
                await fixture.provider.readCharge({
                    chargeId: validation!.resourceId
                })
            ).snapshot;
            expect(charge).toMatchObject({
                purpose: 'cardValidation',
                status: 'approved',
                authorizationId: null,
                reference: null,
                amount: { amountMinor: 0, currency: 'ARS' }
            });

            const token = crypto.randomUUID();
            const webhook = await receiveProviderDelivery(
                {
                    url: url(token, 'WEBHOOKS'),
                    delivery: providerDeliveries.find(
                        (_, index) => decoded[index]?.resourceKind === 'charge'
                    )!
                },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices,
                    promoCharges: fixture.promoCharges,
                    promoExhaustion: fixture.promoExhaustion
                }
            );
            const ipn = await receiveProviderDelivery(
                { url: url(token, 'IPN'), delivery: delivery(charge.chargeId) },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices,
                    promoCharges: fixture.promoCharges,
                    promoExhaustion: fixture.promoExhaustion
                }
            );
            expect(webhook).toMatchObject({ ack: 'OK', outcome: 'CARD_VALIDATION_IGNORED' });
            expect(ipn).toMatchObject({ ack: 'OK', outcome: 'IPN_NOT_PROCESSED' });

            const saved = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url(token, 'WEBHOOKS')));
            const savedIpn = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url(token, 'IPN')));
            const subjectPayments = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, charge.chargeId));
            const subjectCoverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.subscriptionId, fixture.started.subscriptionId));
            const subjectReceipts = await getServiceTestDb()
                .select({ receiptId: receipts.id })
                .from(receipts)
                .innerJoin(payments, eq(payments.id, receipts.paymentId))
                .where(eq(payments.subscriptionId, fixture.started.subscriptionId));
            const userEmails = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(saved).toHaveLength(1);
            expect(saved[0]?.channel).toBe('WEBHOOKS');
            expect(savedIpn).toHaveLength(1);
            expect(savedIpn[0]?.channel).toBe('IPN');
            expect(subjectPayments).toEqual([]);
            expect(subjectCoverage).toEqual([]);
            expect(subjectReceipts).toEqual([]);
            expect(userEmails).toEqual([]);
            expect(after).toEqual(before);
            expect(fixture.coverageNotices.emitCoverageChanged).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'does not treat an RP12 rejected validation as a first rejected payment',
        async () => {
            const fixture = await paymentFixture({ withoutRP12: false });
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const rejected = await fixture.provider.changeCard({
                authorizationId: fixture.started.authorizationId,
                passes: false
            });
            const snapshot = (await fixture.provider.readCharge({ chargeId: rejected!.chargeId }))
                .snapshot;
            const result = await receiveProviderDelivery(
                {
                    url: url(crypto.randomUUID(), 'WEBHOOKS'),
                    delivery: delivery(snapshot.chargeId)
                },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices,
                    promoCharges: fixture.promoCharges,
                    promoExhaustion: fixture.promoExhaustion
                }
            );
            const subjectPayments = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, snapshot.chargeId));
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(snapshot.status).toBe('rejected');
            expect(result).toMatchObject({ ack: 'OK', outcome: 'CARD_VALIDATION_IGNORED' });
            expect(subjectPayments).toEqual([]);
            expect(before?.status).toBe('ACTIVE');
            expect(after).toEqual(before);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'turns RP12 off by name and records a healthy ordinary charge',
        async () => {
            const fixture = await paymentFixture();
            const startupNotices = await Promise.all(
                fixture.provider
                    .takeDeliveries()
                    .deliveries.map((item) => fixture.provider.decodeNotice(item))
            );
            expect(startupNotices.some((item) => item.resourceKind === 'charge')).toBe(false);
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const result = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices,
                    promoCharges: fixture.promoCharges,
                    promoExhaustion: fixture.promoExhaustion
                }
            );
            expect(result.outcome).toBe('CREDITED');
            const subject = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(subject).toHaveLength(1);
            expect(subject[0]?.status).toBe('SUCCEEDED');
        }
    );
});
