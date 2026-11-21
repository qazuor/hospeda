import { expect, type Locator } from '@playwright/test';

/**
 * Redeems a promo code through the `PromoCodeRedeem` island inside `scope`.
 *
 * The island is `client:visible` and its input is server-rendered, so a fill
 * sent before React attaches lands in the DOM while the component's `code`
 * state stays `''`; the click then submits `{"code":""}` and the API answers
 * 400 (HOS-2401). The island sets `data-hydrated="true"` from a mount effect,
 * absent from SSR, so waiting on it proves React owns the input before typing.
 *
 * @param params.scope - Locator containing exactly one promo redemption island
 * @param params.code - The promo code to type and submit
 * @returns The island locator, for asserting on its notice or error
 */
export async function redeemPromoCode({
    scope,
    code
}: {
    readonly scope: Locator;
    readonly code: string;
}): Promise<{ readonly island: Locator }> {
    const island = scope.getByTestId('promo-redeem');
    await island.scrollIntoViewIfNeeded();
    await expect(island, 'The promo redemption island never hydrated.').toHaveAttribute(
        'data-hydrated',
        'true'
    );
    await island.getByLabel('Código promocional').fill(code);
    await island.getByRole('button', { name: 'Canjear código' }).click();
    return { island };
}
