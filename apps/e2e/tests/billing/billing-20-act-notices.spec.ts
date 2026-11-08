import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    type FakeWorld,
    formatMarketDate,
    recordCreditedCycle,
    runCron,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { driveToGrace } from '../../fixtures/cancellation-flow.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupPermanentGrantE2eRows } from '../../fixtures/permanent-grant-flow.ts';
import { attachSession, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const articleFor = (page: Page, id: string) =>
    page.locator(`article[data-testid="my-subscription"][data-subscription-id="${id}"]`);

test.describe('TEST:B8b:25 AC:B8b:25 act notices @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let userIds: string[] = [];
    let promoIds: string[] = [];
    let dialogs: string[] = [];

    test.beforeEach(async ({ page }) => {
        providerNamespace = randomUUID();
        dialogs = [];
        page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    {
                        lie: 'M1',
                        why: 'TEST:B8b:25 needs the credited starting cycle and promo mutation.'
                    },
                    { lie: 'M6', why: 'TEST:B8b:25 observes authorization and charge notices.' },
                    {
                        lie: 'M8',
                        why: 'TEST:B8b:25 reads the credited cycle before changing a plan.'
                    },
                    {
                        lie: 'M12',
                        why: 'TEST:B8b:25 resumes the customer pause to read its next charge.'
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

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
            const providerIds = (
                await execSQL<{ provider_id: string }>(
                    'SELECT provider_id FROM provider_link WHERE provider_id LIKE $1',
                    [`fake-auth-${providerNamespace}-%`]
                )
            ).map((row) => row.provider_id);
            if (promoIds.length) {
                await execSQL(
                    'DELETE FROM promo_redemption WHERE promo_code_id = ANY($1::uuid[])',
                    [promoIds]
                );
                await execSQL('DELETE FROM promo_code WHERE id = ANY($1::uuid[])', [promoIds]);
            }
            await cleanupPermanentGrantE2eRows({ userIds, providerIds });
            await cleanupArrearsRows({ userIds });
            expect(
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                })
            ).toEqual([]);
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            world = null;
            providerNamespace = '';
            userIds = [];
            promoIds = [];
            expect(dialogs, 'native confirmation dialogs are forbidden').toEqual([]);
        }
    });

    async function active({
        page,
        slug = 'owner-basico'
    }: {
        readonly page: Page;
        readonly slug?: 'owner-basico' | 'owner-premium';
    }) {
        if (!world) throw new Error('Expected case-local fake provider.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await monthlyOptionForSlug(slug)
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        await recordCreditedCycle({ fakeServer: world.fakeServer, ...card });
        const nextChargeAt = (
            await world.fakeServer.provider.readAuthorization({
                authorizationId: card.authorizationId
            })
        ).snapshot.nextChargeAt;
        if (!nextChargeAt) throw new Error('Expected a future charge date.');
        const sweep = await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: subscriber.admin.sessionCookie
        });
        expect(sweep.success, JSON.stringify(await describeSweepCandidates())).toBe(true);
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = articleFor(page, card.subscriptionId);
        await expect(article).toBeVisible();
        return { ...subscriber, ...card, article };
    }

    async function pause(page: Page, subscriptionId: string) {
        const article = articleFor(page, subscriptionId);
        await article.getByRole('button', { name: 'Pausar suscripción' }).click();
        const confirmation = article.getByTestId('pause-confirmation');
        await expect(confirmation).toBeVisible();
        return { article, confirmation };
    }

    test('pauses a paid subscription after explaining the listing and addons with this customer date', async ({
        page
    }) => {
        const { subscriptionId } = await active({ page });
        const { article, confirmation } = await pause(page, subscriptionId);
        const dateLine = confirmation.locator('p').first();
        const confirmationText = await dateLine.textContent();
        expect(confirmationText).toMatch(
            /^Si confirmás, tu suscripción queda pausada hasta el .+\.$/
        );
        await expect(confirmation.locator('p').nth(1)).toHaveText(
            'Tu ficha sale del sitio público hoy. Vuelve sola al reanudar si el cupo del plan alcanza. Durante la pausa no se archiva, no se borra ni recibe avisos de retención; el reloj se detiene y arranca de cero al volver.'
        );
        await expect(confirmation.locator('p').nth(2)).toHaveText(
            'Los addons recurrentes de esta vertical se pausan por los mismos meses y vuelven con el plan:'
        );
        await confirmation.getByRole('button', { name: 'Confirmar pausa' }).click();
        await expect(article.getByRole('status')).toBeVisible();
        const rows = await execSQL<{ status: string; expected_end_at: Date }>(
            'SELECT s.status, sp.expected_end_at FROM subscription s JOIN subscription_pause sp ON sp.subscription_id = s.id WHERE s.id = $1',
            [subscriptionId]
        );
        expect(rows[0]?.status).toBe('PAUSED');
        expect(confirmationText).toBe(
            `Si confirmás, tu suscripción queda pausada hasta el ${formatMarketDate(rows[0]!.expected_end_at)}.`
        );
        await expect(article.getByRole('status')).toHaveText(
            `Tu suscripción quedó pausada hasta el ${formatMarketDate(rows[0]!.expected_end_at)}.`
        );
    });

    test('a paused customer sees only the next charge and amount on resume, and why plan change is blocked', async ({
        page
    }) => {
        const { subscriptionId } = await active({ page });
        const { confirmation } = await pause(page, subscriptionId);
        await confirmation.getByRole('button', { name: 'Confirmar pausa' }).click();
        await page.reload();
        const article = articleFor(page, subscriptionId);
        await expect(article.getByTestId('my-subscription-plan-change-paused')).toHaveText(
            'Reanudá tu suscripción para cambiar de plan.'
        );
        await expect(article.locator('[data-testid^="plan-change-"] button')).toHaveText([]);
        await article.getByRole('button', { name: 'Reanudar suscripción' }).click();
        await expect(article.getByTestId('resume-confirmation')).toHaveText(
            'Tu suscripción se reanuda hoy y te mostramos el día del próximo cobro.Confirmar reanudación'
        );
        await article.getByRole('button', { name: 'Confirmar reanudación' }).click();
        await expect(article.getByTestId('resume-result')).toBeVisible();
        const response = await execSQL<{ status: string; next_charge_at: Date | null }>(
            'SELECT status, next_charge_at FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(response[0]?.status).toBe('ACTIVE');
        const chargeAt = response[0]?.next_charge_at;
        if (!chargeAt) throw new Error('Expected next charge after resume.');
        const charge = await execSQL<{ amount: string; currency: string }>(
            'SELECT bo.amount, bo.currency FROM subscription s JOIN billing_option bo ON bo.id = s.billing_option_id WHERE s.id = $1',
            [subscriptionId]
        );
        if (!charge[0]) throw new Error('Expected billing option after resume.');
        const amount = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: charge[0].currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(charge[0].amount) / 100);
        await expect(article.getByTestId('resume-result')).toHaveText(
            `Te vamos a cobrar el ${formatMarketDate(chargeAt)}: ${amount}.`
        );
    });

    test('grace states the payment remedy and does not offer a plan-change control', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const { subscriptionId, authorizationId } = await active({ page });
        await driveToGrace({ world, subscriptionId, authorizationId });
        await page.reload();
        const article = articleFor(page, subscriptionId);
        await expect(article.getByTestId('my-subscription-plan-change-grace')).toHaveText(
            'No podés cambiar de plan mientras tengas un pago pendiente. Regularizalo cambiando la tarjeta con la que pagás en Mercado Pago (el cobro se reintenta en el momento) y, con la suscripción al día, vas a poder hacer cambios en tu plan.'
        );
        await expect(article.locator('[data-testid^="plan-change-"] button')).toHaveText([]);
    });

    test('an open checkout explains what to finish or cancel before another plan change', async ({
        page
    }) => {
        const { subscriptionId, article } = await active({ page });
        await page.route(
            (url) => url.hostname === 'payments-fake.invalid',
            (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'text/html',
                    body: '<html><body>Fake checkout</body></html>'
                })
        );
        await article.getByRole('button', { name: 'Cambiar de plan' }).click();
        const optionId = await monthlyOptionForSlug('owner-premium');
        await article.locator(`li[data-billing-option-id="${optionId}"] button`).click();
        await article.getByRole('button', { name: 'Confirmar cambio' }).click();
        await page.waitForURL((url) => url.hostname === 'payments-fake.invalid');
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const updated = articleFor(page, subscriptionId);
        await expect(updated.getByTestId('my-subscription-plan-change-checkout')).toHaveText(
            'Terminá o cancelá el checkout que tenés abierto para cambiar de plan.'
        );
        await expect(updated.locator('[data-testid^="plan-change-"] button')).toHaveText([]);
    });

    test('a live promo warns that the discount and code are lost on plan change', async ({
        page
    }) => {
        const { subscriptionId, article, admin } = await active({ page });
        const code = `B8B${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        const created = await fetch(`${API_URL}/api/v1/admin/billing-promo-codes`, {
            method: 'POST',
            headers: { cookie: admin.sessionCookie, 'content-type': 'application/json' },
            body: JSON.stringify({
                code,
                effect: {
                    kind: 'DISCOUNT',
                    discountKind: 'PERCENTAGE',
                    value: 20,
                    durationKind: 'N_CHARGES',
                    durationCharges: 3
                },
                allVerticals: true,
                verticals: null,
                totalQuota: null,
                validUntil: '2030-12-31T00:00:00.000Z',
                stackable: false,
                usableWithAnotherActive: false
            })
        });
        expect(created.status).toBe(201);
        const promo = await execSQL<{ id: string }>('SELECT id FROM promo_code WHERE code = $1', [
            code
        ]);
        if (!promo[0]) throw new Error('Expected promo created by admin route.');
        promoIds.push(promo[0].id);
        await article.getByLabel('Código promocional').fill(code);
        await article.getByRole('button', { name: 'Canjear código' }).click();
        await expect(article.getByTestId('promo-redeem-notice')).toBeVisible();
        await page.reload();
        const updated = articleFor(page, subscriptionId);
        await updated.getByRole('button', { name: 'Cambiar de plan' }).click();
        const optionId = await monthlyOptionForSlug('owner-premium');
        await updated.locator(`li[data-billing-option-id="${optionId}"] button`).click();
        await expect(updated.getByTestId('plan-change-promo-warning')).toHaveText(
            'Si cambiás de plan, perdés tu promo: el importe nuevo no lleva el descuento y el código no se puede volver a canjear.'
        );
    });

    test('fila 5 (traspaso HOS-1580 → HOS-1592): live courtesy warns of the loss before customer pause', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        const card = await createApiCardSubscription({
            user: subscriber.user,
            billingOptionId: await monthlyOptionForSlug('owner-basico')
        });
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: card.subscriptionId
        });
        const granted = await page.request.post(
            `${API_URL}/api/v1/admin/billing-subscription/${card.subscriptionId}/courtesy/grant`,
            {
                headers: { cookie: subscriber.admin.sessionCookie },
                data: {
                    expectedStatus: 'ACTIVE',
                    months: 1,
                    reason: 'TEST:B8b:25 row 5 transfer',
                    confirmed: true
                }
            }
        );
        expect(granted.status()).toBe(200);
        const outcome = (await granted.json()) as {
            readonly data: { readonly outcome: string };
        };
        expect(outcome.data.outcome).toBe('GRANTED');
        const [courtesy] = await execSQL<{ ends_at: Date }>(
            'SELECT ends_at FROM courtesy_grant WHERE beneficiary_user_id = $1',
            [subscriber.user.id]
        );
        if (!courtesy) throw new Error('Expected courtesy granted by admin route.');
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = articleFor(page, card.subscriptionId);
        await expect(article).toBeVisible();
        await article.getByRole('button', { name: 'Pausar suscripción' }).click();
        await expect(article.getByTestId('pause-confirm-simple')).toHaveCount(0);
        await expect(article.getByTestId('pause-confirm-courtesy-forfeit')).toBeVisible();
        await expect(article.getByTestId('pause-courtesy-forfeit')).toContainText(
            formatMarketDate(courtesy.ends_at)
        );
        await expect(article.getByTestId('pause-confirmation')).toContainText(
            'perdés el tiempo que quedaba'
        );
        await expect(
            article.getByTestId('pause-confirmation').getByRole('button', {
                name: 'Confirmar pausa'
            })
        ).toBeVisible();
    });

    test('a provider reread without authorized status explains the last charge remedy', async ({
        page
    }) => {
        if (!world) throw new Error('Expected case-local fake provider.');
        const { authorizationId, article } = await active({ page });
        await world.fakeServer.provider.pause({ authorizationId });
        await article.getByRole('button', { name: 'Cambiar de plan' }).click();
        const optionId = await monthlyOptionForSlug('owner-premium');
        await article.locator(`li[data-billing-option-id="${optionId}"] button`).click();
        await article.getByRole('button', { name: 'Confirmar cambio' }).click();
        await expect(article.getByTestId('plan-change-result')).toHaveText(
            'Tu último cobro no entró. Actualizá tu tarjeta en Mercado Pago para poder cambiar de plan.'
        );
    });
});
