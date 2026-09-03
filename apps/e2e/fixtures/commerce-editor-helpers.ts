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
 *
 * HOS-1080 split the editor into one page per section, which broke the gate
 * from (1) and made the URL builder below necessary — see each of their docs.
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
 * The commerce editor's section routes (HOS-1080).
 *
 * The URL segments, in the app's own Spanish vocabulary. `hub` is the landing
 * page at `…/editar/`: it lists the sections and renders NO form, so nothing
 * that fills a field or presses Save can start there.
 *
 * `apps/web/test/pages/commerce-editor-routes.test.ts` reads this union and
 * fails if a slug here has no route file — this file cannot import the web
 * app's registry (the E2E package resolves `@repo/*` to built dist and knows
 * nothing about `apps/web/src`), so the drift is caught from the other side
 * instead of being left to a CI run of the browser suite.
 */
export type CommerceEditorSection =
    | 'hub'
    | 'datos'
    | 'punto-de-encuentro'
    | 'datos-practicos'
    | 'horarios'
    | 'precio'
    | 'servicios'
    | 'fotos'
    | 'contacto'
    // HOS-895 — gastronomy only, the mirror of the two experience-only slugs
    // above. Opening it on an experience listing redirects to the hub.
    | 'carta'
    // HOS-1041 — gastronomy only too, and immediately after the carta because
    // that is where the registry puts it: the carta is the year's menu, this is
    // today's. Listed here for the reason this union exists at all — the E2E
    // package cannot import `apps/web`'s registry, so a section it cannot NAME
    // is a page no browser test can ever open.
    | 'menu-del-dia'
    | 'preguntas'
    | 'traducciones';

/**
 * Builds the URL of one commerce editor section.
 *
 * Always trailing-slashed: Astro runs with `trailingSlash: 'always'`, and a URL
 * without one answers a 404 PAGE rather than a redirect — which reads in a
 * failing spec as "the editor is broken", not "the path was wrong".
 *
 * @param params.webUrl - Base URL of the web app under test
 * @param params.vertical - `gastronomy` or `experience`
 * @param params.listingId - UUID of the listing being edited
 * @param params.section - Which section page to open
 * @param params.locale - UI locale segment (default `es`)
 */
export function commerceEditorUrl({
    webUrl,
    vertical,
    listingId,
    section,
    locale = 'es'
}: {
    readonly webUrl: string;
    readonly vertical: 'gastronomy' | 'experience';
    readonly listingId: string;
    readonly section: CommerceEditorSection;
    readonly locale?: string;
}): string {
    const base = `${webUrl}/${locale}/mi-cuenta/comercio/${vertical}/${listingId}/editar/`;
    return section === 'hub' ? base : `${base}${section}/`;
}

/**
 * Waits until the commerce editor island has actually hydrated.
 *
 * Gates on `data-hydrated`, which `CommerceListingEditor` sets on its `<form>`
 * from a mount effect. Nothing about it can be true before hydration: the SSR
 * HTML does not carry the attribute, and React runs child effects BEFORE parent
 * effects, so by the time the form has it every section component below has
 * finished mounting.
 *
 * WHY NOT `.ProseMirror` ANY MORE (HOS-1080). That was the right gate while the
 * editor was ONE page: TipTap creates `.ProseMirror` at runtime, so its presence
 * proved hydration, and the rich-text field was on the only page there was. With
 * one page per section the rich text lives on `datos` alone — on `contacto`,
 * `precio` and `traducciones` the element does not exist at all, so the gate
 * waited twenty seconds for something the page could never render. Six specs
 * died on exactly that.
 *
 * The fix is NOT to weaken the wait. This gate is the only thing standing
 * between these specs and the HOS-371 class of bug, where an edit lands on a
 * node React is not listening to, the form never goes dirty, and Save silently
 * sends nothing. A shorter timeout, an `if`, or a `waitForTimeout` would make
 * all six green and stop proving the page is alive.
 *
 * @param params.page - The Playwright page sitting on an editor SECTION route
 *   (not the hub — it renders no form and therefore no island)
 * @param params.timeout - Milliseconds to wait (default 20s; the `datos`
 *   section ships TipTap, so it is heavier than a plain form)
 */
export async function waitForCommerceEditorHydration({
    page,
    timeout = 20_000
}: {
    readonly page: Page;
    readonly timeout?: number;
}): Promise<void> {
    await expect(
        page.locator('form[data-hydrated="true"]'),
        'The commerce editor island never hydrated. If this page is the hub ' +
            '(…/editar/ with no section segment) it renders no form at all — open a ' +
            'section route instead, e.g. commerceEditorUrl({ …, section: "datos" }).'
    ).toBeVisible({ timeout });
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
