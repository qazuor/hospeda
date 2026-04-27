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
    EventCardData,
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
    EventLocation,
    ReviewCardData
} from '@/data/types';

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
        .filter((item) => item.key);

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

    const { featuredImage } = processEntityImages({
        item,
        entity: 'accommodation',
        id: String(item.id || ''),
        extract: true,
        fallback: '/images/placeholder-accommodation.svg'
    });

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || item.description || ''),
        type: String(item.type || item.accommodationType || ''),
        featuredImage,
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
        cityDestinationSlug
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

    return {
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
            attractions?.map((a) => ({
                id: a.id,
                name: a.name,
                icon: a.icon,
                displayWeight: a.displayWeight
            })) ?? [],
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
    const { cityName, cityPath, cityDestinationSlug } = deriveCityFields(locationObj);

    return {
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
        cityName,
        cityPath,
        cityDestinationSlug
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
    const authorObj = item.author as Record<string, unknown> | undefined;
    const authorName = String(
        item.authorName ||
            authorObj?.displayName ||
            [authorObj?.firstName, authorObj?.lastName].filter(Boolean).join(' ') ||
            ''
    );
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
        fallback: '/images/placeholder-post.svg'
    });

    return {
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
        tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined
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
 * @param item - Raw accommodation object from the API (getBySlug response)
 * @returns Typed AccommodationDetailData for the detail page components
 */
export function toAccommodationDetailPageProps({
    item
}: { readonly item: Record<string, unknown> }): AccommodationDetailData {
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
        type: String(item.type || ''),
        isFeatured: Boolean(item.isFeatured),
        createdAt: item.createdAt ? String(item.createdAt) : new Date().toISOString(),
        averageRating: Number(item.averageRating || 0),
        reviewsCount: Number(item.reviewsCount || 0),
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-accommodation.svg'),
        media: (() => {
            const galleryItems = extractGalleryItems(item);
            return {
                images: mediaObj?.images ?? extractGalleryUrls(item),
                // Preserve caption/description alongside gallery URLs so
                // HeroGallery + fotos can surface them (GAP-078-136).
                galleryItems,
                videos: mediaObj?.videos ?? []
            };
        })(),
        location: {
            lat: locationObj?.lat != null ? Number(locationObj.lat) : null,
            lng: locationObj?.lng != null ? Number(locationObj.lng) : null
        },
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
        amenities: (amenitiesArr ?? []).map((a) => ({
            amenityId: String(a.amenityId || ''),
            name: String(a.name || ''),
            icon: a.icon ? String(a.icon) : null,
            isOptional: Boolean(a.isOptional),
            additionalCost: a.additionalCost != null ? Number(a.additionalCost) : null
        })),
        features: (featuresArr ?? []).map((f) => ({
            featureId: String(f.featureId || ''),
            name: String(f.name || ''),
            icon: f.icon ? String(f.icon) : null,
            hostReWriteName: f.hostReWriteName ? String(f.hostReWriteName) : null,
            comments: f.comments ? String(f.comments) : null
        })),
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
