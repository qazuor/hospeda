/**
 * @fileoverview
 * Pure mapping utilities for ISR page revalidation.
 * Maps entity change events to the set of URL paths that must be revalidated.
 *
 * All exports are pure functions — no side effects, no I/O.
 *
 * URL slugs match the web app route definitions exactly:
 *  - Accommodation types: hotel, hostel, cabin, apartment, camping, estancia, posada
 *  - Event categories: festival, fair, sport, cultural, gastronomy
 *  - Posts use /publicaciones/ (not /posts/)
 */

/** Supported locales for URL generation */
export const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Accommodation type URL slugs as accepted by the web app route
 * `/[lang]/alojamientos/tipo/[type]/`.
 * Source of truth: `apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro`
 */
export const ACCOMMODATION_TYPE_SLUGS = [
    'hotel',
    'hostel',
    'cabin',
    'apartment',
    'camping',
    'estancia',
    'posada'
] as const;

export type AccommodationTypeSlug = (typeof ACCOMMODATION_TYPE_SLUGS)[number];

/**
 * Event category URL slugs as accepted by the web app route
 * `/[lang]/eventos/categoria/[category]/`.
 * Source of truth: `apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro`
 */
export const EVENT_CATEGORY_SLUGS = [
    'festival',
    'fair',
    'sport',
    'cultural',
    'gastronomy'
] as const;

export type EventCategorySlug = (typeof EVENT_CATEGORY_SLUGS)[number];

/**
 * Discriminated union describing an entity change event.
 * Each variant carries only the contextual data needed to compute affected paths precisely,
 * avoiding over-revalidation.
 */
export type EntityChangeData =
    | {
          /** Accommodation entity changed */
          readonly entityType: 'accommodation';
          /** Slug of the changed accommodation — triggers detail page revalidation */
          readonly slug: string;
          /** Slug of the parent destination — also revalidates the destination page */
          readonly destinationSlug?: string;
          /**
           * URL slug of the accommodation type (e.g. 'hotel', 'cabin').
           * When provided, only that type-filter page is revalidated.
           * When absent, all type-filter pages are revalidated.
           */
          readonly accommodationType?: string;
      }
    | {
          /** Accommodation entity changed (without slug context) */
          readonly entityType: 'accommodation';
          readonly slug?: undefined;
          readonly destinationSlug?: string;
          readonly accommodationType?: string;
      }
    | {
          /** Destination entity changed */
          readonly entityType: 'destination';
          /** Slug of the changed destination */
          readonly slug: string;
      }
    | {
          /** Destination entity changed (without slug context) */
          readonly entityType: 'destination';
          readonly slug?: undefined;
      }
    | {
          /** Event entity changed */
          readonly entityType: 'event';
          /** Slug of the changed event — triggers detail page revalidation */
          readonly slug: string;
          /**
           * URL slug of the event category (e.g. 'festival', 'cultural').
           * When provided, only that category page is revalidated.
           * When absent, all category pages are revalidated.
           */
          readonly category?: string;
      }
    | {
          /** Event entity changed (without slug context) */
          readonly entityType: 'event';
          readonly slug?: undefined;
          readonly category?: string;
      }
    | {
          /** Post/article entity changed */
          readonly entityType: 'post';
          /** Slug of the changed post — triggers detail page revalidation */
          readonly slug: string;
          /** Tag slugs whose filter pages should also be revalidated */
          readonly tagSlugs?: readonly string[];
      }
    | {
          /** Post/article entity changed (without slug context) */
          readonly entityType: 'post';
          readonly slug?: undefined;
          readonly tagSlugs?: readonly string[];
      }
    | {
          /** Accommodation review changed — revalidates the parent accommodation page */
          readonly entityType: 'accommodation_review';
          /** Slug of the parent accommodation */
          readonly accommodationSlug: string;
      }
    | {
          /** Accommodation review changed (without slug context) */
          readonly entityType: 'accommodation_review';
          readonly accommodationSlug?: undefined;
      }
    | {
          /** Destination review changed — revalidates the parent destination page */
          readonly entityType: 'destination_review';
          /** Slug of the parent destination */
          readonly destinationSlug: string;
      }
    | {
          /** Destination review changed (without slug context) */
          readonly entityType: 'destination_review';
          readonly destinationSlug?: undefined;
      }
    | {
          /**
           * Tag entity changed — invalidates accommodation listings
           * (tags affect accommodation search/filter pages)
           */
          readonly entityType: 'tag';
      }
    | {
          /**
           * Amenity entity changed — invalidates accommodation listings
           * (amenities are shown on accommodation listing pages)
           */
          readonly entityType: 'amenity';
      };

/**
 * Returns all URL paths that should be revalidated when an entity changes.
 * Generates paths for all provided locales.
 * Pure function — no side effects, no I/O, no throwing.
 *
 * @param event - Discriminated union describing the entity change with contextual data
 * @param locales - Locales to generate paths for (defaults to all supported locales)
 * @returns Deduplicated readonly array of URL paths to revalidate
 *
 * @example
 * ```ts
 * // Accommodation with type context — only revalidates cabin type page, not all types
 * const paths = getAffectedPaths({
 *   entityType: 'accommodation',
 *   slug: 'cabana-del-rio',
 *   accommodationType: 'cabin',
 *   destinationSlug: 'concordia',
 * });
 * // Includes: /alojamientos/, /alojamientos/cabana-del-rio/,
 * //           /alojamientos/tipo/cabin/, /destinos/concordia/
 * // (plus en/pt variants)
 *
 * // Post with tag slugs
 * const postPaths = getAffectedPaths({
 *   entityType: 'post',
 *   slug: 'mi-articulo',
 *   tagSlugs: ['turismo', 'gastronomia'],
 * });
 * ```
 */
export function getAffectedPaths(
    event: EntityChangeData,
    locales: readonly string[] = SUPPORTED_LOCALES
): readonly string[] {
    const paths = new Set<string>();

    switch (event.entityType) {
        case 'accommodation': {
            // Always revalidate the listing page
            for (const locale of locales) {
                paths.add(getLocalizedPath('/alojamientos/', locale));
            }
            // Detail page if slug provided
            if (event.slug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/alojamientos/${event.slug}/`, locale));
                }
            }
            // Type pages: only the specific type if provided, otherwise all types
            if (event.accommodationType) {
                for (const locale of locales) {
                    paths.add(
                        getLocalizedPath(`/alojamientos/tipo/${event.accommodationType}/`, locale)
                    );
                }
            } else {
                for (const typeSlug of ACCOMMODATION_TYPE_SLUGS) {
                    for (const locale of locales) {
                        paths.add(getLocalizedPath(`/alojamientos/tipo/${typeSlug}/`, locale));
                    }
                }
            }
            // Parent destination page if provided
            if (event.destinationSlug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/destinos/${event.destinationSlug}/`, locale));
                }
            }
            break;
        }

        case 'destination': {
            // Detail page if slug provided
            if (event.slug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/destinos/${event.slug}/`, locale));
                }
            }
            // Destination changes also affect accommodation listings
            // (accommodations display destination info)
            for (const locale of locales) {
                paths.add(getLocalizedPath('/alojamientos/', locale));
            }
            break;
        }

        case 'event': {
            // Always revalidate the events listing page
            for (const locale of locales) {
                paths.add(getLocalizedPath('/eventos/', locale));
            }
            // Detail page if slug provided
            if (event.slug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/eventos/${event.slug}/`, locale));
                }
            }
            // Category pages: only the specific category if provided, otherwise all categories
            if (event.category) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/eventos/categoria/${event.category}/`, locale));
                }
            } else {
                for (const categorySlug of EVENT_CATEGORY_SLUGS) {
                    for (const locale of locales) {
                        paths.add(getLocalizedPath(`/eventos/categoria/${categorySlug}/`, locale));
                    }
                }
            }
            break;
        }

        case 'post': {
            // Always revalidate the publications listing page
            for (const locale of locales) {
                paths.add(getLocalizedPath('/publicaciones/', locale));
            }
            // Detail page if slug provided (route: /publicaciones/[slug]/)
            if (event.slug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/publicaciones/${event.slug}/`, locale));
                }
            }
            // Tag filter pages if tagSlugs provided
            if (event.tagSlugs) {
                for (const tagSlug of event.tagSlugs) {
                    for (const locale of locales) {
                        paths.add(getLocalizedPath(`/publicaciones/etiqueta/${tagSlug}/`, locale));
                    }
                }
            }
            break;
        }

        case 'accommodation_review': {
            // Revalidates the parent accommodation detail page and the listing
            if (event.accommodationSlug) {
                for (const locale of locales) {
                    paths.add(
                        getLocalizedPath(`/alojamientos/${event.accommodationSlug}/`, locale)
                    );
                }
            }
            // Listing page is also affected (ratings update aggregate data shown in cards)
            for (const locale of locales) {
                paths.add(getLocalizedPath('/alojamientos/', locale));
            }
            break;
        }

        case 'destination_review': {
            // Revalidates the parent destination detail page
            if (event.destinationSlug) {
                for (const locale of locales) {
                    paths.add(getLocalizedPath(`/destinos/${event.destinationSlug}/`, locale));
                }
            }
            break;
        }

        case 'tag':
        case 'amenity': {
            // Tags and amenities are used as accommodation filters
            for (const locale of locales) {
                paths.add(getLocalizedPath('/alojamientos/', locale));
            }
            break;
        }

        default: {
            // Unknown entity type — no paths
            break;
        }
    }

    return Array.from(paths);
}

/**
 * Returns the localized URL path.
 * For 'es' (default locale), returns the path as-is (no prefix).
 * For other locales, prepends `/{locale}`.
 *
 * @param path - The base URL path (e.g. '/alojamientos/')
 * @param locale - The locale code (e.g. 'en', 'pt', 'es')
 * @returns Locale-prefixed path for non-default locales, bare path for 'es'
 *
 * @example
 * ```ts
 * getLocalizedPath('/eventos/', 'es')  // '/eventos/'
 * getLocalizedPath('/eventos/', 'en')  // '/en/eventos/'
 * getLocalizedPath('/eventos/', 'pt')  // '/pt/eventos/'
 * ```
 */
export function getLocalizedPath(path: string, locale: string): string {
    if (locale === 'es') return path;
    return `/${locale}${path}`;
}
