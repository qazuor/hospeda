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
            'x-mock-actor-id': user.id,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        },
        body: JSON.stringify({ billingOptionId: option.id })
    });
    const body = (await response.json()) as { authorizationId?: string; subscriptionId?: string };
    if (response.status !== 201 && response.status !== 200)
        throw new Error(`Signup failed: ${response.status}`);
    const authorizationId = body.authorizationId;
    const subscriptionId = body.subscriptionId;
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
        'x-request-id': requestId,
        'x-signature': `ts=${timestamp},v1=${signature}`
    };
}

function postDelivery(delivery: { query: string; headers: Record<string, string>; body: string }) {
    return app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
        method: 'POST',
        headers: delivery.headers,
        body: delivery.body
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    app = initApp({
        clock,
        paymentProvider: new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        })
    });
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
            expect(await response.json()).toEqual({ received: true });
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
            ownedRows.every(
                (row) => row.channel === 'WEBHOOKS' && row.url.includes('source_news=webhooks')
            )
        ).toBe(true);
    });

    // TEST:B3:23 (soporte)
    it('stores IPN without signature and does not change billing state', async () => {
        const signup = await createPendingSignup();
        const paymentId = crypto.randomUUID();
        const url = `/api/v1/webhooks/mercadopago?topic=payment&id=${paymentId}`;
        const response = await app.request(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
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
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true });
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
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true });
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
            body: '{}'
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
        validateApiEnv();
        expect(response.status).toBe(500);
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
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ received: false });
        expect(row?.channel).toBe('WEBHOOKS');
    });
});
