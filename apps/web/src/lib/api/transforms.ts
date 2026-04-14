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
    BlogPostCardData,
    CardAmenityFeature,
    DestinationCardData,
    EventCardData,
    ReviewCardData
} from '@/data/types';
import { extractFeaturedImageUrl, extractGalleryUrls } from '../media';

// Re-export types from canonical source for backward compatibility
export type {
    AccommodationCardData,
    AccommodationDetailData,
    BlogPostCardData,
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
    const destinationObj = item.destination as Record<string, unknown> | undefined;
    const city = String(locationObj?.city || destinationObj?.name || '');
    const state = String(locationObj?.state || '');

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || item.description || ''),
        type: String(item.type || item.accommodationType || ''),
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-accommodation.svg'),
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
        features: extractRelationItems(item.features, 'feature')
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
    const mediaWrapper = { media: item.media } as Record<string, unknown>;
    const featuredImage = extractFeaturedImageUrl(
        mediaWrapper,
        '/images/placeholder-accommodation.svg'
    );
    const gallery = extractGalleryUrls(mediaWrapper);
    const images = gallery.length > 0 ? gallery : [featuredImage];

    const locationObj = item.location as Record<string, unknown> | undefined;
    const extraInfo = item.extraInfo as Record<string, unknown> | undefined;
    const priceData = item.price as
        | { amount?: number; price?: number; currency?: string }
        | undefined;

    return {
        id: String(item.id || ''),
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        type: String(item.type || item.accommodationType || ''),
        images,
        location: {
            city: locationObj?.city ? String(locationObj.city) : undefined,
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
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-destination.svg'),
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
    const dateObj = item.date as { start?: string; end?: string } | undefined;
    const locationObj = item.location as Record<string, unknown> | undefined;

    return {
        slug: String(item.slug || ''),
        name: String(item.name || ''),
        summary: String(item.summary || item.description || ''),
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-event.svg'),
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
                  city: String(locationObj.city || '')
              }
            : undefined
    };
}

/**
 * Transforms a raw API post item to BlogPostCard props.
 *
 * @param item - Raw post object from the API
 * @returns Typed BlogPostCardData for the card component
 */
export function toPostCardProps({
    item
}: { readonly item: Record<string, unknown> }): BlogPostCardData {
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

    return {
        slug: String(item.slug || ''),
        title: String(item.title || ''),
        summary: String(item.summary || item.content || ''),
        featuredImage: extractFeaturedImageUrl(item, '/images/placeholder-post.svg'),
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
        initials: getInitials(String(item.userName || 'U')),
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
    const destinationObj = item.destination as Record<string, unknown> | undefined;
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
        media: {
            images: mediaObj?.images ?? extractGalleryUrls(item),
            videos: mediaObj?.videos ?? []
        },
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
 * Helper to get initials from a name.
 */
export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
    return `${(parts[0]?.[0] ?? '').toUpperCase()}${(parts[parts.length - 1]?.[0] ?? '').toUpperCase()}`;
}
