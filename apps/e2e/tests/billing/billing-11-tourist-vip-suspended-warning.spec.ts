import { expect, test } from '@playwright/test';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import {
    attachSession,
    openSignupCheckout,
    seedActivePlanHolder,
    seedSuspendedPlanHolder,
    touristVipMonthlyOptionId
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const userIds: string[] = [];

test.describe('TEST:B13a:17 AC:B13a:16 suspended Tourist VIP checkout warning @p0 @billing', () => {
    test.afterAll(async () => cleanupTestUsers(getDbPool(), userIds));

    test('warns on return cancellation and marks a non-inheriting active plan unaffected', async ({
        page
    }) => {
        const suspended = await createUser({}, { apiBaseUrl: API_URL });
        const active = await createUser({}, { apiBaseUrl: API_URL });
        userIds.push(suspended.id, active.id);
        await markProfileCompleted({ userId: suspended.id });
        await markProfileCompleted({ userId: active.id });
        await seedSuspendedPlanHolder({ userId: suspended.id, slug: 'owner-basico' });
        await seedActivePlanHolder({ userId: active.id, slug: 'partner-silver' });
        const optionId = await touristVipMonthlyOptionId();

        await seedCookieConsent(page);
        await attachSession(page, suspended.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        const suspendedCheckout = page.locator('section[data-testid="signup-checkout"]');
        await expect(suspendedCheckout).toHaveAttribute('data-tourist-vip', 'CANCELLED_ON_RETURN');
        const notice = suspendedCheckout.getByTestId('signup-checkout-tourist-vip-notice');
        await expect(notice).toContainText('se cancela en el momento');
        await expect(notice).toContainText('no se reembolsa');

        await attachSession(page, active.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId: optionId });
        const activeCheckout = page.locator('section[data-testid="signup-checkout"]');
        await expect(activeCheckout).toHaveAttribute('data-tourist-vip', 'NOT_AFFECTED');
    });
});
