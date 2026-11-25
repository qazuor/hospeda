import { expect, type Page } from '@playwright/test';

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
