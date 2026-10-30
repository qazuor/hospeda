/**
 * Preconditions: E2E database has the 0144 accommodation catalog and billing
 * schema; Playwright starts the built API and web app with the fake provider,
 * adjustable clock, and Brevo-shaped mail capture configured.
 */
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import {
    readSubscriptionStatus,
    seedManualPendingSubscription,
    triggerCron
} from '../../fixtures/billing-signup-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    E2E_RECEIVER_PATH,
    E2E_WEBHOOK_SECRET,
    startE2eFakeProvider
} from '../../fixtures/fake-provider-server.ts';
import {
    type E2eMailCaptureServer,
    startE2eMailCapture
} from '../../fixtures/mail-capture-server.ts';
import {
    attachSession,
    confirmSignupCheckout,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_WINDOW_MS = 72 * 60 * 60 * 1000;
const MAIL_TIMEOUT_MS = 30_000;

test.describe('TEST:B3:35 AC:B3:33 AC:B3:9 the signup end to end with two abandoned checkouts @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial', timeout: 180_000 });

    const clock = createAdjustableClock({ start: new Date() });
    const userIdsToCleanup: string[] = [];
    let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
    let mailCapture: E2eMailCaptureServer | null = null;
    let monthlyOptionId = '';
    let planVersionId = '';
    let manualDays = 0;
    let personA: Awaited<ReturnType<typeof createUser>>;
    let personB: Awaited<ReturnType<typeof createUser>>;
    let personC: Awaited<ReturnType<typeof createUser>>;
    let admin: Awaited<ReturnType<typeof createUser>>;

    test.beforeAll(async () => {
        const baseTime = clock.now();
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M6', why: 'TEST:B3:35 delivers the authorization notice at once.' }
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
        const plans = await execSQL<{ id: string }>(
            `SELECT plan_version.id
               FROM plan_version
               JOIN plan ON plan.id = plan_version.plan_id
              WHERE plan.vertical = 'accommodation'
                AND plan_version.vertical = 'accommodation'
                AND plan_version.current = true
                AND plan_version.sellable = true
                AND plan.slug IN ('owner-basico', 'owner-pro', 'owner-premium')
              ORDER BY plan.pricing_order
              LIMIT 1`
        );
        planVersionId = plans[0]?.id ?? '';
        if (!planVersionId) {
            throw new Error(
                'TEST:B3:35 requires a current sellable accommodation catalog version (0144)'
            );
        }
        await execSQL(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
             VALUES ($1, 'monthly', 100000, 'ARS')
             ON CONFLICT (plan_version_id, cycle) DO NOTHING`,
            [planVersionId]
        );
        const options = await execSQL<{ id: string }>(
            `SELECT id FROM billing_option WHERE plan_version_id = $1 AND cycle = 'monthly'`,
            [planVersionId]
        );
        monthlyOptionId = options[0]?.id ?? '';
        if (!monthlyOptionId)
            throw new Error('TEST:B3:35 could not read the monthly billing option');

        const deadlines = await execSQL<{ manual_days: number }>(
            `SELECT ("values"->'10'->>'manualDays')::integer AS manual_days
               FROM billing_deadline_version WHERE version = 1`
        );
        manualDays = deadlines[0]?.manual_days ?? 0;
        if (manualDays !== 7)
            throw new Error('TEST:B3:35 requires manualDays = 7 in deadline version 1');

        admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(admin.id);
        personA = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(personA.id);
        await markProfileCompleted({ userId: personA.id });
        personB = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(personB.id);
        await markProfileCompleted({ userId: personB.id });
        personC = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(personC.id);
        await markProfileCompleted({ userId: personC.id });
        expect(clock.now().getTime()).toBe(baseTime.getTime());
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

    test('A authorizes in the web checkout and reaches ACTIVE with the signup email', async ({
        page
    }) => {
        if (!fakeServer || !mailCapture)
            throw new Error('TEST:B3:35 fake provider and mail capture must start');
        await seedCookieConsent(page);
        await attachSession(page, personA.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: monthlyOptionId });
        const requestsBeforeSignup = fakeServer.requests().length;
        const { subscriptionId, checkoutUrl, authorizationWindowEndsAt } =
            await confirmSignupCheckout({ page });
        expect(subscriptionId).toBeTruthy();
        expect(checkoutUrl).not.toContain('activation');
        expect(page.url()).toBe(checkoutUrl);
        expect(new Date(authorizationWindowEndsAt).getTime()).toBeGreaterThan(Date.now());
        expect(
            fakeServer.requests().length,
            'API must be pointed at the fake provider'
        ).toBeGreaterThan(requestsBeforeSignup);
        const links = await execSQL<{ provider_id: string }>(
            `SELECT provider_id FROM provider_link WHERE subscription_id = $1`,
            [subscriptionId]
        );
        const authorizationId = links[0]?.provider_id;
        if (!authorizationId)
            throw new Error('TEST:B3:35 signup did not persist its fake authorization link');

        await fakeServer.provider.approve({ authorizationId });
        let delivery: { readonly delivered: number; readonly skipped: number };
        try {
            delivery = await fakeServer.deliverDueAsMercadoPago({
                to: `${API_URL}${E2E_RECEIVER_PATH}`,
                webhookSecret: E2E_WEBHOOK_SECRET
            });
        } catch (error) {
            throw new Error(
                `TEST:B3:35 API webhook receiver rejected the fake delivery; check receiver URL and HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET: ${error instanceof Error ? error.message : String(error)}`
            );
        }
        expect(
            delivery.delivered,
            'API webhook receiver must accept at least one fake delivery'
        ).toBeGreaterThanOrEqual(1);
        expect(await readSubscriptionStatus({ subscriptionId: subscriptionId ?? '' })).toBe(
            'ACTIVE'
        );
        await triggerCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
        const mail = await mailCapture.waitForMail({
            to: personA.email,
            subject: 'Tu suscripción está activa',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(mail.html).toContain('Mercado Pago');
        expect(mail.html).toMatch(/\d{1,2} de [a-záéíóú]+ de \d{4}/i);
        expect(
            fakeServer
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${authorizationId}`
                )
        ).toHaveLength(0);
    });

    test('B abandons card checkout at 72 hours while C manual remains pending', async () => {
        if (!fakeServer || !mailCapture)
            throw new Error('TEST:B3:35 fake provider and mail capture must start');
        const requestsBeforeSignup = fakeServer.requests().length;
        const response = await fetch(`${API_URL}/api/v1/protected/billing/subscriptions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: personB.sessionCookie },
            body: JSON.stringify({
                billingOptionId: monthlyOptionId,
                payerEmail: `mp-${crypto.randomUUID()}@example.test`
            })
        });
        const body = (await response.json()) as {
            readonly data?: { readonly subscriptionId?: string };
            readonly error?: { readonly message?: string };
        };
        expect(
            { status: response.status, subscriptionId: body.data?.subscriptionId },
            `S1 must use the fake provider; failure: ${body.error?.message ?? 'no response detail'}`
        ).toMatchObject({ status: 201, subscriptionId: expect.any(String) });
        expect(
            fakeServer.requests().length,
            'API must be pointed at the fake provider'
        ).toBeGreaterThan(requestsBeforeSignup);
        const subscriptionB = body.data?.subscriptionId ?? '';
        const links = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionB]
        );
        const authorizationB = links[0]?.provider_id;
        if (!authorizationB)
            throw new Error('TEST:B3:35 card signup did not persist its fake authorization link');

        const manualWindowEnd = new Date(fakeServer.now().getTime() + manualDays * DAY_MS);
        const subscriptionC = await seedManualPendingSubscription({
            userId: personC.id,
            planVersionId,
            billingOptionId: monthlyOptionId,
            windowEndsAt: manualWindowEnd
        });
        await fakeServer.advanceClock({ ms: CARD_WINDOW_MS + 60_000 });
        await triggerCron({
            jobName: 'subscription-window-expiry',
            adminCookie: admin.sessionCookie
        });
        expect(await readSubscriptionStatus({ subscriptionId: subscriptionB })).toBe('ABANDONED');
        expect(await readSubscriptionStatus({ subscriptionId: subscriptionC })).toBe(
            'PENDING_AUTHORIZATION'
        );
        expect(
            fakeServer
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${authorizationB}`
                )
        ).toHaveLength(0);

        await triggerCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
        const beforeCancelMail = await mailCapture.waitForMail({
            to: personB.email,
            subject: 'Tu autorización pendiente venció',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(beforeCancelMail.html).toContain('Mercado Pago');
        const capturedRequestCount = fakeServer.requests().length;
        const requests = fakeServer.requests();
        requests.forEach((request, index) => {
            if (request.method === 'PUT' && request.path === `/preapproval/${authorizationB}`) {
                expect(index).toBeGreaterThanOrEqual(capturedRequestCount);
            }
        });
    });

    test('C manual abandons after seven days without a provider authorization', async () => {
        if (!fakeServer || !mailCapture)
            throw new Error('TEST:B3:35 fake provider and mail capture must start');
        const remainingMs = Math.max(0, manualDays * DAY_MS - (CARD_WINDOW_MS + 60_000) + 60_000);
        await fakeServer.advanceClock({ ms: remainingMs });
        const subscriptionRows = await execSQL<{ id: string }>(
            `SELECT id FROM subscription
              WHERE user_id = $1 AND payment_method = 'MANUAL' AND status = 'PENDING_AUTHORIZATION'`,
            [personC.id]
        );
        const subscriptionC = subscriptionRows[0]?.id;
        if (!subscriptionC) throw new Error('TEST:B3:35 manual subscription fixture disappeared');
        await triggerCron({
            jobName: 'subscription-window-expiry',
            adminCookie: admin.sessionCookie
        });
        expect(await readSubscriptionStatus({ subscriptionId: subscriptionC })).toBe('ABANDONED');
        await triggerCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
        const incompleteMail = await mailCapture.waitForMail({
            to: personC.email,
            subject: 'Tu alta quedó sin completarse',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(incompleteMail.html).toContain('quedó sin completarse');
        expect(
            fakeServer.requests().every((request) => !request.path.includes(subscriptionC))
        ).toBe(true);
    });
});
