/**
 * @file z-index.ts
 * @description z-index layer tokens for SPEC-153.
 *
 * A pre-allocated ladder so component authors never need to invent
 * z-index values. Stops are spaced generously (50/60/100/200/9000/9100)
 * so additional layers can be inserted later without renumbering. All
 * values anchored byte-for-byte to web's global.css `--z-*` tokens.
 *
 * The 9000+ block is reserved for fullscreen-blocking overlays (cookie
 * consent, mobile fullscreen menu) that MUST sit above every in-page
 * layer. The 9100 mobile-menu value is intentionally higher than
 * 9000 cookie-banner so opening the menu hides the banner that would
 * otherwise obscure the menu's footer.
 *
 * Values are stored as numbers (CSS z-index accepts unitless integers).
 * The CSS generator serializes them as `--z-{name}: <n>;` to match
 * web's current var names.
 */

export const zIndex = {
    /** In-page content above other in-page content. Web `--z-content`. */
    content: 10,
    /** Sticky / pinned navigation. Web `--z-nav`. */
    nav: 50,
    /** Dropdown menus, popovers. Web `--z-dropdown`. */
    dropdown: 60,
    /** Modal dialogs. Web `--z-modal`. */
    modal: 100,
    /** Toast notifications — above modals so confirmations remain visible. Web `--z-toast`. */
    toast: 200,
    /** Cookie consent banner — above all in-page content. Web `--z-cookie-banner`. */
    cookieBanner: 9000,
    /**
     * Fullscreen mobile menu — must clear the cookie banner so opening
     * the menu is not partially obscured. Web `--z-mobile-menu`.
     */
    mobileMenu: 9100
} as const satisfies Record<string, number>;

export type ZIndexName = keyof typeof zIndex;
