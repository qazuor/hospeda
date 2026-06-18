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
    ExperienceCardData,
    ExperienceContactInfo,
    ExperienceDetailData,
    ExperienceOpeningHoursEntry,
    ExperienceSocialNetworks,
    GastronomyCardData,
    GastronomyDetailData,
    GastronomyOpeningHoursEntry,
    GastronomySocialNetworks,
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
    ExperienceCardData,
    ExperienceDetailData,
    GastronomyCardData,
    GastronomyDetailData,
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
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): AccommodationCardData {
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
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
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
    item,
    locale = 'es'
}: {
    readonly item: Record<string, unknown>;
    readonly locale?: string;
}): AccommodationDetailedCardData {
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
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
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
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): DestinationCardData {
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
        name: resolveI18nText(
            (item.nameI18n as I18nTextLike | string) ?? item.name ?? 'Sin nombre',
            locale
        ),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
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
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): EventCardData {
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
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
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
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): ArticleCardData {
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
        title: resolveI18nText((item.titleI18n as I18nTextLike | string) ?? item.title, locale),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.content,
            locale
        ),
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
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary,
            locale
        ),
        description: resolveI18nText(
            (item.descriptionI18n as I18nTextLike | string) ?? item.description,
            locale
        ),
        richDescription:
            item.richDescriptionI18n != null || item.richDescription != null
                ? resolveI18nText(
                      (item.richDescriptionI18n as I18nTextLike | string) ??
                          item.richDescription ??
                          null,
                      locale
                  )
                : undefined,
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
            { label: 'Mis propiedades', href: 'mi-cuenta/propiedades', icon: 'building' },
            { label: 'Promociones', href: 'mi-cuenta/promociones', icon: 'megaphone' },
            { label: 'Mensajes', href: 'mi-cuenta/consultas', icon: 'chat-dots' },
            { label: 'Suscripción', href: 'mi-cuenta/suscripcion', icon: 'credit-card' }
        ]
    };
}

// --- Host Analytics Transforms (SPEC-207) ---

/**
 * Transforms raw per-accommodation view counts into ranked ViewsWidget data.
 *
 * Crosses the views endpoint response (entityId + counts) with a pre-built
 * id→name map from the accommodations list, sorts by total descending, and
 * returns the typed AccommodationViewsData for the ViewsWidget.
 *
 * @param views - Raw array from GET /views/accommodations/me
 * @param names - Map of accommodation id → display name
 * @param window - The time window the data covers ('7d' | '30d')
 * @returns Typed AccommodationViewsData for the ViewsWidget component
 */
export function transformAccommodationViews({
    views,
    names,
    window
}: {
    readonly views: ReadonlyArray<Record<string, unknown>>;
    readonly names: ReadonlyMap<string, string>;
    readonly window: '7d' | '30d';
}): import('./types').AccommodationViewsData {
    const items = views
        .map((entry) => {
            const accommodationId = String(entry.entityId ?? '');
            return {
                accommodationId,
                name: names.get(accommodationId) ?? '',
                total: Number(entry.total ?? 0),
                unique: Number(entry.unique ?? 0)
            };
        })
        .sort((a, b) => b.total - a.total);
    return { window, items };
}

/**
 * Transforms raw favorites-breakdown API array into per-accommodation data for
 * the FavoritesWidget.
 *
 * Crosses each `{accommodationId, slug, bookmarkCount}` wire item with the
 * id→name map (falls back to slug when the name is not in the map), then sorts
 * descending by bookmarkCount — mirroring `transformAccommodationViews`.
 *
 * @param favorites - Raw array from GET /accommodations/my/favorites-breakdown
 * @param names - Map of accommodation id → display name
 * @returns Typed FavoritesBreakdownData for the FavoritesWidget component
 */
export function transformFavoritesBreakdown({
    favorites,
    names
}: {
    readonly favorites: ReadonlyArray<Record<string, unknown>>;
    readonly names: ReadonlyMap<string, string>;
}): import('./types').FavoritesBreakdownData {
    const items = favorites
        .map((entry) => {
            const accommodationId = String(entry.accommodationId ?? '');
            const slug = String(entry.slug ?? '');
            return {
                accommodationId,
                name: names.get(accommodationId) ?? slug,
                bookmarkCount: Number(entry.bookmarkCount ?? 0)
            };
        })
        .sort((a, b) => b.bookmarkCount - a.bookmarkCount);
    return { items };
}

/**
 * Transforms the raw daily-series API payload into typed HostViewDailySeriesData
 * for the ViewsWidget line chart.
 *
 * The server already gap-fills missing days and returns items in chronological
 * order (oldest → newest), so this transform is a typed pass-through with
 * defensive field extraction. Do NOT re-sort — preserve server order.
 *
 * @param series - Raw response from GET /views/accommodations/me/daily-series
 * @returns Typed HostViewDailySeriesData for the ViewsWidget chart
 */
export function transformViewsDailySeries({
    series
}: {
    readonly series: Record<string, unknown>;
}): import('./types').HostViewDailySeriesData {
    const rawWindow = series.window;
    const window: '7d' | '30d' = rawWindow === '7d' ? '7d' : '30d';
    const rawItems = Array.isArray(series.items) ? series.items : [];
    const items = rawItems.map((entry: unknown) => {
        const e = entry as Record<string, unknown>;
        return {
            date: String(e.date ?? ''),
            total: Number(e.total ?? 0)
        };
    });
    return { window, items };
}

/**
 * Transforms raw API response into response rate data for the ResponseRateWidget.
 *
 * @param item - Raw API response from the host analytics response-rate endpoint
 * @returns Typed ResponseRateData for the ResponseRateWidget component
 */
export function transformResponseRate({
    item
}: {
    readonly item: Record<string, unknown>;
}): import('./types').ResponseRateData {
    return {
        responseRatePct: Number(item.responseRatePct ?? 0),
        avgResponseTimeMinutes:
            item.avgResponseTimeMinutes != null ? Number(item.avgResponseTimeMinutes) : null
    };
}

/**
 * Transforms raw API response into monthly inquiry trend data for the InquiryTrendWidget.
 *
 * @param item - Raw API response from the host analytics inquiries endpoint
 * @returns Typed InquiryTrendData for the InquiryTrendWidget component
 */
export function transformInquiryTrend({
    item
}: {
    readonly item: Record<string, unknown>;
}): import('./types').InquiryTrendData {
    const rawMonths = item.months as ReadonlyArray<Record<string, unknown>> | undefined;

    return {
        months: (rawMonths ?? []).map((entry) => ({
            month: String(entry.month ?? ''),
            count: Number(entry.count ?? 0)
        }))
    };
}

/**
 * Transforms raw API response into market comparison data for the MarketComparisonWidget.
 *
 * @param item - Raw API response from the host analytics market-comparison endpoint
 * @returns Typed MarketComparisonData for the MarketComparisonWidget component
 */
export function transformMarketComparison({
    item
}: {
    readonly item: Record<string, unknown>;
}): import('./types').MarketComparisonData {
    // Backend wraps the array under `comparisons` (HostMarketComparisonSchema);
    // the widget consumes `data.items`, so we map the wire key to the widget key.
    const rawItems = item.comparisons as ReadonlyArray<Record<string, unknown>> | undefined;

    return {
        items: (rawItems ?? []).map((entry) => ({
            accommodationId: String(entry.accommodationId ?? ''),
            accommodationName: String(entry.accommodationName ?? ''),
            accommodationType: String(entry.accommodationType ?? ''),
            destinationName: entry.destinationName != null ? String(entry.destinationName) : null,
            yourRating: entry.yourRating != null ? Number(entry.yourRating) : null,
            yourReviews: Number(entry.yourReviews ?? 0),
            destinationAvgRating:
                entry.destinationAvgRating != null ? Number(entry.destinationAvgRating) : null,
            yourPrice: entry.yourPrice != null ? Number(entry.yourPrice) : null,
            destinationAvgPrice:
                entry.destinationAvgPrice != null ? Number(entry.destinationAvgPrice) : null
        }))
    };
}

export function toEventDetailProps({
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): EventDetailData {
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
    const eventName = resolveI18nText(
        (item.nameI18n as I18nTextLike | string) ?? item.name ?? item.title,
        locale
    );
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
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
        description: resolveI18nText(
            (item.descriptionI18n as I18nTextLike | string) ?? item.description,
            locale
        ),
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

// --- Accommodation Editor Transforms (SPEC-208) ---

import type { AccommodationEditData, AmenityData, DestinationData, MediaImage } from './types';

/**
 * Transforms a raw API accommodation object into AccommodationEditData
 * for the web editor form.
 *
 * Handles both relation-join amenities/features (objects with nested amenity/feature)
 * and plain ID arrays. Price is extracted from the nested `price.price` or
 * `price.amount` shape.
 *
 * @param item - Raw accommodation object from the protected GET endpoint
 * @returns Typed AccommodationEditData for the editor form
 */
export function transformAccommodationEdit({
    item
}: { readonly item: Record<string, unknown> }): AccommodationEditData {
    const priceObj = item.price as
        | { price?: number; amount?: number; currency?: string }
        | undefined;

    const amenitiesArr = item.amenities as
        | readonly (Record<string, unknown> | string)[]
        | undefined;
    const featuresArr = item.features as readonly (Record<string, unknown> | string)[] | undefined;

    // Coordinates live under location.coordinates.lat / location.coordinates.long (strings in DB)
    const locationObj = item.location as
        | { coordinates?: { lat?: string | number; long?: string | number } }
        | null
        | undefined;
    const coordLat = locationObj?.coordinates?.lat;
    const coordLong = locationObj?.coordinates?.long;
    const latitude = coordLat != null && String(coordLat).length > 0 ? Number(coordLat) : null;
    const longitude = coordLong != null && String(coordLong).length > 0 ? Number(coordLong) : null;

    // Capacity lives under extraInfo (capacity → maxGuests, bedrooms, bathrooms, beds)
    const extraInfo = item.extraInfo as
        | {
              capacity?: number | null;
              bedrooms?: number | null;
              bathrooms?: number | null;
              beds?: number | null;
          }
        | null
        | undefined;

    return {
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        summary: String(item.summary ?? ''),
        description: String(item.description ?? ''),
        type: String(item.type ?? ''),
        destinationId: String(item.destinationId ?? ''),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        maxGuests: extraInfo?.capacity != null ? Number(extraInfo.capacity) : null,
        bedrooms: extraInfo?.bedrooms != null ? Number(extraInfo.bedrooms) : null,
        bathrooms: extraInfo?.bathrooms != null ? Number(extraInfo.bathrooms) : null,
        beds: extraInfo?.beds != null ? Number(extraInfo.beds) : null,
        basePrice:
            priceObj?.price != null
                ? Number(priceObj.price)
                : priceObj?.amount != null
                  ? Number(priceObj.amount)
                  : null,
        currency: priceObj?.currency != null ? String(priceObj.currency) : null,
        isAvailable: item.isAvailable != null ? Boolean(item.isAvailable) : true,
        isFeatured: item.isFeatured != null ? Boolean(item.isFeatured) : false,
        amenityIds: extractIdList(amenitiesArr, 'amenityId', 'amenity'),
        featureIds: extractIdList(featuresArr, 'featureId', 'feature'),
        // Phase B: contact info (flat HTTP fields from the domain contactInfo object)
        phone: String(
            (item.phone as string) ??
                ((item.contactInfo as Record<string, unknown> | undefined)
                    ?.mobilePhone as string) ??
                ''
        ),
        email: String(
            (item.email as string) ??
                ((item.contactInfo as Record<string, unknown> | undefined)
                    ?.personalEmail as string) ??
                ''
        ),
        website: String(
            (item.website as string) ??
                ((item.contactInfo as Record<string, unknown> | undefined)?.website as string) ??
                ''
        ),
        // Phase B: social networks (flat HTTP fields from the domain socialNetworks object)
        facebookUrl: String(
            (item.facebook as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)
                    ?.facebook as string) ??
                ''
        ),
        instagramUrl: String(
            (item.instagram as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)
                    ?.instagram as string) ??
                ''
        ),
        twitterUrl: String(
            (item.twitter as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)?.twitter as string) ??
                ''
        ),
        linkedinUrl: String(
            (item.linkedin as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)
                    ?.linkedIn as string) ??
                ''
        ),
        tiktokUrl: String(
            (item.tiktok as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)?.tiktok as string) ??
                ''
        ),
        youtubeUrl: String(
            (item.youtube as string) ??
                ((item.socialNetworks as Record<string, unknown> | undefined)?.youtube as string) ??
                ''
        )
    };
}

/**
 * Extracts a list of string IDs from either relation-join objects
 * (with a nested key) or plain string entries.
 */
function extractIdList(
    items: readonly (Record<string, unknown> | string)[] | undefined,
    idKey: string,
    nestedKey: string
): readonly string[] {
    if (!items) return [];
    return items
        .map((entry) => {
            if (typeof entry === 'string') return entry;
            const nested = entry[nestedKey] as Record<string, unknown> | undefined;
            return String(entry[idKey] ?? nested?.id ?? '');
        })
        .filter((id) => id.length > 0);
}

/**
 * Resolves a possibly-localized name into a plain string.
 *
 * The public amenities endpoint returns `name` as an i18n object
 * (`{ es, en, pt }`), while other endpoints return a plain string. Calling
 * `String()` on the object yields "[object Object]", so resolve the locale
 * (falling back to es → en → first available) before stringifying.
 */
function resolveLocalizedName(raw: unknown, locale: string): string {
    if (typeof raw === 'string') {
        return raw;
    }
    if (raw && typeof raw === 'object') {
        const map = raw as Record<string, unknown>;
        const value = map[locale] ?? map.es ?? map.en ?? Object.values(map)[0];
        return typeof value === 'string' ? value : '';
    }
    return '';
}

/**
 * Transforms a list of raw amenity objects into AmenityData[].
 *
 * @param items - Raw amenity objects from the public amenities endpoint
 * @param locale - Locale used to resolve the i18n `name` field (default `es`)
 * @returns Typed AmenityData array for the editor's checkbox group
 */
export function transformAmenityList({
    items,
    locale = 'es'
}: {
    readonly items: readonly Record<string, unknown>[];
    readonly locale?: string;
}): readonly AmenityData[] {
    return items.map((item) => ({
        id: String(item.id ?? ''),
        name: resolveLocalizedName(item.name, locale),
        category: item.category != null ? String(item.category) : null
    }));
}

/**
 * Transforms a list of raw destination objects into DestinationData[].
 *
 * @param items - Raw destination objects from the public destinations endpoint
 * @returns Typed DestinationData array for the editor's destination select
 */
export function transformDestinationList({
    items
}: { readonly items: readonly Record<string, unknown>[] }): readonly DestinationData[] {
    return items.map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        path: String(item.path ?? '')
    }));
}

/**
 * Result of `transformAccommodationMedia`.
 */
export interface AccommodationMediaResult {
    readonly featuredImage: MediaImage | null;
    readonly gallery: readonly MediaImage[];
}

/**
 * Extracts the raw media field from an API accommodation response and converts
 * it into the `MediaImage` shape used by the editor's PhotoSection component.
 *
 * Only `url` is guaranteed; `publicId`, `width`, and `height` are seeded with
 * empty/zero values when the stored domain image does not carry them. The
 * display logic in PhotoSection only requires `url`.
 *
 * NEVER passes raw API data to components (project rule). Always use this
 * transform as the bridge from the API response to the editor props.
 *
 * @param item - Raw accommodation object from the protected GET endpoint
 * @returns `{ featuredImage, gallery }` shaped for AccommodationEditor props
 */
export function transformAccommodationMedia({
    item
}: { readonly item: Record<string, unknown> }): AccommodationMediaResult {
    const media = item.media as
        | {
              featuredImage?: {
                  url?: string;
                  publicId?: string;
                  width?: number;
                  height?: number;
              } | null;
              gallery?: ReadonlyArray<{
                  url?: string;
                  publicId?: string;
                  width?: number;
                  height?: number;
              }>;
          }
        | null
        | undefined;

    const toMediaImage = (
        img: { url?: string; publicId?: string; width?: number; height?: number } | null | undefined
    ): MediaImage | null => {
        if (!img?.url) return null;
        return {
            url: img.url,
            publicId: img.publicId ?? '',
            width: img.width ?? 0,
            height: img.height ?? 0
        };
    };

    const featuredImage = toMediaImage(media?.featuredImage);
    const gallery: readonly MediaImage[] = (media?.gallery ?? [])
        .map(toMediaImage)
        .filter((img): img is MediaImage => img !== null);

    return { featuredImage, gallery };
}

// --- Accommodation Translation Transforms (SPEC-212) ---

import type { AccommodationTranslationData, I18nFieldValues } from './types';

/**
 * Extracts an I18nFieldValues object from a raw i18n jsonb field.
 * Treats empty strings as null (no content for that locale).
 */
function extractI18nField(raw: unknown): I18nFieldValues {
    const obj = raw as Record<string, unknown> | null | undefined;
    const toVal = (v: unknown): string | null => {
        if (v == null) return null;
        const s = String(v);
        return s.length > 0 ? s : null;
    };
    return {
        es: toVal(obj?.es),
        en: toVal(obj?.en),
        pt: toVal(obj?.pt)
    };
}

/**
 * Extracts translation status data from a raw accommodation API response.
 *
 * Returns an {@link AccommodationTranslationData} object that the host-facing
 * TranslationPanel uses to determine which locales already have content and
 * which ones are missing — WITHOUT touching or polluting
 * {@link AccommodationEditData}, which exclusively drives the PATCH diff.
 *
 * @param item - Raw accommodation object from the protected GET endpoint
 * @returns Per-field i18n values for the four translatable fields
 */
export function transformAccommodationTranslations({
    item
}: { readonly item: Record<string, unknown> }): AccommodationTranslationData {
    return {
        name: extractI18nField(item.nameI18n),
        summary: extractI18nField(item.summaryI18n),
        description: extractI18nField(item.descriptionI18n),
        richDescription: extractI18nField(item.richDescriptionI18n)
    };
}

// --- Owner Promotions Transforms (SPEC-205) ---

/**
 * Transforms a raw API owner-promotion record into a typed `OwnerPromotionData` object.
 *
 * Dates are kept as ISO strings — consistent with how other transforms handle
 * date fields (e.g. event dates in `toEventDetailProps`). Nullable fields are
 * coerced to `null` when absent rather than falling back to a default value,
 * which preserves the distinction between "not set" and "set to zero/empty".
 *
 * @param item - Raw API response item (Record<string, unknown>)
 * @returns Typed OwnerPromotionData for use in web components
 *
 * @example
 * ```ts
 * const apiResult = await ownerPromotionApi.getById({ id: 'promo-uuid' });
 * if (apiResult.ok) {
 *   const data = transformOwnerPromotion({ item: apiResult.data });
 * }
 * ```
 */
export function transformOwnerPromotion({
    item
}: {
    readonly item: Record<string, unknown>;
}): import('./types').OwnerPromotionData {
    return {
        id: String(item.id ?? ''),
        slug: String(item.slug ?? ''),
        ownerId: String(item.ownerId ?? ''),
        accommodationId: item.accommodationId != null ? String(item.accommodationId) : null,
        title: String(item.title ?? ''),
        description: item.description != null ? String(item.description) : null,
        discountType: String(item.discountType ?? 'percentage') as import(
            './types'
        ).OwnerPromotionDiscountType,
        discountValue: Number(item.discountValue ?? 0),
        minNights: item.minNights != null ? Number(item.minNights) : null,
        validFrom: String(item.validFrom ?? ''),
        validUntil: item.validUntil != null ? String(item.validUntil) : null,
        maxRedemptions: item.maxRedemptions != null ? Number(item.maxRedemptions) : null,
        currentRedemptions: Number(item.currentRedemptions ?? 0),
        lifecycleState: String(item.lifecycleState ?? 'DRAFT'),
        createdAt: String(item.createdAt ?? ''),
        updatedAt: String(item.updatedAt ?? '')
    };
}

/**
 * Transforms a paginated raw API response into a typed list of `OwnerPromotionData`.
 *
 * @param items - Array of raw API response items
 * @returns Array of typed OwnerPromotionData objects
 *
 * @example
 * ```ts
 * const apiResult = await ownerPromotionApi.list({ lifecycleState: 'ACTIVE' });
 * if (apiResult.ok) {
 *   const promotions = transformOwnerPromotionList({ items: apiResult.data.items });
 * }
 * ```
 */
export function transformOwnerPromotionList({
    items
}: {
    readonly items: ReadonlyArray<Record<string, unknown>>;
}): ReadonlyArray<import('./types').OwnerPromotionData> {
    return items.map((item) => transformOwnerPromotion({ item }));
}

// ---------------------------------------------------------------------------
// Gastronomy transforms (SPEC-239)
// ---------------------------------------------------------------------------

/**
 * Normalize a raw `openingHours` value from the API into a typed map.
 * Returns `null` when absent or in an unexpected shape.
 */
function normalizeOpeningHours(raw: unknown): Record<string, GastronomyOpeningHoursEntry> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const result: Record<string, GastronomyOpeningHoursEntry> = {};
    for (const [day, value] of Object.entries(obj)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const entry = value as Record<string, unknown>;
        result[day] = {
            isOpen: Boolean(entry.isOpen ?? entry.open),
            open: entry.open ? String(entry.open) : undefined,
            close: entry.close ? String(entry.close) : undefined,
            open24h: entry.open24h ? Boolean(entry.open24h) : undefined
        };
    }
    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Normalize a raw `socialNetworks` value from the API.
 * Returns `null` when absent or empty.
 */
function normalizeSocialNetworks(raw: unknown): GastronomySocialNetworks | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    return {
        facebook: obj.facebook ? String(obj.facebook) : null,
        instagram: obj.instagram ? String(obj.instagram) : null,
        twitter: obj.twitter ? String(obj.twitter) : null,
        youtube: obj.youtube ? String(obj.youtube) : null,
        whatsapp: obj.whatsapp ? String(obj.whatsapp) : null,
        tiktok: obj.tiktok ? String(obj.tiktok) : null,
        website: obj.website ? String(obj.website) : null
    };
}

/**
 * Transforms a raw API gastronomy item to GastronomyCardData props.
 *
 * Maps the `GastronomyPublic` fields from the public list/detail API response
 * to the clean `GastronomyCardData` interface consumed by card components.
 * Components MUST NOT read raw API data directly.
 *
 * @param item - Raw gastronomy object from the API
 * @param locale - Active locale for i18n field resolution
 * @returns Typed GastronomyCardData for the card component
 */
export function toGastronomyCardProps({
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): GastronomyCardData {
    const { featuredImage } = processEntityImages({
        item,
        entity: 'gastronomy',
        id: String(item.id || ''),
        extract: true,
        fallback: '/images/placeholder-gastronomy.svg'
    });

    // Resolve destination name from API join (destinationId is the FK)
    const destinationObj = item.destination as { name?: unknown; nameI18n?: unknown } | undefined;
    const destinationName = destinationObj
        ? resolveI18nText(
              (destinationObj.nameI18n as I18nTextLike | string) ?? destinationObj.name ?? '',
              locale
          )
        : '';

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
        type: String(item.type || ''),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
        featuredImage,
        destinationId: String(item.destinationId || ''),
        destinationName,
        priceRange: item.priceRange != null ? String(item.priceRange) : null,
        averageRating: Number(item.averageRating ?? 0),
        reviewsCount: Number(item.reviewsCount ?? 0),
        isFeatured: Boolean(item.isFeatured),
        openingHours: normalizeOpeningHours(item.openingHours),
        createdAt: item.createdAt ? String(item.createdAt) : null
    };
}

/**
 * Transforms a raw API gastronomy item to GastronomyDetailData props.
 *
 * Used on the gastronomy detail page where the full `GastronomyPublic` shape
 * (including FAQs, social networks, SEO, and owner data) is available.
 *
 * @param item - Raw gastronomy object from the detail API endpoint
 * @param locale - Active locale for i18n field resolution
 * @returns Typed GastronomyDetailData for the detail page components
 */
export function toGastronomyDetailPageProps({
    item,
    locale = 'es'
}: {
    readonly item: Record<string, unknown>;
    readonly locale?: string;
}): GastronomyDetailData {
    const cardProps = toGastronomyCardProps({ item, locale });

    const seoObj = item.seo as Record<string, unknown> | undefined;
    const ownerObj = item.owner as Record<string, unknown> | undefined;

    const faqs: GastronomyDetailData['faqs'] = Array.isArray(item.faqs)
        ? (item.faqs as Array<Record<string, unknown>>).map((faq) => ({
              id: String(faq.id || ''),
              question: String(faq.question || ''),
              answer: String(faq.answer || ''),
              category: faq.category ? String(faq.category) : null
          }))
        : [];

    return {
        ...cardProps,
        description: resolveI18nText(
            (item.descriptionI18n as I18nTextLike | string) ?? item.description ?? '',
            locale
        ),
        richDescription: item.richDescription != null ? String(item.richDescription) : null,
        menuUrl: item.menuUrl != null ? String(item.menuUrl) : null,
        socialNetworks: normalizeSocialNetworks(item.socialNetworks),
        seo: seoObj
            ? {
                  title: seoObj.title != null ? String(seoObj.title) : null,
                  description: seoObj.description != null ? String(seoObj.description) : null
              }
            : null,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        faqs,
        owner: ownerObj
            ? {
                  id: String(ownerObj.id || ''),
                  name: ownerObj.name != null ? String(ownerObj.name) : null,
                  image: ownerObj.image != null ? String(ownerObj.image) : null,
                  createdAt: ownerObj.createdAt != null ? String(ownerObj.createdAt) : null
              }
            : null
    };
}

// ---------------------------------------------------------------------------
// Experience transforms (SPEC-240)
// ---------------------------------------------------------------------------

/**
 * Normalize a raw `openingHours` value for experience listings.
 * Returns null when absent or empty. Mirrors normalizeOpeningHours for gastronomy.
 */
function normalizeExperienceOpeningHours(
    raw: unknown
): Record<string, ExperienceOpeningHoursEntry> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const result: Record<string, ExperienceOpeningHoursEntry> = {};
    for (const [day, value] of Object.entries(obj)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const entry = value as Record<string, unknown>;
        result[day] = {
            isOpen: Boolean(entry.isOpen ?? entry.open),
            open: entry.open ? String(entry.open) : undefined,
            close: entry.close ? String(entry.close) : undefined,
            open24h: entry.open24h ? Boolean(entry.open24h) : undefined
        };
    }
    return Object.keys(result).length > 0 ? result : null;
}

/**
 * Normalize a raw `socialNetworks` value for experience listings.
 * Returns null when absent or empty.
 */
function normalizeExperienceSocialNetworks(raw: unknown): ExperienceSocialNetworks | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    return {
        facebook: obj.facebook ? String(obj.facebook) : null,
        instagram: obj.instagram ? String(obj.instagram) : null,
        twitter: obj.twitter ? String(obj.twitter) : null,
        youtube: obj.youtube ? String(obj.youtube) : null,
        whatsapp: obj.whatsapp ? String(obj.whatsapp) : null,
        tiktok: obj.tiktok ? String(obj.tiktok) : null,
        website: obj.website ? String(obj.website) : null
    };
}

/**
 * Normalize public contact info for experience listings.
 * Only `whatsapp` is surfaced publicly (for the CTA deep link).
 */
function normalizeExperienceContactInfo(raw: unknown): ExperienceContactInfo | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const whatsapp = obj.whatsapp ? String(obj.whatsapp) : null;
    if (!whatsapp) return null;
    return { whatsapp };
}

/**
 * Transforms a raw API experience item to ExperienceCardData props.
 *
 * @param item - Raw experience object from the API
 * @param locale - Active locale for i18n field resolution
 * @returns Typed ExperienceCardData for the card component
 */
export function toExperienceCardProps({
    item,
    locale = 'es'
}: { readonly item: Record<string, unknown>; readonly locale?: string }): ExperienceCardData {
    const { featuredImage } = processEntityImages({
        item,
        entity: 'experience',
        id: String(item.id || ''),
        extract: true,
        fallback: '/images/placeholder-experience.svg'
    });

    const destinationObj = item.destination as { name?: unknown; nameI18n?: unknown } | undefined;
    const destinationName = destinationObj
        ? resolveI18nText(
              (destinationObj.nameI18n as I18nTextLike | string) ?? destinationObj.name ?? '',
              locale
          )
        : '';

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: resolveI18nText((item.nameI18n as I18nTextLike | string) ?? item.name, locale),
        type: String(item.type || ''),
        summary: resolveI18nText(
            (item.summaryI18n as I18nTextLike | string) ?? item.summary ?? item.description,
            locale
        ),
        featuredImage,
        destinationId: String(item.destinationId || ''),
        destinationName,
        priceFrom: Number(item.priceFrom ?? 0),
        priceUnit: String(item.priceUnit || 'per_day'),
        isPriceOnRequest: Boolean(item.isPriceOnRequest),
        averageRating: Number(item.averageRating ?? 0),
        reviewsCount: Number(item.reviewsCount ?? 0),
        isFeatured: Boolean(item.isFeatured),
        openingHours: normalizeExperienceOpeningHours(item.openingHours),
        createdAt: item.createdAt ? String(item.createdAt) : null
    };
}

/**
 * Transforms a raw API experience item to ExperienceDetailData props.
 *
 * Used on the experience detail page where the full public schema shape
 * (including FAQs, social networks, contact info, SEO, and owner data) is available.
 *
 * @param item - Raw experience object from the detail API endpoint
 * @param locale - Active locale for i18n field resolution
 * @returns Typed ExperienceDetailData for the detail page components
 */
export function toExperienceDetailPageProps({
    item,
    locale = 'es'
}: {
    readonly item: Record<string, unknown>;
    readonly locale?: string;
}): ExperienceDetailData {
    const cardProps = toExperienceCardProps({ item, locale });

    const seoObj = item.seo as Record<string, unknown> | undefined;
    const ownerObj = item.owner as Record<string, unknown> | undefined;

    const faqs: ExperienceDetailData['faqs'] = Array.isArray(item.faqs)
        ? (item.faqs as Array<Record<string, unknown>>).map((faq) => ({
              id: String(faq.id || ''),
              question: String(faq.question || ''),
              answer: String(faq.answer || ''),
              category: faq.category ? String(faq.category) : null
          }))
        : [];

    return {
        ...cardProps,
        description: resolveI18nText(
            (item.descriptionI18n as I18nTextLike | string) ?? item.description ?? '',
            locale
        ),
        richDescription: item.richDescription != null ? String(item.richDescription) : null,
        contactInfo: normalizeExperienceContactInfo(item.contactInfo),
        socialNetworks: normalizeExperienceSocialNetworks(item.socialNetworks),
        seo: seoObj
            ? {
                  title: seoObj.title != null ? String(seoObj.title) : null,
                  description: seoObj.description != null ? String(seoObj.description) : null
              }
            : null,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        faqs,
        owner: ownerObj
            ? {
                  id: String(ownerObj.id || ''),
                  name: ownerObj.name != null ? String(ownerObj.name) : null,
                  image: ownerObj.image != null ? String(ownerObj.image) : null,
                  createdAt: ownerObj.createdAt != null ? String(ownerObj.createdAt) : null
              }
            : null
    };
}
