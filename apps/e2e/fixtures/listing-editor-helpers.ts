/**
 * @file listing-editor-helpers.ts
 * @description Shared helpers for driving the venue or experience owner editor island
 * (`ListingEditor.client.tsx`) from Playwright.
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
 * That name WAS ambiguous — `ListingTranslationPanel` rendered a per-locale
 * textarea with the same visible label — and although the panel now qualifies
 * its labels with the active locale ("Descripción ampliada (ES)"), tying this
 * locator to display copy would make the suite break on the next wording or
 * i18n change. `.ProseMirror` is structural and unique: the panel uses plain
 * textareas, not TipTap.
 */
const RICH_DESCRIPTION_SELECTOR = '.ProseMirror';

/**
 * The listing editor's section routes (HOS-1080).
 *
 * The URL segments, in the app's own Spanish vocabulary. `hub` is the landing
 * page at `…/editar/`: it lists the sections and renders NO form, so nothing
 * that fills a field or presses Save can start there.
 *
 * `apps/web/test/pages/listing-editor-routes.test.ts` reads this union and
 * fails if a slug here has no route file — this file cannot import the web
 * app's registry (the E2E package resolves `@repo/*` to built dist and knows
 * nothing about `apps/web/src`), so the drift is caught from the other side
 * instead of being left to a CI run of the browser suite.
 */
export type ListingEditorSection =
    | 'hub'
    | 'datos'
    // HOS-2189 — venue only: the postal address, right after the basic info.
    | 'ubicacion'
    | 'punto-de-encuentro'
    | 'datos-practicos'
    | 'horarios'
    | 'precio'
    | 'servicios'
    | 'fotos'
    | 'contacto'
    // HOS-895, HOS-1042 — venue only, the mirror of the two
    // experience-only slugs above. Opening either on an experience listing
    // redirects to the hub.
    | 'carta'
    // HOS-1041 — venue only too, and immediately after the carta because
    // that is where the registry puts it: the carta is the year's menu, this is
    // today's. Listed here for the reason this union exists at all — the E2E
    // package cannot import `apps/web`'s registry, so a section it cannot NAME
    // is a page no browser test can ever open.
    | 'menu-del-dia'
    | 'eventos'
    | 'promociones'
    | 'preguntas'
    // HOS-2101 — every vertical: the web-only, read-only «Preguntas a la IA»
    // page, right after the FAQs.
    | 'preguntas-ia'
    // HOS-1787 leaf 5.1 — venue only: the night-out info section the catalog
    // adds after faqs. Named here so the route parity guard can address it.
    | 'de-noche'
    | 'traducciones';

/**
 * Builds the URL of one listing editor section.
 *
 * Always trailing-slashed: Astro runs with `trailingSlash: 'always'`, and a URL
 * without one answers a 404 PAGE rather than a redirect — which reads in a
 * failing spec as "the editor is broken", not "the path was wrong".
 *
 * @param params.webUrl - Base URL of the web app under test
 * @param params.vertical - `venue` or `experience`
 * @param params.listingId - UUID of the listing being edited
 * @param params.section - Which section page to open
 * @param params.locale - UI locale segment (default `es`)
 */
export function listingEditorUrl({
    webUrl,
    vertical,
    listingId,
    section,
    locale = 'es'
}: {
    readonly webUrl: string;
    readonly vertical: 'venue' | 'experience';
    readonly listingId: string;
    readonly section: ListingEditorSection;
    readonly locale?: string;
}): string {
    const base = `${webUrl}/${locale}/mi-cuenta/comercio/${vertical}/${listingId}/editar/`;
    return section === 'hub' ? base : `${base}${section}/`;
}

/**
 * Waits until the listing editor island has actually hydrated.
 *
 * Gates on `data-hydrated`, which `ListingEditor` sets on its `<form>`
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
export async function waitForListingEditorHydration({
    page,
    timeout = 20_000
}: {
    readonly page: Page;
    readonly timeout?: number;
}): Promise<void> {
    await expect(
        page.locator('form[data-hydrated="true"]'),
        'The listing editor island never hydrated. If this page is the hub ' +
            '(…/editar/ with no section segment) it renders no form at all — open a ' +
            'section route instead, e.g. listingEditorUrl({ …, section: "datos" }).'
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

/**
 * The editor's save button.
 *
 * Since the editor shell moved every `bar` section onto the shared
 * `EditorSaveBar` (HOS-2487), Save lives inside the kit `StickySaveBar`: a
 * `region` named "Guardar cambios" that is NOT rendered while the form is
 * clean. The button is scoped to that region and matched anchored
 * (`^guardar cambios$`) so a future "Guardar y publicar" elsewhere on the page
 * can never silently retarget every save in the suite.
 *
 * @param params.page - The Playwright page sitting on the editor route
 */
export function listingSaveButton({ page }: { readonly page: Page }): Locator {
    return page
        .getByRole('region', { name: /^\s*guardar cambios\s*$/i })
        .getByRole('button', { name: /^\s*guardar cambios\s*$/i });
}

/**
 * Saves the editor and resolves with the resulting PATCH response.
 *
 * WHY THIS EXISTS. A save that never sends a request has one usual root
 * cause: React never registered the input change (the class of bug this
 * file's header describes). This helper names that cause instead of letting it
 * surface as a cryptic click or response timeout.
 *
 * With the shared save bar (HOS-2487) the signal is the bar itself: it only
 * renders once the form is dirty. So the bar not appearing is reported as "the
 * edit never reached React state", and once it is there the click must produce
 * the PATCH.
 *
 * @param params.page - The Playwright page sitting on the editor route
 * @param params.pathPattern - Matches the expected PATCH URL (e.g. `/\/protected\/venues\//`)
 * @param params.timeout - Milliseconds to wait for the PATCH (default 15s)
 */
export async function saveListingEditor({
    page,
    pathPattern,
    timeout = 15_000
}: {
    readonly page: Page;
    readonly pathPattern: RegExp;
    readonly timeout?: number;
}): Promise<import('@playwright/test').Response> {
    const saveButton = listingSaveButton({ page });
    const barShown = await saveButton
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

    if (!barShown) {
        throw new Error(
            'The save bar never appeared — it only renders while the form is dirty, so the edit ' +
                "did not reach React state (see this file's header on hydration and " +
                'setReactInputValue). That is the bug to chase, not the missing response.'
        );
    }

    const patch = page.waitForResponse(
        (response) => pathPattern.test(response.url()) && response.request().method() === 'PATCH',
        { timeout }
    );

    // `force` is kept from the original call sites: the click is actionable but
    // a sticky element intercepts the pointer non-deterministically under CI.
    await saveButton.click({ force: true });

    return patch;
}
