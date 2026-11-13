import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { FakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import {
    cleanupArrearsRows,
    createSubscriber,
    ensureDeadlineVersion,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import {
    E2E_RECEIVER_PATH,
    E2E_WEBHOOK_SECRET,
    startE2eFakeProvider
} from '../../fixtures/fake-provider-server.ts';
import {
    attachSession,
    confirmSignupCheckout,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const DAY_MS = 24 * 60 * 60 * 1000;
const START_SUBSCRIPTION_PATH = '/api/v1/protected/billing/subscriptions';
const FAKE_APPROVAL_HOST = 'payments-fake.invalid';
const CHECKOUT_STUB_HTML = '<!doctype html><html><body>Fake provider checkout</body></html>';
type SignupUser = Awaited<ReturnType<typeof createSubscriber>>['user'];
type DeclinedSignup = {
    readonly user: SignupUser;
    readonly subscriptionId: string;
    readonly optionId: string;
};
type StartBody = { readonly billingOptionId?: string; readonly payerEmail?: string };
type StartResponse = { readonly data?: { readonly subscriptionId?: string } };
type SubscriptionRow = {
    readonly id: string;
    readonly status: string;
    readonly billing_option_id: string;
};
type UpdatedAtRow = { readonly updated_at: Date } & Record<string, unknown>;

/**
 * Preconditions: the E2E API and web servers, seeded plan catalog, and E2E database are available; `HOSPEDA_E2E_API_URL` and `HOSPEDA_E2E_WEB_URL` may override their local defaults. The test creates users and the monthly `owner-basico` option, drives a pending Mercado Pago signup through a signed decline, and cleans up its rows and fake provider.
 */
test.describe('TEST:2149:1 TEST:2149:2 TEST:2149:3 declined signup notice on my subscription @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
    const userIds: string[] = [];
    let declined: DeclinedSignup | null = null;

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: randomUUID(),
                honestAbout: [
                    {
                        lie: 'M6',
                        why: 'TEST:2149 needs each provider notice once, at once and in emission order.'
                    }
                ]
            }),
            clock
        });
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            await fakeServer?.close().catch(() => undefined);
        }
    });

    test('shows the declined signup notice with the attempted plan only on my subscription', async ({
        page
    }) => {
        if (!fakeServer) throw new Error('Expected fake provider server.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const signup = await driveDeclinedSignup({ page, fakeServer, user: subscriber.user });
        declined = {
            user: subscriber.user,
            subscriptionId: signup.subscriptionId,
            optionId: signup.optionId
        };

        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const notice = page.locator(
            `[data-testid="subscription-return"][data-subscription-id="${signup.subscriptionId}"]`
        );
        await expect(page.getByTestId('subscription-return')).toHaveCount(1);
        await expect(notice).toHaveAttribute('data-view', 'rejected');
        await expect(notice.locator('h2')).toHaveText('Mercado Pago no aprobó el pago');
        await expect(notice.locator('p').first()).toHaveText(
            'No se cobró nada y el intento anterior quedó cerrado. Podés armar uno nuevo con el mismo plan.'
        );
        await expect(notice.getByTestId('subscription-return-attempt-plan')).toHaveText(
            'Plan que intentaste contratar: Básico'
        );
        const retry = notice.getByTestId('subscription-return-retry');
        await expect(retry).toHaveText('Intentar con otro medio de pago');
        await expect(retry).toBeEnabled();
        await expect(notice.getByTestId('subscription-return-payer-email')).toHaveCount(0);

        const accountResponse = await page.goto(`${WEB_URL}/es/mi-cuenta/`);
        expect(accountResponse?.status()).toBe(200);
        // A redirect (e.g. to sign-in) would also answer 200 with zero notices.
        expect(new URL(page.url()).pathname).toBe('/es/mi-cuenta/');
        await expect(page.getByTestId('subscription-return')).toHaveCount(0);
    });

    test('retry starts one new signup with the declined option and the notice goes away', async ({
        page
    }) => {
        if (!fakeServer || !declined)
            throw new Error('Expected the declined signup from TEST:2149:1.');
        await seedCookieConsent(page);
        await attachSession(page, declined.user.sessionCookie);
        const startBodies: StartBody[] = [];
        const startResponse: { value: { readonly status: number; readonly text: string } | null } =
            {
                value: null
            };
        await page.route(
            (url) => url.pathname === START_SUBSCRIPTION_PATH,
            async (route) => {
                if (route.request().method() !== 'POST') {
                    await route.continue();
                    return;
                }
                const postData: unknown = route.request().postDataJSON();
                startBodies.push(readStartBody(postData));
                const response = await route.fetch();
                const text = await response.text();
                startResponse.value = { status: response.status(), text };
                await route.fulfill({ response, body: text });
            }
        );
        await page.route(
            (url) => url.hostname === FAKE_APPROVAL_HOST,
            (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: CHECKOUT_STUB_HTML
                })
        );
        const preapprovalsBefore = fakeServer
            .requests()
            .filter(
                (request) => request.method === 'POST' && request.path === '/preapproval'
            ).length;
        try {
            await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
            const notice = page.locator(
                `[data-testid="subscription-return"][data-subscription-id="${declined.subscriptionId}"]`
            );
            await expect(notice).toHaveCount(1);
            // The retry button is server-rendered: a click before React attaches its
            // handler does nothing (HOS-1890). Astro drops `ssr` once the island hydrates.
            await expect(page.locator('astro-island').filter({ has: notice })).toHaveCount(1);
            await expect(page.locator('astro-island[ssr]').filter({ has: notice })).toHaveCount(0, {
                timeout: 15_000
            });
            await notice.getByTestId('subscription-return-retry').click();
            await page.waitForURL((url) => url.hostname === FAKE_APPROVAL_HOST);

            expect(startBodies).toHaveLength(1);
            expect({
                billingOptionId: startBodies[0]?.billingOptionId,
                payerEmail: startBodies[0]?.payerEmail
            }).toEqual({ billingOptionId: declined.optionId, payerEmail: declined.user.email });
            expect(startResponse.value?.status).toBe(201);
            const responseBody = readStartResponse(startResponse.value?.text ?? '{}');
            const newSubscriptionId = responseBody.data?.subscriptionId;
            expect(newSubscriptionId).toBeTruthy();
            expect(newSubscriptionId).not.toBe(declined.subscriptionId);
            expect(
                fakeServer
                    .requests()
                    .filter(
                        (request) => request.method === 'POST' && request.path === '/preapproval'
                    )
            ).toHaveLength(preapprovalsBefore + 1);

            const rows = await execSQL<SubscriptionRow>(
                `SELECT id, status, billing_option_id FROM subscription
                     WHERE user_id = $1 AND class = 'PRINCIPAL' ORDER BY created_at, id`,
                [declined.user.id]
            );
            expect(rows).toEqual([
                {
                    id: declined.subscriptionId,
                    status: 'CHARGE_DECLINED',
                    billing_option_id: declined.optionId
                },
                {
                    id: newSubscriptionId,
                    status: 'PENDING_AUTHORIZATION',
                    billing_option_id: declined.optionId
                }
            ]);
        } finally {
            await page.unroute((url) => url.pathname === START_SUBSCRIPTION_PATH);
            await page.unroute((url) => url.hostname === FAKE_APPROVAL_HOST);
        }

        const response = await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        expect(response?.status()).toBe(200);
        await expect(page.locator('[data-subscription-sections]')).toHaveCount(1);
        await expect(page.getByTestId('subscription-return')).toHaveCount(0);
    });

    test('the notice disappears seven days after the decline', async ({ page }) => {
        if (!fakeServer) throw new Error('Expected fake provider server.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const signup = await driveDeclinedSignup({ page, fakeServer, user: subscriber.user });
        const rows = await execSQL<UpdatedAtRow>(
            'SELECT updated_at FROM subscription WHERE id = $1',
            [signup.subscriptionId]
        );
        const updatedAt = rows[0]?.updated_at;
        if (!updatedAt) throw new Error(`Missing updated_at for ${signup.subscriptionId}.`);

        await fakeServer.setClock({ at: new Date(updatedAt.getTime() + 7 * DAY_MS - 60_000) });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const notice = page.locator(
            `[data-testid="subscription-return"][data-subscription-id="${signup.subscriptionId}"]`
        );
        await expect(notice).toHaveCount(1);
        await expect(notice).toHaveAttribute('data-view', 'rejected');
        await expect(notice.getByTestId('subscription-return-attempt-plan')).toHaveText(
            'Plan que intentaste contratar: Básico'
        );

        await fakeServer.setClock({ at: new Date(updatedAt.getTime() + 7 * DAY_MS) });
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        await expect(page.locator('[data-subscription-sections]')).toHaveCount(1);
        await expect(page.getByTestId('subscription-return')).toHaveCount(0);
    });
});

async function driveDeclinedSignup(args: {
    readonly page: Page;
    readonly fakeServer: FakeProviderServer;
    readonly user: SignupUser;
}): Promise<{ readonly subscriptionId: string; readonly optionId: string }> {
    await seedCookieConsent(args.page);
    await attachSession(args.page, args.user.sessionCookie);
    const optionId = await monthlyOptionForSlug('owner-basico');
    await openSignupCheckout({ page: args.page, webUrl: WEB_URL, billingOptionId: optionId });
    const { subscriptionId } = await confirmSignupCheckout({ page: args.page });
    const links = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    const authorizationId = links[0]?.provider_id;
    if (!authorizationId) throw new Error(`Missing provider authorization for ${subscriptionId}.`);

    await deliverNotices(args.fakeServer);
    await args.fakeServer.provider.declineCharge({
        authorizationId,
        declineReason: 'cc_rejected_other_reason'
    });
    await args.fakeServer.provider.cancel({ authorizationId });
    await deliverNotices(args.fakeServer);
    await expect
        .poll(() => subscriptionStatus(subscriptionId), {
            message: 'S16 must close the pending signup as CHARGE_DECLINED',
            timeout: 30_000
        })
        .toBe('CHARGE_DECLINED');
    return { subscriptionId, optionId };
}

async function deliverNotices(fakeServer: FakeProviderServer): Promise<void> {
    const result = await fakeServer.deliverDueAsMercadoPago({
        to: `${API_URL}${E2E_RECEIVER_PATH}`,
        webhookSecret: E2E_WEBHOOK_SECRET
    });
    if (result.delivered === 0)
        throw new Error('Expected due fake Mercado Pago notices to be delivered.');
}

async function subscriptionStatus(subscriptionId: string): Promise<string | undefined> {
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return rows[0]?.status;
}

function readStartBody(value: unknown): StartBody {
    if (typeof value !== 'object' || value === null)
        throw new Error('Expected signup request body.');
    return {
        billingOptionId:
            'billingOptionId' in value && typeof value.billingOptionId === 'string'
                ? value.billingOptionId
                : undefined,
        payerEmail:
            'payerEmail' in value && typeof value.payerEmail === 'string'
                ? value.payerEmail
                : undefined
    };
}

function readStartResponse(text: string): StartResponse {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return {};
    if (!('data' in value)) return {};
    const data = value.data;
    if (typeof data !== 'object' || data === null || !('subscriptionId' in data)) return {};
    return typeof data.subscriptionId === 'string'
        ? { data: { subscriptionId: data.subscriptionId } }
        : {};
}
