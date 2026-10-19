import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    decodeHtmlEntities,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import {
    confirmSelfCancel,
    driveToGrace,
    driveToSuspended,
    latestOutbox,
    readSubscriptionRow,
    selfCancelFromMySubscription,
    signUpCardSubscriber,
    subscriptionArticle,
    waitForSubscriptionStatus
} from '../../fixtures/cancellation-flow.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';

const MAIL_TIMEOUT_MS = 30_000;

/** Cutover cancellation path; transitions are owned by B8a's integration coverage. */
test.describe('TEST:B13a:20 AC:B13a:19 the cancellation end to end from its screen @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    const userIds: string[] = [];

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    { lie: 'M6', why: 'TEST:B13a:20 verifies captured cancellation ordering.' },
                    {
                        lie: 'M8',
                        why: 'TEST:B13a:20 records the credited cycle before cancellation.'
                    }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('ACTIVE: S11 from the screen, our email before the provider cancellation, and S12 when the clock reaches the end of service', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        const { subscriptionId, authorizationId } = await signUpCardSubscriber({
            page,
            world,
            user: subscriber.user,
            slug: 'owner-basico'
        });
        const { preview, endLine } = await selfCancelFromMySubscription({ page, subscriptionId });
        expect(preview.origin).toBe('ACTIVE');
        expect(preview.addons).toEqual([]);
        if (!preview.serviceEndsAt) throw new Error('Expected ACTIVE preview service end.');
        const serviceEndsAt = new Date(preview.serviceEndsAt);
        const marketEnd = formatMarketDate(serviceEndsAt);
        await expect(endLine).toContainText('seguís con el servicio hasta el');
        await expect(endLine).toContainText(marketEnd);
        await expect(await confirmSelfCancel({ page })).toContainText(marketEnd);
        const scheduled = await readSubscriptionRow({ subscriptionId });
        expect(scheduled.status).toBe('CANCEL_SCHEDULED');
        expect(formatMarketDate(new Date(scheduled.service_ends_at ?? ''))).toBe(marketEnd);
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.scheduled-cancellation'
                })
            )?.status
        ).toBe('pending');
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: subscriber.admin.sessionCookie
        });
        const mail = await world.mailCapture.waitForMail({
            to: subscriber.user.email,
            subject: 'Cancelamos el cobro automático de tu suscripción',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(decodeHtmlEntities(mail.html)).toContain(marketEnd);
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.scheduled-cancellation'
                })
            )?.status
        ).toBe('sent');
        const sweepStartedAt = new Date();
        expect(
            mail.receivedAt.getTime(),
            'Expected our mail before the reconciliation sweep started.'
        ).toBeLessThan(sweepStartedAt.getTime());
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: subscriber.admin.sessionCookie
        });
        const cancelRequest = cancelRequestsFor({
            requests: world.fakeServer.requests(),
            authorizationId
        })[0];
        expect(
            cancelRequest,
            'Expected reconciliation to cancel the provider authorization.'
        ).toBeTruthy();
        expect(
            mail.receivedAt.getTime(),
            'Expected our mail before provider cancellation.'
        ).toBeLessThan(new Date(cancelRequest!.at).getTime());
        expect(new Date(cancelRequest!.at).getTime()).toBeGreaterThanOrEqual(
            sweepStartedAt.getTime()
        );
        await world.fakeServer.setClock({ at: new Date(serviceEndsAt.getTime() + 60_000) });
        await runCron({
            jobName: 'subscription-service-end',
            adminCookie: subscriber.admin.sessionCookie
        });
        await waitForSubscriptionStatus({
            subscriptionId,
            status: 'CANCELLED',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const island = page.locator('section[aria-label="Tus suscripciones"]');
        await expect(island).toContainText('No tenés suscripciones vigentes.');
        await expect(subscriptionArticle(page, subscriptionId)).toHaveCount(0);
    });

    test('GRACE_PERIOD: S24 ends service today, our email before the provider cancellation', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        const { subscriptionId, authorizationId } = await signUpCardSubscriber({
            page,
            world,
            user: subscriber.user,
            slug: 'owner-basico'
        });
        const { graceEndsAt } = await driveToGrace({ world, subscriptionId, authorizationId });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = subscriptionArticle(page, subscriptionId);
        await expect(article.getByTestId('my-subscription-grace')).toContainText(
            formatMarketDate(graceEndsAt)
        );
        const { preview, endLine } = await selfCancelFromMySubscription({ page, subscriptionId });
        expect(preview.origin).toBe('GRACE_PERIOD');
        expect(preview.addons).toEqual([]);
        await expect(endLine).toContainText('el servicio termina hoy');
        await expect(endLine).toContainText('perdés el servicio');
        await expect(endLine).toContainText(formatMarketDate(graceEndsAt));
        await expect(await confirmSelfCancel({ page })).toContainText('El servicio terminó hoy.');
        expect((await readSubscriptionRow({ subscriptionId })).status).toBe('CANCELLED');
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.direct-cancellation'
                })
            )?.status
        ).toBe('pending');
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: subscriber.admin.sessionCookie
        });
        const mail = await world.mailCapture.waitForMail({
            to: subscriber.user.email,
            subject: 'Tu suscripción quedó cancelada',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.direct-cancellation'
                })
            )?.status
        ).toBe('sent');
        const sweepStartedAt = new Date();
        expect(
            mail.receivedAt.getTime(),
            'Expected our mail before the reconciliation sweep started.'
        ).toBeLessThan(sweepStartedAt.getTime());
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: subscriber.admin.sessionCookie
        });
        const cancelRequest = cancelRequestsFor({
            requests: world.fakeServer.requests(),
            authorizationId
        })[0];
        expect(
            cancelRequest,
            'Expected direct cancellation to reach the provider after its mail.'
        ).toBeTruthy();
        expect(mail.receivedAt.getTime()).toBeLessThan(new Date(cancelRequest!.at).getTime());
        expect(new Date(cancelRequest!.at).getTime()).toBeGreaterThanOrEqual(
            sweepStartedAt.getTime()
        );
    });

    test('SUSPENDED: reached by the real arrears flow, S23 ends service today without a second provider cancellation', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        const { subscriptionId, authorizationId } = await signUpCardSubscriber({
            page,
            world,
            user: subscriber.user,
            slug: 'owner-basico'
        });
        await driveToGrace({ world, subscriptionId, authorizationId });
        const suspension = await driveToSuspended({
            world,
            user: subscriber.user,
            admin: subscriber.admin,
            subscriptionId,
            authorizationId
        });
        expect(suspension.cancelRequestsAfterSuspension).toBe(1);
        const suspensionHtml = decodeHtmlEntities(suspension.suspensionMail.html);
        expect(suspensionHtml).toContain('volvé a suscribirte con una tarjeta que funcione');
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = subscriptionArticle(page, subscriptionId);
        await expect(article.getByTestId('self-cancel-open')).toBeVisible();
        await expect(article.getByTestId('my-subscription-grace')).toHaveCount(0);
        const { preview, endLine } = await selfCancelFromMySubscription({ page, subscriptionId });
        expect(preview.origin).toBe('SUSPENDED');
        expect(preview.addons).toEqual([]);
        await expect(endLine).toContainText('la suscripción termina hoy');
        await expect(endLine).toContainText('estaba suspendida');
        await expect(await confirmSelfCancel({ page })).toContainText('El servicio terminó hoy.');
        expect((await readSubscriptionRow({ subscriptionId })).status).toBe('CANCELLED');
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.direct-cancellation'
                })
            )?.status
        ).toBe('pending');
        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: subscriber.admin.sessionCookie
        });
        await world.mailCapture.waitForMail({
            to: subscriber.user.email,
            subject: 'Tu suscripción quedó cancelada',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(
            (
                await latestOutbox({
                    userId: subscriber.user.id,
                    template: 'billing.direct-cancellation'
                })
            )?.status
        ).toBe('sent');
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: subscriber.admin.sessionCookie
        });
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(1);
    });
});
