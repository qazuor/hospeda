/**
 * @file radius.ts
 * @description Border-radius tokens for SPEC-153.
 *
 * Per doc 05 §5.4 the base radius is `0.75rem` (12px) — web's current
 * `--radius` value, intentionally adopted as the shared base for both
 * apps. The scale (`sm/md/lg/xl`) is expressed as `calc()` relative to
 * the base so themes that override `--radius` automatically propagate
 * proportional values to derived stops.
 *
 * Three layers:
 *
 *   1. **base** — the canonical `--radius` value (0.75rem).
 *
 *   2. **scale** — `sm/md/lg/xl` as `calc()` expressions relative to
 *      `var(--radius)`. Anchored byte-for-byte to web's `--radius-sm`,
 *      `--radius-md`, `--radius-lg`, `--radius-xl`.
 *
 *   3. **semantic** — single absolute values for component contexts:
 *      `card` (24px), `pill` (9999px), `button` (8px). Anchored to web's
 *      `--radius-card`, `--radius-pill`, `--radius-button`.
 *
 *   4. **organic** — DEPRECATED legacy values from web's previous design
 *      language. Exported so the @import drop-in during Phase 2 resolves
 *      all current vars; new code MUST NOT reference these (web's CLAUDE.md
 *      explicitly marks them deprecated).
 */

/** Canonical base radius. Web token `--radius`. */
export const radiusBase = '0.75rem';

/**
 * Radius scale expressed as `calc()` relative to `var(--radius)`. Each
 * shade adjusts by ±2px or ±4px from the base so the scale stays in
 * harmony when the base is themed.
 */
export const radiusScale = {
    /** ~8px when base=0.75rem. Web token `--radius-sm`. */
    sm: 'calc(var(--radius) - 4px)',
    /** ~10px when base=0.75rem. Web token `--radius-md`. */
    md: 'calc(var(--radius) - 2px)',
    /** Equal to base. Web token `--radius-lg`. */
    lg: 'var(--radius)',
    /** ~16px when base=0.75rem. Web token `--radius-xl`. */
    xl: 'calc(var(--radius) + 4px)'
} as const satisfies Record<string, string>;

export type RadiusScaleKey = keyof typeof radiusScale;

/**
 * Component-specific absolute radius values. Not derived from
 * `var(--radius)` because their semantics (card surfaces, pills,
 * buttons) intentionally diverge from the proportional scale.
 */
export const radiusSemantic = {
    /** Outer container of cards. Web token `--radius-card`. */
    card: '24px',
    /** Fully rounded (badges, tags, avatars). Web token `--radius-pill`. */
    pill: '9999px',
    /** Standard button radius. Web token `--radius-button`. */
    button: '8px'
} as const satisfies Record<string, string>;

export type RadiusSemanticName = keyof typeof radiusSemantic;

/**
 * @deprecated Legacy organic / asymmetric radius from web's previous
 * design iteration. apps/web/CLAUDE.md flags these as deprecated. Kept
 * exported for byte-for-byte parity with the current global.css so the
 * Phase 2 @import drop-in resolves all vars; consumers MUST NOT add new
 * references to these tokens.
 */
export const radiusOrganic = {
    base: '0px 100px',
    sm: '0px 75px',
    alt: '100px 0px'
} as const satisfies Record<string, string>;

export type RadiusOrganicName = keyof typeof radiusOrganic;

// ============================================================================
// Master radius aggregate
// ============================================================================

export const radius = {
    base: radiusBase,
    scale: radiusScale,
    semantic: radiusSemantic,
    organic: radiusOrganic
} as const;
