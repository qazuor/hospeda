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
const serverClosed = false;
let app: ReturnType<typeof initApp>;

async function createPendingSignup() {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `unmarked-${crypto.randomUUID()}@example.test`,
            displayName: 'Unmarked webhook user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user created');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `unmarked-${crypto.randomUUID()}`,
            name: 'Básico'
        })
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
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 100000,
            currency: 'ARS'
        })
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

function signedHeaders(dataId: string) {
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(clock.now().getTime() / 1000));
    const manifestId = /^[a-z\d]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const signature = createHmac('sha256', webhookSecret)
        .update(`id:${manifestId};request-id:${requestId};ts:${timestamp};`)
        .digest('hex');
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
        headers: { ...delivery.headers, 'user-agent': 'vitest' },
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

describe('Mercado Pago unmarked receiver integration', () => {
    it('TEST:1726:3 activates a signup from signed fake deliveries without the marker', async () => {
        const signup = await createPendingSignup();
        await server.provider.approve({ authorizationId: signup.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const deliveries = server
            .mercadoPagoDeliveries({ webhookSecret })
            .deliveries.filter(({ channel }) => channel === 'WEBHOOKS')
            .map((delivery) => {
                const query = new URLSearchParams(delivery.query);
                query.delete('source_news');
                return { ...delivery, query: query.toString() };
            });
        expect(deliveries.length).toBeGreaterThan(0);
        expect(
            deliveries.every(({ query }) => !new URLSearchParams(query).has('source_news'))
        ).toBe(true);
        for (const delivery of deliveries) expect((await postDelivery(delivery)).status).toBe(200);
        const [subscription] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        expect(subscription?.status).toBe('ACTIVE');
        for (const delivery of deliveries) {
            const url = `http://localhost/api/v1/webhooks/mercadopago?${delivery.query}`;
            const [row] = await getDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url));
            expect(row?.channel).toBe('WEBHOOKS');
        }
    });

    it('TEST:1726:4 rejects an invalid signature on the real unmarked Webhooks shape', async () => {
        const signup = await createPendingSignup();
        const query = `type=subscription_preapproval&data.id=${signup.authorizationId}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const body = JSON.stringify({
            action: 'updated',
            application_id: 2671930029336144,
            data: { id: signup.authorizationId },
            entity: 'preapproval',
            type: 'subscription_preapproval',
            version: 3
        });
        const headers = signedHeaders(signup.authorizationId);
        headers['x-signature'] =
            `ts=${Math.floor(clock.now().getTime() / 1000)},v1=${'0'.repeat(64)}`;
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            headers,
            body
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        const [subscription] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, signup.subscriptionId));
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ received: false });
        expect(row).toBeUndefined();
        expect(subscription?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('TEST:1726:5 stores signed-header IPN without processing it', async () => {
        const id = crypto.randomUUID();
        const query = `topic=payment&id=${id}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const response = await app.request(`/api/v1/webhooks/mercadopago?${query}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                'x-request-id': crypto.randomUUID(),
                'x-signature': `ts=${Date.now()},v1=${'a'.repeat(64)}`
            },
            body: JSON.stringify({ resource: id, topic: 'payment' })
        });
        const [row] = await getDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, url));
        const facts = await getDb().select().from(payments).where(eq(payments.providerFactId, id));
        expect(response.status).toBe(200);
        expect(row?.channel).toBe('IPN');
        expect(facts).toHaveLength(0);
    });

    it('TEST:1726:6 returns 500 without a secret for unmarked Webhooks shape', async () => {
        const id = crypto.randomUUID();
        const query = `type=payment&data.id=${id}`;
        const url = `http://localhost/api/v1/webhooks/mercadopago?${query}`;
        const originalSecret = process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET;
        try {
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
            expect(response.status).toBe(500);
            expect(await response.json()).toMatchObject({ received: false });
            expect(row).toBeUndefined();
        } finally {
            process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = originalSecret ?? '';
            validateApiEnv();
        }
    });
});
