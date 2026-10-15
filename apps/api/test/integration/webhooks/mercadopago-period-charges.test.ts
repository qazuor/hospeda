import { and, emailOutbox, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    createSubjects,
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const DAY = 86_400_000;
const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});

afterEach(async () => retireSubjects(subjects, fixture.lifterId));
afterAll(async () => fixture.stop());

async function dueDelivery(input: {
    readonly type: 'subscription_preapproval' | 'payment';
    readonly id: string;
    readonly version?: string;
}) {
    const due = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (candidate) =>
                candidate.query.includes(`type=${input.type}`) &&
                candidate.query.includes(`data.id=${input.id}`)
        );
    if (due) return due;
    const [link] = await getDb()
        .select({ lastAppliedVersion: providerLinks.lastAppliedVersion })
        .from(providerLinks)
        .where(eq(providerLinks.providerId, input.id));
    if (!link) throw new Error(`Expected provider link for ${input.id}`);
    return signedNotice({
        clock: fixture.clock,
        type: input.type,
        id: input.id,
        version: input.version ?? String(BigInt(link.lastAppliedVersion ?? '0') + 1n)
    });
}

async function deliver(delivery: SignedDelivery) {
    subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
    expect((await noticeRowsOf(delivery)).map((row) => row.channel)).toEqual(['WEBHOOKS']);
}

async function activate() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(
        await dueDelivery({ type: 'subscription_preapproval', id: created.authorizationId })
    );
    return created;
}

async function recordCreditedCycle(created: Awaited<ReturnType<typeof activate>>) {
    const paid = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1669-paid-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver(await dueDelivery({ type: 'payment', id: paid.chargeId }));
    expect(
        await getDb()
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, created.subscriptionId))
    ).toHaveLength(1);
    return paid;
}

async function noFailureFor(subscriptionId: string) {
    const result = await fixture.runSweep();
    const failedIds = (result.details?.failedSubscriptionIds ?? []) as string[];
    expect(failedIds).not.toContain(subscriptionId);
    return result;
}

async function arrearsMail(userId: string) {
    return getDb()
        .select({ id: emailOutbox.id, status: emailOutbox.status })
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(emailOutbox.template, 'billing.arrears-suspension')
            )
        );
}

describe('HOS-1669 TEST:1669:4 AC:1669:4 — S6 decide el grace vencido por HTTP real', () => {
    it('un rechazo del período vencido en grace encola S6; si el período cobró, S5 lo saca de grace', async () => {
        const created = await activate();
        await recordCreditedCycle(created);
        const rejected = await fixture.fake.declineCharge({
            authorizationId: created.authorizationId,
            declineReason: 'issuer_declined'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(fixture.clock.now().getTime() - 9 * DAY),
                graceEndsAt: new Date(fixture.clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, created.subscriptionId));

        const first = await noFailureFor(created.subscriptionId);
        const [deferredRow] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(first.details?.failedSubscriptionIds).not.toContain(created.subscriptionId);
        expect(deferredRow?.status).toBe('GRACE_PERIOD');
        expect(await arrearsMail(created.userId)).toHaveLength(1);
        expect(
            fixture.server
                .requests()
                .some((request) =>
                    request.path.startsWith('/authorized_payments/search?preapproval_id=')
                )
        ).toBe(true);

        await fixture.markOutboxSent({
            userId: created.userId,
            template: 'billing.arrears-suspension'
        });
        await noFailureFor(created.subscriptionId);
        const [suspended] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(suspended?.status).toBe('SUSPENDED');
        expect(
            (await fixture.fake.readAuthorization({ authorizationId: created.authorizationId }))
                .snapshot.status
        ).toBe('cancelled');
        expect(rejected.chargeId).toBeTruthy();

        const charged = await activate();
        await recordCreditedCycle(charged);
        const nextPaid = await fixture.fake.charge({
            authorizationId: charged.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `hos1669-current-paid-${crypto.randomUUID()}`
        });
        await fixture.fake.readCharge({ chargeId: nextPaid.chargeId });
        expect(
            await getDb()
                .select({ providerFactId: payments.providerFactId })
                .from(payments)
                .where(
                    and(
                        eq(payments.subscriptionId, charged.subscriptionId),
                        eq(payments.providerFactId, nextPaid.chargeId)
                    )
                )
        ).toEqual([]);
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(fixture.clock.now().getTime() - 9 * DAY),
                graceEndsAt: new Date(fixture.clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, charged.subscriptionId));
        const callsBefore = fixture.server.requests().length;
        await noFailureFor(charged.subscriptionId);
        const [settled] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, charged.subscriptionId));
        expect(settled?.status).toBe('ACTIVE');
        expect(await arrearsMail(charged.userId)).toEqual([]);
        const chargedPeriodReads = fixture.server.requests().slice(callsBefore);
        expect(
            chargedPeriodReads.some((request) =>
                request.path.startsWith('/authorized_payments/search?preapproval_id=')
            )
        ).toBe(true);
        expect(
            chargedPeriodReads.some(
                (request) => request.path === `/v1/payments/${nextPaid.chargeId}`
            )
        ).toBe(true);
    });
});

describe('HOS-1669 TEST:1669:6 AC:1669:4 — S4 resuelve el rechazo cuyo aviso se perdió', () => {
    it('entra en grace sólo con un pago acreditado propio previo al rechazo perdido', async () => {
        const created = await activate();
        await recordCreditedCycle(created);
        const { chargeId } = await fixture.fake.declineCharge({
            authorizationId: created.authorizationId,
            declineReason: 'issuer_declined'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        const before = fixture.server.requests().length;

        await noFailureFor(created.subscriptionId);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('GRACE_PERIOD');
        expect(await arrearsMail(created.userId)).toEqual([]);
        expect(fixture.server.requests().length).toBeGreaterThan(before);
        expect(chargeId).toBeTruthy();

        const noHistory = await activate();
        await fixture.fake.declineCharge({
            authorizationId: noHistory.authorizationId,
            declineReason: 'issuer_declined'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        expect(
            await getDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, noHistory.subscriptionId))
        ).toEqual([]);
        await noFailureFor(noHistory.subscriptionId);
        const [untouched] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, noHistory.subscriptionId));
        expect(untouched?.status).toBe('ACTIVE');
    });
});
