/**
 * TEST:B7:7 AC:B7:33 AC:B7:27 a chargeback on a predecessor with a live S1
 * successor runs S6 and cuts the successor through S31.
 *
 * The succession is produced by the real `startSuccession` service (the same one
 * the plan-change branch calls), the charge is credited through the real notice
 * receiver, and the chargeback is read twice: the first read opens the mark and
 * defers S6 on the pending mail, the second completes it.
 *
 * This file builds its own fixture because it needs the fake to be honest about
 * M1: `startSuccession` sends `firstChargeAt` to the provider and asserts it
 * landed, which the shared period-charges fake drops.
 */
import {
    and,
    billingDeadlineVersions,
    emailOutbox,
    eq,
    getDb,
    planCatalogModel,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { startSuccession } from '@repo/service-core';
import { createAdjustableClock } from '@repo/test-clock';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../../src/routes/billing-subscription/tourist-vip-inheritance';
import { getClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from '../webhooks/mercadopago-delegates-fixtures';

const START = new Date('2026-10-12T12:00:00.000Z');

let fixture: Awaited<ReturnType<typeof startChargebackSuccessionFixture>>;

/** A real API over a fake provider honest about M1, so S1 can create the successor. */
async function startChargebackSuccessionFixture() {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
    await testDb.setup();
    validateApiEnv();
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'the successor authorization must land as requested' }]
    });
    const subjects = createSubjects();
    const server = await startFakeProviderServer({ provider: fake, clock });
    const app = initApp({
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
    const billingOptionId = await createSignupOption();
    const lifterId = await createLifter();
    return {
        app,
        billingOptionId,
        clock,
        fake,
        lifterId,
        server,
        subjects,
        async markOutboxSent(input: { readonly userId: string; readonly template: string }) {
            return getDb()
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, input.userId),
                        eq(emailOutbox.template, input.template)
                    )
                );
        },
        async stop() {
            await server.close();
            await testDb.teardown();
        }
    };
}

beforeAll(async () => {
    fixture = await startChargebackSuccessionFixture();
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
}

async function activeSignup() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects: fixture.subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(
        signedNotice({
            clock: fixture.clock,
            type: 'subscription_preapproval',
            id: created.authorizationId,
            version: '2'
        })
    );
    return created;
}

async function creditedCharge(created: Awaited<ReturnType<typeof activeSignup>>) {
    const charge = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1631-succession-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver(
        signedNotice({
            clock: fixture.clock,
            type: 'payment',
            id: charge.chargeId,
            version: '2'
        })
    );
    return charge;
}

describe('TEST:B7:7 AC:B7:33 AC:B7:27 S6 cuts a live successor on a chargeback', () => {
    it('suspends the predecessor and abandons the PENDING_AUTHORIZATION successor', async () => {
        // Arrange: a real ACTIVE predecessor with a credited charge, then an S1 successor.
        const created = await activeSignup();
        const charge = await creditedCharge(created);
        const [predecessor] = await getDb()
            .select({ billingOptionId: subscriptions.billingOptionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        if (!predecessor?.billingOptionId) throw new Error('Predecessor billing option missing');
        const successor = await startSuccession(
            {
                predecessorSubscriptionId: created.subscriptionId,
                userId: created.userId,
                billingOptionId: predecessor.billingOptionId,
                returnUrl: 'https://hospeda.test/es/planes/'
            },
            {
                provider: getPaymentProvider(),
                clock: getClock().clock,
                planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
                beforeCancelNotice,
                touristVipInheritance
            }
        );
        fixture.subjects.subscriptions.add(successor.subscriptionId);
        const [before] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, successor.subscriptionId));
        expect(before?.status).toBe('PENDING_AUTHORIZATION');

        // Act: the chargeback opens the mark and defers S6 on the pending mail; the next read completes it.
        await fixture.fake.chargeBack({ chargeId: charge.chargeId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '3'
            })
        );
        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.chargeback-suspension'
        });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '4'
            })
        );

        // Assert
        const rows = await getDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.userId, created.userId));
        expect(
            rows.find((row) => row.id === created.subscriptionId)?.status,
            'the predecessor is suspended'
        ).toBe('SUSPENDED');
        expect(
            rows.find((row) => row.id === successor.subscriptionId)?.status,
            'the successor is abandoned'
        ).toBe('ABANDONED');
    });
});
