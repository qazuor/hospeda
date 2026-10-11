import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
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
            await execSQL(
                "UPDATE trial SET status = 'TRIAL_EXPIRED', ends_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND vertical = 'accommodation'",
                [consumed.id]
            );

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
                slugPrefix: 'subscribe-no-plans'
            });
            restoreCatalog = await retireAccommodationPlanVersions(getDbPool());
            await execSQL('DELETE FROM trial WHERE user_id = $1 AND vertical = $2', [
                owner.id,
                'accommodation'
            ]);

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
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            await page
                .getByRole('button', { name: /publicar/i })
                .first()
                .click();
            await page.getByRole('button', { name: /sí, publicar/i }).click();
            await expect(page.getByTestId('publish-no-plans')).toContainText(
                /esta vertical no tiene planes disponibles/i
            );
        } finally {
            if (restoreCatalog) await restoreCatalog();
            await cleanupTestUsers(getDbPool(), [owner.id]);
        }
    });
});
