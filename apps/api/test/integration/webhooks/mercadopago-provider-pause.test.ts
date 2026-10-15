import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    getDb,
    payments,
    providerLinks,
    providerNotifications,
    subscriptions
} from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(fixture.subjects, fixture.lifterId));
afterAll(async () => {
    await fixture.stop();
});

async function deliver(delivery: SignedDelivery) {
    fixture.subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
    expect((await noticeRowsOf(delivery)).map((item) => item.channel)).toEqual(['WEBHOOKS']);
}

async function dueDelivery(type: 'subscription_preapproval' | 'payment', id: string) {
    const delivery = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (item) => item.query.includes(`type=${type}`) && item.query.includes(`data.id=${id}`)
        );
    if (delivery) return delivery;
    const [link] = await getDb()
        .select({ lastAppliedVersion: providerLinks.lastAppliedVersion })
        .from(providerLinks)
        .where(eq(providerLinks.providerId, id));
    if (!link) throw new Error(`Expected provider link for ${id}`);
    // The fake can omit a notice; the test still delivers the observed provider state by Webhooks.
    return signedNotice({
        clock: fixture.clock,
        type,
        id,
        version: String(BigInt(link.lastAppliedVersion ?? '0') + 1n)
    });
}

async function activeSignup() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects: fixture.subjects
    });
    fixture.server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(await dueDelivery('subscription_preapproval', created.authorizationId));
    return created;
}

describe('HOS-1669 TEST:1669:5 AC:B7:9 — S6 distingue el período cobrado del rechazado', () => {
    it('I-8: un período cobrado queda ACTIVE tras pausar y se verifica por HTTP real', async () => {
        const created = await activeSignup();
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `hos1669-charged-${crypto.randomUUID()}`
        });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await fixture.fake.readCharge({ chargeId: charge.chargeId });
        await deliver(await dueDelivery('payment', charge.chargeId));
        fixture.server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fixture.fake.pause({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const delivery = await dueDelivery('subscription_preapproval', created.authorizationId);
        await deliver(delivery);
        expect(
            await getDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.body, delivery.body))
        ).toHaveLength(1);
        const callsBeforeSweep = fixture.server.requests().length;
        const sweep = await fixture.runSweep();
        expect((sweep.details?.failedSubscriptionIds ?? []) as string[]).not.toContain(
            created.subscriptionId
        );
        const chargeRequests = fixture.server
            .requests()
            .slice(callsBeforeSweep)
            .filter((request) => request.method === 'GET');
        expect(
            chargeRequests.some(
                (request) =>
                    request.path ===
                    `/authorized_payments/search?preapproval_id=${encodeURIComponent(created.authorizationId)}&limit=10&offset=0`
            )
        ).toBe(true);
        expect(
            chargeRequests.some((request) => request.path === `/v1/payments/${charge.chargeId}`)
        ).toBe(true);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(
            (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
                .snapshot.status
        ).toBe('paused');
        expect(
            await getDb()
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, created.userId),
                        eq(emailOutbox.template, 'billing.arrears-suspension')
                    )
                )
        ).toEqual([]);
    });

    it('el rechazo último con una pausa encola S6, espera el aviso y cancela tras enviarlo', async () => {
        const created = await activeSignup();
        const paid = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `hos1669-prior-paid-${crypto.randomUUID()}`
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await fixture.fake.readCharge({ chargeId: paid.chargeId });
        await deliver(await dueDelivery('payment', paid.chargeId));
        expect(
            await getDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, created.subscriptionId))
        ).toHaveLength(1);
        await fixture.fake.declineCharge({
            authorizationId: created.authorizationId,
            declineReason: 'issuer_declined'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        fixture.server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fixture.fake.pause({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(await dueDelivery('subscription_preapproval', created.authorizationId));

        const deferred = await fixture.runSweep();
        expect((deferred.details?.failedSubscriptionIds ?? []) as string[]).not.toContain(
            created.subscriptionId
        );
        const [waiting] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(waiting?.status).toBe('ACTIVE');
        const pendingNotices = await getDb()
            .select({ id: emailOutbox.id, status: emailOutbox.status })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, created.userId),
                    eq(emailOutbox.template, 'billing.arrears-suspension')
                )
            );
        expect(pendingNotices).toHaveLength(1);
        expect(pendingNotices[0]?.status).toBe('pending');

        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.arrears-suspension'
        });
        const decided = await fixture.runSweep();
        expect((decided.details?.failedSubscriptionIds ?? []) as string[]).not.toContain(
            created.subscriptionId
        );
        const [suspended] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(suspended?.status).toBe('SUSPENDED');
        expect(
            (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
                .snapshot.status
        ).toBe('cancelled');
    });

    it('expired grace cancelled is processed without mirroring to CANCELLED', async () => {
        const created = await activeSignup();
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(fixture.clock.now().getTime() - 9 * 86_400_000),
                graceEndsAt: new Date(fixture.clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, created.subscriptionId));
        fixture.server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fixture.fake.cancel({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const delivery = await dueDelivery('subscription_preapproval', created.authorizationId);
        await deliver(delivery);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('GRACE_PERIOD');
        const events = await getDb()
            .select({ eventType: domainEvent.eventType })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, created.subscriptionId));
        expect(
            events.filter(
                (event) => event.eventType === 'subscription.provider_cancelled_after_rejection'
            )
        ).toEqual([]);
        const [link] = await getDb()
            .select({ subscriptionId: providerLinks.subscriptionId })
            .from(providerLinks)
            .where(eq(providerLinks.providerId, created.authorizationId));
        expect(link?.subscriptionId).toBe(created.subscriptionId);
    });
});
