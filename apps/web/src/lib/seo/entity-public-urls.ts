/**
 * @file entity-public-urls.ts
 * @description The canonical map from a content entity to its public URL path,
 * and the per-locale expansion of it (HOS-585 G-1).
 *
 * This exists because two independent consumers need the same answer to "where
 * does this accommodation live on the public site?":
 *
 * - `sitemap-dynamic.xml.ts`, which advertises every indexable URL to crawlers.
 * - `pages/api/indexnow.ts`, which tells the search engines that one of them
 *   just changed.
 *
 * Two copies of that mapping is a bug waiting to happen with a very long fuse:
 * they would agree on the day they were written and drift the first time a
 * section is renamed, at which point the sitemap and the change notifications
 * would describe different sites and nothing would fail loudly. So the map lives
 * here once and both import it.
 *
 * Deliberately scoped to the four entity types that have a page of their own AND
 * emit revalidation events. POIs, facet landings and static pages are sitemap-only
 * concerns and stay in the sitemap: they are not driven by a content write, so
 * nothing would ever notify about them.
 */

import { SITEMAP_LOCALES } from './sitemap-xml';

/**
 * Content entities that have a public detail page and can be notified about.
 *
 * Note what is NOT here, and why. The revalidation event union also carries
 * `accommodation_review` / `destination_review` (which change their PARENT's
 * page, not one of their own) and `tag` / `amenity` (which have no page at all).
 * Callers normalize or drop those before reaching this module — an entity type
 * in this list is one that maps to exactly one canonical URL per locale.
 */
export const NOTIFIABLE_ENTITY_TYPES = ['accommodation', 'destination', 'event', 'post'] as const;

/** An entity type that maps to exactly one public page per locale. */
export type NotifiableEntityType = (typeof NOTIFIABLE_ENTITY_TYPES)[number];

/**
 * Locale-agnostic public path for each notifiable entity, with leading and
 * trailing slash. The locale prefix is added by {@link buildEntityLocaleUrls}.
 *
 * The segments are the Spanish ones in EVERY locale — that is the site's URL
 * convention, not an oversight. `/en/alojamientos/x/` is correct; `/en/accommodations/x/`
 * does not exist and 404s.
 */
export const ENTITY_PUBLIC_PATHS: Readonly<Record<NotifiableEntityType, (slug: string) => string>> =
    {
        accommodation: (slug) => `/alojamientos/${slug}/`,
        destination: (slug) => `/destinos/${slug}/`,
        event: (slug) => `/eventos/${slug}/`,
        post: (slug) => `/publicaciones/${slug}/`
    };

/**
 * Type guard for the notifiable set, for validating untrusted input.
 *
 * @param value - Candidate entity type.
 * @returns Whether it maps to a public page.
 */
export function isNotifiableEntityType(value: unknown): value is NotifiableEntityType {
    return (
        typeof value === 'string' && (NOTIFIABLE_ENTITY_TYPES as readonly string[]).includes(value)
    );
}

/**
 * Expand one entity into its absolute public URL in every supported locale.
 *
 * All three locales are returned, not just Spanish: each is a distinct
 * indexable URL that the sitemap already advertises with reciprocal hreflang,
 * so a change to the underlying row changes all three pages at once. Submitting
 * only the Spanish one would leave the English and Portuguese versions stale in
 * the index for as long as the crawler took to find them on its own.
 *
 * @param params.entityType - The entity's type.
 * @param params.slug - The entity's URL slug.
 * @param params.siteUrl - Absolute site origin. A trailing slash is tolerated.
 * @returns One absolute URL per locale, in the sitemap's locale order.
 */
export function buildEntityLocaleUrls({
    entityType,
    slug,
    siteUrl
}: {
    readonly entityType: NotifiableEntityType;
    readonly slug: string;
    readonly siteUrl: string;
}): readonly string[] {
    const origin = siteUrl.replace(/\/$/, '');
    const path = ENTITY_PUBLIC_PATHS[entityType](slug);

    return SITEMAP_LOCALES.map(({ prefix }) => `${origin}${prefix}${path}`);
}
