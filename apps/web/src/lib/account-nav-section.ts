/**
 * @file account-nav-section.ts
 * @description Maps a nav item's `href` to the `activeSection` key the account
 * pages pass (extracted from `account-nav-model.ts` for HOS-2551, so the
 * zoned shell can use it without an import cycle).
 *
 * @module lib/account-nav-section
 */

/**
 * `activeSection` (passed by every `/mi-cuenta/*` page) predates the nav
 * config's item `href`s and diverges from the URL path segment for the two
 * "consultas" routes: the guest inbox page passes `messages` and the owner
 * inbox page passes `owner-messages`, not `consultas`/`consultas-propietario`.
 * Kept as an explicit override (rather than renamed across every consuming
 * page) so the active-state highlight matches exactly what it did before
 * this was extracted (HOS-131 T-007).
 */
export const ACTIVE_SECTION_OVERRIDES: Readonly<Record<string, string>> = {
    'mi-cuenta/consultas': 'messages',
    'mi-cuenta/consultas-propietario': 'owner-messages'
};

/**
 * Derives the `activeSection`-comparable key for a nav item's `href`.
 *
 * @param input - Options object.
 * @param input.href - The item's path segment (e.g. `mi-cuenta/editar`).
 * @returns The section key to compare against the `activeSection` prop.
 */
export function getActiveSectionKey({ href }: { readonly href: string }): string {
    const override = ACTIVE_SECTION_OVERRIDES[href];
    if (override) return override;
    return href === 'mi-cuenta' ? href : href.replace('mi-cuenta/', '');
}
