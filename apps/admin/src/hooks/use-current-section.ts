/**
 * useCurrentSection — resolves the active IA section from the current pathname.
 *
 * Membership strategy: a section is active when the current pathname matches
 * a link item in its associated sidebar (longest-prefix / exact wins). If no
 * sidebar link matches, falls back to matching the section's own `route` /
 * `defaultRoute` as a prefix.
 *
 * This deliberately avoids URL-prefix glob matching on the section route alone
 * because two sections can share a route prefix (e.g. `/billing/plans` for
 * `comercial` vs `/billing/subscriptions` for `miFacturacion`). Sidebar
 * membership is the authoritative signal.
 *
 * @module use-current-section
 * @see apps/admin/src/config/ia/validate.ts   — validatedConfig
 * @see apps/admin/src/config/ia/sections.ts   — Section definitions
 * @see apps/admin/src/config/ia/sidebars.ts   — Sidebar definitions
 * @see SPEC-154 T-021
 */

import type { Section } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useLocation } from '@tanstack/react-router';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collects every link route from a flat+nested sidebar items tree.
 * Returns an array of `{ route, exact }` tuples for all `link` items.
 *
 * @param items - Top-level sidebar items (may contain groups with children).
 * @returns Flat list of route/exact pairs from all link items.
 */
function collectLinkRoutes(
    items: readonly {
        type: string;
        route?: string;
        exact?: boolean;
        items?: readonly { type: string; route?: string; exact?: boolean }[];
    }[]
): ReadonlyArray<{ readonly route: string; readonly exact: boolean }> {
    const routes: { route: string; exact: boolean }[] = [];
    for (const item of items) {
        if (item.type === 'link' && item.route) {
            routes.push({ route: item.route, exact: item.exact ?? false });
        }
        if (item.type === 'group' && item.items) {
            for (const child of item.items) {
                if (child.type === 'link' && child.route) {
                    routes.push({ route: child.route, exact: child.exact ?? false });
                }
            }
        }
    }
    return routes;
}

/**
 * Scores how well a sidebar link route matches the current pathname.
 *
 * - Exact match (`exact: true`, or route === pathname): very high score.
 * - Prefix match (pathname starts with route + '/'): route.length (longer = more specific).
 * - No match: -1.
 *
 * @param pathname - Current URL pathname.
 * @param route    - Sidebar link route.
 * @param exact    - Whether the link uses exact matching.
 * @returns Match score (-1 means no match).
 */
function matchScore(pathname: string, route: string, exact: boolean): number {
    if (exact || route === pathname) {
        return route === pathname ? Number.MAX_SAFE_INTEGER : -1;
    }
    // Prefix match: pathname must start with route followed by '/' or be equal
    if (pathname === route || pathname.startsWith(`${route}/`)) {
        return route.length;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Exported hook
// ---------------------------------------------------------------------------

/**
 * Returns the active {@link Section} based on sidebar link membership.
 *
 * Resolution order:
 * 1. For each section that has a sidebar, flatten all link items from that sidebar.
 * 2. Find the link with the highest match score for the current pathname across
 *    ALL sections. The section owning the best-matching link wins.
 * 3. If no sidebar link matched, fall back to sections whose `route` or
 *    `defaultRoute` is a prefix of the current pathname (take the longest prefix).
 *
 * Memoized on `pathname` — renders do not re-compute unless the route changes.
 *
 * @returns The matching {@link Section}, or `undefined` if no section matched.
 *
 * @example
 * ```ts
 * const section = useCurrentSection();
 * // section?.id === 'catalogo' when pathname is '/accommodations/123'
 * ```
 */
export function useCurrentSection(): Section | undefined {
    const { pathname } = useLocation();

    return useMemo(() => {
        let bestSection: Section | undefined;
        let bestScore = -1;

        // Phase 1: sidebar link membership (most specific)
        for (const section of Object.values(validatedConfig.sections)) {
            if (!section.sidebar) continue;
            const sidebar = validatedConfig.sidebars[section.sidebar];
            if (!sidebar) continue;

            const links = collectLinkRoutes(sidebar.items);
            for (const { route, exact } of links) {
                const score = matchScore(pathname, route, exact);
                if (score > bestScore) {
                    bestScore = score;
                    bestSection = section;
                }
            }
        }

        if (bestSection) return bestSection;

        // Phase 2: section route / defaultRoute prefix fallback
        let fallbackSection: Section | undefined;
        let fallbackScore = -1;

        for (const section of Object.values(validatedConfig.sections)) {
            for (const candidate of [section.defaultRoute ?? section.route, section.route]) {
                if (!candidate) continue;
                if (pathname === candidate || pathname.startsWith(`${candidate}/`)) {
                    const score = candidate.length;
                    if (score > fallbackScore) {
                        fallbackScore = score;
                        fallbackSection = section;
                    }
                }
            }
        }

        return fallbackSection;
    }, [pathname]);
}
