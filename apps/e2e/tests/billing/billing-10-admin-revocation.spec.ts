import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    recordCreditedCycle,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    cancellationRequestsFor,
    cleanupRevocationRows,
    openRevocationScreen,
    pauseForSubscription,
    refundsForPayment,
    seedPausedSubscription,
    useAdminSession
} from '../../fixtures/revocation-flow.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const MAIL_TIMEOUT_MS = 30_000;
const TIMESTAMP_TOLERANCE_MS = 2_000;
const REVOCATION_SUBJECT = 'Registramos la revocación de tu suscripción';

test.describe('TEST:B5:22 AC:B5:39 admin revocation (S36) end to end @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    const userIds: string[] = [];
    const subscriptionIds: string[] = [];

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:B5:22 needs the fake to deliver authorization and charge notices.'
                    },
                    {
                        lie: 'M8',
                        why: 'TEST:B5:22 needs the credited cycle available before admin revocation.'
                    }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
            subscriber = await createSubscriber();
            userIds.push(subscriber.user.id, subscriber.admin.id);
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
    });

    test.afterAll(async () => {
        try {
            await cleanupRevocationRows(subscriptionIds);
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('ACTIVE revocation shows the full refund and sends our notice before provider cancellation', async ({
        page
    }) => {
        if (!subscriber || !world) throw new Error('Expected fake provider world and subscriber.');
        const { user, admin } = subscriber;
        const { subscriptionId, authorizationId } = await prepareCardSubscription({
            user,
            fakeServer: world.fakeServer
        });
        subscriptionIds.push(subscriptionId);
        await seedCookieConsent(page);
        await useAdminSession({ page, admin, adminUrl: ADMIN_URL });
        await openRevocationScreen({ page, subscriptionId, adminUrl: ADMIN_URL });
        const screen = page.getByTestId('subscription-revocation-screen');
        const ready = screen.getByTestId('subscription-revocation-ready');
        await expect(ready).toBeVisible();
        await expect(
            ready.getByTestId('subscription-revocation-effect-authorization')
        ).toBeVisible();
        await expect(ready.getByTestId('subscription-revocation-effect-service')).toBeVisible();
        await expect(ready.getByTestId('subscription-revocation-effect-refund')).toBeVisible();

        const payment = await readCreditedPayment(subscriptionId, world.fakeServer.now());
        const expectedAmount = formatRevocationAmount(payment);
        await expect(ready.getByTestId('subscription-revocation-payment')).toContainText(
            expectedAmount
        );
        await expect(ready.getByTestId('subscription-revocation-effect-service')).toContainText(
            'Se corta el servicio ahora mismo, sin esperar al fin del período.'
        );

        const actStartedAt = world.fakeServer.now();
        await screen.getByTestId('subscription-revocation-confirm').click();
        await expect(screen.getByTestId('subscription-revocation-result')).toBeVisible();
        const { cancelled, refund } = await assertRevoked({
            subscriptionId,
            paymentId: payment.id,
            paymentAmount: payment.amount,
            actStartedAt
        });
        await assertNoticeBeforeProvider({
            subscriber: user,
            adminCookie: admin.sessionCookie,
            authorizationId,
            world
        });
        expect(refund.amount).toBe(payment.amount);
        expect(cancelled.status).toBe('CANCELLED');
    });

    test('PAUSED revocation closes the pause and cancels its paused preapproval', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const pausedSubscriber = await createSubscriber();
        userIds.push(pausedSubscriber.user.id, pausedSubscriber.admin.id);
        const { subscriptionId, authorizationId } = await prepareCardSubscription({
            user: pausedSubscriber.user,
            fakeServer: world.fakeServer
        });
        subscriptionIds.push(subscriptionId);
        await seedPausedSubscription({
            subscriptionId,
            authorizationId,
            fakeServer: world.fakeServer
        });

        await seedCookieConsent(page);
        await useAdminSession({ page, admin: pausedSubscriber.admin, adminUrl: ADMIN_URL });
        await openRevocationScreen({ page, subscriptionId, adminUrl: ADMIN_URL });
        const screen = page.getByTestId('subscription-revocation-screen');
        const ready = screen.getByTestId('subscription-revocation-ready');
        await expect(ready).toBeVisible();
        await expect(
            ready.getByTestId('subscription-revocation-effect-authorization')
        ).toBeVisible();
        await expect(ready.getByTestId('subscription-revocation-effect-service')).toBeVisible();
        await expect(ready.getByTestId('subscription-revocation-effect-refund')).toBeVisible();
        const payment = await readCreditedPayment(subscriptionId, world.fakeServer.now());
        const expectedAmount = formatRevocationAmount(payment);
        await expect(ready.getByTestId('subscription-revocation-payment')).toContainText(
            expectedAmount
        );
        await expect(ready.getByTestId('subscription-revocation-effect-service')).toContainText(
            'Se corta el servicio ahora mismo, sin esperar al fin del período.'
        );

        const actStartedAt = world.fakeServer.now();
        await screen.getByTestId('subscription-revocation-confirm').click();
        await expect(screen.getByTestId('subscription-revocation-result')).toBeVisible();
        const { cancelled, refund } = await assertRevoked({
            subscriptionId,
            paymentId: payment.id,
            paymentAmount: payment.amount,
            actStartedAt
        });
        const [pause] = await pauseForSubscription(subscriptionId);
        expect(pause?.actual_end_at).toBeTruthy();
        expect(
            Math.abs(pause!.actual_end_at!.getTime() - cancelled.service_ends_at.getTime())
        ).toBeLessThanOrEqual(TIMESTAMP_TOLERANCE_MS);
        expect(refund.amount).toBe(payment.amount);
        expect(cancelled.status).toBe('CANCELLED');
        await assertNoticeBeforeProvider({
            subscriber: pausedSubscriber.user,
            adminCookie: pausedSubscriber.admin.sessionCookie,
            authorizationId,
            world
        });
    });
});

async function prepareCardSubscription(args: {
    readonly user: Awaited<ReturnType<typeof createSubscriber>>['user'];
    readonly fakeServer: FakeWorld['fakeServer'];
}): Promise<{ subscriptionId: string; authorizationId: string }> {
    const billingOptionId = await monthlyOptionForSlug('owner-basico');
    const created = await createApiCardSubscription({ user: args.user, billingOptionId });
    await activateCardSubscription({
        fakeServer: args.fakeServer,
        subscriptionId: created.subscriptionId
    });
    await recordCreditedCycle({
        fakeServer: args.fakeServer,
        subscriptionId: created.subscriptionId,
        authorizationId: created.authorizationId
    });
    return created;
}

async function readCreditedPayment(subscriptionId: string, now: Date) {
    const [payment] = await execSQL<{
        id: string;
        amount: number;
        currency: string;
        fact_at: Date;
    }>(
        `SELECT id, amount, currency, fact_at FROM payment
         WHERE subscription_id = $1 AND status = 'SUCCEEDED'
         ORDER BY fact_at DESC LIMIT 1`,
        [subscriptionId]
    );
    if (!payment) throw new Error(`Expected credited payment for ${subscriptionId}.`);
    expect(now.getTime() - payment.fact_at.getTime()).toBeLessThanOrEqual(10 * 24 * 60 * 60 * 1000);
    return payment;
}

function formatRevocationAmount(payment: { readonly amount: number; readonly currency: string }) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: payment.currency
    }).format(payment.amount / 100);
}

async function assertRevoked(args: {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly paymentAmount: number;
    readonly actStartedAt: Date;
}) {
    const [cancelled] = await execSQL<{
        status: string;
        service_ends_at: Date;
    }>('SELECT status, service_ends_at FROM subscription WHERE id = $1', [args.subscriptionId]);
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.service_ends_at).toBeTruthy();
    expect(
        Math.abs(cancelled!.service_ends_at.getTime() - args.actStartedAt.getTime())
    ).toBeLessThanOrEqual(TIMESTAMP_TOLERANCE_MS);
    const refunds = await refundsForPayment(args.paymentId);
    expect(refunds).toHaveLength(1);
    const refund = refunds[0]!;
    expect(refund.status).toBe('REQUESTED');
    expect(refund.payment_id).toBe(args.paymentId);
    expect(refund.amount).toBe(args.paymentAmount);
    expect(refund.created_at.getTime()).toBeGreaterThanOrEqual(
        args.actStartedAt.getTime() - TIMESTAMP_TOLERANCE_MS
    );
    expect(refund.created_at.getTime()).toBeLessThanOrEqual(
        cancelled!.service_ends_at.getTime() + TIMESTAMP_TOLERANCE_MS
    );
    return { cancelled: cancelled!, refund };
}

async function assertNoticeBeforeProvider(args: {
    readonly subscriber: Awaited<ReturnType<typeof createSubscriber>>['user'];
    readonly adminCookie: string;
    readonly authorizationId: string;
    readonly world: FakeWorld;
}): Promise<void> {
    const outbox = await execSQL<{ status: string }>(
        `SELECT status FROM email_outbox
         WHERE recipient_user_id = $1 AND template = 'billing.revocation-cancel'
         ORDER BY created_at DESC LIMIT 1`,
        [args.subscriber.id]
    );
    expect(outbox[0]?.status).toBe('pending');
    expect(
        cancellationRequestsFor({
            requests: args.world.fakeServer.requests(),
            authorizationId: args.authorizationId
        })
    ).toHaveLength(0);
    await runCron({ jobName: 'email-outbox-sender', adminCookie: args.adminCookie });
    const mail = await args.world.mailCapture.waitForMail({
        to: args.subscriber.email,
        subject: REVOCATION_SUBJECT,
        timeoutMs: MAIL_TIMEOUT_MS
    });
    expect(mail.receivedAt).toBeInstanceOf(Date);
    await runCron({ jobName: 'billing-reconciliation-sweep', adminCookie: args.adminCookie });
    const requests = cancellationRequestsFor({
        requests: args.world.fakeServer.requests(),
        authorizationId: args.authorizationId
    });
    expect(requests).toHaveLength(1);
    expect(mail.receivedAt.getTime()).toBeLessThan(new Date(requests[0]!.at).getTime());
}
