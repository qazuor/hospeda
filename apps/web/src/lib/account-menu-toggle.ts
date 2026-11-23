/**
 * @file account-menu-toggle.ts
 * @description Wires the account header's hamburger to the site menu
 * (HOS-2550).
 *
 * The bug it fixes: `AccountHeader.astro` rendered the hamburger, but the click
 * listener that turns a hamburger click into the `mobile-menu:toggle` event
 * `MobileMenu.client.tsx` listens for lived only in `Header.astro`, which the
 * account pages do not render. The click did nothing, `aria-expanded` never
 * changed, and the menu stayed translated off screen.
 *
 * The account hamburger carries its own attribute (`data-account-mobile-toggle`)
 * so this listener and the site header's never both toggle one click after a
 * ClientRouter navigation between the two chromes.
 *
 * `aria-expanded` follows the menu's real state: `MobileMenu` sets
 * `data-mobile-menu-open` on `<html>` while it is open (and clears it on Esc,
 * on the back button and on navigation), so the attribute is mirrored from
 * there instead of being flipped on click.
 */

/** Selector of the account header's hamburger. */
export const ACCOUNT_MENU_TOGGLE_SELECTOR = '[data-account-mobile-toggle]';

/** The event `MobileMenu.client.tsx` toggles on. */
export const MOBILE_MENU_TOGGLE_EVENT = 'mobile-menu:toggle';

/** The `<html>` attribute `MobileMenu.client.tsx` sets while the menu is open. */
export const MOBILE_MENU_OPEN_ATTRIBUTE = 'data-mobile-menu-open';

/**
 * Documents already wired, so wiring one twice adds no second listener. A
 * WeakSet rather than an `<html>` attribute: ClientRouter replaces the root's
 * attributes on every navigation, and the listeners outlive that.
 */
const wiredDocuments = new WeakSet<Document>();

/**
 * Copies the menu's open state onto every account hamburger's `aria-expanded`.
 *
 * @param input - Options object.
 * @param input.doc - The document.
 */
export function syncAccountMenuExpanded({ doc }: { readonly doc: Document }): void {
    const open = doc.documentElement.hasAttribute(MOBILE_MENU_OPEN_ATTRIBUTE);
    for (const button of doc.querySelectorAll(ACCOUNT_MENU_TOGGLE_SELECTOR)) {
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
}

/**
 * Wires the hamburger once per document: a delegated click that dispatches
 * the menu event, and an observer that mirrors the open state. Delegation and
 * the `astro:page-load` resync keep it working after ClientRouter swaps the
 * header.
 *
 * @param input - Options object.
 * @param input.doc - The document.
 * @returns `true` when it wired the document, `false` when it already was.
 */
export function wireAccountMenuToggle({ doc }: { readonly doc: Document }): boolean {
    if (wiredDocuments.has(doc)) {
        return false;
    }
    wiredDocuments.add(doc);

    doc.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(ACCOUNT_MENU_TOGGLE_SELECTOR)) {
            return;
        }
        const win = doc.defaultView;
        if (win !== null) {
            win.dispatchEvent(new win.CustomEvent(MOBILE_MENU_TOGGLE_EVENT));
        }
    });

    const view = doc.defaultView;
    if (view !== null) {
        new view.MutationObserver(() => syncAccountMenuExpanded({ doc })).observe(
            doc.documentElement,
            {
                attributes: true,
                attributeFilter: [MOBILE_MENU_OPEN_ATTRIBUTE]
            }
        );
    }
    doc.addEventListener('astro:page-load', () => syncAccountMenuExpanded({ doc }));
    syncAccountMenuExpanded({ doc });
    return true;
}
