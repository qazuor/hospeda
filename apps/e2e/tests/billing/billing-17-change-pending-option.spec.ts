import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import {
    type E2eMailCaptureServer,
    startE2eMailCapture
} from '../../fixtures/mail-capture-server.ts';
import {
    annualOptionForSlug,
    attachSession,
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const card = (page: import('@playwright/test').Page, versionId: string) =>
    page.locator(`[data-testid="pricing-card-cta"][data-plan-version-id="${versionId}"]`);

test.describe('TEST:1735:16 AC:1735:16 change the billing option with a pending attempt @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial', timeout: 180_000 });

    const clock = createAdjustableClock({ start: new Date() });
    const userIdsToCleanup: string[] = [];
    let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
    let mailCapture: E2eMailCaptureServer | null = null;
    let monthlyOptionId = '';
    let annualOptionId = '';
    let planVersionId = '';
    let person: Awaited<ReturnType<typeof createUser>>;

    test.beforeAll(async () => {
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M1',
                        why: 'TEST:1735:16 needs the annual cadence read back as created.'
                    }
                ]
            }),
            clock
        });
        mailCapture = await startE2eMailCapture();
        await execSQL(
            `INSERT INTO billing_deadline_version (version, "values")
             VALUES (1, $1::jsonb) ON CONFLICT (version) DO NOTHING`,
            [
                JSON.stringify({
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
                })
            ]
        );

        monthlyOptionId = await monthlyOptionForSlug('owner-basico');
        annualOptionId = await annualOptionForSlug('owner-basico');
        const versions = await execSQL<{ id: string }>(
            `SELECT plan_version.id
               FROM plan_version
               JOIN plan ON plan.id = plan_version.plan_id
              WHERE plan.slug = 'owner-basico'
                AND plan_version.current = true
                AND plan_version.sellable = true
              LIMIT 1`
        );
        planVersionId = versions[0]?.id ?? '';
        if (!planVersionId) throw new Error('TEST:1735:16 requires current owner-basico');

        person = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(person.id);
        await markProfileCompleted({ userId: person.id });
    });

    test.afterAll(async () => {
        try {
            if (userIdsToCleanup.length > 0) {
                await execSQL(
                    `DELETE FROM provider_link
                      WHERE subscription_id IN (
                          SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])
                      )`,
                    [userIdsToCleanup]
                );
                await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
                userIdsToCleanup.length = 0;
            }
        } finally {
            try {
                await mailCapture?.close();
            } finally {
                await fakeServer?.close();
            }
        }
    });

    test('TEST:1735:16 changes from monthly to annual after cancelling the pending attempt', async ({
        page
    }) => {
        if (!fakeServer || !mailCapture)
            throw new Error('TEST:1735:16 fake provider and mail capture must start');
        await seedCookieConsent(page);
        await attachSession(page, person.sessionCookie);

        let originalSubscriptionId = '';
        let originalCheckoutUrl = '';
        await test.step('1. Start a monthly checkout and retain its pending link', async () => {
            await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: monthlyOptionId });
            // HOS-1896: a fresh signup navigates to the provider checkout, so the
            // start response replaces the pending screen as the source of truth.
            const { subscriptionId, checkoutUrl } = await confirmSignupCheckout({ page });
            originalSubscriptionId = subscriptionId;
            expect(originalSubscriptionId).toBeTruthy();
            originalCheckoutUrl = checkoutUrl;
            expect(originalCheckoutUrl).toBeTruthy();
            expect(fakeServer?.requests().some((request) => request.path === '/preapproval')).toBe(
                true
            );
        });

        await test.step('0. Pricing exposes resume monthly and a separate annual checkout', async () => {
            await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
            const basic = card(page, planVersionId);
            await expect(basic).toHaveAttribute('data-loaded', 'true');
            const monthly = basic.getByRole('link', { name: 'Continuar el pago' });
            await expect(monthly).toHaveAttribute(
                'href',
                new RegExp(`/es/suscriptores/checkout/\\?opcion=${monthlyOptionId}$`)
            );
            const annual = basic.getByRole('link', { name: /suscribirme.*anual/i });
            await expect(annual).toHaveAttribute(
                'href',
                new RegExp(`/es/suscriptores/checkout/\\?opcion=${annualOptionId}$`)
            );
            await annual.click();
        });

        await test.step('2. Annual checkout shows the existing attempt and blocks confirmation', async () => {
            const checkout = page.getByTestId('signup-checkout');
            const pendingAttempt = checkout.getByTestId('signup-checkout-pending-attempt');
            await expect(pendingAttempt).toBeVisible();
            await expect(pendingAttempt).toHaveAttribute(
                'data-subscription-id',
                originalSubscriptionId
            );
            await expect(checkout.getByTestId('signup-checkout-confirm')).toHaveCount(0);
            await expect(
                checkout.getByTestId('signup-checkout-pending-attempt-resume')
            ).toHaveAttribute('href', originalCheckoutUrl);
        });

        await test.step('3. Cancel the pending attempt and verify its durable effects', async () => {
            const checkout = page.getByTestId('signup-checkout');
            await checkout.getByTestId('signup-checkout-pending-attempt-cancel').click();
            await expect(
                checkout.getByTestId('signup-checkout-pending-attempt-cancelled')
            ).toBeVisible();
            await expect(checkout.getByTestId('signup-checkout-confirm')).toBeVisible();
            const subscription = await execSQL<{
                status: string;
                provider_link_id: string | null;
            }>(
                `SELECT subscription.status, provider_link.provider_id AS provider_link_id
                   FROM subscription
                   LEFT JOIN provider_link ON provider_link.subscription_id = subscription.id
                  WHERE subscription.id = $1 AND subscription.user_id = $2`,
                [originalSubscriptionId, person.id]
            );
            expect(subscription[0]).toEqual({
                status: 'ABANDONED',
                provider_link_id: expect.any(String)
            });
            const cancellationMail = await execSQL<{ template: string }>(
                `SELECT template FROM email_outbox
                  WHERE recipient_user_id = $1
                    AND template = 'billing.attempt-cancelled-cancel'
                  ORDER BY created_at DESC LIMIT 1`,
                [person.id]
            );
            expect(cancellationMail).toHaveLength(1);
        });

        await test.step('4. Confirm annual checkout and receive a new subscription', async () => {
            // HOS-1896: the pending screen is gone from the happy path; the
            // helper reads the new id from the start response after navigating.
            const { subscriptionId } = await confirmSignupCheckout({ page });
            expect(subscriptionId).toBeTruthy();
            expect(subscriptionId).not.toBe(originalSubscriptionId);
            expect(
                fakeServer?.requests().filter((request) => request.path === '/preapproval').length
            ).toBeGreaterThanOrEqual(2);
        });
    });
});
