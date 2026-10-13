import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { retireAccommodationPlanVersions } from '../../fixtures/subscribe-button.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

async function attachSession(
    page: import('@playwright/test').Page,
    sessionCookie: string
): Promise<void> {
    const cookies = sessionCookie.split('; ').flatMap((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return name ? [{ name, value: valueParts.join('='), domain: 'localhost', path: '/' }] : [];
    });
    await page.context().addCookies(cookies);
}

test.describe('Subscribe button destinations @verticals @billing', () => {
    test.beforeEach(async ({ page }) => {
        // The consent backdrop intercepts the click on the pricing subscribe link.
        await seedCookieConsent(page);
    });

    test('TEST:V8a:3 sends a PRE_TRIAL owner to publish and a spent-trial owner to checkout', async ({
        page
    }) => {
        const preTrial = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        const consumed = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        try {
            await markProfileCompleted({ userId: preTrial.id });
            await markProfileCompleted({ userId: consumed.id });
            const listing = await createAccommodation({
                ownerId: consumed.id,
                slugPrefix: 'subscribe-consumed'
            });
            // `ck_trial_clock_order` requires ends_at >= started_at, so the clock
            // moves back as a whole instead of only its end.
            await execSQL(
                "UPDATE trial SET status = 'TRIAL_EXPIRED', started_at = NOW() - INTERVAL '31 days', ends_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND vertical = 'accommodation'",
                [consumed.id]
            );
            const [spentTrial] = await execSQL<{ status: string; ended: boolean }>(
                "SELECT status, ends_at < NOW() AS ended FROM trial WHERE user_id = $1 AND vertical = 'accommodation'",
                [consumed.id]
            );
            expect(spentTrial).toEqual({ status: 'TRIAL_EXPIRED', ended: true });

            await attachSession(page, preTrial.sessionCookie);
            await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
            const subscribe = page.getByTestId('subscribe-button');
            await expect(subscribe).toHaveAttribute('data-destination', 'publish');
            await subscribe.getByRole('link').click();
            await expect(page).toHaveURL(/\/es\/publicar\/$/);
            await expect(page.getByText(/prueba gratis.*arranca.*public/i)).toBeVisible();

            await page.context().clearCookies();
            await attachSession(page, consumed.sessionCookie);
            await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
            const checkout = page.getByTestId('subscribe-button');
            await expect(checkout).toHaveAttribute('data-destination', 'checkout');
            await expect(checkout.locator('a')).toHaveCount(0);
            expect(listing.ownerId).toBe(consumed.id);
        } finally {
            await cleanupTestUsers(getDbPool(), [preTrial.id, consumed.id]);
        }
    });

    test('TEST:V8a:4 shows no plans in pricing and after publish is rejected', async ({ page }) => {
        const owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        let restoreCatalog: (() => Promise<void>) | null = null;
        try {
            await markProfileCompleted({ userId: owner.id });
            const listing = await createAccommodation({
                ownerId: owner.id,
                slugPrefix: 'subscribe-no-plans',
                // `trg_trial_no_delete` forbids deleting a trial, so the owner is
                // created without one instead of having it removed afterwards.
                withTrial: false
            });
            // Publishing requires a main image (a real owner uploads it in the editor);
            // without it the server answers the completeness 400 before the catalog check.
            await execSQL(
                `INSERT INTO accommodation_media
                     (accommodation_id, url, state, is_featured, sort_order, moderation_state)
                 VALUES ($1, 'https://cdn.example.test/e2e-no-plans-main.jpg', 'visible', true, 0, 'APPROVED')`,
                [listing.id]
            );
            restoreCatalog = await retireAccommodationPlanVersions(getDbPool());
            const trialRows = await execSQL('SELECT 1 FROM trial WHERE user_id = $1', [owner.id]);
            expect(trialRows).toHaveLength(0);

            await attachSession(page, owner.sessionCookie);
            await page.goto(`${WEB_URL}/es/planes/anfitriones/precios/`);
            const noPlans = page.getByTestId('subscribe-button');
            await expect(noPlans).toHaveAttribute('data-destination', 'no-plans');
            await expect(noPlans).toContainText(/esta vertical no tiene planes disponibles/i);
            await expect(noPlans.locator('a, button')).toHaveCount(0);
            await expect(noPlans).not.toContainText(/suscribite/i);

            const publishResponse = await page.request.post(
                `${API_URL}/api/v1/protected/accommodations/${listing.id}/publish`,
                {
                    headers: { cookie: owner.sessionCookie }
                }
            );
            expect(publishResponse.status()).toBe(403);
            await expect(publishResponse.json()).resolves.toMatchObject({
                error: { message: 'no_plans_available' }
            });
            const [afterPublish] = await execSQL<{ publication_status: string }>(
                'SELECT publication_status FROM accommodations WHERE id = $1',
                [listing.id]
            );
            expect(afterPublish?.publication_status).toBe('DRAFT');
            const trialRowsAfter = await execSQL('SELECT 1 FROM trial WHERE user_id = $1', [
                owner.id
            ]);
            expect(trialRowsAfter).toHaveLength(0);
            // HOS-1668 (H4): the card reads the destination up front, so it shows
            // the no-plans notice from the start and offers nothing to press.
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            const cardNoPlans = page.getByTestId('publish-no-plans');
            await expect(cardNoPlans).toContainText(/esta vertical no tiene planes disponibles/i);
            await expect(cardNoPlans.locator('a, button')).toHaveCount(0);
            await expect(cardNoPlans).not.toContainText(/suscribite/i);
            await expect(
                page
                    .getByRole('list', { name: 'Mis propiedades' })
                    .getByRole('button', { name: 'Publicar', exact: true })
            ).toHaveCount(0);
        } finally {
            if (restoreCatalog) await restoreCatalog();
            await cleanupTestUsers(getDbPool(), [owner.id]);
        }
    });
});
