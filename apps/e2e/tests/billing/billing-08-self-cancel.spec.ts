import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    DAY_MS,
    decodeHtmlEntities,
    deliverNotices,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    recordCreditedCycle,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    attachSession,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

test.describe('TEST:B13a:1 self-service cancellation @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    let userIds: string[] = [];
    const MAIL_TIMEOUT_MS = 30_000;

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
                        why: 'TEST:B13a:1 observes cancellation ordering through the fake provider.'
                    },
                    { lie: 'M8', why: 'The credited cycle is visible before self-cancellation.' }
                ]
            }),
            clock
        });
        world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        subscriber = await createSubscriber();
        userIds = [subscriber.user.id, subscriber.admin.id];
    });
    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('checkout steps are no fewer than the self-cancellation steps', async ({ page }) => {
        if (!subscriber || !world) throw new Error('Expected fake provider and subscriber.');
        const { user, admin } = subscriber;
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        const optionId = await monthlyOptionForSlug('owner-basico');
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        await page.getByTestId('signup-checkout-confirm').click();
        const pending = page.getByTestId('signup-checkout-pending');
        await expect(pending).toBeVisible();
        const subscriptionId = await pending.getAttribute('data-subscription-id');
        if (!subscriptionId) throw new Error('Expected a subscription created by web checkout.');
        const providerRows = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = providerRows[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected fake-provider authorization link.');
        const signupClicks = 1;
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        const providerAuthorizationSteps = 1;
        await recordCreditedCycle({
            fakeServer: world.fakeServer,
            subscriptionId,
            authorizationId
        });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const open = page.getByTestId('self-cancel-open');
        await expect(open).toBeVisible();
        await open.click();
        const end = page.getByTestId('self-cancel-end');
        await expect(end).toBeVisible();
        const cancelStepsBeforeConfirm = 1;
        await page.getByTestId('self-cancel-confirm').click();
        const cancelSteps = cancelStepsBeforeConfirm + 1;
        const signupSteps = signupClicks + providerAuthorizationSteps;
        const done = page.getByTestId('self-cancel-done');
        await expect(done).toBeVisible();
        expect(cancelSteps).toBeLessThanOrEqual(signupSteps);
        await expect(page.locator('input, textarea')).toHaveCount(0);
        const rows = await execSQL<{ status: string; service_ends_at: Date }>(
            'SELECT status, service_ends_at FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(rows[0]?.status).toBe('CANCEL_SCHEDULED');
        expect(rows[0]?.service_ends_at).toBeTruthy();
        const marketEnd = formatMarketDate(new Date(rows[0]!.service_ends_at));
        await expect(end).toContainText(marketEnd);
        await expect(done).toContainText(marketEnd);
        const outboxBeforeSend = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.scheduled-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );
        expect(outboxBeforeSend[0]?.status).toBe('pending');
        await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
        const mail = await world.mailCapture.waitForMail({
            to: user.email,
            subject: 'Cancelamos el cobro automático de tu suscripción',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        const html = decodeHtmlEntities(mail.html);
        expect(html).toContain('El servicio sigue hasta');
        expect(html).toContain(marketEnd);
        const sent = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.scheduled-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );
        expect(sent[0]?.status).toBe('sent');
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: admin.sessionCookie
        });
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(1);
    });

    test('GRACE_PERIOD shows its own end date and ends service today on cancellation', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const graceSubscriber = await createSubscriber();
        userIds.push(graceSubscriber.user.id, graceSubscriber.admin.id);
        await seedCookieConsent(page);
        await attachSession(page, graceSubscriber.user.sessionCookie);
        const optionId = await monthlyOptionForSlug('owner-basico');
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        await page.getByTestId('signup-checkout-confirm').click();
        const pending = page.getByTestId('signup-checkout-pending');
        await expect(pending).toBeVisible();
        const subscriptionId = await pending.getAttribute('data-subscription-id');
        if (!subscriptionId) throw new Error('Expected web checkout subscription id.');
        const links = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = links[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected fake-provider authorization id.');
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        await recordCreditedCycle({
            fakeServer: world.fakeServer,
            subscriptionId,
            authorizationId
        });
        await world.fakeServer.advanceClock({ ms: 31 * DAY_MS });
        await world.fakeServer.provider.declineCharge({
            authorizationId,
            declineReason: 'cc_rejected_other_reason'
        });
        await deliverNotices({ fakeServer: world.fakeServer });
        const graceRows = await execSQL<{ status: string; grace_ends_at: Date }>(
            'SELECT status, grace_ends_at FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(graceRows[0]?.status).toBe('GRACE_PERIOD');
        const graceDate = formatMarketDate(new Date(graceRows[0]!.grace_ends_at));
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const notice = page.getByTestId('my-subscription-grace');
        await expect(notice).toContainText(graceDate);
        await expect(notice).toContainText('se vuelve a intentar en el momento');
        await expect(notice).toContainText('no podemos asegurarte que entre');
        await expect(notice).toContainText('volver a suscribirte');
        await page.getByTestId('self-cancel-open').click();
        const end = page.getByTestId('self-cancel-end');
        await expect(end).toContainText('termina hoy');
        await expect(end).toContainText('perdés el servicio');
        await expect(end).toContainText(graceDate);
        await page.getByTestId('self-cancel-confirm').click();
        await expect(page.getByTestId('self-cancel-done')).toContainText('terminó hoy');
        const ended = await execSQL<{ status: string }>(
            'SELECT status FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(ended[0]?.status).toBe('CANCELLED');
        const directNotice = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.direct-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [graceSubscriber.user.id]
        );
        expect(directNotice[0]?.status).toBe('pending');
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: graceSubscriber.admin.sessionCookie
        });
        await world.mailCapture.waitForMail({
            to: graceSubscriber.user.email,
            subject: 'Tu suscripción quedó cancelada',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        const directNoticeSent = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.direct-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [graceSubscriber.user.id]
        );
        expect(directNoticeSent[0]?.status).toBe('sent');
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: graceSubscriber.admin.sessionCookie
        });
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(1);
    });

    test('SUSPENDED has no grace notice and cancels service today', async ({ page }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const suspendedSubscriber = await createSubscriber();
        userIds.push(suspendedSubscriber.user.id, suspendedSubscriber.admin.id);
        await seedCookieConsent(page);
        await attachSession(page, suspendedSubscriber.user.sessionCookie);
        const optionId = await monthlyOptionForSlug('owner-basico');
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        await page.getByTestId('signup-checkout-confirm').click();
        const pending = page.getByTestId('signup-checkout-pending');
        await expect(pending).toBeVisible();
        const subscriptionId = await pending.getAttribute('data-subscription-id');
        if (!subscriptionId) throw new Error('Expected web checkout subscription id.');
        const links = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = links[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected fake-provider authorization id.');
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        // The expiry path can outlive this spec's bounded setup; seed the final row state explicitly.
        await execSQL("UPDATE subscription SET status = 'SUSPENDED' WHERE id = $1", [
            subscriptionId
        ]);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        await expect(page.getByTestId('my-subscription-grace')).toHaveCount(0);
        await page.getByTestId('self-cancel-open').click();
        const end = page.getByTestId('self-cancel-end');
        await expect(end).toContainText('termina hoy');
        await expect(end).not.toContainText('gracia');
        await page.getByTestId('self-cancel-confirm').click();
        await expect(page.getByTestId('self-cancel-done')).toContainText('terminó hoy');
        const ended = await execSQL<{ status: string }>(
            'SELECT status FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(ended[0]?.status).toBe('CANCELLED');
        const directNotice = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.direct-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [suspendedSubscriber.user.id]
        );
        expect(directNotice[0]?.status).toBe('pending');
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: suspendedSubscriber.admin.sessionCookie
        });
        await world.mailCapture.waitForMail({
            to: suspendedSubscriber.user.email,
            subject: 'Tu suscripción quedó cancelada',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        const directNoticeSent = await execSQL<{ status: string }>(
            `SELECT status FROM email_outbox
             WHERE recipient_user_id = $1 AND template = 'billing.direct-cancellation'
             ORDER BY created_at DESC LIMIT 1`,
            [suspendedSubscriber.user.id]
        );
        expect(directNoticeSent[0]?.status).toBe('sent');
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: suspendedSubscriber.admin.sessionCookie
        });
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(1);
    });
});
