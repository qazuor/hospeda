/**
 * @file layout.ts
 * @description Layout dimension tokens for SPEC-153.
 *
 * Two families:
 *
 *   - **chrome** — header/nav-bar heights and runtime-published values
 *     (cookie banner height, wave-bar compact height). Some of these
 *     are runtime tokens that JS overrides via `style.setProperty()`
 *     after measuring the DOM; the default values here are the safe
 *     fallback used on first paint before measurement.
 *
 *   - **container** — max-width constraints for the page's main column
 *     and the narrower long-form variant. A `@media (min-width: 1600px)`
 *     override on `container.max` (1500px instead of 1350px) is emitted
 *     by the CSS generator (T-153-16) using the seed manifest's media
 *     entry.
 *
 * All values anchored byte-for-byte to web's `--navbar-height`,
 * `--wave-bar-compact`, `--cookie-banner-height`, `--bottom-safe-inset`,
 * `--container-max`, `--container-narrow`.
 */

// ============================================================================
// Chrome — header/nav heights and runtime-published dimensions
// ============================================================================

export const layoutChrome = {
    /** Sticky top navbar. Web `--navbar-height`. */
    navbarHeight: '80px',
    /**
     * Compact wave-bar header on mobile fullscreen-map screens. Web's
     * mobile-map script (apps/web/src/pages/[lang]/alojamientos/mapa.astro)
     * measures the actual element and overrides this via
     * `style.setProperty()`; the 77px value here is the first-paint
     * fallback. Web `--wave-bar-compact`.
     */
    waveBarCompact: '77px',
    /**
     * Runtime token: 0 by default, set to the actual banner height by
     * the cookie consent script when the banner is mounted. Pairs with
     * `bottomSafeInset` so floating UI lifts above it. Web
     * `--cookie-banner-height`.
     */
    cookieBannerHeight: '0px',
    /**
     * Semantic alias consumed by every fixed-bottom UI element (FABs,
     * floating toggles, sheet triggers). Resolves to whatever bottom-
     * anchored overlay is currently active (today: the cookie banner).
     * Future banners can sum into this token via JS without each
     * floating element having to know about specific overlays. Web
     * `--bottom-safe-inset`.
     */
    bottomSafeInset: 'var(--cookie-banner-height, 0px)'
} as const satisfies Record<string, string>;

export type LayoutChromeName = keyof typeof layoutChrome;

// ============================================================================
// Container — page-level max-width constraints
// ============================================================================

export const layoutContainer = {
    /**
     * Default page max-width (~1350px). Web `--container-max`. The seed
     * manifest also captures a `@media (min-width: 1600px)` override
     * that bumps this to 1500px — emitted under the same var name by
     * the CSS generator inside that media block.
     */
    max: '1350px',
    /** Narrow column for long-form reading (~900px). Web `--container-narrow`. */
    narrow: '900px'
} as const satisfies Record<string, string>;

export type LayoutContainerName = keyof typeof layoutContainer;

/**
 * Media-override values applied at specific viewport widths. The CSS
 * generator (T-153-16) consumes this to emit corresponding `@media`
 * blocks in tokens.css. Anchored to the seed manifest's media block.
 */
export const layoutMediaOverrides = {
    '(min-width: 1600px)': {
        'container-max': '1500px'
    }
} as const satisfies Record<string, Record<string, string>>;

// ============================================================================
// Master layout aggregate
// ============================================================================

export const layout = {
    chrome: layoutChrome,
    container: layoutContainer,
    mediaOverrides: layoutMediaOverrides
} as const;

// ============================================================================
// Account area — control heights, template widths, breakpoints
// (HOS-2454 T-001 control heights; HOS-2413 T-002 layout widths)
// ============================================================================

/** Control heights for the Mi Cuenta kit. Web tokens `--control-h-{sm,md,lg}`. */
export const controlHeight = {
    /** Compact button (the touch target stays 44px through padding/margin). */
    sm: '36px',
    /** Default desktop button, sidebar item. */
    md: '40px',
    /** Inputs, selects, tabs, switch rows, mobile buttons. */
    lg: '44px'
} as const satisfies Record<string, string>;

/** Name of a control height step. */
export type ControlHeightName = keyof typeof controlHeight;

/** Account shell and template widths. Web tokens `--sidebar-w`, `--editor-nav-w`, `--form-max`, `--reading-max`. */
export const layoutAccount = {
    /** AccountSidebar column from 64rem. */
    'sidebar-w': '240px',
    /** EditorSectionNav column. */
    'editor-nav-w': '224px',
    /** Max width of the `form` template (left-aligned). */
    'form-max': '720px',
    /** Max width of the `reading` template. */
    'reading-max': '640px'
} as const satisfies Record<string, string>;

/** Name of an account layout width. */
export type LayoutAccountName = keyof typeof layoutAccount;

/**
 * The closed list of account breakpoints in rem, mobile-first `min-width`
 * only (D6 «breakpoints cerrados»). Documentation-only: custom properties
 * cannot appear inside `@media` preludes, so `check:account-breakpoints`
 * enforces these literal values and tests or `matchMedia` callers import them.
 */
export const ACCOUNT_BREAKPOINTS_REM = [30, 48, 64, 80] as const;

/** One account breakpoint value in rem. */
export type AccountBreakpointRem = (typeof ACCOUNT_BREAKPOINTS_REM)[number];

/** Container width (rem) from which the editor section nav appears (D2). */
export const CQ_EDITOR_NAV_REM = 60;
