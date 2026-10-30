import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    recordCreditedCycle,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import {
    attachSession,
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

test.describe('TEST:B13a:6 TEST:B13a:7 Mi Suscripción notices @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    const userIds: string[] = [];
    const courtesyGrantIds: string[] = [];

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
                        why: 'The checkout activation notice is observed in the fake provider.'
                    },
                    {
                        lie: 'M8',
                        why: 'The credited cycle is visible before reading Mi Suscripción.'
                    }
                ]
            }),
            clock
        });
        world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
    });

    test.afterAll(async () => {
        try {
            if (courtesyGrantIds.length)
                await execSQL('DELETE FROM courtesy_grant WHERE id = ANY($1::uuid[])', [
                    courtesyGrantIds
                ]);
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('TEST:B13a:6 shows the literal AU notice and no plan-change control', async ({ page }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        const billingOptionId = await monthlyOptionForSlug('owner-basico');
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId });
        const { subscriptionId } = await confirmSignupCheckout({ page });
        const providerRows = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = providerRows[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected fake-provider authorization link.');
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        await recordCreditedCycle({
            fakeServer: world.fakeServer,
            subscriptionId,
            authorizationId
        });

        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const subscription = page.locator(
            `article[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
        );
        await expect(subscription).toContainText('Básico');
        await expect(subscription).toContainText('Alojamiento');
        await expect(subscription.getByTestId('my-subscription-price')).toContainText('por mes');
        const notice = subscription.getByTestId('my-subscription-plan-change-unavailable');
        await expect(notice).toBeVisible();
        await expect(notice).toHaveText(
            'Todavía no se puede cambiar de plan: date de baja al fin del período y volvé a suscribirte.'
        );
        await expect(subscription.getByRole('button', { name: /cambiar (de )?plan/i })).toHaveCount(
            0
        );
        await expect(subscription.getByRole('link', { name: /cambiar (de )?plan/i })).toHaveCount(
            0
        );
    });

    test('TEST:B13a:7 shows a deferred balance with its condition until it closes', async ({
        page
    }) => {
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        const billingOptionId = await monthlyOptionForSlug('owner-basico');
        const anchors = await execSQL<{ plan_version_id: string; vertical: string }>(
            `SELECT plan_version.id AS plan_version_id, plan_version.vertical
               FROM billing_option
               JOIN plan_version ON plan_version.id = billing_option.plan_version_id
              WHERE billing_option.id = $1`,
            [billingOptionId]
        );
        const anchor = anchors[0];
        if (!anchor) throw new Error('Expected the monthly option anchor.');
        const subscriptions = await execSQL<{ id: string }>(
            `INSERT INTO subscription (
                 user_id, vertical, plan_version_id, billing_option_id,
                 payment_method, status, class
             ) VALUES ($1, $2, $3, $4, 'CARD', 'CANCELLED', 'PRINCIPAL')
             RETURNING id`,
            [subscriber.user.id, anchor.vertical, anchor.plan_version_id, billingOptionId]
        );
        const subscriptionId = subscriptions[0]?.id;
        if (!subscriptionId) throw new Error('Expected seeded cancelled principal subscription.');
        const grants = await execSQL<{ id: string }>(
            `INSERT INTO courtesy_grant (
                 beneficiary_user_id, granted_by, subscription_id, months,
                 starts_at, ends_at, reason, balance_months
             ) VALUES ($1, $1, $2, 6, now(), now() + interval '6 months', $3, 3)
             RETURNING id`,
            [subscriber.user.id, subscriptionId, 'TEST:B13a:7 deferred courtesy']
        );
        const courtesyGrantId = grants[0]?.id;
        if (!courtesyGrantId) throw new Error('Expected seeded deferred courtesy.');
        courtesyGrantIds.push(courtesyGrantId);

        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const section = page.locator('section[aria-label="Tus suscripciones"]');
        const courtesy = section.locator(
            `article[data-testid="my-subscription-deferred-courtesy"][data-courtesy-grant-id="${courtesyGrantId}"]`
        );
        await expect(courtesy).toBeVisible();
        await expect(courtesy).toContainText('Alojamiento');
        await expect(courtesy).toContainText(
            'Te quedan 3 meses, que empiezan a correr cuando completes el pago.'
        );

        await execSQL(
            `UPDATE courtesy_grant
                SET balance_closed_at = now(), close_reason = 'VENTANA_DE_AUTORIZACION_VENCIDA'
              WHERE id = $1`,
            [courtesyGrantId]
        );
        await page.reload();
        await expect(section).toBeVisible();
        await expect(courtesy).toHaveCount(0);
    });
});
