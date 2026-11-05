/**
 * Reserved listing slugs — the slug values a listing may never take because
 * Astro resolves them to a STATIC segment before `[slug]`.
 *
 * A public listing lives at `/{locale}/<folder>/<slug>/` (for example
 * `/es/comer-y-salir/mi-bar/`). A sibling static entry in the same folder —
 * `page/`, `tipo/`, `mapa.astro`, ... — wins over the `[slug]` route, so a
 * listing whose slug is one of those words loses its page and every
 * sub-page hanging off it (`/fotos/`, `/carta/`, ...). The routing outcome is
 * silent: there is no 404 and no build error, the listing just becomes
 * unreachable at its own URL.
 *
 * This list is the single source of truth for every write path that stores a
 * listing slug: the auto-generator skips reserved candidates (appending a
 * `-2` suffix like any other collision), and an explicit slug supplied by the
 * admin is rejected. The static guard under `apps/web/test/static-guards`
 * compares this list against the real page folders and fails when a new
 * static segment appears without being added here.
 *
 * `rubro` is reserved in all three listing verticals even though only the
 * venue folder has no `rubro/` today (DEC-FAC-011 defines the collection route
 * for any vertical), so a listing created before that route ships cannot
 * squat the slug.
 *
 * @module reserved-listing-slugs
 */

import { VerticalEnum } from '../enums/vertical.enum.js';
import type { VerticalValue } from '../enums/vertical.schema.js';

/**
 * Static sibling segments that outrank `[slug]` in each listing vertical.
 *
 * The record is exhaustive over {@link VerticalValue}: adding a vertical
 * without deciding its reserved segments is a type error. `tourist` and
 * `partner` have no listing detail route with static siblings, so their
 * lists are empty.
 */
export const RESERVED_LISTING_SLUGS: Readonly<Record<VerticalValue, readonly string[]>> = {
    [VerticalEnum.ACCOMMODATION]: [
        'caracteristicas',
        'comodidades',
        'comparar',
        'mapa',
        'page',
        'rubro',
        'tipo'
    ],
    [VerticalEnum.VENUE]: ['page', 'rubro'],
    [VerticalEnum.EXPERIENCE]: ['page', 'rubro'],
    [VerticalEnum.TOURIST]: [],
    [VerticalEnum.PARTNER]: []
};

/** Input of {@link isReservedListingSlug}. */
export interface ReservedListingSlugInput {
    /** Listing vertical the slug belongs to. */
    readonly vertical: VerticalValue;
    /** Candidate slug, compared case-insensitively. */
    readonly slug: string;
}

/**
 * Reports whether a candidate slug is reserved for a listing vertical.
 *
 * Comparison is case-insensitive because the explicit admin slug has no
 * format regex of its own; `Rubro` must be rejected exactly like `rubro`.
 *
 * @param input - The vertical and candidate slug.
 * @returns `true` when the vertical reserves the slug.
 */
export function isReservedListingSlug(input: ReservedListingSlugInput): boolean {
    const reserved = RESERVED_LISTING_SLUGS[input.vertical] ?? [];
    const normalized = input.slug.trim().toLowerCase();
    return reserved.includes(normalized);
}
