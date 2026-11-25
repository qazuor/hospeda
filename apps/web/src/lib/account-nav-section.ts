/**
 * @file account-nav-section.ts
 * @description Maps a nav item's `href` to the `activeSection` key the account
 * pages pass (extracted from `account-nav-model.ts` for HOS-2551, so the
 * zoned shell can use it without an import cycle).
 *
 * @module lib/account-nav-section
 */

import {
    OWNER_LIST_BASE_PATH,
    OWNER_LIST_VERTICAL_PARAM,
    OWNER_LIST_VERTICALS,
    ownerListPath,
    ownerListSectionKey,
    parseOwnerListVertical
} from '@/lib/listing/owner-list-vertical';

/**
 * `activeSection` (passed by every `/mi-cuenta/*` page) predates the nav
 * config's item `href`s and diverges from the URL path segment for the two
 * "consultas" routes: the guest inbox page passes `messages` and the owner
 * inbox page passes `owner-messages`, not `consultas`/`consultas-propietario`.
 * Kept as an explicit override (rather than renamed across every consuming
 * page) so the active-state highlight matches exactly what it did before
 * this was extracted (HOS-131 T-007).
 *
 * HOS-2559: the two owner lists share one path and differ by the `vertical`
 * query, so each maps to its own key (`comercio-venue`, `comercio-experience`),
 * which the list page and the editors of that vertical pass.
 */
export const ACTIVE_SECTION_OVERRIDES: Readonly<Record<string, string>> = {
    'mi-cuenta/consultas': 'messages',
    'mi-cuenta/consultas-propietario': 'owner-messages',
    ...Object.fromEntries(
        OWNER_LIST_VERTICALS.map((vertical) => [
            ownerListPath({ vertical }),
            ownerListSectionKey({ vertical })
        ])
    )
};

/**
 * Resolves a registry href or browser pathname to its canonical account section.
 * Nested pages inherit their parent entry. Only the shared commerce list reads
 * the vertical query; a commerce editor's pathname supplies its vertical instead.
 *
 * @param input - Options object.
 * @param input.href - A registry href or locale-prefixed browser pathname.
 * @param input.search - Optional browser query, separate from the pathname.
 * @returns The section key to compare against the `activeSection` prop.
 */
export function getActiveSectionKey({
    href,
    search
}: {
    readonly href: string;
    readonly search?: string;
}): string {
    const [pathname = '', hrefSearch = ''] = href.split('#')[0]?.split('?') ?? [];
    const normalized = pathname.replace(/^\/(?:es|en|pt)\//, '').replace(/^\/|\/$/g, '');
    const segments = normalized.split('/');
    if (segments[0] !== 'mi-cuenta') return normalized;

    const parentPath = segments.slice(0, 2).join('/');
    if (parentPath === OWNER_LIST_BASE_PATH) {
        const value =
            normalized === OWNER_LIST_BASE_PATH
                ? new URLSearchParams(search ?? hrefSearch).get(OWNER_LIST_VERTICAL_PARAM)
                : (segments[2] ?? null);
        const vertical = parseOwnerListVertical({ value });
        if (vertical) return ownerListSectionKey({ vertical });
    }

    return ACTIVE_SECTION_OVERRIDES[parentPath] ?? segments[1] ?? 'mi-cuenta';
}
