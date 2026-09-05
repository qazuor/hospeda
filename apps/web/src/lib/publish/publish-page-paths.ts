/**
 * @file publish-page-paths.ts
 * @description Where each vertical publishes, and the account pages its publish
 * page links to (HOS-1156).
 *
 * ## Why this is one map and not three literals
 *
 * These paths are named from five places: the three pages themselves, the header
 * menu (`PUBLISH_CTA_OPTIONS`), the five 301s off the superseded URLs, the
 * sign-up return URL, and the static guard that asserts none of the superseded
 * URLs is linked any more. HOS-1156 exists because a link went stale in exactly
 * that way — `4d7e448ea` repointed eighteen call sites at a 301 whose target had
 * changed meaning, and one of them was the "Publicar" button.
 *
 * A path that appears once cannot drift from itself.
 *
 * `import type` for the vertical union on purpose: this module is reachable from
 * `discovery-doors.ts`, which the header island imports, and a value import of
 * `endpoints-protected` would drag the whole protected API surface into the
 * browser bundle. The type is erased at build time; nothing ships.
 *
 * @module lib/publish/publish-page-paths
 */

import type { PublishVerticalSlug } from '@/lib/api/endpoints-protected';

/**
 * Each vertical's publish page, as a `buildUrl` path (no locale, no slashes at
 * the ends).
 *
 * The two commerce segments are Spanish, like every other public route in this
 * app: the URL is a user-facing surface, not an identifier.
 */
export const PUBLISH_PAGE_PATH_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'publicar',
    gastronomy: 'publicar/gastronomia',
    experience: 'publicar/experiencias'
} as const;

/**
 * Where an owner manages the listings of one vertical — "Ver mis fichas" on the
 * precheck panel, and where the "pick among several drafts" branch sends them.
 *
 * The two commerce verticals share one page: `/mi-cuenta/comercio/` lists both,
 * which is correct here because an owner who has drafts in both verticals still
 * finds each of them there.
 */
export const ACCOUNT_LISTINGS_PATH_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'mi-cuenta/propiedades',
    gastronomy: 'mi-cuenta/comercio',
    experience: 'mi-cuenta/comercio'
} as const;

/**
 * The sales page each publish page links to, for a visitor who wants the
 * argument before the form (§6 point 4). Its `/precios/` child is the same path
 * plus that segment — see {@link PRICING_PAGE_PATH_BY_VERTICAL}.
 */
export const PLANS_PAGE_PATH_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: 'planes/anfitriones',
    gastronomy: 'planes/gastronomia',
    experience: 'planes/experiencias'
} as const;

/**
 * The price grid of each vertical's plans.
 *
 * Derived from {@link PLANS_PAGE_PATH_BY_VERTICAL} rather than re-listed: the
 * `/precios/` child is a fact about the sales-page route shape, and two copies
 * of it would be two places for a rename to land.
 */
export const PRICING_PAGE_PATH_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, string>> = {
    accommodation: `${PLANS_PAGE_PATH_BY_VERTICAL.accommodation}/precios`,
    gastronomy: `${PLANS_PAGE_PATH_BY_VERTICAL.gastronomy}/precios`,
    experience: `${PLANS_PAGE_PATH_BY_VERTICAL.experience}/precios`
} as const;
