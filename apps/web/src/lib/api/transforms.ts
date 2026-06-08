/**
 * Centralized API response to card component prop transformations.
 *
 * Each function takes a raw API response item (Record<string, unknown>) and
 * returns a properly typed object matching the corresponding card component's
 * props interface. Components MUST NOT consume raw API data directly.
 *
 * Pipeline: API Response (raw) → transforms.ts → Component Props (clean)
 *
 * Type definitions live in `@/data/types` (single source of truth).
 * Re-exported here for backward compatibility with existing importers.
 */
import type {
    AccommodationCardData,
    AccommodationDetailData,
    ArticleCardData,
    CardAmenityFeature,
    DestinationCardData,
    DetailFaq,
    EventCardData,
    EventDetailData,
    ReviewCardData
} from '@/data/types';
import { getInitialsFromName } from '../avatar-utils';
import { webLogger } from '../logger';
import {
    extractFeaturedImage,
    extractFeaturedImageUrl,
    extractGalleryItems,
    extractGalleryUrls
} from '../media';
import { type I18nTextLike, resolveI18nText } from '../resolve-i18n-text';

// Re-export types from canonical source for backward compatibility
export type {
    AccommodationCardData,
    AccommodationDetailData,
    ArticleCardData,
    CardAmenityFeature,
    CardLocation,
    CardPrice,
    DestinationCardData,
    EventCardData,
    EventDetailData,
    EventLocation,
    ReviewCardData
} from '@/data/types';

/**
 * Normalizes a raw destination `faqs` array (from the public detail API) into
 * the clean `DetailFaq[]` shape consumed by `DestinationFaqAccordion` and the
 * `FAQPageJsonLd` builder. Tolerates a missing/non-array input (returns []).
 *
 * @param raw - The `faqs` field from a destination detail API response.
 * @returns Array of normalized FAQ items (empty when absent).
 */
export function toDestinationFaqs(raw: unknown): DetailFaq[] {
    if (!Array.isArray(raw)) return [];
    return (raw as ReadonlyArray<Record<string, unknown>>).map((faq) => ({
        id: String(faq.id || ''),
        question: String(faq.question || ''),
        answer: String(faq.answer || ''),
        category: faq.category ? String(faq.category) : null
    }));
}

// --- Accommodation Card Data (Detailed) --- unique to transforms

/** Props for AccommodationCardDetailed component. */
export interface AccommodationDetailedCardData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly type: string;
    readonly images: readonly string[];
    readonly location: { readonly city?: string; readonly state?: string };
    readonly capacity?: number;
    readonly bedrooms?: number;
    readonly beds?: number;
    readonly bathrooms?: number;
    readonly averageRating: number;
    readonly reviewsCount: number;
    readonly price?: { readonly amount: number; readonly currency: string };
    readonly isFeatured: boolean;
}

// --- Helper: derive city fields from cityDestination (SPEC-095) ---

/**
 * Derives flat city fields from an API entity's `cityDestination` projection.
 * Falls back to the legacy `destination`/`location.city` shape when the API
 * response predates SPEC-095 so older fixtures keep rendering during the
 * migration window. After re-seeding, the legacy branches should be unreachable
 * — a `webLogger.warn` records the fallback so we can spot lingering payloads.
 *
 * @param item - Raw API entity carrying either `cityDestination`, `destination`,
 * or `location.city`.
 * @returns `{ cityName, cityPath, cityDestinationSlug }` — empty strings when
 * none of the sources are present.
 */
function deriveCityFields(source: Record<string, unknown> | undefined): {
    readonly cityName: string;
    readonly cityPath: string;
    readonly cityDestinationSlug: string;
} {
    if (!source) return { cityName: '', cityPath: '', cityDestinationSlug: '' };

    const cityDestination = source.cityDestination as
        | { name?: unknown; path?: unknown; slug?: unknown }
        | undefined;

    if (cityDestination?.name) {
        return {
            cityName: String(cityDestination.name ?? ''),
            cityPath: String(cityDestination.path ?? ''),
            cityDestinationSlug: String(cityDestination.slug ?? '')
        };
    }

    const legacyDestination = source.destination as
        | { name?: unknown; path?: unknown; slug?: unknown }
        | undefined;
    const legacyLocation = source.location as { city?: unknown } | undefined;
    const legacyInlineCity = (source as { city?: unknown }).city;
    const legacyCityName = String(
        legacyDestination?.name || legacyLocation?.city || legacyInlineCity || ''
    );

    if (legacyCityName) {
        webLogger.warn(
            'transforms.deriveCityFields: cityDestination missing, using legacy fallback',
            {
                entityId: String((source as { id?: unknown }).id ?? ''),
                entitySlug: String((source as { slug?: unknown }).slug ?? '')
            }
        );
        return {
            cityName: legacyCityName,
            cityPath: String(legacyDestination?.path ?? ''),
            cityDestinationSlug: String(legacyDestination?.slug ?? '')
        };
    }

    return { cityName: '', cityPath: '', cityDestinationSlug: '' };
}

// --- Helper: extract relation items (amenities / features) ---

/**
 * Extracts amenity or feature items from a relation join array.
 */
function extractRelationItems(
    items: unknown,
    relationKey: 'amenity' | 'feature'
): readonly CardAmenityFeature[] | undefined {
    if (!Array.isArray(items)) return undefined;

    const mapped = (items as Array<Record<string, unknown>>)
        .map((rel) => {
            const nested = rel[relationKey] as Record<string, unknown> | undefined;
            return {
                key: String(nested?.slug || nested?.name || ''),
                label: String(nested?.description || nested?.name || rel.name || ''),
                icon: String(nested?.icon || ''),
                displayWeight: Number(nested?.displayWeight ?? 50)
            };
        })
        .filter((item) => item.key)
        // SPEC-018: surface higher-weight items first so cards/grids that slice
        // (e.g. AccommodationCard top-4 amenities) show the most important ones.
        .sort((a, b) => b.displayWeight - a.displayWeight);

    return mapped.length > 0 ? mapped : undefined;
}

// --- Transform functions ---

/**
 * Transforms a raw API accommodation item to AccommodationCard props.
 *
 * @param item - Raw accommodation object from the API
 * @returns Typed AccommodationCardData for the card component
 */
export function toAccommodationCardProps({
    item
}: { readonly item: Record<string, unknown> }): AccommodationCardData {
    const priceData = item.price as
        | { price?: number; amount?: number; currency?: string }
        | undefined;

    const locationObj = item.location as Record<string, unknown> | undefined;
    const { cityName, cityPath, cityDestinationSlug } = deriveCityFields(item);
    const city = cityName;
    const state = String(locationObj?.state || '');

    const { featuredImage, galleryUrls } = processEntityImages({
        item,
        entity: 'accommodation',
        id: String(item.id || ''),
        extract: true,
        fallback: '/images/placeholder-accommodation.svg'
    });

    // photoCount: prefer gallery length; fall back to 1 if only the featured
    // image is present (no gallery), or 0 when there is no real media so the
    // card hides the badge instead of misleading the user.
    const hasRealFeatured =
        featuredImage.url.length > 0 && !featuredImage.url.includes('placeholder');
    const photoCount = galleryUrls.length > 0 ? galleryUrls.length : hasRealFeatured ? 1 : 0;

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || item.description || ''),
        type: String(item.type || item.accommodationType || ''),
        featuredImage,
        photoCount,
        averageRating: Number(item.averageRating || 0),
        reviewsCount: Number(item.reviewsCount || item.ratingCount || 0),
        location: { city, state },
        isFeatured: Boolean(item.isFeatured),
        createdAt: item.createdAt ? String(item.createdAt) : undefined,
        price:
            priceData?.price != null || priceData?.amount != null
                ? {
                      amount: Number(priceData?.amount ?? priceData?.price ?? 0),
                      currency: priceData?.currency ?? 'ARS',
                      period: 'noche'
                  }
                : undefined,
        amenities: extractRelationItems(item.amenities, 'amenity'),
        features: extractRelationItems(item.features, 'feature'),
        cityName,
        cityPath,
        cityDestinationSlug,
        approximateLocation: (() => {
            const aprox = item.approximateLocation as
                | { lat?: number; lng?: number; radiusMeters?: number }
                | undefined;
            if (!aprox || aprox.lat == null || aprox.lng == null || !aprox.radiusMeters) {
                return undefined;
            }
            return {
                lat: Number(aprox.lat),
                lng: Number(aprox.lng),
                radiusMeters: Number(aprox.radiusMeters)
            };
        })(),
        // SPEC-098: pass through favorite/bookmark enrichment when present.
        // These fields are populated by the listing page after a bulk-check API
        // call. They are intentionally absent on unenriched responses so
        // FavoriteButton can fall back to its own single-check on mount.
        isFavorited: item.isFavorited !== undefined ? Boolean(item.isFavorited) : undefined,
        favoriteBookmarkId: (() => {
            if (item.favoriteBookmarkId === undefined) return undefined;
            return item.favoriteBookmarkId === null ? null : String(item.favoriteBookmarkId);
        })(),
        bookmarkCount: item.bookmarkCount !== undefined ? Number(item.bookmarkCount) : undefined
    };
}

/**
 * Transforms a raw API accommodation item to AccommodationCardDetailed props.
 * Includes gallery images, capacity, and room specs from extraInfo.
 *
 * @param item - Raw accommodation object from the API
 * @returns Typed AccommodationDetailedCardData for the detailed card component
 */
export function toAccommodationDetailedProps({
    item
}: { readonly item: Record<string, unknown> }): AccommodationDetailedCardData {
    const { featuredImage, galleryUrls } = processEntityImages({
        item,
        entity: 'accommodation-detailed',
        id: String(item.id || ''),
        extract: true,
        fallback: '/images/placeholder-accommodation.svg'
    });
    const images = galleryUrls.length > 0 ? galleryUrls : [featuredImage.url];

    const locationObj = item.location as Record<string, unknown> | undefined;
    const extraInfo = item.extraInfo as Record<string, unknown> | undefined;
    const priceData = item.price as
        | { amount?: number; price?: number; currency?: string }
        | undefined;

    const { cityName } = deriveCityFields(item);

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        type: String(item.type || item.accommodationType || ''),
        images,
        location: {
            city: cityName || undefined,
            state: locationObj?.state ? String(locationObj.state) : undefined
        },
        capacity: extraInfo?.capacity ? Number(extraInfo.capacity) : undefined,
        bedrooms: extraInfo?.bedrooms ? Number(extraInfo.bedrooms) : undefined,
        beds: extraInfo?.beds ? Number(extraInfo.beds) : undefined,
        bathrooms: extraInfo?.bathrooms ? Number(extraInfo.bathrooms) : undefined,
        averageRating: Number(item.averageRating ?? 0),
        reviewsCount: Number(item.reviewsCount ?? 0),
        price:
            priceData?.amount != null || priceData?.price != null
                ? {
                      amount: Number(priceData?.amount ?? priceData?.price ?? 0),
                      currency: priceData?.currency ?? 'ARS'
                  }
                : undefined,
        isFeatured: Boolean(item.isFeatured)
    };
}

/**
 * Transforms a raw API destination item to DestinationCard props.
 *
 * @param item - Raw destination object from the API
 * @returns Typed DestinationCardData for the card component
 */
export function toDestinationCardProps({
    item
}: { readonly item: Record<string, unknown> }): DestinationCardData {
    const { featuredImage } = processEntityImages({
        item,
        entity: 'destination',
        id: String(item.slug || ''),
        extract: true,
        fallback: '/images/placeholder-destination.svg'
    });

    // `gallery` on DestinationCardData carries `{ url, caption }` objects,
    // not plain URL strings — keep the inline construction here (option 2b).
    const mediaObj = item.media as
        | { gallery?: Array<{ url?: string; caption?: string }> }
        | undefined;
    const locationObj = item.location as
        | { coordinates?: { lat?: string; long?: string } }
        | undefined;
    const coords = locationObj?.coordinates;
    const attractions = item.attractions as
        | Array<{ id: string; name: string; icon?: string; displayWeight?: number }>
        | undefined;

    const id = String(item.id || '');
    if (!id) {
        webLogger.warn(
            'transforms.toDestinationCardProps: destination has no UUID id — FavoriteButton entityId will be empty',
            { slug: String(item.slug || '') }
        );
    }

    return {
        id,
        slug: String(item.slug || ''),
        name: String(item.name || 'Sin nombre'),
        summary: String(item.summary || item.description || ''),
        featuredImage,
        accommodationsCount: Number(item.accommodationsCount || 0),
        isFeatured: Boolean(item.isFeatured),
        path: String(item.path || item.slug || ''),
        averageRating: Number(item.averageRating ?? 0),
        reviewsCount: Number(item.reviewsCount ?? 0),
        eventsCount: Number(item.eventsCount ?? 0),
        attractions:
            attractions
                ?.map((a) => ({
                    id: a.id,
                    name: a.name,
                    icon: a.icon,
                    displayWeight: a.displayWeight ?? 50
                }))
                // SPEC-018: order attractions by displayWeight DESC so consumers
                // that slice the array surface the most relevant ones first.
                .sort((a, b) => b.displayWeight - a.displayWeight) ?? [],
        gallery: mediaObj?.gallery?.map((g) => ({ url: g.url ?? '', caption: g.caption })) ?? [],
        coordinates:
            coords?.lat && coords?.long ? { lat: coords.lat, long: coords.long } : undefined,
        ratingDimensions: (item.rating as Record<string, number>) ?? undefined
    };
}

/**
 * Transforms a raw API event item to EventCard props.
 *
 * @param item - Raw event object from the API
 * @returns Typed EventCardData for the card component
 */
export function toEventCardProps({
    item
}: { readonly item: Record<string, unknown> }): EventCardData {
    const { featuredImage } = processEntityImages({
        item,
        entity: 'event',
        id: String(item.slug || ''),
        extract: true,
        fallback: '/images/placeholder-event.svg'
    });

    const dateObj = item.date as { start?: string; end?: string } | undefined;
    const locationObj = item.location as Record<string, unknown> | undefined;
    const organizerObj = item.organizer as Record<string, unknown> | undefined;
    const { cityName, cityPath, cityDestinationSlug } = deriveCityFields(locationObj);

    const id = String(item.id || '');
    if (!id) {
        webLogger.warn(
            'transforms.toEventCardProps: event has no UUID id — FavoriteButton entityId will be empty',
            { slug: String(item.slug || '') }
        );
    }

    const organizerName = organizerObj?.name ? String(organizerObj.name) : '';
    const organizerSlug = organizerObj?.slug ? String(organizerObj.slug) : undefined;

    return {
        id,
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || item.description || ''),
        featuredImage,
        category: String(item.category || ''),
        date: {
            start: String(dateObj?.start || item.startDate || ''),
            end: dateObj?.end
                ? String(dateObj.end)
                : item.endDate
                  ? String(item.endDate)
                  : undefined
        },
        isFeatured: Boolean(item.isFeatured),
        location: locationObj
            ? {
                  name: String(locationObj.placeName || locationObj.name || ''),
                  city: cityName
              }
            : undefined,
        organizer: organizerName ? { name: organizerName, slug: organizerSlug } : undefined,
        cityName,
        cityPath,
        cityDestinationSlug,
        isFavorited: item.isFavorited !== undefined ? Boolean(item.isFavorited) : undefined,
        favoriteBookmarkId:
            item.favoriteBookmarkId !== undefined
                ? item.favoriteBookmarkId === null
                    ? null
                    : String(item.favoriteBookmarkId)
                : undefined,
        bookmarkCount: item.bookmarkCount !== undefined ? Number(item.bookmarkCount) : undefined
    };
}

/**
 * Transforms a raw API post item to ArticleCard props.
 *
 * @param item - Raw post object from the API
 * @returns Typed ArticleCardData for the card component
 */
export function toArticleCardProps({
    item
}: { readonly item: Record<string, unknown> }): ArticleCardData {
    const id = String(item.id || '');
    if (!id) {
        webLogger.warn(
            'transforms.toArticleCardProps: post has no UUID id — FavoriteButton entityId will be empty',
            { slug: String(item.slug || '') }
        );
    }

    const authorObj = item.author as Record<string, unknown> | undefined;
    const resolvedAuthorName = String(
        item.authorName ||
            authorObj?.displayName ||
            [authorObj?.firstName, authorObj?.lastName].filter(Boolean).join(' ') ||
            ''
    );
    // Fallback when the public posts endpoint does not JOIN the author table
    // (tracked under the backend author-join spec). Keeps the UI complete and
    // signals editorial ownership rather than leaving the byline empty.
    const authorName = resolvedAuthorName || 'Equipo Hospeda';
    const authorAvatar = item.authorAvatar
        ? String(item.authorAvatar)
        : authorObj?.image
          ? String(authorObj.image)
          : undefined;

    const { featuredImage } = processEntityImages({
        item,
        entity: 'post',
        id: String(item.slug || ''),
        extract: true,
        fallback: '/assets/images/placeholder-blog.svg'
    });

    return {
        id,
        slug: String(item.slug || ''),
        title: String(item.title || ''),
        summary: String(item.summary || item.content || ''),
        featuredImage,
        category: String(item.category || ''),
        publishedAt: String(item.publishedAt || item.createdAt || ''),
        readingTimeMinutes: Number(item.readingTimeMinutes || 0),
        authorName,
        authorAvatar,
        isFeatured: Boolean(item.isFeatured),
        isNews: item.isNews ? Boolean(item.isNews) : false,
        expiresAt: item.expiresAt ? String(item.expiresAt) : undefined,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
        isFavorited: item.isFavorited !== undefined ? Boolean(item.isFavorited) : undefined,
        favoriteBookmarkId:
            item.favoriteBookmarkId !== undefined
                ? item.favoriteBookmarkId === null
                    ? null
                    : String(item.favoriteBookmarkId)
                : undefined,
        bookmarkCount: item.bookmarkCount !== undefined ? Number(item.bookmarkCount) : undefined
    };
}

/**
 * Transforms a raw API testimonial item to ReviewCard props.
 *
 * @param item - Raw testimonial object from the testimonials API
 * @returns Typed ReviewCardData for the carousel component
 */
export function toTestimonialCardProps({
    item
}: { readonly item: Record<string, unknown> }): ReviewCardData {
    return {
        id: String(item.id || ''),
        quote: String(item.comment || item.title || ''),
        rating: Number(item.rating ?? 0),
        reviewerName: String(item.userName || 'Usuario'),
        reviewerOrigin: String(item.entityName || ''),
        reviewerAvatar: item.avatarUrl ? String(item.avatarUrl) : undefined,
        initials: getInitialsFromName(String(item.userName || 'U')),
        location: String(item.entityName || ''),
        entityName: String(item.entityName || ''),
        entityType:
            item.type === 'accommodation' || item.type === 'destination' ? item.type : undefined,
        entitySlug: item.entitySlug ? String(item.entitySlug) : undefined,
        badge:
            item.type === 'accommodation'
                ? 'Alojamiento'
                : item.type === 'destination'
                  ? 'Destino'
                  : undefined,
        date: item.date ? String(item.date) : undefined
    };
}

// --- Accommodation Detail Page ---

/**
 * Transforms a raw API accommodation response (from getBySlug) into
 * AccommodationDetailData for the detail page.
 *
 * IMPORTANT: Uses `price.price` (canonical PriceSchema field).
 * Does NOT propagate the legacy `price.amount` fallback.
 *
 * SPEC-172 PR2: amenity and feature catalog `name` (and `description`) changed
 * from plain strings to JSONB i18n objects `{ es, en, pt }`. The `locale`
 * parameter is used to resolve these objects to plain strings before the data
 * reaches components. Defaults to `'es'` if omitted.
 *
 * @param item - Raw accommodation object from the API (getBySlug response)
 * @param locale - Page locale used to resolve i18n name/description fields
 * @returns Typed AccommodationDetailData for the detail page components
 */
export function toAccommodationDetailPageProps({
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): AccommodationDetailData {
    const mediaObj = item.media as { images?: string[]; videos?: string[] } | undefined;
    const locationObj = item.location as Record<string, unknown> | undefined;
    // SPEC-095: prefer the `cityDestination` projection from the API; fall back
    // to the legacy heavy `destination` relation while older payloads still circulate.
    const cityDestinationObj = item.cityDestination as Record<string, unknown> | undefined;
    const destinationObj =
        cityDestinationObj ?? (item.destination as Record<string, unknown> | undefined);
    const priceObj = item.price as Record<string, unknown> | null | undefined;
    const extraInfoObj = item.extraInfo as Record<string, unknown> | null | undefined;
    const seoObj = item.seo as Record<string, unknown> | null | undefined;
    const ownerObj = item.owner as Record<string, unknown> | null | undefined;
    const amenitiesArr = item.amenities as readonly Record<string, unknown>[] | undefined;
    const featuresArr = item.features as readonly Record<string, unknown>[] | undefined;
    const faqsArr = item.faqs as readonly Record<string, unknown>[] | undefined;

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || ''),
        description: String(item.description || ''),
        richDescription: item.richDescription == null ? undefined : String(item.richDescription),
        type: String(item.type || ''),
        isFeatured: Boolean(item.isFeatured),
        createdAt: item.createdAt ? String(item.createdAt) : new Date().toISOString(),
        averageRating: Number(item.averageRating || 0),
        reviewsCount: Number(item.reviewsCount || 0),
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-accommodation.svg'),
        media: (() => {
            const galleryItems = extractGalleryItems(item);
            const rawVideos = mediaObj?.videos as readonly unknown[] | undefined;
            // Normalize videos to `{ url, caption?, description? }`. Accepts both
            // the schema shape (objects) and legacy bare-URL strings so older
            // accommodation records keep rendering. `moderationState` from the
            // schema is intentionally dropped — public reads don't surface it.
            const videos = (rawVideos ?? [])
                .map((entry) => {
                    if (typeof entry === 'string') {
                        return entry.length > 0 ? { url: entry } : null;
                    }
                    if (entry && typeof entry === 'object') {
                        const v = entry as Record<string, unknown>;
                        const url = typeof v.url === 'string' ? v.url : '';
                        if (!url) return null;
                        return {
                            url,
                            caption: typeof v.caption === 'string' ? v.caption : undefined,
                            description:
                                typeof v.description === 'string' ? v.description : undefined
                        };
                    }
                    return null;
                })
                .filter(
                    (entry): entry is { url: string; caption?: string; description?: string } =>
                        entry !== null
                );
            return {
                images: mediaObj?.images ?? extractGalleryUrls(item),
                // Preserve caption/description alongside gallery URLs so
                // photo page and lightbox views can surface them (GAP-078-136).
                galleryItems,
                videos
            };
        })(),
        location: {
            lat: locationObj?.lat != null ? Number(locationObj.lat) : null,
            lng: locationObj?.lng != null ? Number(locationObj.lng) : null
        },
        approximateLocation: (() => {
            const aprox = item.approximateLocation as
                | { lat?: number; lng?: number; radiusMeters?: number }
                | undefined;
            if (!aprox || aprox.lat == null || aprox.lng == null || !aprox.radiusMeters) {
                return undefined;
            }
            return {
                lat: Number(aprox.lat),
                lng: Number(aprox.lng),
                radiusMeters: Number(aprox.radiusMeters)
            };
        })(),
        destination: {
            id: String(destinationObj?.id || ''),
            slug: String(destinationObj?.slug || ''),
            name: String(destinationObj?.name || '')
        },
        // CANONICAL: price.price only — never price.amount
        price: priceObj
            ? {
                  price: priceObj.price != null ? Number(priceObj.price) : null,
                  currency: priceObj.currency ? String(priceObj.currency) : null,
                  additionalFees:
                      (priceObj.additionalFees as AccommodationDetailData['price'] extends {
                          additionalFees: infer F;
                      }
                          ? F
                          : never) ?? null,
                  discounts:
                      (priceObj.discounts as AccommodationDetailData['price'] extends {
                          discounts: infer D;
                      }
                          ? D
                          : never) ?? null
              }
            : null,
        extraInfo: extraInfoObj
            ? {
                  capacity: extraInfoObj.capacity != null ? Number(extraInfoObj.capacity) : null,
                  bedrooms: extraInfoObj.bedrooms != null ? Number(extraInfoObj.bedrooms) : null,
                  beds: extraInfoObj.beds != null ? Number(extraInfoObj.beds) : null,
                  bathrooms: extraInfoObj.bathrooms != null ? Number(extraInfoObj.bathrooms) : null,
                  minNights: extraInfoObj.minNights != null ? Number(extraInfoObj.minNights) : null,
                  maxNights: extraInfoObj.maxNights != null ? Number(extraInfoObj.maxNights) : null,
                  smokingAllowed:
                      extraInfoObj.smokingAllowed != null
                          ? Boolean(extraInfoObj.smokingAllowed)
                          : null
              }
            : null,
        seo: seoObj
            ? {
                  title: seoObj.title ? String(seoObj.title) : null,
                  description: seoObj.description ? String(seoObj.description) : null
              }
            : null,
        owner: {
            id: String(ownerObj?.id || ''),
            name: String(ownerObj?.name || 'Unknown'),
            image: ownerObj?.image ? String(ownerObj.image) : null,
            createdAt: ownerObj?.createdAt ? String(ownerObj.createdAt) : new Date().toISOString()
        },
        // SPEC-018: extract displayWeight from either the join row or the
        // nested entity (API shape varies), then order DESC so the detail
        // page renders the most important amenities/features first.
        //
        // SPEC-172 PR4: amenity/feature `name` is now a JSONB i18n object
        // `{ es, en, pt }` from PR2. We resolve it to a plain string here
        // using the page locale so that downstream components (AmenitiesGrid,
        // FeaturesGrid) receive a stable string and translateAmenity() can
        // build the `accommodations.amenityNames.<key>` i18n lookup as before.
        // The `name.es` value contains the slug-like catalog name (e.g. 'wifi',
        // 'pool') used as the i18n key — resolving with locale + es fallback
        // preserves this behavior while correctly surfacing the translated
        // catalog name for en/pt locales that have a matching amenityNames entry.
        amenities: (amenitiesArr ?? [])
            .map((a) => {
                const nestedAmenity = a.amenity as Record<string, unknown> | undefined;
                return {
                    amenityId: String(a.amenityId || ''),
                    name: resolveI18nText(
                        a.name as I18nTextLike | string | null | undefined,
                        locale
                    ),
                    icon: a.icon ? String(a.icon) : null,
                    isOptional: Boolean(a.isOptional),
                    additionalCost: a.additionalCost != null ? Number(a.additionalCost) : null,
                    displayWeight: Number(a.displayWeight ?? nestedAmenity?.displayWeight ?? 50)
                };
            })
            .sort((a, b) => b.displayWeight - a.displayWeight),
        features: (featuresArr ?? [])
            .map((f) => {
                const nestedFeature = f.feature as Record<string, unknown> | undefined;
                return {
                    featureId: String(f.featureId || ''),
                    name: resolveI18nText(
                        f.name as I18nTextLike | string | null | undefined,
                        locale
                    ),
                    icon: f.icon ? String(f.icon) : null,
                    hostReWriteName: f.hostReWriteName ? String(f.hostReWriteName) : null,
                    comments: f.comments ? String(f.comments) : null,
                    displayWeight: Number(f.displayWeight ?? nestedFeature?.displayWeight ?? 50)
                };
            })
            .sort((a, b) => b.displayWeight - a.displayWeight),
        faqs: (faqsArr ?? []).map((faq) => ({
            id: String(faq.id || ''),
            question: String(faq.question || ''),
            answer: String(faq.answer || ''),
            category: faq.category ? String(faq.category) : null
        }))
    };
}

/**
 * Shape of the `media` JSONB field as returned by the API for list/detail
 * entity endpoints.
 *
 * `extractFeaturedImageUrl` and `extractGalleryUrls` already normalise the
 * nested vs flat variants — this local type exists only so {@link processEntityImages}
 * can warn about partial payloads without reaching for `any`.
 */
interface EntityMediaShape {
    readonly featuredImage?: { readonly url?: string } | string;
    readonly gallery?: ReadonlyArray<{ readonly url?: string } | string>;
}

/**
 * Result returned by {@link processEntityImages} when called with
 * `extract: true`.  Carries the resolved `featuredImage` object (url + optional
 * caption) and the `galleryUrls` array alongside the original item so
 * call-sites can destructure instead of calling `extractFeaturedImage` /
 * `extractGalleryUrls` separately.
 *
 * The `caption` field on `featuredImage` is populated when the API stores the
 * image as a structured `{ url, caption }` object.  Components should prefer
 * `featuredImage.caption` over the entity name as `alt` text for accessibility.
 */
export interface ProcessEntityImagesResult<T extends Record<string, unknown>> {
    /** The original item, unchanged (identity). */
    readonly item: T;
    /**
     * Resolved featured image with URL and optional caption.
     * Falls back to `{ url: fallback }` when no image is found on the entity.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /**
     * Resolved gallery URL list.  Empty array when the entity has no gallery.
     */
    readonly galleryUrls: readonly string[];
}

/**
 * Development-time smell detector **and** media extraction helper for API
 * entity responses.
 *
 * ### Smell detection (always active)
 * The API should either return `media.featuredImage` AND `media.gallery`
 * together or omit the whole `media` block. If `media` is present but the
 * `featuredImage` slot is empty, the card falls back to the default
 * placeholder even though the entity clearly has imagery attached (the
 * gallery is non-empty). That inconsistency usually traces back to a
 * backend transform bug or a partially migrated fixture — easy to miss
 * unless we shout about it at dev-time.
 *
 * This helper does NOT throw, and it does NOT short-circuit rendering. It
 * just emits a `warn` line via `webLogger` (which is a no-op in production
 * unless `PUBLIC_ENABLE_LOGGING=true`) so reviewers browsing the site
 * locally see a single, specific breadcrumb in the console.
 *
 * ### Media extraction (opt-in via `extract: true`)
 * When `extract` is `true` the helper returns a
 * {@link ProcessEntityImagesResult} object that carries `featuredImageUrl`
 * and `galleryUrls`.  Pass `fallback` to control the placeholder used when
 * no image is found (defaults to `'/images/placeholder.svg'`).
 *
 * Call-sites that only need the smell-detection side-effect can still call
 * the function without `extract` and get back the original item directly
 * (backward-compatible behaviour).
 *
 * GAP-078-194 (SPEC-078-GAPS T-049).
 *
 * @param item - Raw entity object from the API.
 * @param entity - Label for the warn message (e.g. `'accommodation'`).
 * @param id - Optional entity identifier for the warn message.
 * @param extract - When `true`, also resolve `featuredImageUrl` and
 *   `galleryUrls` and return them alongside `item`.
 * @param fallback - Placeholder URL used when no featured image is found.
 *   Only meaningful when `extract` is `true`.
 * @returns When `extract` is `true`: a {@link ProcessEntityImagesResult}.
 *   Otherwise: the original item, unchanged (identity — kept so call-sites
 *   can chain it inline if they want).
 */
export function processEntityImages<T extends Record<string, unknown>>(args: {
    readonly item: T;
    readonly entity: string;
    readonly id?: string;
    readonly extract?: false;
    readonly fallback?: string;
}): T;
export function processEntityImages<T extends Record<string, unknown>>(args: {
    readonly item: T;
    readonly entity: string;
    readonly id?: string;
    readonly extract: true;
    readonly fallback?: string;
}): ProcessEntityImagesResult<T>;
export function processEntityImages<T extends Record<string, unknown>>({
    item,
    entity,
    id,
    extract = false,
    fallback
}: {
    readonly item: T;
    readonly entity: string;
    readonly id?: string;
    readonly extract?: boolean;
    readonly fallback?: string;
}): T | ProcessEntityImagesResult<T> {
    const media = item.media as EntityMediaShape | undefined;

    if (media) {
        const hasFeatured =
            typeof media.featuredImage === 'string'
                ? media.featuredImage.length > 0
                : typeof media.featuredImage?.url === 'string' &&
                  media.featuredImage.url.length > 0;

        if (!hasFeatured) {
            const galleryLength = Array.isArray(media.gallery) ? media.gallery.length : 0;

            webLogger.warn(
                `[transforms] ${entity}${id ? `#${id}` : ''}: media present but featuredImage missing (gallery=${galleryLength}). Backend data-shape smell — check the API transform.`
            );
        }
    }

    if (!extract) return item;

    return {
        item,
        featuredImage: extractFeaturedImage(item, { fallback }),
        galleryUrls: extractGalleryUrls(item)
    };
}

// --- Event Detail Page ---

/**
 * Transforms a raw API event response (from getBySlug) into
 * EventDetailData for the event detail page.
 *
 * All fields default gracefully — missing API fields produce undefined/null
 * rather than throwing, so older API payloads remain renderable.
 *
 * @param item - Raw event object from the API (getBySlug response)
 * @returns Typed EventDetailData for the event detail page components
 */
/**
 * Transforms a raw API host dashboard response into HostDashboardData
 * for the HostDashboard React island.
 *
 * Drops `archived` from properties (not shown in the summary),
 * maps `unreadConversations` → `unreadCount`, and synthesizes
 * `quickActions` for the host's self-service shortcuts.
 *
 * @param item - Raw dashboard response from the API's host dashboard endpoint
 * @returns Typed HostDashboardData for the HostDashboard component
 *
 * @example
 * ```ts
 * const apiResult = await hostDashboardApi.get();
 * if (apiResult.ok) {
 *   const data = transformHostDashboard({ item: apiResult.data });
 * }
 * ```
 */
export function transformHostDashboard({
    item
}: {
    readonly item: Record<string, unknown>;
}): import('./types').HostDashboardData {
    const properties = item.properties as Record<string, unknown> | undefined;
    const plan = item.plan as Record<string, unknown> | null | undefined;

    return {
        propertySummary: {
            total: Number(properties?.total ?? 0),
            published: Number(properties?.published ?? 0),
            draft: Number(properties?.draft ?? 0)
        },
        planInfo: plan
            ? {
                  name: String(plan.name ?? ''),
                  status: String(plan.status ?? ''),
                  isTrial: Boolean(plan.isTrial)
              }
            : null,
        unreadCount: Number(item.unreadConversations ?? 0),
        quickActions: [
            { label: 'Mis propiedades', href: '/mis-propiedades', icon: 'building' },
            { label: 'Promociones', href: '/promociones', icon: 'megaphone' },
            { label: 'Mensajes', href: '/mensajes', icon: 'chat-dots' },
            { label: 'Suscripción', href: '/suscripcion', icon: 'credit-card' }
        ]
    };
}

export function toEventDetailProps({
    item
}: { readonly item: Record<string, unknown> }): EventDetailData {
    // --- Identity ---
    const id = String(item.id || '');
    if (!id) {
        webLogger.warn(
            'transforms.toEventDetailProps: event has no UUID id — FavoriteButton entityId will be empty',
            { slug: String(item.slug || '') }
        );
    }

    // --- Tags ---
    const rawTags = item.tags;
    const tags: readonly string[] = Array.isArray(rawTags) ? rawTags.map(String) : [];

    // --- Dates ---
    const dateObj = item.date as { start?: string; end?: string } | undefined;
    const startDate = String(dateObj?.start || item.startDate || '');
    const endDate = dateObj?.end
        ? String(dateObj.end)
        : item.endDate
          ? String(item.endDate)
          : undefined;
    const isAllDay = Boolean(item.isAllDay);

    // --- Status flags ---
    const isCancelled = Boolean(item.isCancelled);
    const isRescheduled = Boolean(item.isRescheduled);
    const isPast = startDate ? new Date(startDate) < new Date() : false;
    const eventStatus: EventDetailData['eventStatus'] = isCancelled
        ? 'EventCancelled'
        : isRescheduled
          ? 'EventRescheduled'
          : 'EventScheduled';

    // --- Media ---
    const { featuredImage, galleryUrls } = processEntityImages({
        item,
        entity: 'event',
        id: String(item.slug || id),
        extract: true,
        fallback: '/assets/images/placeholder-event.svg'
    });

    // Build gallery with alt text. Use name as fallback alt.
    const eventName = String(item.name || item.title || '');
    const mediaObj = item.media as
        | {
              gallery?: ReadonlyArray<{
                  url?: string;
                  caption?: string;
              }>;
          }
        | undefined;

    const gallery: ReadonlyArray<EventDetailData['gallery'][number]> =
        mediaObj?.gallery && mediaObj.gallery.length > 0
            ? mediaObj.gallery
                  .filter((g) => g.url)
                  .map((g) => ({
                      url: String(g.url),
                      alt: g.caption || eventName,
                      caption: g.caption
                  }))
            : galleryUrls.map((url) => ({ url, alt: eventName }));

    // --- Location ---
    const locationObj = item.location as Record<string, unknown> | undefined;
    const locationName = String(
        locationObj?.placeName || locationObj?.name || locationObj?.venueName || ''
    );
    const locationCity = String(locationObj?.city || '');
    const locationStreet = String(locationObj?.street || '');
    const locationNumber = String(locationObj?.number || '');
    const locationFloor = String(locationObj?.floor || '');
    const locationApartment = String(locationObj?.apartment || '');

    const addressParts = [
        locationStreet && locationNumber ? `${locationStreet} ${locationNumber}` : locationStreet,
        locationFloor ? `Piso ${locationFloor}` : '',
        locationApartment ? `Dpto. ${locationApartment}` : ''
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

    const coordsRaw = locationObj?.coordinates as
        | { lat?: string | number; lng?: string | number; long?: string | number }
        | undefined;
    const coordLat = coordsRaw?.lat != null ? Number(coordsRaw.lat) : null;
    const coordLng =
        coordsRaw?.lng != null
            ? Number(coordsRaw.lng)
            : coordsRaw?.long != null
              ? Number(coordsRaw.long)
              : null;
    const coordinates =
        coordLat !== null && coordLng !== null && !Number.isNaN(coordLat) && !Number.isNaN(coordLng)
            ? { lat: coordLat, lng: coordLng }
            : null;

    // --- Pricing ---
    // The public API response exposes the price block under `pricing` (matches
    // EventPriceSchema). Older shapes used `price`, so we accept both for
    // forward-compatibility.
    const priceObj = (item.pricing ?? item.price) as Record<string, unknown> | undefined;
    const hasPriceData = priceObj != null;
    const pricingIsFree = hasPriceData
        ? Boolean(priceObj.isFree ?? (priceObj.amount == null && priceObj.price == null))
        : true;

    const rawPrice = priceObj?.amount != null ? priceObj.amount : priceObj?.price;
    const flatPrice = rawPrice != null ? Number(rawPrice) : undefined;

    const earlyBirdDeadlineRaw = priceObj?.earlyBirdDeadline
        ? String(priceObj.earlyBirdDeadline)
        : undefined;
    const earlyBirdIsUpcoming = earlyBirdDeadlineRaw
        ? new Date(earlyBirdDeadlineRaw) > new Date()
        : false;

    const pricing: EventDetailData['pricing'] = {
        price: flatPrice,
        priceFrom: priceObj?.priceFrom != null ? Number(priceObj.priceFrom) : undefined,
        priceTo: priceObj?.priceTo != null ? Number(priceObj.priceTo) : undefined,
        currency: priceObj?.currency ? String(priceObj.currency) : 'ARS',
        isFree: pricingIsFree,
        earlyBirdPrice:
            earlyBirdIsUpcoming && priceObj?.earlyBirdPrice != null
                ? Number(priceObj.earlyBirdPrice)
                : undefined,
        earlyBirdDeadline: earlyBirdIsUpcoming ? earlyBirdDeadlineRaw : undefined,
        groupDiscountThreshold:
            priceObj?.groupDiscountThreshold != null
                ? Number(priceObj.groupDiscountThreshold)
                : undefined,
        groupDiscountPercent:
            priceObj?.groupDiscountPercent != null
                ? Number(priceObj.groupDiscountPercent)
                : undefined,
        pricePerGroup: priceObj?.pricePerGroup != null ? Number(priceObj.pricePerGroup) : undefined
    };

    // --- Organizer ---
    const organizerObj = item.organizer as Record<string, unknown> | undefined;
    let organizer: EventDetailData['organizer'];

    if (organizerObj && String(organizerObj.name || '')) {
        const contactRaw = organizerObj.contactInfo as Record<string, unknown> | undefined;
        const socialRaw = organizerObj.socialNetworks as Record<string, unknown> | undefined;

        organizer = {
            name: String(organizerObj.name),
            slug: organizerObj.slug ? String(organizerObj.slug) : undefined,
            description: organizerObj.description ? String(organizerObj.description) : undefined,
            logo: organizerObj.logo ? String(organizerObj.logo) : undefined,
            contactInfo:
                contactRaw && (contactRaw.email || contactRaw.phone || contactRaw.website)
                    ? {
                          email: contactRaw.email ? String(contactRaw.email) : undefined,
                          phone: contactRaw.phone ? String(contactRaw.phone) : undefined,
                          website: contactRaw.website ? String(contactRaw.website) : undefined
                      }
                    : undefined,
            socialNetworks:
                socialRaw &&
                (socialRaw.facebook ||
                    socialRaw.instagram ||
                    socialRaw.twitter ||
                    socialRaw.youtube ||
                    socialRaw.linkedin)
                    ? {
                          facebook: socialRaw.facebook ? String(socialRaw.facebook) : undefined,
                          instagram: socialRaw.instagram ? String(socialRaw.instagram) : undefined,
                          twitter: socialRaw.twitter ? String(socialRaw.twitter) : undefined,
                          youtube: socialRaw.youtube ? String(socialRaw.youtube) : undefined,
                          linkedin: socialRaw.linkedin ? String(socialRaw.linkedin) : undefined
                      }
                    : undefined
        };
    }

    // --- SEO ---
    const seoObj = item.seo as Record<string, unknown> | undefined;
    const rawKeywords = seoObj?.keywords;
    const seo: EventDetailData['seo'] = {
        title: seoObj?.title ? String(seoObj.title) : undefined,
        description: seoObj?.description ? String(seoObj.description) : undefined,
        keywords: Array.isArray(rawKeywords) ? rawKeywords.map(String) : undefined
    };

    // --- Contact (event-level, not organizer) ---
    const contactObj = item.contact as Record<string, unknown> | undefined;

    return {
        id,
        slug: String(item.slug || ''),
        name: eventName,
        summary: String(item.summary || item.description || ''),
        description: String(item.description || ''),
        contentHtml: item.contentHtml ? String(item.contentHtml) : undefined,
        category: String(item.category || ''),
        isFeatured: Boolean(item.isFeatured),
        tags,
        startDate,
        endDate,
        isAllDay,
        pricing,
        featuredImage,
        gallery,
        location: {
            name: locationName || undefined,
            city: locationCity || undefined,
            fullAddress,
            coordinates
        },
        organizer,
        contactEmail: contactObj?.email
            ? String(contactObj.email)
            : item.contactEmail
              ? String(item.contactEmail)
              : undefined,
        contactPhone: contactObj?.phone
            ? String(contactObj.phone)
            : item.contactPhone
              ? String(item.contactPhone)
              : undefined,
        contactWebsite: contactObj?.website
            ? String(contactObj.website)
            : item.contactWebsite
              ? String(item.contactWebsite)
              : undefined,
        seo,
        isCancelled,
        isRescheduled,
        isPast,
        eventStatus
    };
}
