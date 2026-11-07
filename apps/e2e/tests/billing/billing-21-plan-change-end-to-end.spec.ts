import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    decodeHtmlEntities,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupPlanChangeCase, openActivePlanCase } from '../../fixtures/plan-change-e2e.ts';
import { annualOptionForSlug, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const MAIL_TIMEOUT_MS = 30_000;
const articleFor = (page: Page, id: string) =>
    page.locator(`article[data-testid="my-subscription"][data-subscription-id="${id}"]`);

type SubscriptionRow = {
    readonly id: string;
    readonly status: string;
    readonly succeeds_id: string | null;
    readonly succeeded_by_id: string | null;
    readonly billing_option_id: string;
};

test.describe('TEST:B8b:26 AC:B8b:26 plan changes end to end @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let userIds: string[] = [];

    test.beforeEach(async () => {
        await ensureDeadlineVersion();
        providerNamespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    { lie: 'M1', why: 'TEST:B8b:26 needs real checkout and amount changes.' },
                    { lie: 'M6', why: 'TEST:B8b:26 observes authorization webhooks.' },
                    { lie: 'M8', why: 'TEST:B8b:26 needs the credited starting cycle.' }
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

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
            const providerIds = await cleanupPlanChangeCase({ userIds, providerNamespace });
            await cleanupArrearsRows({ userIds });
            expect(
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                }),
                'TEST:B8b:26 cleanup: no case sweep candidates survive.'
            ).toEqual([]);
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            world = null;
            providerNamespace = '';
            userIds = [];
        }
    });

    async function startCase(args: {
        readonly page: Page;
        readonly slug: 'owner-basico' | 'owner-premium';
    }) {
        if (!world) throw new Error('TEST:B8b:26 setup: case-local fake provider missing.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(args.page);
        const current = await openActivePlanCase({
            page: args.page,
            world,
            user: subscriber.user,
            admin: subscriber.admin,
            slug: args.slug
        });
        const article = articleFor(args.page, current.subscriptionId);
        await expect(
            article,
            'TEST:B8b:26 setup: current subscription appears in My Subscription.'
        ).toBeVisible();
        return { ...subscriber, ...current, article };
    }

    async function chooseOption(args: {
        readonly page: Page;
        readonly subscriptionId: string;
        readonly billingOptionId: string;
        readonly planName: 'Básico' | 'Premium';
        readonly cycleName: 'por mes' | 'por año';
        readonly worldName: string;
    }) {
        const article = articleFor(args.page, args.subscriptionId);
        await article.getByRole('button', { name: 'Cambiar de plan' }).click();
        const option = article.locator(
            `li[data-billing-option-id="${args.billingOptionId}"] button`
        );
        await expect(
            option,
            `TEST:B8b:26 ${args.worldName}: target option is visible.`
        ).toBeVisible();
        const [price] = await execSQL<{ amount: string }>(
            'SELECT amount FROM billing_option WHERE id = $1',
            [args.billingOptionId]
        );
        if (!price) throw new Error(`TEST:B8b:26 ${args.worldName}: missing option price.`);
        const amount = Number(price.amount);
        const selectedLabel = `${args.planName} · ${args.cycleName} · ${new Intl.NumberFormat(
            'es-AR',
            {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
                maximumFractionDigits: amount % 100 === 0 ? 0 : 2
            }
        ).format(amount / 100)}`;
        await expect(
            option,
            `TEST:B8b:26 ${args.worldName}: complete plan option label.`
        ).toHaveText(selectedLabel);
        await option.click();
        const confirmation = article.getByTestId('plan-change-offer');
        await expect(
            confirmation.locator('h4'),
            `TEST:B8b:26 ${args.worldName}: confirmation heading.`
        ).toHaveText('Así funciona el cambio');
        await expect(
            confirmation.locator('p').nth(0),
            `TEST:B8b:26 ${args.worldName}: selected plan and cycle.`
        ).toHaveText(selectedLabel);
        await expect(
            confirmation.locator('p').nth(1),
            `TEST:B8b:26 ${args.worldName}: checkout consequence.`
        ).toHaveText(
            'Si el cambio requiere autorización, vas a ir al checkout de Mercado Pago; tu plan actual sigue hasta que autorices.'
        );
        await expect(
            confirmation.locator('p').nth(2),
            `TEST:B8b:26 ${args.worldName}: scheduled change consequence.`
        ).toHaveText(
            'Si el cambio se programa, vas a ver la fecha exacta desde la que rige el plan nuevo.'
        );
        return confirmation;
    }

    async function readRows(
        subscriptionId: string,
        successorId = ''
    ): Promise<readonly SubscriptionRow[]> {
        return execSQL<SubscriptionRow>(
            'SELECT id, status, succeeds_id, succeeded_by_id, billing_option_id FROM subscription WHERE id = $1 OR id::text = $2 OR succeeds_id = $1 OR succeeded_by_id = $1',
            [subscriptionId, successorId]
        );
    }

    async function finishSuccession(args: {
        readonly page: Page;
        readonly worldName: 'upgrade' | 'cycle';
        readonly subscriptionId: string;
        readonly authorizationId: string;
        readonly targetOptionId: string;
        readonly planName: 'Básico' | 'Premium';
        readonly cycleName: 'por mes' | 'por año';
        readonly adminCookie: string;
        readonly email: string;
    }) {
        if (!world) throw new Error(`TEST:B8b:26 ${args.worldName}: fake world missing.`);
        await args.page.route(
            (url) => url.hostname === 'payments-fake.invalid',
            (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: '<html><body>Fake provider checkout</body></html>'
                })
        );
        let checkoutUrl = '';
        await args.page.route(
            (url) =>
                url.pathname ===
                `/api/v1/protected/billing-subscription/${args.subscriptionId}/plan-change`,
            async (route) => {
                const response = await route.fetch();
                const body = (await response.json()) as {
                    readonly data?: { readonly checkoutUrl?: string };
                };
                checkoutUrl = body.data?.checkoutUrl ?? '';
                await route.fulfill({ response });
            }
        );
        const confirmation = await chooseOption({
            page: args.page,
            subscriptionId: args.subscriptionId,
            billingOptionId: args.targetOptionId,
            planName: args.planName,
            cycleName: args.cycleName,
            worldName: args.worldName
        });
        await confirmation.getByRole('button', { name: 'Confirmar cambio' }).click();
        await args.page.waitForURL((url) => checkoutUrl.length > 0 && url.href === checkoutUrl);
        expect(
            args.page.url(),
            `TEST:B8b:26 ${args.worldName}: browser reaches provider checkout.`
        ).toBe(checkoutUrl);
        const pending = await readRows(args.subscriptionId);
        const successor = pending.find((row) => row.succeeds_id === args.subscriptionId);
        expect(
            successor?.status,
            `TEST:B8b:26 ${args.worldName}: successor waits for authorization.`
        ).toBe('PENDING_AUTHORIZATION');
        expect(
            pending.find((row) => row.id === args.subscriptionId)?.status,
            `TEST:B8b:26 ${args.worldName}: old service remains active during checkout.`
        ).toBe('ACTIVE');
        if (!successor) throw new Error(`TEST:B8b:26 ${args.worldName}: missing successor.`);
        const [link] = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [successor.id]
        );
        if (!link)
            throw new Error(`TEST:B8b:26 ${args.worldName}: missing successor authorization.`);
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: successor.id
        });
        const sender = await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: args.adminCookie
        });
        expect(sender.success, `TEST:B8b:26 ${args.worldName}: outbox sender succeeds.`).toBe(true);
        const mail = await world.mailCapture.waitForMail({
            to: args.email,
            subject: 'Tu cambio de plan ya está activo',
            timeoutMs: MAIL_TIMEOUT_MS
        });
        expect(
            decodeHtmlEntities(mail.html),
            `TEST:B8b:26 ${args.worldName}: complete S17 explanation.`
        ).toContain(
            'Tu nuevo plan ya está activo. Cancelamos la autorización de cobro de tu plan anterior para que no se te cobre dos veces. Puede llegarte un correo de Mercado Pago que habla de una cancelación: es parte del cambio que pediste.'
        );
        expect(
            cancelRequestsFor({
                requests: world.fakeServer.requests(),
                authorizationId: args.authorizationId
            }),
            `TEST:B8b:26 ${args.worldName}: provider has not cancelled before mail.`
        ).toHaveLength(0);
        const reevaluation = await runCron({
            jobName: 'subscription-succession-reevaluation',
            adminCookie: args.adminCookie
        });
        expect(
            reevaluation.success,
            `TEST:B8b:26 ${args.worldName}: S17 reevaluation succeeds.`
        ).toBe(true);
        const closed = await readRows(args.subscriptionId, successor.id);
        expect(
            closed.find((row) => row.id === successor.id)?.status,
            `TEST:B8b:26 ${args.worldName}: successor is active.`
        ).toBe('ACTIVE');
        expect(
            closed.find((row) => row.id === args.subscriptionId)?.status,
            `TEST:B8b:26 ${args.worldName}: predecessor is cancelled.`
        ).toBe('CANCELLED');
        expect(
            closed.find((row) => row.id === args.subscriptionId)?.succeeded_by_id,
            `TEST:B8b:26 ${args.worldName}: predecessor retains successor link after S17.`
        ).toBe(successor.id);
        // S17 clears succeeds_id when it closes; the pending assertion above proves the original link.
        expect(
            closed.find((row) => row.id === successor.id)?.succeeds_id,
            `TEST:B8b:26 ${args.worldName}: S17 cleared the temporary successor link.`
        ).toBeNull();
        const cancellations = cancelRequestsFor({
            requests: world.fakeServer.requests(),
            authorizationId: args.authorizationId
        });
        expect(
            cancellations,
            `TEST:B8b:26 ${args.worldName}: provider received one predecessor cancellation.`
        ).toHaveLength(1);
        expect(
            mail.receivedAt.getTime(),
            `TEST:B8b:26 ${args.worldName}: our mail precedes provider cancellation.`
        ).toBeLessThan(new Date(cancellations[0]!.at).getTime());
    }

    test('upgrade: checkout activates successor and mail precedes predecessor cancellation', async ({
        page
    }) => {
        const targetOptionId = await monthlyOptionForSlug('owner-premium');
        const current = await startCase({ page, slug: 'owner-basico' });
        await finishSuccession({
            page,
            worldName: 'upgrade',
            ...current,
            targetOptionId,
            planName: 'Premium',
            cycleName: 'por mes',
            adminCookie: current.admin.sessionCookie,
            email: current.user.email
        });
    });

    test('downgrade: scheduled date applies lower plan and amount; sin correo propio: no existe plantilla', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:B8b:26 downgrade: fake world missing.');
        const targetOptionId = await monthlyOptionForSlug('owner-basico');
        const current = await startCase({ page, slug: 'owner-premium' });
        let effectiveAt = '';
        await page.route(
            (url) =>
                url.pathname ===
                `/api/v1/protected/billing-subscription/${current.subscriptionId}/plan-change`,
            async (route) => {
                const response = await route.fetch();
                const body = (await response.json()) as {
                    readonly data?: { readonly effectiveAt?: string };
                };
                effectiveAt = body.data?.effectiveAt ?? '';
                await route.fulfill({ response });
            }
        );
        const confirmation = await chooseOption({
            page,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId,
            planName: 'Básico',
            cycleName: 'por mes',
            worldName: 'downgrade'
        });
        // The queue row is written by the plan-change request; read it only after
        // that response has arrived, never right after the click.
        const planChangeResponse = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    `/api/v1/protected/billing-subscription/${current.subscriptionId}/plan-change` &&
                response.request().method() === 'POST'
        );
        await confirmation.getByRole('button', { name: 'Confirmar cambio' }).click();
        expect(
            (await planChangeResponse).ok(),
            'TEST:B8b:26 downgrade: plan-change request succeeds.'
        ).toBe(true);
        const [scheduled] = await execSQL<{ effective_at: Date; target_billing_option_id: string }>(
            'SELECT effective_at, target_billing_option_id FROM subscription_scheduled_change WHERE subscription_id = $1',
            [current.subscriptionId]
        );
        expect(
            scheduled?.target_billing_option_id,
            'TEST:B8b:26 downgrade: queue points at lower plan.'
        ).toBe(targetOptionId);
        if (!scheduled) throw new Error('TEST:B8b:26 downgrade: missing scheduled change.');
        expect(
            new Date(effectiveAt).toISOString(),
            'TEST:B8b:26 downgrade: UI date equals queued date.'
        ).toBe(scheduled.effective_at.toISOString());
        await expect(
            current.article.getByTestId('plan-change-result'),
            'TEST:B8b:26 downgrade: full effective date message.'
        ).toHaveText(`Tu plan cambia el ${formatMarketDate(scheduled.effective_at)}.`);
        await world.fakeServer.setClock({
            at: new Date(scheduled.effective_at.getTime() + 60_000)
        });
        const applied = await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie
        });
        expect(applied.success, 'TEST:B8b:26 downgrade: scheduled change job succeeds.').toBe(true);
        const [after] = await execSQL<{ status: string; billing_option_id: string }>(
            'SELECT status, billing_option_id FROM subscription WHERE id = $1',
            [current.subscriptionId]
        );
        expect(after, 'TEST:B8b:26 downgrade: lower plan is active.').toMatchObject({
            status: 'ACTIVE',
            billing_option_id: targetOptionId
        });
        const [target] = await execSQL<{ amount: string }>(
            'SELECT amount FROM billing_option WHERE id = $1',
            [targetOptionId]
        );
        const authorization = await world.fakeServer.provider.readAuthorization({
            authorizationId: current.authorizationId
        });
        expect(
            authorization.snapshot.amount?.amountMinor,
            'TEST:B8b:26 downgrade: provider amount matches lower option.'
        ).toBe(Number(target?.amount));
        expect(
            world.fakeServer
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${current.authorizationId}` &&
                        typeof request.body === 'object' &&
                        request.body !== null &&
                        'auto_recurring' in request.body
                ),
            'TEST:B8b:26 downgrade: provider received amount mutation.'
        ).toHaveLength(1);
    });

    test('cycle monthly to annual: checkout activates successor and mail precedes predecessor cancellation', async ({
        page
    }) => {
        const targetOptionId = await annualOptionForSlug('owner-basico');
        const current = await startCase({ page, slug: 'owner-basico' });
        await finishSuccession({
            page,
            worldName: 'cycle',
            ...current,
            targetOptionId,
            planName: 'Básico',
            cycleName: 'por año',
            adminCookie: current.admin.sessionCookie,
            email: current.user.email
        });
    });
});
