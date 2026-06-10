/**
 * @file badge.types.ts
 * @description Shared types for the Badge component system (Astro + React).
 * Single source of truth for size/variant constants and the color scheme shape.
 *
 * These types are consumed by:
 * - `Badge.astro` (SSR pill/anchor)
 * - `Badge.tsx` (React island equivalent)
 * - `BadgeRow.astro` (wrapper)
 * - `badge.utils.ts` (style/class helpers)
 */

/**
 * Supported badge sizes.
 *
 * - `xs`: tight chip (24px min-height when clickable), used for compact tag lists.
 * - `sm`: default chip (44px min-height when clickable).
 * - `md`: larger chip (44px min-height when clickable), used in featured contexts.
 */
export type BadgeSize = 'xs' | 'sm' | 'md';

/**
 * Supported badge visual variants.
 *
 * - `default`: per-type color scheme applied to bg/text/border.
 * - `filled-dark`: uniform dark fill regardless of color scheme (homepage filter rows).
 * - `outline`: transparent background with colored border and text.
 * - `dot`: neutral background with a colored leading dot indicator.
 */
export type BadgeVariant = 'default' | 'filled-dark' | 'outline' | 'dot';

/**
 * Color scheme applied to the badge surface, text, and border.
 * All values must be valid CSS property values (tokens preferred).
 */
export interface BadgeColorScheme {
    /** CSS background-color value (e.g. 'var(--brand-accent-a15)'). */
    readonly bg: string;
    /** CSS color value (e.g. 'var(--brand-accent)'). */
    readonly text: string;
    /** CSS border-color value (e.g. 'var(--brand-accent-a30)'). */
    readonly border: string;
}

/**
 * Common Badge props shared across Astro and React implementations.
 * Astro adds `class`, React adds `className` on top of this shape.
 */
export interface BadgeBaseProps {
    /** Text label displayed inside the badge. */
    readonly label: string;
    /** Optional href. When provided the badge renders as an anchor with clickable styling. */
    readonly href?: string;
    /** Color scheme object controlling badge appearance (ignored for `filled-dark`/`dot`). */
    readonly colorScheme: BadgeColorScheme;
    /** Size variant. Defaults to `sm` in the components. */
    readonly size?: BadgeSize;
    /** Visual variant. Defaults to `default` in the components. */
    readonly variant?: BadgeVariant;
    /** Optional icon name resolved via `@repo/icons` `resolveIcon({ iconName })`. */
    readonly icon?: string;
    /** Optional aria-label applied on the root element. */
    readonly ariaLabel?: string;
}

/** All supported badge sizes in render order (xs → sm → md). */
export const BADGE_SIZES: readonly BadgeSize[] = ['xs', 'sm', 'md'] as const;

/** All supported badge variants. */
export const BADGE_VARIANTS: readonly BadgeVariant[] = [
    'default',
    'filled-dark',
    'outline',
    'dot'
] as const;
