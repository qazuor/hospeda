#!/usr/bin/env tsx
/**
 * validate-sidebar-routes.ts — CI regression gate for AC-22.
 *
 * Asserts that every `link` item in the admin IA sidebar config points to a
 * real TanStack Router route. Exits 1 on any unresolvable link.
 *
 * Usage:
 *   pnpm --filter admin validate:sidebar-routes
 *   # or directly:
 *   tsx apps/admin/scripts/validate-sidebar-routes.ts
 *
 * @see SPEC-154 AC-22 — "no unreachable pages"
 * @see apps/admin/src/config/ia/sidebars.ts — sidebar link data (direct import — avoids transitive @repo/schemas boot chain)
 * @see apps/admin/src/routes/_authed/ — TanStack Router file-based routes
 */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { sidebars } from '../src/config/ia/sidebars.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A bad link found during validation. */
interface BadLink {
    /** Sidebar key in the registry (e.g. "catalogoSidebar"). */
    sidebar: string;
    /** Item id field. */
    itemId: string;
    /** The raw route value from the config. */
    route: string;
    /** Human-readable explanation of why it failed. */
    reason: string;
}

/** An extracted link item (flat — groups are recursively unwrapped). */
interface ExtractedLink {
    sidebar: string;
    itemId: string;
    route: string;
}

// ---------------------------------------------------------------------------
// Step 1: Enumerate real routes from the filesystem
// ---------------------------------------------------------------------------

const ROUTES_DIR = join(import.meta.dirname, '../src/routes/_authed');

/**
 * Returns true if a path segment should be skipped during route enumeration.
 *
 * Skipped segments:
 * - Directories starting with `-`  (collocated components, e.g. `-components/`)
 * - Files / dirs starting with `_` (layout wrappers: `__root.tsx`, `_authed.tsx`)
 * - Directories wrapped in parentheses (route groups: `(group)/`)
 * - Non-TSX files and non-directories
 */
function shouldSkipSegment(segment: string): boolean {
    return (
        segment.startsWith('-') ||
        segment.startsWith('_') ||
        (segment.startsWith('(') && segment.endsWith(')'))
    );
}

/**
 * Recursively collects all `.tsx` route files under `dir`, returning their
 * paths relative to `ROUTES_DIR`.
 *
 * Skips collocated-component directories (`-components`), layout wrappers
 * (`_authed.tsx`, `__root.tsx`), and route group directories (`(group)/`).
 */
async function collectRouteFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
        if (shouldSkipSegment(entry.name)) continue;

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
            const nested = await collectRouteFiles(fullPath);
            results.push(...nested);
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
            results.push(relative(ROUTES_DIR, fullPath));
        }
    }

    return results;
}

/**
 * Derives the TanStack Router URL path pattern from a route file path relative
 * to `_authed/`.
 *
 * Conventions applied (matching TanStack Router v1 file-based routing):
 *
 * | File pattern            | URL pattern            |
 * |-------------------------|------------------------|
 * | `foo/index.tsx`         | `/foo`                 |
 * | `foo.tsx`               | `/foo`                 |
 * | `foo/$id.tsx`           | `/foo/$id`             |
 * | `foo/$id_.edit.tsx`     | `/foo/$id/edit`        |
 * | `foo/$id_.bar.baz.tsx`  | `/foo/$id/bar/baz`     |
 * | `foo/bar.tsx`           | `/foo/bar`             |
 * | `foo.lazy.tsx`          | — (deduplicated)       |
 * | `dashboard.lazy.tsx`    | — (deduplicated)       |
 *
 * The `$param_.rest` convention: a trailing underscore on a dynamic segment
 * (`$param_`) is a TanStack Router "split route" marker — it ejects `rest`
 * out of the `$param` layout context, creating `/parent/$param/rest`.
 *
 * @param relativePath - File path relative to `_authed/`, e.g. `accommodations/$id_.edit.tsx`
 * @returns URL path pattern starting with `/`, or `null` if the file is a
 *          `.lazy.tsx` duplicate (the canonical `.tsx` covers it).
 */
function deriveRoutePath(relativePath: string): string | null {
    // Strip .tsx extension
    let path = relativePath.replace(/\.tsx$/, '');

    // Skip .lazy duplicates — the non-lazy twin covers this route
    if (path.endsWith('.lazy')) return null;

    // Strip index suffix → parent path
    if (path === 'index' || path.endsWith('/index')) {
        path = path.slice(0, -'/index'.length) || '/';
    }

    // Convert path separators and handle the $param_.rest split-route pattern.
    // Split on `/` to process each segment individually.
    const segments = path.split('/');
    const outputSegments: string[] = [];

    for (const segment of segments) {
        // Dot-notation within a segment (TanStack flat-files convention):
        // `foo.bar` → two path segments `/foo/bar`
        // BUT: `$id_.edit` is special — the trailing `_` on `$id_` signals
        //   a split route. We must NOT treat the dot as a nested path separator
        //   here; instead we split `$id_.edit` into `$id` + `edit`.
        const dotIdx = segment.indexOf('.');
        if (dotIdx !== -1) {
            const before = segment.slice(0, dotIdx);
            const after = segment.slice(dotIdx + 1);

            if (before.endsWith('_')) {
                // Split-route: `$id_.edit` → [$id, edit]
                // Multiple trailing segments from `$id_.foo.bar` → [$id, foo, bar]
                outputSegments.push(before.slice(0, -1)); // strip trailing _
                outputSegments.push(...after.split('.'));
            } else {
                // Flat-file dot notation: `foo.bar` → [foo, bar]
                outputSegments.push(before, ...after.split('.'));
            }
        } else {
            outputSegments.push(segment);
        }
    }

    return `/${outputSegments.join('/')}`;
}

/**
 * Builds the complete set of real route path patterns from the filesystem,
 * normalising them so they can be matched against sidebar link routes.
 *
 * Returns a `Set<string>` of patterns like `/accommodations`, `/accommodations/$id`,
 * `/accommodations/$id/edit`, etc.
 */
async function buildRealRouteSet(): Promise<Set<string>> {
    const files = await collectRouteFiles(ROUTES_DIR);
    const routes = new Set<string>();

    for (const file of files) {
        const derived = deriveRoutePath(file);
        if (derived !== null) {
            routes.add(derived);
        }
    }

    return routes;
}

// ---------------------------------------------------------------------------
// Step 2: Extract link items from rawConfig.sidebars
// ---------------------------------------------------------------------------

/**
 * Recursively walks a sidebar's item list and collects every `link` item.
 *
 * Group items are descended into; separator items are ignored.
 *
 * @param sidebarKey - The registry key (e.g. "catalogoSidebar")
 * @param items      - Top-level items array from the sidebar definition
 * @returns Flat list of extracted link items
 */
function extractLinks(
    sidebarKey: string,
    items: ReadonlyArray<{
        type: string;
        id: string;
        route?: string;
        items?: ReadonlyArray<{ type: string; id: string; route?: string }>;
    }>
): ExtractedLink[] {
    const links: ExtractedLink[] = [];

    for (const item of items) {
        if (item.type === 'link' && item.route !== undefined) {
            links.push({ sidebar: sidebarKey, itemId: item.id, route: item.route });
        } else if (item.type === 'group' && Array.isArray(item.items)) {
            links.push(...extractLinks(sidebarKey, item.items));
        }
        // separator: skip
    }

    return links;
}

/**
 * Collects all link items from every sidebar in the sidebars registry.
 *
 * @returns Flat array of all extracted link items across all sidebars
 */
function collectAllLinks(): ExtractedLink[] {
    const all: ExtractedLink[] = [];

    for (const [key, sidebar] of Object.entries(sidebars)) {
        if (sidebar && Array.isArray(sidebar.items)) {
            all.push(...extractLinks(key, sidebar.items));
        }
    }

    return all;
}

// ---------------------------------------------------------------------------
// Step 3: Route resolution logic
// ---------------------------------------------------------------------------

/**
 * Strips the query string from a route path.
 *
 * @example
 * stripQuery('/posts?status=published') // '/posts'
 * stripQuery('/posts') // '/posts'
 */
function stripQuery(route: string): string {
    const qIdx = route.indexOf('?');
    return qIdx === -1 ? route : route.slice(0, qIdx);
}

/**
 * Splits a URL path into its segments, filtering empty strings.
 *
 * @example
 * pathSegments('/accommodations/$id/edit') // ['accommodations', '$id', 'edit']
 */
function pathSegments(path: string): string[] {
    return path.split('/').filter(Boolean);
}

/**
 * Returns true if `routePattern` is a dynamic segment placeholder (starts with `$`).
 */
function isDynamic(segment: string): boolean {
    return segment.startsWith('$');
}

/**
 * Determines whether a sidebar link route resolves against the set of real
 * TanStack Router route patterns.
 *
 * Resolution rules (in order):
 * 1. **Exact match**: the stripped route is directly in `realRoutes`.
 * 2. **Dynamic match**: the route segments match a real route pattern when
 *    `$param` segments in the real pattern are treated as wildcards.
 *
 * A static link `/accommodations` resolves if the real route set contains
 * `/accommodations` (from `accommodations/index.tsx`).
 *
 * A static link `/accommodations/new` resolves if the set contains
 * `/accommodations/new` (from `accommodations/new.tsx`).
 *
 * @param linkRoute  - The route from the sidebar config (query-stripped)
 * @param realRoutes - Set of real route patterns from the filesystem
 * @returns true if the link resolves to a real route
 */
function resolves(linkRoute: string, realRoutes: Set<string>): boolean {
    // Rule 1: exact
    if (realRoutes.has(linkRoute)) return true;

    // Rule 2: dynamic matching — compare segment by segment
    const linkParts = pathSegments(linkRoute);

    for (const realPattern of realRoutes) {
        const realParts = pathSegments(realPattern);
        if (realParts.length !== linkParts.length) continue;

        const match = realParts.every((rSeg, i) => {
            const lSeg = linkParts[i];
            return isDynamic(rSeg) || rSeg === lSeg;
        });

        if (match) return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Step 4: Main validation runner
// ---------------------------------------------------------------------------

/**
 * Main entry point. Runs the full validation and exits with 0 on success
 * or 1 on failure.
 */
async function main(): Promise<void> {
    console.log('validate-sidebar-routes — checking IA config against real routes...\n');

    // Build real route set
    const realRoutes = await buildRealRouteSet();
    console.log(`Real routes discovered: ${realRoutes.size}`);

    // Debug: print all discovered routes (sorted)
    const sortedRoutes = [...realRoutes].sort();
    for (const r of sortedRoutes) {
        console.log(`  ${r}`);
    }
    console.log('');

    // Extract all link items
    const links = collectAllLinks();
    const sidebarCount = Object.keys(sidebars).length;

    console.log(`Sidebars in config: ${sidebarCount}`);
    console.log(`Link items to validate: ${links.length}\n`);

    // Validate each link
    const badLinks: BadLink[] = [];

    for (const link of links) {
        const stripped = stripQuery(link.route);

        if (!resolves(stripped, realRoutes)) {
            badLinks.push({
                sidebar: link.sidebar,
                itemId: link.itemId,
                route: link.route,
                reason: `No real route matches "${stripped}" (exact or dynamic)`
            });
        }
    }

    // Report results
    if (badLinks.length > 0) {
        console.error('FAILED — unresolvable sidebar links found:\n');
        for (const bad of badLinks) {
            console.error(`  Sidebar:  ${bad.sidebar}`);
            console.error(`  Item ID:  ${bad.itemId}`);
            console.error(`  Route:    ${bad.route}`);
            console.error(`  Reason:   ${bad.reason}`);
            console.error('');
        }
        console.error(
            `${badLinks.length} bad link(s) found. Fix the sidebar config or add the missing routes.`
        );
        process.exit(1);
    }

    console.log(
        `OK — ${sidebarCount} sidebar(s), ${links.length} link item(s), all resolved to real routes.`
    );
    process.exit(0);
}

main().catch((err: unknown) => {
    console.error('validate-sidebar-routes: unexpected error:', err);
    process.exit(1);
});
