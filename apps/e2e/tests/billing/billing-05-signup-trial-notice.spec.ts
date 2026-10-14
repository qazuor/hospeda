import { expect, test } from '@playwright/test';
import { VerticalEnum } from '@repo/schemas';
import { createUser } from '../../fixtures/api-helpers.ts';
import { getDbPool } from '../../fixtures/db-helpers.ts';
import { ensureListingOwnerTrial } from '../../fixtures/listing-owner-trial.ts';
import {
    attachSession,
    monthlyOptionForSlug,
    openSignupCheckout
} from '../../fixtures/signup-checkout.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

test.describe('TEST:B13a:21 AC:B13a:5 the signup checkout says both trial halves @billing', () => {
    test.describe.configure({ mode: 'serial' });

    const usersToCleanup: string[] = [];
    let billingOptionId = '';
    let personWithTrial: Awaited<ReturnType<typeof createUser>>;
    let personWithoutTrial: Awaited<ReturnType<typeof createUser>>;

    test.beforeAll(async () => {
        billingOptionId = await monthlyOptionForSlug('owner-basico');
        personWithTrial = await createUser();
        usersToCleanup.push(personWithTrial.id);
        await ensureListingOwnerTrial(getDbPool(), personWithTrial.id, VerticalEnum.ACCOMMODATION);
        personWithoutTrial = await createUser();
        usersToCleanup.push(personWithoutTrial.id);
    });

    test.afterAll(async () => {
        if (usersToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...usersToCleanup]);
            usersToCleanup.length = 0;
        }
    });

    test('shows the running trial consequences before confirmation', async ({ page }) => {
        await attachSession(page, personWithTrial.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId });

        const notice = page.getByTestId('signup-checkout-trial-notice');
        await expect(notice).toBeVisible();
        await expect(notice).toHaveAttribute('data-kind', 'RUNNING');
        await expect(notice).toContainText(/\d+ días/);
        await expect(notice).toContainText('tu prueba termina y perdés esos días');
        await expect(notice).toContainText('seguís en tu prueba con esos días');
        await expect(notice).toContainText(/hasta el .+/);
        const confirm = page.getByTestId('signup-checkout-confirm');
        await expect(confirm).toBeVisible();
        expect(
            await notice.evaluate((element) => {
                const button = document.querySelector('[data-testid="signup-checkout-confirm"]');
                return Boolean(
                    button &&
                        element.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
                );
            })
        ).toBe(true);
    });

    test('shows no trial notice for a person without a trial', async ({ page }) => {
        await attachSession(page, personWithoutTrial.sessionCookie);
        await openSignupCheckout({ page, webUrl: WEB_URL, billingOptionId });

        await expect(page.getByTestId('signup-checkout-trial-notice')).toHaveCount(0);
    });
});
