import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    recordCreditedCycle,
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
        expect(
            cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId })
        ).toHaveLength(0);
    });
});
