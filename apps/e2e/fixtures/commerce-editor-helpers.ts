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

/**
 * TipTap's editable surface.
 *
 * Deliberately NOT `getByRole('textbox', { name: 'Descripción ampliada' })`.
 * That name WAS ambiguous — `CommerceTranslationPanel` rendered a per-locale
 * textarea with the same visible label — and although the panel now qualifies
 * its labels with the active locale ("Descripción ampliada (ES)"), tying this
 * locator to display copy would make the suite break on the next wording or
 * i18n change. `.ProseMirror` is structural and unique: the panel uses plain
 * textareas, not TipTap.
 */
const RICH_DESCRIPTION_SELECTOR = '.ProseMirror';

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
    await expect(page.locator(RICH_DESCRIPTION_SELECTOR).first()).toBeVisible({ timeout });
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
    return page.locator(RICH_DESCRIPTION_SELECTOR).first();
}

/**
 * Replaces the rich description content and lets the change reach React.
 *
 * Drives TipTap's own command rather than typing: the editor owns a ProseMirror
 * document, so writing to the DOM node (as `setReactInputValue` does for native
 * inputs) would be overwritten on the next transaction. `setContent` without
 * `emitUpdate: false` dispatches a real transaction, which is what fires the
 * component's `onUpdate` → `onChange` → dirty-tracking chain.
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

/** What a save attempt resolved to: a real request, or the app refusing to send one. */
type SaveOutcome =
    | { readonly kind: 'patch'; readonly response: import('@playwright/test').Response }
    | { readonly kind: 'no-changes' };

/**
 * The editor's submit button.
 *
 * Matched anchored (`^guardar$`) rather than as a substring: the shared
 * `ActionBar` labels it exactly "Guardar", and a loose `/guardar/i` would also
 * match a future "Guardar y publicar" — silently retargeting every save in the
 * suite at a different control.
 *
 * @param params.page - The Playwright page sitting on the editor route
 */
export function commerceSaveButton({ page }: { readonly page: Page }): Locator {
    return page.locator('button[type="submit"]', { hasText: /^\s*guardar\s*$/i });
}

/**
 * Saves the editor and resolves with the resulting PATCH response.
 *
 * WHY THIS EXISTS. The specs used to assert `toBeEnabled()` on Save before
 * clicking, as a DIAGNOSTIC: the button was disabled while the form was clean,
 * so a failure there named the real root cause — React never registered the
 * input change, exactly the class of bug this file's header describes — instead
 * of surfacing as a cryptic click or response timeout.
 *
 * Moving the editor onto the shared `ActionBar` made Save permanently enabled
 * (HOS-190: it must always visibly do something), which removed that signal.
 * A clean form now answers with an info toast and sends nothing, so this races
 * the PATCH against that toast and fails loudly when the toast wins. That is
 * strictly more informative than the old assertion: it reports not just "the
 * form was not dirty" but that the app actively said so.
 *
 * @param params.page - The Playwright page sitting on the editor route
 * @param params.pathPattern - Matches the expected PATCH URL (e.g. `/\/protected\/gastronomies\//`)
 * @param params.timeout - Milliseconds to wait for the PATCH (default 15s)
 */
export async function saveCommerceEditor({
    page,
    pathPattern,
    timeout = 15_000
}: {
    readonly page: Page;
    readonly pathPattern: RegExp;
    readonly timeout?: number;
}): Promise<import('@playwright/test').Response> {
    const saveButton = commerceSaveButton({ page });
    await expect(saveButton).toBeVisible({ timeout: 10_000 });

    /*
     * Both waits are raced, so exactly one of them is guaranteed to time out on
     * every call. Each therefore has to SETTLE rather than reject: a rejection
     * nobody awaits (the loser of the race) surfaces as an unhandled rejection
     * and can take the whole worker down instead of failing this assertion.
     */
    const patch: Promise<SaveOutcome | null> = page
        .waitForResponse(
            (response) =>
                pathPattern.test(response.url()) && response.request().method() === 'PATCH',
            { timeout }
        )
        .then((response): SaveOutcome => ({ kind: 'patch', response }))
        .catch(() => null);

    // `addToast` renders info toasts as `role="status"`; only a clean form
    // produces this copy, so seeing it means the edit never reached React.
    const noChangesToast: Promise<SaveOutcome | null> = page
        .getByRole('status')
        .filter({ hasText: /no hay cambios para guardar/i })
        .first()
        .waitFor({ state: 'visible', timeout })
        .then((): SaveOutcome => ({ kind: 'no-changes' }))
        .catch(() => null);

    // `force` is kept from the original call sites: the click is actionable but
    // a sticky element intercepts the pointer non-deterministically under CI.
    await saveButton.click({ force: true });

    const outcome = await Promise.race([
        patch.then((result) => result ?? noChangesToast),
        noChangesToast.then((result) => result ?? patch)
    ]);

    if (outcome?.kind === 'no-changes') {
        throw new Error(
            'Save reported "no hay cambios para guardar" — the form was never dirty, so no PATCH ' +
                "was sent. The edit did not reach React state (see this file's header on hydration " +
                'and setReactInputValue), which is the bug to chase, not the missing response.'
        );
    }

    if (!outcome) {
        throw new Error(
            `Save produced neither a PATCH matching ${pathPattern} nor a "no hay cambios" toast ` +
                `within ${timeout}ms — the click did not reach the submit handler at all.`
        );
    }

    return outcome.response;
}
