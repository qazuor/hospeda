/**
 * @file facet-slugs.ts
 * @description Canonical Spanish URL slugs for the three enums promoted to
 * first-class, dedicated landing pages: `AccommodationTypeEnum`,
 * `EventCategoryEnum`, and `PostCategoryEnum` (H-110).
 *
 * All three landing families live under an otherwise all-Spanish path
 * (`/es/alojamientos/tipo/…`, `/es/eventos/categoria/…`,
 * `/es/publicaciones/categoria/…`), and that path is IDENTICAL across every
 * supported locale — only the `/{lang}/` prefix changes
 * (`/en/alojamientos/tipo/cabin/` responds 200; `/en/accommodations/type/…`
 * does not exist). Before H-110 the last URL segment was the raw enum value
 * lowercased and hyphenated (`.toLowerCase().replace(/_/g, '-')`), which is
 * English — a bilingual inconsistency that also produced dead links whenever
 * a user or search engine guessed the Spanish word instead (e.g.
 * `/es/alojamientos/tipo/cabana/` 404'd while `/tipo/cabin/` served 200).
 *
 * The slug tables below are OWNER-APPROVED, not mechanically derived from the
 * enum, because:
 * - some enum members need a multi-word Spanish rendering a naive
 *   lowercase+hyphenate transform cannot produce (`COUNTRY_HOUSE` ->
 *   `casa-de-campo`, `RESORT` -> `complejo-turistico`);
 * - the i18n display labels (`accommodations.byType.types.<ENUM>.name`, etc.)
 *   carry plurals, accents, and symbols unfit for a URL segment (the same
 *   reasoning that keeps amenity/feature slugs separate from their i18n
 *   labels since SPEC-266) — the slug must be a distinct, URL-safe value,
 *   never derived from marketing copy.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the enum<->slug mapping,
 * consumed by:
 * - the dedicated landing pages (`alojamientos/tipo/[type]`,
 *   `eventos/categoria/[category]`, `publicaciones/categoria/[category]`),
 *   to resolve the URL segment to its enum value (404 on no match);
 * - `middleware.ts`, to 301-redirect the legacy English slug (and any other
 *   naive-transform link) to its canonical Spanish counterpart;
 * - `promoted-facet-canonical.ts`, `FeaturedAccommodationsSection.astro`, and
 *   `sitemap-dynamic.xml.ts`, to build the outbound href/URL for a given
 *   enum value.
 */

import { AccommodationTypeEnum, EventCategoryEnum, PostCategoryEnum } from '@repo/schemas';

/**
 * Owner-approved canonical Spanish slug for every `AccommodationTypeEnum`
 * value, keyed by the enum itself so TypeScript enforces exhaustiveness at
 * compile time — a new enum member that is not added here fails to compile.
 */
export const ACCOMMODATION_TYPE_SLUG_BY_ENUM: Readonly<Record<AccommodationTypeEnum, string>> =
    Object.freeze({
        [AccommodationTypeEnum.APARTMENT]: 'departamento',
        [AccommodationTypeEnum.HOUSE]: 'casa',
        [AccommodationTypeEnum.COUNTRY_HOUSE]: 'casa-de-campo',
        [AccommodationTypeEnum.CABIN]: 'cabana',
        [AccommodationTypeEnum.HOTEL]: 'hotel',
        [AccommodationTypeEnum.HOSTEL]: 'hostel',
        [AccommodationTypeEnum.CAMPING]: 'camping',
        [AccommodationTypeEnum.ROOM]: 'habitacion',
        [AccommodationTypeEnum.MOTEL]: 'motel',
        [AccommodationTypeEnum.RESORT]: 'complejo-turistico',
        [AccommodationTypeEnum.APART_HOTEL]: 'apart-hotel',
        [AccommodationTypeEnum.ESTANCIA]: 'estancia',
        [AccommodationTypeEnum.BED_AND_BREAKFAST]: 'bed-and-breakfast'
    });

/** Owner-approved canonical Spanish slug for every `EventCategoryEnum` value. */
export const EVENT_CATEGORY_SLUG_BY_ENUM: Readonly<Record<EventCategoryEnum, string>> =
    Object.freeze({
        [EventCategoryEnum.MUSIC]: 'musica',
        [EventCategoryEnum.CULTURE]: 'cultura',
        [EventCategoryEnum.SPORTS]: 'deportes',
        [EventCategoryEnum.GASTRONOMY]: 'gastronomia',
        [EventCategoryEnum.FESTIVAL]: 'festival',
        [EventCategoryEnum.NATURE]: 'naturaleza',
        [EventCategoryEnum.THEATER]: 'teatro',
        [EventCategoryEnum.WORKSHOP]: 'taller',
        [EventCategoryEnum.OTHER]: 'otros'
    });

/** Owner-approved canonical Spanish slug for every `PostCategoryEnum` value. */
export const POST_CATEGORY_SLUG_BY_ENUM: Readonly<Record<PostCategoryEnum, string>> = Object.freeze(
    {
        [PostCategoryEnum.EVENTS]: 'eventos',
        [PostCategoryEnum.CULTURE]: 'cultura',
        [PostCategoryEnum.GASTRONOMY]: 'gastronomia',
        [PostCategoryEnum.NATURE]: 'naturaleza',
        [PostCategoryEnum.TOURISM]: 'turismo',
        [PostCategoryEnum.GENERAL]: 'general',
        [PostCategoryEnum.SPORT]: 'deportes',
        [PostCategoryEnum.CARNIVAL]: 'carnaval',
        [PostCategoryEnum.NIGHTLIFE]: 'noche',
        [PostCategoryEnum.HISTORY]: 'historia',
        [PostCategoryEnum.TRADITIONS]: 'tradiciones',
        [PostCategoryEnum.WELLNESS]: 'bienestar',
        [PostCategoryEnum.FAMILY]: 'familia',
        [PostCategoryEnum.TIPS]: 'consejos',
        [PostCategoryEnum.ART]: 'arte',
        [PostCategoryEnum.BEACH]: 'playa',
        [PostCategoryEnum.RURAL]: 'rural',
        [PostCategoryEnum.FESTIVALS]: 'festivales'
    }
);

/**
 * Build the slug -> enum reverse lookup from a forward (enum -> slug) map.
 * Keys are lowercased so callers can resolve a slug case-insensitively
 * without duplicating that normalization at every call site.
 *
 * @param forward - The facet's canonical enum -> slug map.
 * @returns A `Map` from lowercase slug to enum value.
 */
function buildReverseSlugMap<T extends string>(
    forward: Readonly<Record<T, string>>
): ReadonlyMap<string, T> {
    return new Map(
        Object.entries(forward).map(([enumValue, slug]) => [
            (slug as string).toLowerCase(),
            enumValue as T
        ])
    );
}

/**
 * The pre-H-110 naive slug transform (`.toLowerCase().replace(/_/g, '-')`),
 * reproduced here ONLY to recognize the legacy English link shape for the
 * middleware redirect below — never used to compute a slug that is actually
 * rendered or served with a 200.
 *
 * @param value - The raw enum member name (e.g. `'COUNTRY_HOUSE'`).
 * @returns The naive lowercase-hyphenated transform (e.g. `'country-house'`).
 */
function naiveEnglishSlug(value: string): string {
    return value.toLowerCase().replace(/_/g, '-');
}

/**
 * Build the legacy-English-slug -> canonical-Spanish-slug lookup consumed by
 * the middleware redirect, for one facet's forward map.
 *
 * Entries where the naive English transform already equals the Spanish slug
 * (e.g. `hotel`, `camping`, `motel`, `festival`, `general`, `rural`) are
 * DELIBERATELY OMITTED. Including them would make the middleware redirect a
 * URL to itself — at best a wasted round trip, at worst the seed of a loop if
 * the surrounding match logic ever changes. Omission is the loop-proofing
 * mechanism itself, not a runtime check bolted on top of it.
 *
 * @param forward - The facet's canonical enum -> slug map.
 * @returns A frozen record from legacy English slug to canonical Spanish
 *   slug, containing only the pairs where the two differ.
 */
function buildLegacyEnglishSlugMap<T extends string>(
    forward: Readonly<Record<T, string>>
): Readonly<Record<string, string>> {
    const entries = Object.entries(forward)
        .map(
            ([enumValue, spanishSlug]) =>
                [naiveEnglishSlug(enumValue), spanishSlug as string] as const
        )
        .filter(([englishSlug, spanishSlug]) => englishSlug !== spanishSlug);
    return Object.freeze(Object.fromEntries(entries));
}

const ACCOMMODATION_TYPE_SLUG_TO_ENUM = buildReverseSlugMap(ACCOMMODATION_TYPE_SLUG_BY_ENUM);
const EVENT_CATEGORY_SLUG_TO_ENUM = buildReverseSlugMap(EVENT_CATEGORY_SLUG_BY_ENUM);
const POST_CATEGORY_SLUG_TO_ENUM = buildReverseSlugMap(POST_CATEGORY_SLUG_BY_ENUM);

/**
 * Legacy English slug -> canonical Spanish slug for `AccommodationTypeEnum`,
 * consumed by `middleware.ts` to 301-redirect an old English link (e.g.
 * `/alojamientos/tipo/cabin/`) to its Spanish counterpart
 * (`/alojamientos/tipo/cabana/`). Does not contain slugs identical in both
 * forms (`hotel`, `camping`, `motel`) — see {@link buildLegacyEnglishSlugMap}.
 */
export const ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS = buildLegacyEnglishSlugMap(
    ACCOMMODATION_TYPE_SLUG_BY_ENUM
);

/** Legacy English slug -> canonical Spanish slug for `EventCategoryEnum`. See {@link ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS}. */
export const EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS = buildLegacyEnglishSlugMap(
    EVENT_CATEGORY_SLUG_BY_ENUM
);

/** Legacy English slug -> canonical Spanish slug for `PostCategoryEnum`. See {@link ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS}. */
export const POST_CATEGORY_LEGACY_ENGLISH_SLUGS = buildLegacyEnglishSlugMap(
    POST_CATEGORY_SLUG_BY_ENUM
);

/**
 * Resolve a URL slug to its `AccommodationTypeEnum` value. Case-insensitive.
 *
 * @param params - Object containing the raw `slug` from the URL.
 * @returns The matching `AccommodationTypeEnum` value, or `undefined` when
 *   the slug is not a recognized canonical Spanish slug.
 *
 * @example
 * ```ts
 * resolveAccommodationTypeSlug({ slug: 'cabana' }); // AccommodationTypeEnum.CABIN
 * resolveAccommodationTypeSlug({ slug: 'cabin' });  // undefined (legacy English slug — see middleware)
 * ```
 */
export function resolveAccommodationTypeSlug({
    slug
}: {
    readonly slug: string | undefined;
}): AccommodationTypeEnum | undefined {
    if (!slug) return undefined;
    return ACCOMMODATION_TYPE_SLUG_TO_ENUM.get(slug.toLowerCase());
}

/**
 * Resolve a URL slug to its `EventCategoryEnum` value. Case-insensitive.
 *
 * @param params - Object containing the raw `slug` from the URL.
 * @returns The matching `EventCategoryEnum` value, or `undefined` when the
 *   slug is not a recognized canonical Spanish slug.
 */
export function resolveEventCategorySlug({
    slug
}: {
    readonly slug: string | undefined;
}): EventCategoryEnum | undefined {
    if (!slug) return undefined;
    return EVENT_CATEGORY_SLUG_TO_ENUM.get(slug.toLowerCase());
}

/**
 * Resolve a URL slug to its `PostCategoryEnum` value. Case-insensitive.
 *
 * @param params - Object containing the raw `slug` from the URL.
 * @returns The matching `PostCategoryEnum` value, or `undefined` when the
 *   slug is not a recognized canonical Spanish slug.
 */
export function resolvePostCategorySlug({
    slug
}: {
    readonly slug: string | undefined;
}): PostCategoryEnum | undefined {
    if (!slug) return undefined;
    return POST_CATEGORY_SLUG_TO_ENUM.get(slug.toLowerCase());
}

/**
 * Look up the canonical Spanish slug for an `AccommodationTypeEnum` value.
 *
 * @param params - Object containing the `type` enum value.
 * @returns The canonical Spanish URL slug (e.g. `'casa-de-campo'`).
 */
export function slugForAccommodationType({
    type
}: {
    readonly type: AccommodationTypeEnum;
}): string {
    return ACCOMMODATION_TYPE_SLUG_BY_ENUM[type];
}

/**
 * Look up the canonical Spanish slug for an `EventCategoryEnum` value.
 *
 * @param params - Object containing the `category` enum value.
 * @returns The canonical Spanish URL slug (e.g. `'gastronomia'`).
 */
export function slugForEventCategory({
    category
}: {
    readonly category: EventCategoryEnum;
}): string {
    return EVENT_CATEGORY_SLUG_BY_ENUM[category];
}

/**
 * Look up the canonical Spanish slug for a `PostCategoryEnum` value.
 *
 * @param params - Object containing the `category` enum value.
 * @returns The canonical Spanish URL slug (e.g. `'noche'`).
 */
export function slugForPostCategory({ category }: { readonly category: PostCategoryEnum }): string {
    return POST_CATEGORY_SLUG_BY_ENUM[category];
}
