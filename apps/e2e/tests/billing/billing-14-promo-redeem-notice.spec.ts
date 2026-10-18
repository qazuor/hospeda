import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    createApiCardSubscription,
    createSubscriber,
    type FakeWorld,
    WEB_URL
} from '../../fixtures/arrears-cycle.ts';
import { seedManualPendingSubscription } from '../../fixtures/billing-signup-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import {
    attachSession,
    type CatalogSlug,
    monthlyOptionForSlug
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ownedUserIds = new Set<string>();
const ownedPromoIds = new Set<string>();
const ownedSubscriptionIds = new Set<string>();
const ownedRedemptionIds = new Set<string>();

async function createPromo(options: {
    readonly code: string;
    readonly discountKind: 'PERCENTAGE' | 'FIXED';
    readonly value: number;
    readonly durationKind: 'N_CHARGES' | 'FIRST_CHARGE';
    readonly durationCharges: number | null;
}): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO promo_code (code, discount_kind, value, all_verticals, verticals, total_quota,
             valid_from, valid_until, stackable, usable_with_another_active, duration_kind, duration_charges)
         VALUES ($1, $2, $3, true, NULL, 20, now() - interval '1 day', now() + interval '30 days',
             false, false, $4, $5) RETURNING id`,
        [
            options.code,
            options.discountKind,
            options.value,
            options.durationKind,
            options.durationCharges
        ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`Could not seed promo code ${options.code}.`);
    ownedPromoIds.add(id);
    return id;
}

async function activeCardSubscription(
    fakeServer: FakeWorld['fakeServer'],
    slug: CatalogSlug = 'owner-basico'
): Promise<{ user: Awaited<ReturnType<typeof createSubscriber>>['user']; subscriptionId: string }> {
    const subscriber = await createSubscriber();
    ownedUserIds.add(subscriber.user.id);
    ownedUserIds.add(subscriber.admin.id);
    const billingOptionId = await monthlyOptionForSlug(slug);
    const subscription = await createApiCardSubscription({
        user: subscriber.user,
        billingOptionId
    });
    ownedSubscriptionIds.add(subscription.subscriptionId);
    await activateCardSubscription({ fakeServer, subscriptionId: subscription.subscriptionId });
    return { user: subscriber.user, subscriptionId: subscription.subscriptionId };
}

async function redeem(page: import('@playwright/test').Page, subscriptionId: string, code: string) {
    const article = page.locator(
        `article[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
    );
    await article.getByLabel('Código promocional').fill(code);
    await article.getByRole('button', { name: 'Canjear código' }).click();
    return { article, notice: article.getByTestId('promo-redeem-notice') };
}

test.describe('TEST:B9b:12 TEST:B9b:2 AC:B9b:12 AC:B9b:2 promo redemption notice in Mi Suscripción @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let nCode = '';
    let firstCode = '';
    let floorCode = '';

    test.beforeAll(async () => {
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: randomUUID() }),
            clock
        });
        const { startE2eMailCapture } = await import('../../fixtures/mail-capture-server.ts');
        world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        nCode = `N${randomUUID().replaceAll('-', '').slice(0, 15).toUpperCase()}`;
        firstCode = `FIRST${randomUUID().replaceAll('-', '').slice(0, 11).toUpperCase()}`;
        floorCode = `FLOOR${randomUUID().replaceAll('-', '').slice(0, 11).toUpperCase()}`;
        await createPromo({
            code: nCode,
            discountKind: 'PERCENTAGE',
            value: 20,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        });
        await createPromo({
            code: firstCode,
            discountKind: 'PERCENTAGE',
            value: 20,
            durationKind: 'FIRST_CHARGE',
            durationCharges: null
        });
        await createPromo({
            code: floorCode,
            discountKind: 'FIXED',
            value: 248600,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        });
    });

    test.afterAll(async () => {
        if (ownedRedemptionIds.size)
            await execSQL('DELETE FROM promo_redemption WHERE id = ANY($1::uuid[])', [
                [...ownedRedemptionIds]
            ]);
        if (ownedPromoIds.size)
            await execSQL('DELETE FROM promo_code WHERE id = ANY($1::uuid[])', [
                [...ownedPromoIds]
            ]);
        if (ownedSubscriptionIds.size)
            await execSQL('DELETE FROM provider_link WHERE subscription_id = ANY($1::uuid[])', [
                [...ownedSubscriptionIds]
            ]);
        if (ownedSubscriptionIds.size)
            await execSQL('DELETE FROM subscription WHERE id = ANY($1::uuid[])', [
                [...ownedSubscriptionIds]
            ]);
        if (ownedUserIds.size) await cleanupTestUsers(getDbPool(), [...ownedUserIds]);
        await world?.mailCapture.close().catch(() => undefined);
        await world?.fakeServer.close().catch(() => undefined);
    });

    test('shows the N-charge terms and records three remaining charges', async ({ page }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const { user, subscriptionId } = await activeCardSubscription(world.fakeServer);
        await seedCookieConsent(page);
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const { article, notice } = await redeem(page, subscriptionId, nCode);
        await expect(notice).toContainText('3 cobros');
        await expect(notice).toContainText('2.000,00');
        await expect(notice).toContainText('2.500,00');
        await expect(notice).toContainText('correo');
        await expect(notice).toContainText('Mercado Pago');
        const promo = await execSQL<{ id: string }>('SELECT id FROM promo_code WHERE code = $1', [
            nCode
        ]);
        const rows = await execSQL<{ id: string; remaining_charges: number }>(
            `SELECT id, remaining_charges FROM promo_redemption WHERE promo_code_id = $1 AND user_id = $2`,
            [promo[0]?.id, user.id]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]?.remaining_charges).toBe(3);
        ownedRedemptionIds.add(rows[0]!.id);
        await expect(article.getByTestId('promo-redeem')).toBeVisible();
    });

    test('states that a first-charge promotion ends', async ({ page }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const { user, subscriptionId } = await activeCardSubscription(world.fakeServer);
        await seedCookieConsent(page);
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const { notice } = await redeem(page, subscriptionId, firstCode);
        await expect(notice).toContainText('Tu próximo cobro');
        await expect(notice).toContainText('Después pagás');
        await expect(notice).toContainText('promo termina');
        const promo = await execSQL<{ id: string }>('SELECT id FROM promo_code WHERE code = $1', [
            firstCode
        ]);
        const rows = await execSQL<{ id: string }>(
            'SELECT id FROM promo_redemption WHERE promo_code_id = $1 AND user_id = $2',
            [promo[0]?.id, user.id]
        );
        if (rows[0]) ownedRedemptionIds.add(rows[0].id);
    });

    test('offers amount redemption only within the CARD article, not the MANUAL article', async ({
        page
    }) => {
        const subscriber = await createSubscriber();
        ownedUserIds.add(subscriber.user.id);
        ownedUserIds.add(subscriber.admin.id);
        const manualOptionId = await monthlyOptionForSlug('owner-basico');
        const manualAnchors = await execSQL<{ plan_version_id: string }>(
            'SELECT plan_version_id FROM billing_option WHERE id = $1',
            [manualOptionId]
        );
        const manualId = await seedManualPendingSubscription({
            userId: subscriber.user.id,
            planVersionId: manualAnchors[0]!.plan_version_id,
            billingOptionId: manualOptionId,
            windowEndsAt: new Date(Date.now() + 7 * 86400000)
        });
        ownedSubscriptionIds.add(manualId);
        await execSQL("UPDATE subscription SET status = 'ACTIVE' WHERE id = $1", [manualId]);
        const card = await activeCardSubscriptionForExistingUser(subscriber.user);
        await seedCookieConsent(page);
        await attachSession(page, subscriber.user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const manual = page.locator(
            `article[data-testid="my-subscription"][data-subscription-id="${manualId}"]`
        );
        const cardArticle = page.locator(
            `article[data-testid="my-subscription"][data-subscription-id="${card}"]`
        );
        await expect(manual.getByTestId('promo-redeem')).toHaveCount(0);
        await expect(cardArticle.getByTestId('promo-redeem')).toBeVisible();
    });

    test('rejects ARS 14 before any fake-provider amount mutation or redemption', async ({
        page
    }) => {
        if (!world) throw new Error('Expected fake provider world.');
        const { user, subscriptionId } = await activeCardSubscription(world.fakeServer);
        const links = await execSQL<{ provider_id: string }>(
            'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
            [subscriptionId]
        );
        const authorizationId = links[0]?.provider_id;
        if (!authorizationId) throw new Error('Expected provider authorization.');
        const requestCountBefore = world.fakeServer
            .requests()
            .filter(
                (request) =>
                    request.method === 'PUT' && request.path === `/preapproval/${authorizationId}`
            ).length;
        await seedCookieConsent(page);
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        const article = page.locator(
            `article[data-testid="my-subscription"][data-subscription-id="${subscriptionId}"]`
        );
        await article.getByLabel('Código promocional').fill(floorCode);
        await article.getByRole('button', { name: 'Canjear código' }).click();
        await expect(article.getByTestId('promo-redeem-error')).toHaveText(
            'este código deja el importe por debajo del mínimo que Mercado Pago permite cobrar'
        );
        const requestCountAfter = world.fakeServer
            .requests()
            .filter(
                (request) =>
                    request.method === 'PUT' && request.path === `/preapproval/${authorizationId}`
            ).length;
        expect(requestCountAfter).toBe(requestCountBefore);
        const promo = await execSQL<{ id: string }>('SELECT id FROM promo_code WHERE code = $1', [
            floorCode
        ]);
        const redemptions = await execSQL<{ id: string }>(
            'SELECT id FROM promo_redemption WHERE promo_code_id = $1 AND user_id = $2',
            [promo[0]?.id, user.id]
        );
        expect(redemptions).toHaveLength(0);
    });
});

async function activeCardSubscriptionForExistingUser(user: { id: string }): Promise<string> {
    const optionId = await monthlyOptionForSlug('partner-silver');
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class)
         SELECT $1, pv.vertical, pv.id, bo.id, 'CARD', 'ACTIVE', 'PRINCIPAL'
           FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id WHERE bo.id = $2 RETURNING id`,
        [user.id, optionId]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Expected active CARD subscription.');
    ownedSubscriptionIds.add(id);
    return id;
}
