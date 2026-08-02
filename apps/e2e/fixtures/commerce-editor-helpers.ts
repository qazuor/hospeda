/**
 * @file commerce-editor-helpers.ts
 * @description Shared helpers for driving the commerce owner editor island
 * (`CommerceListingEditor.client.tsx`) from Playwright.
 *
 * Added in HOS-371, when `richDescription` became a TipTap editor and the
 * specs' previous assumptions stopped holding:
 *
 * 1. **Hydration gate.** The specs waited on `#ce-type` — a `<select>` that is
 *    part of the island's SSR output, so it is visible (and `toBeEditable()`)
 *    the moment the HTML lands, BEFORE React has attached a single handler.
 *    That was always a false gate; it only stayed green because hydration
 *    happened to win the race. Loading TipTap made the island's bundle
 *    materially heavier, hydration lost the race, and `setReactInputValue`
 *    started writing into a DOM node React was not yet listening to — the form
 *    never went dirty and Save stayed disabled. Waiting on something that
 *    CANNOT exist before hydration fixes the class of bug, not just this
 *    instance.
 * 2. **Rich text input.** `#ce-richDescription` was a `<textarea>`; it is now a
 *    contenteditable driven by TipTap, so `setReactInputValue` no longer
 *    applies to it.
 */

import { expect, type Locator, type Page } from '@playwright/test';

/** Accessible name of the rich description field, as rendered in Spanish. */
const RICH_DESCRIPTION_LABEL = 'Descripción ampliada';

/**
 * Waits until the commerce editor island has actually hydrated.
 *
 * Gates on TipTap's editable surface: `.ProseMirror` is created by TipTap at
 * runtime and is absent from the SSR HTML, so its presence proves React
 * hydrated and mounted the island's children — unlike any server-rendered
 * element, which is present long before that.
 *
 * @param params.page - The Playwright page sitting on the editor route
 * @param params.timeout - Milliseconds to wait (default 20s; the island ships
 *   TipTap, so it is heavier than a plain form)
 */
export async function waitForCommerceEditorHydration({
    page,
    timeout = 20_000
}: {
    readonly page: Page;
    readonly timeout?: number;
}): Promise<void> {
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout });
    // The rich text surface is the LAST child to mount, but the island's own
    // handlers attach before it — asserting a server-rendered control is
    // interactive here is therefore safe and keeps the failure message
    // pointed at the form rather than at the editor.
    await expect(page.locator('#ce-type')).toBeEditable({ timeout: 5_000 });
}

/**
 * Returns the rich description editing surface (TipTap's `role="textbox"`).
 *
 * @param params.page - The Playwright page sitting on the editor route
 */
export function richDescriptionEditor({ page }: { readonly page: Page }): Locator {
    return page.getByRole('textbox', { name: RICH_DESCRIPTION_LABEL });
}

/**
 * Replaces the rich description content and lets the change reach React.
 *
 * Drives TipTap's own command rather than typing: the editor owns a ProseMirror
 * document, so writing to the DOM node (as `setReactInputValue` does for native
 * inputs) would be overwritten on the next transaction. `setContent` without
 * `emitUpdate: false` dispatches a real transaction, which is what fires the
 * component's `onUpdate` → `onChange` → `markDirty` chain.
 *
 * @param params.page - The Playwright page sitting on the editor route
 * @param params.value - Plain text / Markdown to set as the whole document
 */
export async function setRichDescription({
    page,
    value
}: {
    readonly page: Page;
    readonly value: string;
}): Promise<void> {
    const editor = richDescriptionEditor({ page });
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.evaluate((element, content) => {
        const { editor: instance } = element as unknown as {
            editor?: { commands: { setContent: (value: string) => boolean } };
        };
        if (!instance) {
            throw new Error(
                'TipTap instance missing on the editable element — the island did not hydrate'
            );
        }
        instance.commands.setContent(content);
    }, value);
}
