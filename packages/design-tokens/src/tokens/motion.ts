/**
 * @file motion.ts
 * @description Motion tokens (durations + easings) for SPEC-153.
 *
 * Two parallel scales — doc 05 §5.6 reference scale for new admin
 * surfaces, and the web-anchored alias scale that the @import drop-in
 * during Phase 2 needs to preserve byte-for-byte.
 *
 * **Important**: doc 05's values intentionally differ from web's current
 * ones (e.g. doc 05 `fast` = 150ms while web `--duration-fast` = 0.2s,
 * doc 05 `slower` = 500ms while web has no equivalent). Both sets are
 * exported under distinct namespaces; the CSS generator (T-153-16) emits
 * them under separate CSS var name spaces so no collision exists at
 * runtime:
 *
 *   - doc 05 scale  →  `--motion-duration-*`, `--motion-easing-*`
 *   - web anchored  →  `--duration-*`, `--ease-*`
 *
 * Per doc 05: web can use `spring` for playful marketing
 * micro-interactions; admin defaults to `out` for professional,
 * predictable transitions.
 */

// ============================================================================
// Doc 05 §5.6 reference scale — for admin (Tailwind transition utilities)
// ============================================================================

export const motionDuration = {
    /** Snap — minimal acknowledge of an interaction. */
    fast: '150ms',
    /** Default for hover, focus, small state changes. */
    base: '200ms',
    /** Layout shifts, larger state changes. */
    slow: '300ms',
    /** Modal in/out, view transitions. */
    slower: '500ms'
} as const satisfies Record<string, string>;

export type MotionDurationKey = keyof typeof motionDuration;

export const motionEasing = {
    /** Default — fast start, slow finish. Use for entrances. */
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    /** Symmetric — slow-fast-slow. Use for in-place state changes. */
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    /** Playful overshoot. Web marketing accents only — admin avoids. */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
} as const satisfies Record<string, string>;

export type MotionEasingName = keyof typeof motionEasing;

// ============================================================================
// Web-anchored scale — byte-for-byte from apps/web/src/styles/global.css
//
// Keys mirror web's `--duration-*` and `--ease-*` token suffixes so the
// CSS generator can emit them straight. NOT a superset of the doc 05
// scale above — overlapping names (`fast`, `slow`) intentionally have
// different values, reflecting web's existing design tuning.
// ============================================================================

export const webDuration = {
    /** Web token `--duration-fast`. */
    fast: '0.2s',
    /** Web token `--duration-normal`. */
    normal: '0.4s',
    /** Web token `--duration-slow`. */
    slow: '0.5s',
    /** Web token `--duration-reveal` — used by the scroll-reveal system. */
    reveal: '450ms'
} as const satisfies Record<string, string>;

export type WebDurationKey = keyof typeof webDuration;

export const webEasing = {
    /** Web token `--ease-bounce`. Snappy entrance, no overshoot. */
    bounce: 'cubic-bezier(0.1, 0, 0.3, 1)',
    /** Web token `--ease-reveal`. Used by scroll-reveal animations. */
    reveal: 'cubic-bezier(0.22, 1, 0.36, 1)'
} as const satisfies Record<string, string>;

export type WebEasingName = keyof typeof webEasing;

// ============================================================================
// Master motion aggregate
// ============================================================================

export const motion = {
    duration: motionDuration,
    easing: motionEasing,
    web: {
        duration: webDuration,
        easing: webEasing
    }
} as const;
