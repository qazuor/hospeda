import { expect, test } from '@playwright/test';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    openSignupCheckout,
    seedInheritingPlanHolder,
    touristVipMonthlyOptionId
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const userIds: string[] = [];

test.describe('TEST:B3:30 AC:B3:28 the inherited Tourist VIP checkout shows the rejection and never authorizes @p0 @billing', () => {
    test.afterAll(async () => {
        await cleanupTestUsers(getDbPool(), userIds);
    });

    test('rejects a Tourist VIP checkout while the current plan inherits it', async ({ page }) => {
        const user = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(user.id);
        await markProfileCompleted({ userId: user.id });
        await seedInheritingPlanHolder({ userId: user.id });
        const optionId = await touristVipMonthlyOptionId();

        await seedCookieConsent(page);
        await attachSession(page, user.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        await expect(page).toHaveURL(
            new RegExp(`/es/suscriptores/checkout/\\?opcion=${optionId}$`)
        );
        const pageUrl = page.url();
        await page.getByTestId('signup-checkout-confirm').click();

        const rejection = page.getByTestId('signup-checkout-rejection');
        await expect(rejection).toBeVisible();
        await expect(rejection).toHaveAttribute('data-reason', 'TOURIST_VIP_INHERITED');
        await expect(rejection).toContainText(
            'Tu plan actual ya incluye los beneficios de Turista VIP'
        );
        await expect(page.getByTestId('signup-checkout-resume-link')).toHaveCount(0);
        await expect(page.getByTestId('signup-checkout-confirm')).toHaveCount(0);
        await expect(page.getByTestId('signup-checkout-retry')).toHaveCount(0);
        expect(page.url()).toBe(pageUrl);

        const rows = await execSQL<{ id: string }>(
            `SELECT id FROM subscription WHERE user_id = $1 AND vertical = 'tourist'`,
            [user.id]
        );
        expect(rows).toEqual([]);
        const providerLinks = await execSQL<{ id: string }>(
            `SELECT provider_link.id
               FROM provider_link
               JOIN subscription ON subscription.id = provider_link.subscription_id
              WHERE subscription.user_id = $1 AND subscription.vertical = 'tourist'`,
            [user.id]
        );
        expect(providerLinks).toEqual([]);
    });
});
