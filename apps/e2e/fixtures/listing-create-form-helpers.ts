import { expect, type Page } from '@playwright/test';

/** Fills only the four fields shared by venue and experience draft creation. */
export async function fillListingCreateForm({
    page,
    name,
    type,
    summary,
    destinationId
}: {
    readonly page: Page;
    readonly name: string;
    readonly type: string;
    readonly summary: string;
    readonly destinationId: string;
}): Promise<void> {
    await waitForListingCreateFormHydration({ page });
    await page.locator('#cc-name').fill(name);
    await page.locator('#cc-type').selectOption(type);
    await page.locator('#cc-summary').fill(summary);
    await page.locator('#cc-destinationId').selectOption(destinationId);
    await expect(page.locator('#cc-description, #cc-priceFrom, #cc-priceUnit')).toHaveCount(0);
}

/**
 * Waits until the `ListingCreateForm` island has attached its React handlers.
 *
 * The create form's controls are server-rendered, so a `load` event does not
 * mean React is listening: a `selectOption` sent before hydration changes the
 * native select, React then hydrates with its own empty state, and anything
 * held in React state is lost (HOS-2372).
 * The form sets `data-hydrated="true"` from a mount effect, absent from SSR.
 *
 * @param params.page - The Playwright page sitting on a create form route
 * @param params.timeout - Milliseconds to wait (default 20s)
 */
export async function waitForListingCreateFormHydration({
    page,
    timeout = 20_000
}: {
    readonly page: Page;
    readonly timeout?: number;
}): Promise<void> {
    await expect(
        page
            .locator('[data-kit-section] form[data-hydrated="true"]')
            .filter({ has: page.locator('#cc-name') }),
        'The listing create form island never hydrated.'
    ).toBeVisible({ timeout });
}
