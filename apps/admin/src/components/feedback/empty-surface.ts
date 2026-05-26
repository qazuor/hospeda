/**
 * Shared container styles for empty-state surfaces.
 *
 * `EmptyState` (no-data placeholder) and `ComingSoon` (unimplemented feature
 * placeholder) stay as separate components but share this base so the brand
 * treatment — river-tinted dashed surface, centered layout — is defined once.
 * Padding is intentionally left out so each component sets its own.
 */
export const EMPTY_SURFACE_CLASS =
    'flex flex-col items-center justify-center rounded-lg border border-primary/25 border-dashed text-center';
