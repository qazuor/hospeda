/**
 * useCurrentSidebar — resolves the active Sidebar for the current route.
 *
 * Delegates to {@link useCurrentSection} to find the active section, then
 * looks up the sidebar by the section's `sidebar` reference key in
 * `validatedConfig.sidebars`.
 *
 * @module use-current-sidebar
 * @see apps/admin/src/hooks/use-current-section.ts — active section resolution
 * @see apps/admin/src/config/ia/validate.ts        — validatedConfig
 * @see SPEC-154 T-021
 */

import type { Sidebar } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useCurrentSection } from './use-current-section';

// ---------------------------------------------------------------------------
// Exported hook
// ---------------------------------------------------------------------------

/**
 * Returns the active {@link Sidebar} for the current route.
 *
 * A section may declare `sidebar: null` (no sidebar for that section). In that
 * case, or when no section is active, this hook returns `undefined`.
 *
 * The sidebar lookup is a simple map access — it is automatically memoized by
 * the underlying {@link useCurrentSection} memo (which keys on `pathname`).
 *
 * @returns The current {@link Sidebar} definition, or `undefined`.
 *
 * @example
 * ```ts
 * const sidebar = useCurrentSidebar();
 * // sidebar?.items — the sidebar items to render
 * ```
 */
export function useCurrentSidebar(): Sidebar | undefined {
    const section = useCurrentSection();
    if (!section?.sidebar) return undefined;
    return validatedConfig.sidebars[section.sidebar];
}
