import { createHmac } from 'node:crypto';
import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    getDb,
    payments,
    plans,
    planVersions,
    providerNotifications,
    subscriptions,
    users
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import {
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../../src/utils/analytics/analytics-facts';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const webhookSecret = 'mercadopago-test-webhook-secret';
const clock = createAdjustableClock({ start: new Date('2026-10-12T12:00:00.000Z') });
const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
let server: FakeProviderServer;
let serverClosed = false;
let app: ReturnType<typeof initApp>;

async function createPendingSignup() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b36-webhook-${crypto.randomUUID()}@example.test`,
            displayName: 'B36 webhook user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user created');
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'accommodation', slug: `b36-${crypto.randomUUID()}`, name: 'Básico' })
        .returning();
    if (!plan) throw new Error('No plan created');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No plan version created');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option created');
    const response = await app.request('/api/v1/protected/billing/subscriptions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': user.id,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        },
        body: JSON.stringify({
            billingOptionId: option.id,
            payerEmail: `mp-${crypto.randomUUID()}@example.test`
        })
    });
    const responseText = await response.text();
    if (response.status !== 201 && response.status !== 200)
        throw new Error(`Signup failed: ${response.status} ${responseText}`);
    const responseBody = JSON.parse(responseText) as {
        data?: { authorizationId?: string; subscriptionId?: string };
    };
    const authorizationId = responseBody.data?.authorizationId;
    const subscriptionId = responseBody.data?.subscriptionId;
    if (!authorizationId || !subscriptionId) throw new Error('Signup response lacked identifiers');
    return { user, authorizationId, subscriptionId };
}

function signedHeaders(input: {
    readonly url: string;
    readonly dataId: string;
    readonly body: string;
}) {
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(clock.now().getTime() / 1000));
    const manifestId = /^[a-z\d]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
    const manifest = `id:${manifestId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-request-id': requestId,
        'x-signature': `ts=${timestamp},v1=${signature}`
    };
}

function postDelivery(delivery: { query: string; headers: Record<string, string>; body: string }) {
    return app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
        method: 'POST',
        headers: { ...delivery.headers, 'user-agent': delivery.headers['user-agent'] ?? 'vitest' },
        body: delivery.body
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    const mercadoPagoProvider = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    app = initApp({ clock, paymentProvider: mercadoPagoProvider });
    await getDb()
        .insert(billingDeadlineVersions)
        .values({
            version: 1,
            values: {
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '13': { daysBefore: [5, 1] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            }
        })
        .onConflictDoNothing();
});

afterAll(async () => {
    if (!serverClosed) await server.close();
    await testDb.teardown();
});

describe('Mercado Pago receiver integration', () => {
    it('TEST:1878:7 emits one credited fact for a repeated approved charge delivery and none for a no-op', async () => {
        const signup = await createPendingSignup();
        type CapturedFact = Parameters<
            Parameters<typeof setAnalyticsFactSinkForTests>[0]['emit']
        >[0];
        const facts: CapturedFact[] = [];
        setAnalyticsFactSinkForTests({ emit: (fact) => facts.push(fact) });
        try {
            server.mercadoPagoDeliveries({ webhookSecret });
            await server.provider.approve({ authorizationId: signup.authorizationId });
            clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
            const approval = server
                .mercadoPagoDeliveries({ webhookSecret })
                .deliveries.find((delivery) =>
                    delivery.query.includes('type=subscription_preapproval')
                );
            if (!approval) throw new Error('Expected signed approval notice');
            expect((await postDelivery(approval)).status).toBe(200);
            facts.length = 0;

            server.mercadoPagoDeliveries({ webhookSecret });
            const charge = await server.provider.charge({
                authorizationId: signup.authorizationId,
                amount: { amountMinor: 100000, currency: 'ARS' },
                reference: `analytics-${signup.subscriptionId}`
            });
            clock.advance({ ms: 60 * 60 * 1000 });
            await server.provider.readCharge({ chargeId: charge.chargeId });
            const delivery = server
                .mercadoPagoDeliveries({ webhookSecret })
                .deliveries.filter((item) => item.query.includes(`data.id=${charge.chargeId}`))
                .at(-1);
            if (!delivery) throw new Error('Expected signed approved charge notice');
            expect((await postDelivery(delivery)).status).toBe(200);
            expect((await postDelivery(delivery)).status).toBe(200);
            const chargeFacts = facts.filter(
                (fact) =>
                    'subscriptionId' in fact &&
                    fact.subscriptionId === signup.subscriptionId &&
                    fact.kind === 'CHARGE_CREDITED'
            );
            expect(chargeFacts, JSON.stringify(facts)).toHaveLength(1);

            facts.length = 0;
            expect((await postDelivery(approval)).status).toBe(200);
            expect(
                facts.filter(
                    (fact) =>
                        'subscriptionId' in fact && fact.subscriptionId === signup.subscriptionId
                )
            ).toHaveLength(0);
        } finally {
            resetAnalyticsFactSinkForTests();
        }
    });

    // TEST:B3:36 (soporte)
    it('stores each signed Webhooks delivery and activates by rereading the authorization', async () => {
        const signup = await createPendingSignup();
        server.mercadoPagoDeliveries({ webhookSecret });
        await server.provider.approve({ authorizationId: signup.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const deliveries = server.mercadoPagoDeliveries({ webhookSecret }).deliveries;
        expect(deliveries.length).toBeGreaterThan(0);
        for (const delivery of deliveries) {
            const response = await postDelivery(delivery);
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                success: true,
                data: { received: true }
            });
        }
        const [subscription] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        const ownedRows = (
            await Promise.all(
                deliveries.map(async (delivery) => {
                    const [row] = await getDb()
                        .select()
                        .from(providerNotifications)
                        .where(
                            eq(
                                providerNotifications.url,
                                `http://localhost/api/v1/webhooks/mercadopago?${delivery.query}`
                            )
                        );
                    return row;
                })
            )
        ).filter((row) => row !== undefined);
        expect(subscription?.status).toBe('ACTIVE');
        expect(ownedRows.length).toBe(deliveries.length);
        expect(
            ownedRows.every((row) => {
                const delivery = deliveries.find(({ query }) => row.url.endsWith(`?${query}`));
                return delivery?.channel === row.channel;
            })
        ).toBe(true);
    });

    it('moves an active card subscription into grace after a rejected charge notice', async () => {
        const signup = await createPendingSignup();
        server.mercadoPagoDeliveries({ webhookSecret });
        await server.provider.approve({ authorizationId: signup.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const approval = server
            .mercadoPagoDeliveries({ webhookSecret })
            .deliveries.find((delivery) =>
                delivery.query.includes('type=subscription_preapproval')
            );
        if (!approval) throw new Error('Expected signed approval notice');
        expect((await postDelivery(approval)).status).toBe(200);
        const [active] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        expect(active?.status).toBe('ACTIVE');

        const paidCharge = await server.provider.charge({
            authorizationId: signup.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'paid-cycle'
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        await server.provider.readCharge({ chargeId: paidCharge.chargeId });
        const paidDelivery = server
            .mercadoPagoDeliveries({ webhookSecret })
            .deliveries.find((delivery) =>
                delivery.query.includes(`data.id=${paidCharge.chargeId}`)
            );
        if (!paidDelivery) throw new Error('Expected signed approved-charge notice');
        expect((await postDelivery(paidDelivery)).status).toBe(200);

        server.mercadoPagoDeliveries({ webhookSecret });
        const { chargeId } = await server.provider.failChargeCycle({
            authorizationId: signup.authorizationId,
            declineReason: 'issuer_declined'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const rejected = server
            .mercadoPagoDeliveries({ webhookSecret })
            .deliveries.find((delivery) => delivery.query.includes(`data.id=${chargeId}`));
        if (!rejected) throw new Error('Expected signed rejected-charge notice');
        const response = await postDelivery(rejected);
        const [inGrace] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        expect(inGrace?.status).toBe('GRACE_PERIOD');
        expect(response.status, await response.clone().text()).toBe(200);
    });

    // TEST:B3:23 (soporte)
    it('stores IPN without signature and does not change billing state', async () => {
        const signup = await createPendingSignup();
        const paymentId = crypto.randomUUID();
        const url = `/api/v1/webhooks/mercadopago?topic=payment&id=${paymentId}`;
        const response = await app.request(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ resource: paymentId, topic: 'payment' })
        });
        const [subscription] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, `http://localhost${url}`));
        const processedPayment = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.providerFactId, paymentId));
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
        expect(row?.channel).toBe('IPN');
        expect(subscription?.status).toBe('PENDING_AUTHORIZATION');
        expect(processedPayment).toHaveLength(0);
    });

    it('rejects an invalid Webhooks signature without saving or changing state', async () => {
        const signup = await createPendingSignup();
        const query = `source_news=webhooks&type=subscription_preapproval&data.id=${signup.authorizationId}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const body = JSON.stringify({
            type: 'subscription_preapproval',
            data: { id: signup.authorizationId }
        });
        const headers = signedHeaders({ url, dataId: signup.authorizationId, body });
        headers['x-signature'] =
            `ts=${Math.floor(clock.now().getTime() / 1000)},v1=${'0'.repeat(64)}`;
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            headers,
            body
        });
        const [subscription] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ received: false });
        expect(row).toBeUndefined();
        expect(subscription?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('acknowledges and stores a signed unsupported notice', async () => {
        const id = crypto.randomUUID();
        const query = `source_news=webhooks&type=subscription_authorized_payment&data.id=${id}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const body = JSON.stringify({ type: 'subscription_authorized_payment', data: { id } });
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            headers: signedHeaders({ url, dataId: id, body }),
            body
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
        expect(row?.channel).toBe('WEBHOOKS');
    });

    it('rejects an oversized body before saving it', async () => {
        const id = crypto.randomUUID();
        const query = `topic=payment&id=${id}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            body: 'x'.repeat(64 * 1024 + 1)
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        expect(response.status).toBe(413);
        expect(row).toBeUndefined();
    });

    it('returns 500 without saving a Webhooks delivery when no secret is configured', async () => {
        const id = crypto.randomUUID();
        const query = `source_news=webhooks&type=payment&data.id=${id}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = '';
        validateApiEnv();
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: '{}'
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
        validateApiEnv();
        expect(response.status, await response.clone().text()).toBe(500);
        expect(await response.json()).toMatchObject({ received: false });
        expect(row).toBeUndefined();
    });

    it('stores a signed delivery before a failed reread when the provider is unavailable', async () => {
        const signup = await createPendingSignup();
        server.mercadoPagoDeliveries({ webhookSecret });
        await server.provider.approve({ authorizationId: signup.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const delivery = server.mercadoPagoDeliveries({ webhookSecret }).deliveries[0];
        if (!delivery) throw new Error('No due Webhooks delivery');
        await server.close();
        serverClosed = true;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${delivery.query}`;
        const response = await postDelivery(delivery);
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        expect(response.status, await response.clone().text()).toBe(500);
        expect(await response.json()).toEqual({ received: false });
        expect(row?.channel).toBe('WEBHOOKS');
    });
});
