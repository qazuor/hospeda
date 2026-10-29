/**
 * @file step-4c.legacy.ts
 * @description The retired vocabulary that step 4c must also purge (HOS-1957, G10).
 *
 * HOS-1801 renamed `gastronomy` to `venue` and `/gastronomia/` to `/comer-y-salir/`.
 * Production's edge still holds pages cached under the OLD tags and OLD URL
 * prefixes: the current vocabulary no longer names them, so no ordinary purge
 * would ever reach them. They are listed here, as a checked-in constant, and a
 * test pins them. Do not derive them from `@repo/cache-tags`: that package no
 * longer knows the old words, which is exactly why a derived list would be empty.
 *
 * Source of the old set: `origin/main:packages/cache-tags/src/vocabulary.ts`
 * (`CACHE_TAG_ENTITY_PREFIXES.gastronomy = 'gastro'`,
 * `CACHE_TAG_COLLECTIONS.gastronomy = 'list-gastro'`).
 */

/** The retired collection tags, bare (the revalidation service adds the `<env>:` namespace). */
export const LEGACY_COLLECTION_TAGS = ['list-gastro'] as const;

/** The retired per-entity tag prefix: the old tag of a listing is `gastro-<slug>` or `gastro-<id>`. */
export const LEGACY_ENTITY_TAG_PREFIX = 'gastro' as const;

/** Both production hosts: one Cloudflare cache key per host. */
export const LEGACY_PREFIX_HOSTS = ['hospeda.com.ar', 'www.hospeda.com.ar'] as const;

/** Locales whose pages were cached. */
export const LEGACY_PREFIX_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Route segments (after `/<lang>`) of the old gastronomy pages and of their new
 * `comer-y-salir` twins. The redirects from the old to the new routes are 302s
 * and are cached without a tag, so only a prefix purge reaches them.
 */
export const LEGACY_PREFIX_PATHS = [
    'gastronomia/',
    'comer-y-salir/',
    'planes/gastronomia/',
    'planes/comer-y-salir/',
    'presentacion/gastronomia/',
    'presentacion/comer-y-salir/',
    'publicar/gastronomia/',
    'publicar/comer-y-salir/',
    'publicar-restaurante/'
] as const;

/** Cloudflare accepts at most 100 operations per purge request. */
export const MAX_PURGE_OPERATIONS_PER_REQUEST = 100;

/** Builds the 54 URL prefixes (host + path, no scheme): 2 hosts x 3 locales x 9 routes. */
export function buildLegacyPrefixes(): readonly string[] {
    return LEGACY_PREFIX_HOSTS.flatMap((host) =>
        LEGACY_PREFIX_LOCALES.flatMap((locale) =>
            LEGACY_PREFIX_PATHS.map((path) => `${host}/${locale}/${path}`)
        )
    );
}

/** Builds the retired per-entity tags of listings known by slug and/or id. */
export function buildLegacyEntityTags({
    listings
}: {
    readonly listings: readonly { readonly id: string; readonly slug?: string | null }[];
}): readonly string[] {
    return listings.flatMap(({ id, slug }) => {
        const identifiers = [slug, id].filter(
            (value): value is string => typeof value === 'string' && value.length > 0
        );
        return identifiers.map((identifier) => `${LEGACY_ENTITY_TAG_PREFIX}-${identifier}`);
    });
}
