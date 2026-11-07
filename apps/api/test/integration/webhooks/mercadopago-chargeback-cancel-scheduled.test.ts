/** TEST:B8a:7: a real charged-back payment ends its scheduled principal through API roots. */
import { randomUUID } from 'node:crypto';
import {
    and,
    billingDeadlineVersions,
    emailOutbox,
    eq,
    getDb,
    payments,
    planCatalogModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { startFakeProviderServer } from '@repo/payments/fake-server';
import { startSuccession } from '@repo/service-core';
import { createAdjustableClock } from '@repo/test-clock';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { billingReconciliationSweepJob } from '../../../src/cron/jobs/billing-reconciliation-sweep.job';
import type { CronJobContext } from '../../../src/cron/types';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../../src/routes/billing-subscription/tourist-vip-inheritance';
import { getClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { presetSelfCancelNotice } from '../billing-subscription/self-cancel-fixtures';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';

const START = new Date('2026-10-12T12:00:00.000Z');
let fixture: Awaited<ReturnType<typeof startFixture>>;

async function startFixture() {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
    await testDb.setup();
    validateApiEnv();
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'S1 successor first-charge schedule must be preserved' }]
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
        subjects,
        lifterId,
        async runSweep() {
            const ctx: CronJobContext = {
                logger: { info() {}, warn() {}, error() {}, debug() {} },
                startedAt: clock.now(),
                runId: randomUUID(),
                correlationId: randomUUID(),
                dryRun: false,
                newCycle: true
            };
            return billingReconciliationSweepJob.handler(ctx);
        },
        async stop() {
            await server.close();
            await testDb.teardown();
        }
    };
}

beforeAll(async () => {
    fixture = await startFixture();
});
afterEach(async () => {
    vi.restoreAllMocks();
    await retireSubjects(fixture.subjects, fixture.lifterId);
});
afterAll(async () => {
    await fixture.stop();
});

async function deliver(type: 'subscription_preapproval' | 'payment', id: string, version: string) {
    const notice = signedNotice({ clock: fixture.clock, type, id, version });
    fixture.subjects.deliveries.push(notice);
    const response = await postDelivery(fixture.app, notice);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
}

async function scheduledChargeback() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects: fixture.subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver('subscription_preapproval', created.authorizationId, '1');
    const charge = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1633-s12-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver('payment', charge.chargeId, '1');
    await presetSelfCancelNotice({
        ownerId: created.userId,
        subscriptionId: created.subscriptionId,
        status: 'sent'
    });
    const response = await fixture.app.request(
        `/api/v1/protected/billing-subscription/${created.subscriptionId}/cancellation`,
        {
            method: 'POST',
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-id': created.userId,
                'x-mock-actor-role': 'USER',
                'x-mock-actor-permissions': '[]'
            }
        }
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
        success: true,
        data: { outcome: 'SCHEDULED' }
    });
    const [scheduled] = await getDb()
        .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(scheduled?.status).toBe('CANCEL_SCHEDULED');
    expect(scheduled?.serviceEndsAt).toBeInstanceOf(Date);
    expect(
        (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
            .snapshot.status
    ).toBe('cancelled');
    await fixture.fake.chargeBack({ chargeId: charge.chargeId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    return { ...created, chargeId: charge.chargeId, scheduledEnd: scheduled!.serviceEndsAt! };
}

async function realSuccessor(created: Awaited<ReturnType<typeof scheduledChargeback>>) {
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
    return successor;
}

async function expectSuccessorCut(
    successor: Awaited<ReturnType<typeof realSuccessor>>,
    cancel: {
        readonly mock: { readonly calls: readonly (readonly [{ authorizationId: string }])[] };
    }
) {
    const [row] = await getDb()
        .select({ status: subscriptions.status, succeedsId: subscriptions.succeedsId })
        .from(subscriptions)
        .where(eq(subscriptions.id, successor.subscriptionId));
    expect(row).toEqual({ status: 'ABANDONED', succeedsId: expect.any(String) });
    expect(row?.succeedsId).toBe(successor.predecessorId);
    expect(
        cancel.mock.calls.filter(([input]) => input.authorizationId === successor.authorizationId)
    ).toHaveLength(1);
}

async function deliverSuccessorCutNotice(userId: string) {
    await getDb()
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(emailOutbox.template, 'billing.successor-cut-cancel')
            )
        );
    await fixture.runSweep();
    await fixture.runSweep();
}

async function expectS12Settled(created: Awaited<ReturnType<typeof scheduledChargeback>>) {
    const [row] = await getDb()
        .select({ status: subscriptions.status, serviceEndsAt: subscriptions.serviceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(row?.status).toBe('CANCELLED');
    expect(row?.serviceEndsAt).toBeInstanceOf(Date);
    expect(row!.serviceEndsAt!.getTime()).toBeLessThan(created.scheduledEnd.getTime());
    const [payment] = await getDb()
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.providerFactId, created.chargeId));
    expect(payment).toBeDefined();
    const marks = await getDb()
        .select({ id: reconciliationMarks.id, liftedAt: reconciliationMarks.liftedAt })
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, created.subscriptionId),
                eq(reconciliationMarks.reason, 'CONTRACARGO')
            )
        );
    expect(marks).toHaveLength(1);
    expect(marks[0]?.liftedAt).toBeNull();
    const hung = await getDb()
        .select({ paymentId: reconciliationMarkPayments.paymentId })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
    expect(hung.map((item) => item.paymentId)).toEqual([payment?.id]);
    const mails = await getDb()
        .select({ template: emailOutbox.template, payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, created.userId),
                eq(emailOutbox.template, 'billing.chargeback-suspension')
            )
        );
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
        template: 'billing.chargeback-suspension',
        payload: { subscriptionId: created.subscriptionId, origin: 'CANCEL_SCHEDULED' }
    });
}

describe('TEST:B8a:7 scheduled cancellation is ended by a charged-back payment', () => {
    it('the signed payment webhook rereads the charge and runs S12', async () => {
        const created = await scheduledChargeback();
        const successor = await realSuccessor(created);
        const cancel = vi.spyOn(fixture.fake, 'cancel');
        const pause = vi.spyOn(fixture.fake, 'pause');
        const resume = vi.spyOn(fixture.fake, 'resume');
        const changeAmount = vi.spyOn(fixture.fake, 'changeAmount');
        const changeCard = vi.spyOn(fixture.fake, 'changeCard');
        const approve = vi.spyOn(fixture.fake, 'approve');

        await deliver('payment', created.chargeId, '2');
        await fixture.runSweep();
        await deliverSuccessorCutNotice(created.userId);

        await expectS12Settled(created);
        await expectSuccessorCut(successor, cancel);
        expect(
            cancel.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            pause.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            resume.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            changeAmount.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
        expect(
            changeCard.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
        expect(
            approve.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
    });

    it('the real credited-payments sweep rereads the same state and runs S12', async () => {
        const created = await scheduledChargeback();
        const successor = await realSuccessor(created);
        const cancel = vi.spyOn(fixture.fake, 'cancel');
        const pause = vi.spyOn(fixture.fake, 'pause');
        const resume = vi.spyOn(fixture.fake, 'resume');
        const changeAmount = vi.spyOn(fixture.fake, 'changeAmount');
        const changeCard = vi.spyOn(fixture.fake, 'changeCard');
        const approve = vi.spyOn(fixture.fake, 'approve');

        await fixture.runSweep();
        await deliverSuccessorCutNotice(created.userId);

        await expectS12Settled(created);
        await expectSuccessorCut(successor, cancel);
        expect(
            cancel.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            pause.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            resume.mock.calls.filter(([input]) => input.authorizationId === created.authorizationId)
        ).toHaveLength(0);
        expect(
            changeAmount.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
        expect(
            changeCard.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
        expect(
            approve.mock.calls.filter(
                ([input]) => input.authorizationId === created.authorizationId
            )
        ).toHaveLength(0);
    });
});
