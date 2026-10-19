import { expect, type Page, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    monthlyOptionForSlug,
    seedActivePlanHolder
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';
const AU =
    'Todavía no se puede cambiar de plan: date de baja al fin del período y volvé a suscribirte.';
const card = (page: Page, versionId: string) =>
    page.locator(`[data-testid="pricing-card-cta"][data-plan-version-id="${versionId}"]`);
const versionFor = async (slug: string): Promise<string> => {
    const rows = await execSQL<{ id: string }>(
        `SELECT plan_version.id FROM plan_version JOIN plan ON plan.id = plan_version.plan_id WHERE plan.slug = $1 AND plan_version.current = true`,
        [slug]
    );
    if (!rows[0]) throw new Error(`Missing current plan version for ${slug}`);
    return rows[0].id;
};
const owner = async () => {
    const user = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
    await markProfileCompleted({ userId: user.id });
    return user;
};

// The user's situation is resolved once by the API and shared by every card.
test.describe('TEST:B13a:10 TEST:B13a:11 pricing per vertical @p0 @billing', () => {
    test.describe.configure({ mode: 'serial' });
    const userIds: string[] = [];
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
        await monthlyOptionForSlug('owner-basico');
        await monthlyOptionForSlug('owner-premium');
        await monthlyOptionForSlug('tourist-vip');
    });
    test.afterAll(async () => {
        if (userIds.length) await cleanupTestUsers(getDbPool(), userIds);
    });

    test('TEST:B13a:10 PRE_TRIAL publishes; a consumed trial gets the card checkout', async ({
        page
    }) => {
        const fresh = await owner();
        userIds.push(fresh.id);
        await attachSession(page, fresh.sessionCookie);
        const situationRead = page.waitForResponse((response) =>
            response
                .url()
                .includes('/api/v1/protected/billing-subscription/pricing-situation/accommodation')
        );
        await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
        await expect(page.getByTestId('subscribe-button')).toHaveAttribute(
            'data-destination',
            'publish'
        );
        await situationRead;
        const basicId = await versionFor('owner-basico');
        await expect(card(page, basicId)).toHaveAttribute('data-loaded', 'true');
        await expect(card(page, basicId)).toHaveAttribute('data-kind', 'none');

        const spent = await owner();
        userIds.push(spent.id);
        await createAccommodation({ ownerId: spent.id, slugPrefix: 'pricing-consumed' });
        await execSQL(
            "UPDATE trial SET status = 'TRIAL_EXPIRED', started_at = NOW() - INTERVAL '31 days', ends_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND vertical = 'accommodation'",
            [spent.id]
        );
        await page.context().clearCookies();
        await attachSession(page, spent.sessionCookie);
        await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
        const basic = card(page, basicId);
        await expect(basic).toHaveAttribute('data-kind', 'checkout');
        const option = await monthlyOptionForSlug('owner-basico');
        const monthlyLink = basic.locator(`a[href$="/es/suscriptores/checkout/?opcion=${option}"]`);
        await expect(monthlyLink).toBeVisible();
        await monthlyLink.click();
        await expect(page.getByTestId('signup-checkout')).toBeVisible();
    });

    test('TEST:B13a:11 tourist pricing keeps Gratis first and sells VIP to an uncovered person', async ({
        page
    }) => {
        await page.goto(`${WEB_URL}/es/planes/turistas/precios/`);
        expect((await page.request.get(`${WEB_URL}/es/planes/turistas/precios/`)).status()).toBe(
            200
        );
        const articles = page.locator('#pricing-cards-grid [data-pricing-card]');
        await expect(articles.nth(0)).toContainText('Gratis');
        await expect(articles.nth(1)).toContainText(/VIP/i);
        const vip = card(page, await versionFor('tourist-vip'));
        await expect(vip).toHaveAttribute('data-kind', 'checkout');
        await expect(articles.nth(0).getByRole('link', { name: /suscribirme/i })).toHaveCount(0);
    });

    test('TEST:B13a:11 inherited tourist VIP is hidden until subscription cancellation', async ({
        page
    }) => {
        const user = await owner();
        userIds.push(user.id);
        const seeded = await seedActivePlanHolder({ userId: user.id, slug: 'owner-basico' });
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/planes/turistas/precios/`);
        const vip = card(page, await versionFor('tourist-vip'));
        await expect(vip).toHaveAttribute('data-kind', 'vipInherited');
        await expect(vip).toContainText('Tu plan ya incluye Turista VIP: no hace falta comprarlo.');
        await expect(vip.locator('a')).toHaveCount(0);
        await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
        const basic = card(page, await versionFor('owner-basico'));
        await expect(basic).toHaveAttribute('data-kind', 'current');
        await expect(basic).toContainText('Tu plan actual en alojamiento');
        await expect(basic).toContainText(AU);
        const premium = card(page, await versionFor('owner-premium'));
        await expect(premium).toHaveAttribute('data-kind', 'planChangeUnavailable');
        await expect(premium).toContainText(AU);
        await expect(premium.locator('a')).toHaveCount(0);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        await expect(
            page.locator(
                `article[data-testid="my-subscription"][data-subscription-id="${seeded.subscriptionId}"]`
            )
        ).toContainText('alojamiento');
        await page.goto(`${WEB_URL}/es/planes/turistas/precios/`);
        await execSQL(
            "UPDATE subscription SET status = 'CANCELLED', grace_started_at = NULL, grace_ends_at = NULL, updated_at = NOW() WHERE id = $1",
            [seeded.subscriptionId]
        );
        await page.reload();
        await expect(card(page, await versionFor('tourist-vip'))).toHaveAttribute(
            'data-kind',
            'checkout'
        );
    });

    test('TEST:B13a:11 active owner sees current card, unavailable change, and vertical in Mi Suscripción', async ({
        page
    }) => {
        const user = await owner();
        userIds.push(user.id);
        const seeded = await seedActivePlanHolder({ userId: user.id, slug: 'owner-basico' });
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
        const basic = card(page, await versionFor('owner-basico'));
        await expect(basic).toHaveAttribute('data-kind', 'current');
        await expect(basic).toContainText('Tu plan actual en alojamiento');
        await expect(basic).toContainText(AU);
        const premium = card(page, await versionFor('owner-premium'));
        await expect(premium).toHaveAttribute('data-kind', 'planChangeUnavailable');
        await expect(premium).toContainText(AU);
        await expect(premium.locator('a')).toHaveCount(0);
        await page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
        await expect(
            page.locator(
                `article[data-testid="my-subscription"][data-subscription-id="${seeded.subscriptionId}"]`
            )
        ).toContainText('alojamiento');
    });

    test('TEST:B13a:11 running trial permits checkout', async ({ page }) => {
        const user = await owner();
        userIds.push(user.id);
        await createAccommodation({ ownerId: user.id, slugPrefix: 'pricing-running-trial' });
        await attachSession(page, user.sessionCookie);
        await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
        await expect(card(page, await versionFor('owner-basico'))).toHaveAttribute(
            'data-kind',
            'checkout'
        );
    });
});

test.describe('TEST:B13a:11 retired plan @billing', () => {
    test('omits the retired version while another sellable card remains', async ({ page }) => {
        await seedCookieConsent(page);
        await monthlyOptionForSlug('owner-basico');
        await monthlyOptionForSlug('owner-premium');
        await monthlyOptionForSlug('tourist-vip');
        const premiumId = await versionFor('owner-premium');
        try {
            await execSQL('UPDATE plan_version SET current = false WHERE id = $1', [premiumId]);
            await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
            await expect(
                page
                    .locator('#pricing-cards-grid [data-pricing-card]')
                    .filter({ hasText: 'Básico' })
            ).toHaveCount(1);
            await expect(page.locator('#pricing-cards-grid [data-pricing-card]')).toHaveCount(1);
        } finally {
            await execSQL('UPDATE plan_version SET current = true WHERE id = $1', [premiumId]);
        }
    });
});
