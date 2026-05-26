/**
 * @file Semantic surface variants
 *
 * Token-backed background + border classes for CONTEXTUAL content surfaces
 * (notes, alerts, status panels) layered on top of the warm-white base
 * surface (`bg-card`). Using the brand semantic tokens (`info` / `success` /
 * `warning` / `destructive`) instead of raw Tailwind palette colors means:
 *   - one source of truth for the contextual tint set, and
 *   - dark mode flips automatically (the tokens are theme-aware), so callers
 *     must NOT add hardcoded `dark:` color variants.
 *
 * Tint level (`/10` bg, `/30` border) mirrors the convention noted in
 * `styles.css`. The `danger` variant maps to the `destructive` token
 * (shadcn's built-in semantic name).
 */
export type SurfaceVariant = 'info' | 'success' | 'warning' | 'danger';

export const SURFACE_VARIANT_CLASS: Record<SurfaceVariant, string> = {
    info: 'border-info/30 bg-info/10',
    success: 'border-success/30 bg-success/10',
    warning: 'border-warning/30 bg-warning/10',
    danger: 'border-destructive/30 bg-destructive/10'
} as const;
