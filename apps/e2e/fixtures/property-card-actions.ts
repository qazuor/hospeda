/**
 * @file property-card-actions.ts
 * @description Drives the secondary actions of a «Mis propiedades» card.
 *
 * Since HOS-2483 a property card shows ONE primary action and moves the rest
 * (Despublicar, Eliminar, …) into the kit «Más acciones para <nombre>» menu.
 * Choosing Despublicar or Eliminar opens a kit `alertdialog` that mounts the
 * same UnpublishButton / DeleteButton confirmation step the card used to show
 * inline, so every testid of that step (trial / recurring add-on notes, the
 * add-ons a delete loses, «Cancelar») now lives inside the dialog.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Opens a card's «Más acciones» menu, picks `action` and returns the
 * confirmation dialog it opens.
 *
 * @param params.page - The page on `/mi-cuenta/propiedades/`
 * @param params.card - The card (list item) of the listing
 * @param params.action - The menu entry to choose («Despublicar» or «Eliminar»)
 * @returns The open confirmation dialog (`role="alertdialog"`, named after the action)
 */
export async function openPropertyCardConfirm({
    page,
    card,
    action
}: {
    readonly page: Page;
    readonly card: Locator;
    readonly action: string;
}): Promise<Locator> {
    await card.getByRole('button', { name: /^más acciones para /i }).click();
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: action, exact: true });
    await expect(dialog).toBeVisible();
    return dialog;
}
