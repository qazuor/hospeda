import {
    and,
    billingDeadlineVersions,
    domainEvent,
    emailOutbox,
    eq,
    getDb,
    providerLinks,
    providerNotifications,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-12T12:00:00.000Z') });
const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
const subjects = createSubjects();
let server: FakeProviderServer;
let app: ReturnType<typeof initApp>;
let billingOptionId: string;
let lifterId: string;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
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
    billingOptionId = await createSignupOption();
    lifterId = await createLifter();
});
afterEach(async () => retireSubjects(subjects, lifterId));
afterAll(async () => {
    await server.close();
    await testDb.teardown();
});

async function deliver(delivery: SignedDelivery) {
    subjects.deliveries.push(delivery);
    const response = await postDelivery(app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
    expect((await noticeRowsOf(delivery)).map((item) => item.channel)).toEqual(['WEBHOOKS']);
}

async function dueDelivery(type: 'subscription_preapproval' | 'payment', id: string) {
    const delivery = server
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
        clock,
        type,
        id,
        version: String(BigInt(link.lastAppliedVersion ?? '0') + 1n)
    });
}

async function activeSignup() {
    const created = await signup({ app, billingOptionId, subjects });
    server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
    await fake.approve({ authorizationId: created.authorizationId });
    clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(await dueDelivery('subscription_preapproval', created.authorizationId));
    return created;
}

describe('HOS-1559 AC:B7:9 — el receptor real registra la pausa del proveedor', () => {
    it('I-8: paused ACTIVE is processed while listCharges remains UNKNOWN (HOS-1669)', async () => {
        const created = await activeSignup();
        const charge = await fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'hos1559-provider-pause'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await fake.readCharge({ chargeId: charge.chargeId });
        await deliver(await dueDelivery('payment', charge.chargeId));
        // HOS-1669: the real adapter listCharges is NOT_IMPLEMENTED; once it reads charges this must become SUSPENDED.
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fake.pause({ authorizationId: created.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const delivery = await dueDelivery('subscription_preapproval', created.authorizationId);
        await deliver(delivery);
        expect(
            await getDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.body, delivery.body))
        ).toHaveLength(1);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(
            (await fake.readAuthorization({ authorizationId: created.authorizationId })).snapshot
                .status
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

    it('expired grace cancelled is processed without mirroring to CANCELLED', async () => {
        const created = await activeSignup();
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(clock.now().getTime() - 9 * 86_400_000),
                graceEndsAt: new Date(clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, created.subscriptionId));
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fake.cancel({ authorizationId: created.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
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
