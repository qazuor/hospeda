/**
 * @file shadows.ts
 * @description Box-shadow tokens for SPEC-153.
 *
 * Two coexisting layers:
 *
 *   1. **shadowScale** — `none/sm/base/md/lg/xl` per doc 05 §5.5. A
 *      conventional elevation ladder using pure-black alpha layers.
 *      Designed for admin's Tailwind utility classes (`shadow-sm`,
 *      `shadow-md`, etc.) and any component that wants a stock
 *      elevation level.
 *
 *   2. **shadowSemantic** — `card / cardHover / search / nav`. Anchored
 *      byte-for-byte to web's `--shadow-card`, `--shadow-card-hover`,
 *      `--shadow-search`, `--shadow-nav`. These use the relative-color
 *      syntax `oklch(from var(--core-foreground) l c h / α)` so the
 *      shadow tints automatically pick up the foreground color of the
 *      active theme — softer in light mode, deeper in dark mode without
 *      needing per-theme overrides.
 *
 * Per doc 05 Eje 8 convention: web tends to use md/lg for cards (softer,
 * more breathing room); admin uses sm/base (denser, subtler). This is
 * encoded at component-style level, not in the token module.
 */

// ============================================================================
// shadowScale — doc 05 §5.5 conventional elevation ladder
// ============================================================================

export const shadowScale = {
    /** No shadow. */
    none: 'none',
    /** Subtle elevation — 1px lift. */
    sm: '0 1px 2px 0 oklch(0 0 0 / 0.05)',
    /** Default card elevation. */
    base: '0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px 0 oklch(0 0 0 / 0.06)',
    /** Hovered cards / dropdowns. */
    md: '0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -1px oklch(0 0 0 / 0.06)',
    /** Popovers / sticky surfaces. */
    lg: '0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -2px oklch(0 0 0 / 0.05)',
    /** Modals / panels. */
    xl: '0 20px 25px -5px oklch(0 0 0 / 0.1), 0 10px 10px -5px oklch(0 0 0 / 0.04)'
} as const satisfies Record<string, string>;

export type ShadowScaleKey = keyof typeof shadowScale;

// ============================================================================
// shadowSemantic — anchored byte-for-byte to web's global.css
//
// These use the CSS Color Module Level 5 relative-color syntax
// (`oklch(from var(--token) ...)`) so the shadow color tracks the active
// theme's foreground automatically. Browser support is the same as web's
// current minimum (Chromium 119+, Safari 16.4+, Firefox 128+).
// ============================================================================

export const shadowSemantic = {
    /**
     * Default card elevation. Soft 12px blur at low alpha.
     * Web token `--shadow-card`.
     */
    card: '0 4px 12px -2px oklch(from var(--core-foreground) l c h / 0.08)',
    /**
     * Hovered card elevation — lifted 12px with broader spread.
     * Web token `--shadow-card-hover`.
     */
    cardHover: '0 12px 24px -4px oklch(from var(--core-foreground) l c h / 0.12)',
    /**
     * Wide diffuse glow under search surfaces (homepage hero search bar).
     * Web token `--shadow-search`.
     */
    search: '0 4px 60px oklch(from var(--core-foreground) l c h / 0.1)',
    /**
     * Tight under-shadow for sticky / pinned navigation bars.
     * Web token `--shadow-nav`.
     */
    nav: '0 2px 4px oklch(from var(--core-foreground) l c h / 0.15)'
} as const satisfies Record<string, string>;

export type ShadowSemanticName = keyof typeof shadowSemantic;

// ============================================================================
// Master shadows aggregate
// ============================================================================

export const shadows = {
    scale: shadowScale,
    semantic: shadowSemantic
} as const;
