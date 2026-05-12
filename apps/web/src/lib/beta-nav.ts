/**
 * @file beta-nav.ts
 * @description Build the hierarchical navigation tree for the beta docs site
 * from the `beta` Content Collection. Used by `BetaSidebar.astro` and by the
 * catch-all route to compute prev/next neighbours.
 *
 * The tree is grouped by `role` (top-level) and `section` (sub-headers), and
 * sorted by `order` ascending within each grouping.
 *
 * Roles are listed in deliberate reading order — Empezar first, then the per-
 * audience tracks, then FAQ. `common` is reserved for the index page and is
 * not surfaced as a sidebar group.
 */

import type { CollectionEntry } from 'astro:content';

export type BetaRole = CollectionEntry<'beta'>['data']['role'];

/**
 * Ordered list of roles as they should appear in the sidebar.
 * `common` is intentionally absent — that group only holds the index page.
 */
export const BETA_ROLES_ORDER: ReadonlyArray<BetaRole> = [
    'empezar',
    'turista',
    'host',
    'admin-editor',
    'pago-real',
    'reportar-bugs',
    'faq'
];

/**
 * Human-readable label per role for the sidebar.
 */
export const BETA_ROLE_LABELS: Record<BetaRole, string> = {
    common: 'General',
    empezar: 'Empezar',
    turista: 'Turista',
    host: 'Host / Propietario',
    'admin-editor': 'Admin / Editor',
    'pago-real': 'Pago real',
    'reportar-bugs': 'Reportar bugs',
    faq: 'FAQ'
};

export interface BetaNavEntry {
    readonly id: string;
    readonly title: string;
    readonly url: string;
    readonly order: number;
    readonly section: string;
}

export interface BetaNavGroup {
    readonly role: BetaRole;
    readonly label: string;
    readonly entries: ReadonlyArray<BetaNavEntry>;
}

function toUrl(id: string): string {
    return id === 'index' ? '/beta/' : `/beta/${id}/`;
}

/**
 * Builds the ordered sidebar nav tree from the collection.
 * Drops draft entries and excludes the index page (it's the role-selector home).
 */
export function buildBetaNav(
    docs: ReadonlyArray<CollectionEntry<'beta'>>
): ReadonlyArray<BetaNavGroup> {
    const visible = docs.filter((doc) => !doc.data.draft && doc.id !== 'index');

    const byRole = new Map<BetaRole, BetaNavEntry[]>();
    for (const doc of visible) {
        const role = doc.data.role;
        const entry: BetaNavEntry = {
            id: doc.id,
            title: doc.data.title,
            url: toUrl(doc.id),
            order: doc.data.order,
            section: doc.data.section ?? ''
        };
        const bucket = byRole.get(role);
        if (bucket) {
            bucket.push(entry);
        } else {
            byRole.set(role, [entry]);
        }
    }

    const groups: BetaNavGroup[] = [];
    for (const role of BETA_ROLES_ORDER) {
        const entries = byRole.get(role);
        if (!entries || entries.length === 0) continue;
        groups.push({
            role,
            label: BETA_ROLE_LABELS[role],
            entries: entries.slice().sort((a, b) => a.order - b.order)
        });
    }

    return groups;
}

/**
 * Flattens the nav tree into a single ordered list — the reading order across
 * the whole site. Used to compute prev/next neighbours for a given doc id.
 */
export function flattenBetaNav(groups: ReadonlyArray<BetaNavGroup>): ReadonlyArray<BetaNavEntry> {
    return groups.flatMap((group) => group.entries);
}

export interface NeighbourLinks {
    readonly prev: BetaNavEntry | null;
    readonly next: BetaNavEntry | null;
}

/**
 * Finds the prev/next siblings of a given doc id in reading order.
 * Returns nulls at the boundaries.
 */
export function findNeighbours(
    flat: ReadonlyArray<BetaNavEntry>,
    currentId: string
): NeighbourLinks {
    const index = flat.findIndex((entry) => entry.id === currentId);
    if (index === -1) {
        return { prev: null, next: null };
    }
    return {
        prev: index > 0 ? (flat[index - 1] ?? null) : null,
        next: index < flat.length - 1 ? (flat[index + 1] ?? null) : null
    };
}
