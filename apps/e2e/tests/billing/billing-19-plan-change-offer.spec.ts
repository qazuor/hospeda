import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createSubscriber,
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
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

test.describe('TEST:B8b:14 plan-change offer @p0 @billing @clock', () => {
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
                    {
                        lie: 'M1',
                        why: 'TEST:B8b:14 needs the successor first-charge date retained for checkout.'
                    },
                    {
                        lie: 'M6',
                        why: 'TEST:B8b:14 observes authorization of the starting subscription.'
                    },
                    {
                        lie: 'M8',
                        why: 'TEST:B8b:14 needs the credited cycle before offering a change.'
                    }
                ]
            }),
            clock
        });
        world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
    });
    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    async function activeFrom({
        page,
        slug
    }: {
        page: Page;
        slug: 'owner-basico' | 'owner-premium';
    }) {
        if (!world) throw new Error('Expected fake provider world.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        const optionId = await monthlyOptionForSlug(slug);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        const { subscriptionId } = await confirmSignupCheckout({ page });
        const links = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = links[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected provider authorization link.');
        await activateCardSubscription({ fakeServer: world.fakeServer, subscriptionId });
        await recordCreditedCycle({
            fakeServer: world.fakeServer,
            subscriptionId,
            authorizationId
        });
        const nextChargeAt = (
            await world.fakeServer.provider.readAuthorization({ authorizationId })
        ).snapshot.nextChargeAt;
        if (!nextChargeAt) throw new Error('Expected a future provider charge after the cycle.');
        const sweep = await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: subscriber.admin.sessionCookie
        });
        expect(sweep.success).toBe(true);
        const synced = await execSQL<{ next_charge_at: Date | null }>(
            'SELECT next_charge_at FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(synced[0]?.next_charge_at?.toISOString()).toBe(nextChargeAt);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = page.locator(
            `article[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
        );
        await expect(article.getByRole('button', { name: /cambiar de plan/i })).toBeVisible();
        return { subscriptionId, article };
    }

    test('ACTIVE monthly upgrade reaches fake checkout; old stays ACTIVE and successor waits', async ({
        page
    }) => {
        const premiumOptionId = await monthlyOptionForSlug('owner-premium');
        const { subscriptionId, article } = await activeFrom({ page, slug: 'owner-basico' });
        let checkoutUrl = '';
        await page.route(
            (url) => url.hostname === 'payments-fake.invalid',
            (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: '<html><body>Fake provider checkout</body></html>'
                })
        );
        await page.route(
            (url) =>
                url.pathname ===
                `/api/v1/protected/billing-subscription/${subscriptionId}/plan-change`,
            async (route) => {
                const response = await route.fetch();
                const body = await response.json();
                checkoutUrl = body.data?.checkoutUrl ?? '';
                await route.fulfill({ response });
            }
        );
        await article.getByRole('button', { name: /cambiar de plan/i }).click();
        const option = article.locator(`li[data-billing-option-id="${premiumOptionId}"] button`);
        await expect(option).toBeVisible();
        await option.click();
        await article.getByRole('button', { name: 'Confirmar cambio' }).click();
        await page.waitForURL((url) => url.href === checkoutUrl && checkoutUrl.length > 0);
        expect(page.url()).toBe(checkoutUrl);
        const rows = await execSQL<{ id: string; status: string; succeeds_id: string | null }>(
            'SELECT id, status, succeeds_id FROM subscription WHERE id = $1 OR succeeds_id = $1',
            [subscriptionId]
        );
        expect(rows.find((row) => row.id === subscriptionId)?.status).toBe('ACTIVE');
        expect(rows.find((row) => row.succeeds_id === subscriptionId)?.status).toBe(
            'PENDING_AUTHORIZATION'
        );
    });

    test('ACTIVE monthly downgrade displays the effective date in the customer zone', async ({
        page
    }) => {
        const basicOptionId = await monthlyOptionForSlug('owner-basico');
        const { subscriptionId, article } = await activeFrom({ page, slug: 'owner-premium' });
        let effectiveAt = '';
        await page.route(
            (url) =>
                url.pathname ===
                `/api/v1/protected/billing-subscription/${subscriptionId}/plan-change`,
            async (route) => {
                const response = await route.fetch();
                const body = await response.json();
                effectiveAt = body.data?.effectiveAt ?? '';
                await route.fulfill({ response });
            }
        );
        await article.getByRole('button', { name: /cambiar de plan/i }).click();
        const option = article.locator(`li[data-billing-option-id="${basicOptionId}"] button`);
        await expect(option).toBeVisible();
        await option.click();
        await article.getByRole('button', { name: 'Confirmar cambio' }).click();
        const result = article.getByTestId('plan-change-result');
        await expect(result).toBeVisible();
        expect(effectiveAt).toBeTruthy();
        await expect(result).toContainText(formatMarketDate(new Date(effectiveAt)));
    });

    test('M1 creation mismatch shows the provider rejection and keeps the current plan', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const premiumOptionId = await monthlyOptionForSlug('owner-premium');
        const { subscriptionId, article } = await activeFrom({ page, slug: 'owner-basico' });
        world.fakeServer.provider.restoreLie({ lie: 'M1' });
        let rejectedStatus = 0;
        let rejectedCode = '';
        await page.route(
            (url) =>
                url.pathname ===
                `/api/v1/protected/billing-subscription/${subscriptionId}/plan-change`,
            async (route) => {
                const response = await route.fetch();
                const body = await response.json();
                rejectedStatus = response.status();
                rejectedCode = body.error?.code ?? '';
                await route.fulfill({ response });
            }
        );
        await article.getByRole('button', { name: /cambiar de plan/i }).click();
        await article.locator(`li[data-billing-option-id="${premiumOptionId}"] button`).click();
        await article.getByRole('button', { name: 'Confirmar cambio' }).click();
        await expect(article.getByTestId('plan-change-result')).toContainText(
            'Mercado Pago no pudo aplicar el cambio. Tu plan actual sigue vigente.'
        );
        expect(rejectedStatus).toBe(502);
        expect(rejectedCode).toBe('PROVIDER_ERROR');
        const rows = await execSQL<{ status: string }>(
            'SELECT status FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(rows[0]?.status).toBe('ACTIVE');
    });
});
