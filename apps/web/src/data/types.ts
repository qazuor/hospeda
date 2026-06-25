/**
 * @file types.ts
 * @description Shared TypeScript interfaces for web mock data and component props.
 *
 * These interfaces mirror the real API transform shapes defined in
 * `apps/web/src/lib/api/transforms.ts` (and the future web equivalent).
 * They are used throughout the homepage and other static sections that
 * consume mock/seed data before the live API is wired up.
 *
 * All fields are `readonly` to prevent accidental mutation of shared data.
 */

// Re-export UI types from split file for backward compatibility
export type {
    ArticleCardBaseProps,
    ArticleRelatedEntity,
    FeatureItemData,
    HomepageConfig,
    PartnerData,
    ReviewCardData,
    StatItemData
} from './types-ui';

// ---------------------------------------------------------------------------
// Shared sub-types
// ---------------------------------------------------------------------------

/**
 * Amenity or feature item extracted from an accommodation relation join.
 *
 * Used in {@link AccommodationCardData} for the `amenities` and `features`
 * arrays. Matches the `CardAmenityFeature` interface from `transforms.ts`.
 *
 * @example
 * ```ts
 * const amenity: CardAmenityFeature = {
 *   key: 'wifi',
 *   label: 'WiFi gratuito',
 *   icon: 'WifiHigh',
 *   displayWeight: 10,
 * };
 * ```
 */
export interface CardAmenityFeature {
    /** Unique slug/key identifying this amenity or feature. */
    readonly key: string;
    /** Human-readable label shown in the UI. */
    readonly label: string;
    /** Optional Phosphor icon name (e.g. `'WifiHigh'`). */
    readonly icon?: string;
    /** Display priority (higher = more important, range 1-100). Defaults to 50. */
    readonly displayWeight?: number;
}

/**
 * Price display information for accommodation cards.
 *
 * The `amount` field stores the raw value in centavos (integer).
 * Divide by 100 for display, or pass directly to `formatPrice()`.
 *
 * Matches the `CardPrice` interface from `transforms.ts`.
 *
 * @example
 * ```ts
 * const price: CardPrice = {
 *   amount: 1500000, // ARS 15.000,00
 *   currency: 'ARS',
 *   period: 'noche',
 * };
 * ```
 */
export interface CardPrice {
    /** Price in centavos (integer). Divide by 100 for display. */
    readonly amount: number;
    /** ISO 4217 currency code (e.g. `'ARS'`, `'USD'`). */
    readonly currency: string;
    /** Billing period label (e.g. `'noche'`, `'semana'`). */
    readonly period: string;
}

/**
 * Simple city/state location for accommodation cards.
 *
 * Matches the `CardLocation` interface from `transforms.ts`.
 */
export interface CardLocation {
    /** City name (e.g. `'Concepción del Uruguay'`). */
    readonly city: string;
    /** State/province name (e.g. `'Entre Ríos'`). */
    readonly state: string;
}

// ---------------------------------------------------------------------------
// Entity card data
// ---------------------------------------------------------------------------

/**
 * Props for the AccommodationCard component.
 *
 * Produced by `toAccommodationCardProps()` in `transforms.ts` and consumed
 * directly by `AccommodationCard.astro`. Used in the homepage featured
 * accommodations section and the full listing page.
 *
 * @example
 * ```ts
 * const card: AccommodationCardData = {
 *   id: 'abc-123',
 *   slug: 'cabana-rio-verde',
 *   name: 'Cabaña Río Verde',
 *   summary: 'Hermosa cabaña frente al río.',
 *   type: 'cabin',
 *   featuredImage: { url: '/images/cabin.jpg', caption: 'Vista del río' },
 *   location: { city: 'Concepción del Uruguay', state: 'Entre Ríos' },
 *   price: { amount: 1500000, currency: 'ARS', period: 'noche' },
 *   averageRating: 4.7,
 *   reviewsCount: 32,
 *   isFeatured: true,
 * };
 * ```
 */
export interface AccommodationCardData {
    /** UUID or opaque identifier for the accommodation. */
    readonly id: string;
    /** URL-safe slug used to build the detail page path. */
    readonly slug: string;
    /** Display name shown in the card header. */
    readonly name: string;
    /** Short description shown below the name. */
    readonly summary: string;
    /** Accommodation type slug (e.g. `'hotel'`, `'cabin'`, `'apartment'`). */
    readonly type: string;
    /**
     * Featured image with Cloudinary-transformed URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? name` as `alt` text for accessibility.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /** City and state displayed in the location row. */
    readonly location: CardLocation;
    /** Optional nightly/weekly price. Absent when pricing is not published. */
    readonly price?: CardPrice;
    /** Average star rating (0–5). */
    readonly averageRating: number;
    /** Total number of reviews contributing to `averageRating`. */
    readonly reviewsCount: number;
    /** Whether this accommodation appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /** ISO 8601 creation date. Used to derive "new" badge (< 30 days). */
    readonly createdAt?: string;
    /** Optional list of amenity items (wifi, pool, parking, …). */
    readonly amenities?: readonly CardAmenityFeature[];
    /** Optional list of extra feature items (pet-friendly, eco-certified, …). */
    readonly features?: readonly CardAmenityFeature[];
    /**
     * SPEC-095: City name derived from `cityDestination.name`. Empty string if
     * the API response did not carry a `cityDestination` projection.
     */
    readonly cityName?: string;
    /**
     * SPEC-095: Materialized destination path (e.g.
     * `/argentina/litoral/entre-rios/concepcion-del-uruguay`) used for SEO
     * breadcrumbs and `/destinos` deep links.
     */
    readonly cityPath?: string;
    /** SPEC-095: Slug of the city destination, used for `/destinos/{slug}` links. */
    readonly cityDestinationSlug?: string;
    /**
     * SPEC-097: Privacy-aware obfuscated coordinates for listing maps. Present
     * only when the accommodation has stored coordinates and the API returns
     * an obfuscated projection.
     */
    readonly approximateLocation?: {
        readonly lat: number;
        readonly lng: number;
        readonly radiusMeters: number;
    };
    /**
     * SPEC-098: Whether the current user has already favorited this accommodation.
     * Populated by a bulk-check API call on listing pages. Undefined for guests or
     * when the bulk-check was not performed (FavoriteButton single-check fallback
     * handles this case on mount).
     */
    readonly isFavorited?: boolean;
    /**
     * SPEC-098: Bookmark id when the entity is already favorited by the current user.
     * Required for explicit DELETE flows. Null when the entity is not yet favorited.
     * Undefined when no bulk-check was performed.
     */
    readonly favoriteBookmarkId?: string | null;
    /**
     * SPEC-098: Total public count of users who have bookmarked this accommodation.
     * Used by FavoriteButton's `pill` variant to render the count badge.
     * Undefined when not returned by the API endpoint.
     */
    readonly bookmarkCount?: number;
    /**
     * Total number of photos (gallery + featured fallback). Derived from
     * `media.gallery.length`; falls back to 1 when only `featuredImage` is
     * present, and 0 when the accommodation has no media at all so the card
     * can hide the photo-count badge.
     */
    readonly photoCount?: number;
}

/**
 * Attraction item nested inside {@link DestinationCardData}.
 *
 * Represents a named point of interest (e.g. a natural park, historic site)
 * associated with a destination. Used to render icon chips on destination cards.
 */
export interface DestinationAttraction {
    /** Unique identifier for this attraction. */
    readonly id: string;
    /** Human-readable name of the attraction. */
    readonly name: string;
    /** Optional Phosphor icon name. */
    readonly icon?: string;
    /** Display priority (lower = shown first). */
    readonly displayWeight?: number;
}

/**
 * Gallery image item nested inside {@link DestinationCardData}.
 */
export interface DestinationGalleryImage {
    /** Absolute or root-relative URL for the gallery image. */
    readonly url: string;
    /** Optional alt/caption text for the image. */
    readonly caption?: string;
}

/**
 * Geographic coordinates nested inside {@link DestinationCardData}.
 */
export interface DestinationCoordinates {
    /** Latitude as a decimal string (e.g. `'-32.484'`). */
    readonly lat: string;
    /** Longitude as a decimal string (e.g. `'-58.234'`). */
    readonly long: string;
}

/**
 * Props for the DestinationCard component.
 *
 * Produced by `toDestinationCardProps()` in `transforms.ts` and consumed
 * by `DestinationCard.astro`. Used in the homepage destinations section
 * and the full destinations listing page.
 *
 * @example
 * ```ts
 * const card: DestinationCardData = {
 *   id: 'e3b0c442-98fc-4c14-9e32-82b3e4b6b6a2',
 *   slug: 'concepcion-del-uruguay',
 *   name: 'Concepción del Uruguay',
 *   summary: 'Ciudad histórica a orillas del río Uruguay.',
 *   featuredImage: { url: '/images/cdu.jpg', caption: 'Vista aérea del río' },
 *   accommodationsCount: 48,
 *   isFeatured: true,
 *   path: 'concepcion-del-uruguay',
 *   averageRating: 4.5,
 *   reviewsCount: 120,
 *   eventsCount: 15,
 * };
 * ```
 */
export interface DestinationCardData {
    /**
     * UUID identifier for the destination.
     * Required by FavoriteButton as `entityId` — must be a UUID, not a slug.
     * If the API response does not include `id`, the FavoriteButton will not
     * function correctly (a console warning is logged by the transform).
     */
    readonly id: string;
    /** URL-safe slug used to build the destination detail page path. */
    readonly slug: string;
    /** Display name of the destination. */
    readonly name: string;
    /** Short description shown on the card. */
    readonly summary: string;
    /**
     * Featured image with Cloudinary-transformed URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? name` as `alt` text for accessibility.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /** Total number of published accommodations in this destination. */
    readonly accommodationsCount: number;
    /** Whether this destination appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /**
     * Route path segment used when building destination URLs.
     * Usually equals `slug`, but may differ if the API uses a separate `path` field.
     */
    readonly path: string;
    /** Average star rating across all reviews for this destination (0–5). */
    readonly averageRating: number;
    /** Total number of reviews contributing to `averageRating`. */
    readonly reviewsCount: number;
    /** Number of published events associated with this destination. */
    readonly eventsCount: number;
    /** Optional list of named attractions / points of interest. */
    readonly attractions?: readonly DestinationAttraction[];
    /** Optional gallery images shown in a lightbox or carousel. */
    readonly gallery?: readonly DestinationGalleryImage[];
    /** Optional GPS coordinates for map rendering. */
    readonly coordinates?: DestinationCoordinates;
    /**
     * Optional rating breakdown by dimension.
     * Keys are dimension slugs (e.g. `'cleanliness'`), values are 0–5 scores.
     */
    readonly ratingDimensions?: Record<string, number>;
}

/**
 * Event date range nested inside {@link EventCardData}.
 */
export interface EventDateRange {
    /** ISO 8601 start date-time string. */
    readonly start: string;
    /** Optional ISO 8601 end date-time string. */
    readonly end?: string;
}

/**
 * Event venue location nested inside {@link EventCardData}.
 *
 * Matches the `EventLocation` interface from `transforms.ts`.
 */
export interface EventLocation {
    /** Name of the venue or place (e.g. `'Teatro 1º de Mayo'`). */
    readonly name: string;
    /** City where the event takes place. */
    readonly city: string;
}

/**
 * Props for the event card components.
 *
 * Produced by `toEventCardProps()` in `transforms.ts` and consumed
 * by `EventCardHorizontal.astro` and `EventCardFeatured.astro`.
 * Used in the homepage events section, the full events listing
 * page, and related-events sections on destination/accommodation
 * detail pages.
 *
 * @example
 * ```ts
 * const card: EventCardData = {
 *   id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 *   slug: 'festival-cosquin-rock-2026',
 *   name: 'Cosquín Rock 2026',
 *   summary: 'El festival de rock más importante de Argentina.',
 *   featuredImage: { url: '/images/cosquin-rock.jpg', caption: 'Escenario principal' },
 *   category: 'music',
 *   date: { start: '2026-02-14T18:00:00Z', end: '2026-02-15T02:00:00Z' },
 *   isFeatured: true,
 *   location: { name: 'Estadio Municipal', city: 'Cosquín' },
 * };
 * ```
 */
export interface EventCardData {
    /**
     * UUID identifier for the event.
     * Required by FavoriteButton as `entityId` — must be a UUID, not a slug.
     * If the API response does not include `id`, the FavoriteButton will not
     * function correctly (a console warning is logged by the transform).
     */
    readonly id: string;
    /** URL-safe slug used to build the event detail page path. */
    readonly slug: string;
    /** Display name of the event. */
    readonly name: string;
    /** Short description shown on the card. */
    readonly summary: string;
    /**
     * Featured image with Cloudinary-transformed URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? name` as `alt` text for accessibility.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /** Event category slug (e.g. `'music'`, `'cultural'`, `'gastronomy'`). */
    readonly category: string;
    /** Start and optional end date-time for the event. */
    readonly date: EventDateRange;
    /** Whether this event appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /** Optional venue location. Absent for online/virtual events. */
    readonly location?: EventLocation;
    /**
     * Optional event organizer. Absent when the API list endpoint does not
     * expand the organizer relation. Cards may surface `organizer.name`
     * as secondary meta.
     */
    readonly organizer?: { readonly name: string; readonly slug?: string };
    /**
     * SPEC-095: City name derived from `eventLocation.cityDestination.name`.
     * Empty string when the API response did not carry a `cityDestination`
     * projection or when the event has no eventLocation.
     */
    readonly cityName?: string;
    /** SPEC-095: Materialized destination path for SEO breadcrumbs. */
    readonly cityPath?: string;
    /** SPEC-095: Slug of the city destination, used for `/destinos/{slug}` links. */
    readonly cityDestinationSlug?: string;
    /**
     * SPEC-098: Whether the current user has already favorited this event.
     * Populated by a bulk-check API call on listing pages. Undefined for guests or
     * when the bulk-check was not performed (FavoriteButton single-check fallback
     * handles this case on mount).
     */
    readonly isFavorited?: boolean;
    /**
     * SPEC-098: Bookmark id when the entity is already favorited by the current user.
     * Required for explicit DELETE flows. Null when the entity is not yet favorited.
     * Undefined when no bulk-check was performed.
     */
    readonly favoriteBookmarkId?: string | null;
    /**
     * SPEC-098: Total public count of users who have bookmarked this event.
     * Used by FavoriteButton's `pill` variant to render the count badge.
     * Undefined when not returned by the API endpoint.
     */
    readonly bookmarkCount?: number;
}

/**
 * Props for the ArticleCard component.
 *
 * Produced by `toArticleCardProps()` in `transforms.ts` and consumed
 * by `ArticleCard.astro`. Used in the homepage blog section and
 * the full posts listing page.
 *
 * @example
 * ```ts
 * const card: ArticleCardData = {
 *   id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
 *   slug: 'mejores-cabanas-entre-rios',
 *   title: 'Las 10 mejores cabañas de Entre Ríos',
 *   summary: 'Descubrí los rincones más hermosos del litoral.',
 *   featuredImage: { url: '/images/cabanas-er.jpg', caption: 'Cabaña a orillas del río' },
 *   category: 'travel',
 *   publishedAt: '2026-03-01T10:00:00Z',
 *   readingTimeMinutes: 7,
 *   authorName: 'Laura Méndez',
 *   isFeatured: true,
 * };
 * ```
 */
export interface ArticleCardData {
    /**
     * UUID identifier for the article/post.
     * Required by FavoriteButton as `entityId` — must be a UUID, not a slug.
     * If the API response does not include `id`, the FavoriteButton will not
     * function correctly (a console warning is logged by the transform).
     */
    readonly id: string;
    /** URL-safe slug used to build the post detail page path. */
    readonly slug: string;
    /** Display title of the blog post. */
    readonly title: string;
    /** Short excerpt or summary shown on the card. */
    readonly summary: string;
    /**
     * Featured image with Cloudinary-transformed URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? title` as `alt` text for accessibility.
     */
    readonly featuredImage: {
        readonly url: string;
        readonly caption?: string;
        readonly attribution?: {
            readonly photographer: string;
            readonly sourceUrl: string;
            readonly license: string;
            readonly provider: 'unsplash' | 'pexels';
        };
    };
    /** Post category slug (e.g. `'travel'`, `'gastronomy'`, `'tips'`). */
    readonly category: string;
    /** ISO 8601 publish date-time string. */
    readonly publishedAt: string;
    /** Estimated reading time in minutes. */
    readonly readingTimeMinutes: number;
    /** Display name of the post author. */
    readonly authorName: string;
    /** Optional URL for the author's avatar image. */
    readonly authorAvatar?: string;
    /** Whether this post appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /** Whether this post is classified as a news item. */
    readonly isNews?: boolean;
    /** Optional ISO 8601 expiration date. Present only on posts with a set expiry. */
    readonly expiresAt?: string;
    /** Optional list of tag slugs associated with the post. */
    readonly tags?: readonly string[];
    /**
     * SPEC-098: Whether the current user has already favorited this article/post.
     * Populated by a bulk-check API call on listing pages. Undefined for guests or
     * when the bulk-check was not performed (FavoriteButton single-check fallback
     * handles this case on mount).
     */
    readonly isFavorited?: boolean;
    /**
     * SPEC-098: Bookmark id when the entity is already favorited by the current user.
     * Required for explicit DELETE flows. Null when the entity is not yet favorited.
     * Undefined when no bulk-check was performed.
     */
    readonly favoriteBookmarkId?: string | null;
    /**
     * SPEC-098: Total public count of users who have bookmarked this article/post.
     * Used by FavoriteButton's `pill` variant to render the count badge.
     * Undefined when not returned by the API endpoint.
     */
    readonly bookmarkCount?: number;
}

// ---------------------------------------------------------------------------
// Accommodation detail page data
// ---------------------------------------------------------------------------

/** Amenity relation from accommodation join. */
export interface DetailAmenity {
    readonly amenityId: string;
    readonly name: string;
    readonly icon: string | null;
    readonly isOptional: boolean;
    readonly additionalCost: number | null;
    /** Display priority (higher = more important, range 1-100). Defaults to 50. */
    readonly displayWeight: number;
}

/** Feature relation from accommodation join. */
export interface DetailFeature {
    readonly featureId: string;
    readonly name: string;
    readonly icon: string | null;
    readonly hostReWriteName: string | null;
    readonly comments: string | null;
    /** Display priority (higher = more important, range 1-100). Defaults to 50. */
    readonly displayWeight: number;
}

/** FAQ item from accommodation join. */
export interface DetailFaq {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly category: string | null;
}

/**
 * Type alias used by OwnerCard.astro.
 * Mirrors the `owner` field of {@link AccommodationDetailData}.
 */
export interface AccommodationOwnerData {
    readonly id: string;
    readonly name: string;
    readonly image: string | null;
    readonly createdAt: string;
}

/**
 * Type alias used by AmenitiesGrid.astro.
 * Mirrors {@link DetailAmenity} — name has been pre-resolved to a plain string
 * by the transform layer (SPEC-172 PR4: amenity.name is an i18n object in the API).
 */
export type AccommodationAmenityItem = DetailAmenity;

/**
 * Type alias used by FeaturesGrid.astro.
 * Mirrors {@link DetailFeature} — name has been pre-resolved to a plain string
 * by the transform layer (SPEC-172 PR4: feature.name is an i18n object in the API).
 */
export type AccommodationFeatureItem = DetailFeature;

/**
 * Typed data shape for the accommodation detail page.
 * Produced by `toAccommodationDetailPageProps()` in transforms.ts.
 */
export interface AccommodationDetailData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly richDescription?: string | null;
    readonly type: string;
    readonly isFeatured: boolean;
    readonly createdAt: string;
    readonly averageRating: number;
    readonly reviewsCount: number;
    readonly featuredImage: string;
    readonly media: {
        readonly images: readonly string[];
        /**
         * Gallery items carrying the image URL plus optional caption and
         * description metadata preserved from the API response. Consumed by
         * the full photo page and lightbox integrations; kept alongside
         * `images` for backward compatibility.
         */
        readonly galleryItems: readonly {
            readonly url: string;
            readonly caption?: string;
            readonly description?: string;
        }[];
        /**
         * Video entries carrying the URL plus optional caption and description.
         * Aligned with `@repo/schemas` `VideoSchema` (drops `moderationState`,
         * which is irrelevant for the public read). The transform also accepts
         * a legacy `string[]` payload (a bare URL) and normalizes each entry
         * to `{ url }` so older accommodation records keep rendering.
         */
        readonly videos: readonly {
            readonly url: string;
            readonly caption?: string;
            readonly description?: string;
        }[];
    };
    readonly location: {
        readonly lat: number | null;
        readonly lng: number | null;
    };
    /**
     * SPEC-097 — Privacy-aware obfuscated coordinates for accommodation maps.
     * Present only when the API returns it (anonymous/public visitors).
     * Owners and admins receive the exact `location` instead.
     */
    readonly approximateLocation?: {
        readonly lat: number;
        readonly lng: number;
        readonly radiusMeters: number;
    };
    readonly destination: {
        readonly id: string;
        readonly slug: string;
        readonly name: string;
    };
    readonly price: {
        readonly price: number | null;
        readonly currency: string | null;
        readonly additionalFees: unknown;
        readonly discounts: unknown;
    } | null;
    readonly extraInfo: {
        readonly capacity: number | null;
        readonly bedrooms: number | null;
        readonly beds: number | null;
        readonly bathrooms: number | null;
        readonly minNights: number | null;
        readonly maxNights: number | null;
        readonly smokingAllowed: boolean | null;
    } | null;
    readonly seo: {
        readonly title: string | null;
        readonly description: string | null;
    } | null;
    readonly owner: {
        readonly id: string;
        readonly name: string;
        readonly image: string | null;
        readonly createdAt: string;
    };
    readonly amenities: readonly DetailAmenity[];
    readonly features: readonly DetailFeature[];
    readonly faqs: readonly DetailFaq[];
}

// ---------------------------------------------------------------------------
// Event detail page data
// ---------------------------------------------------------------------------

/**
 * Gallery image for the event detail page.
 * Mirrors `GalleryImage` from ImageGallery.client.tsx but defined here
 * as the canonical type so components import from `@/data/types`, not from
 * the island file directly.
 */
export interface EventGalleryImage {
    /** Absolute or relative URL of the full-size image. */
    readonly url: string;
    /** Alt text for accessibility. */
    readonly alt: string;
    /** Optional caption shown in lightbox. */
    readonly caption?: string;
}

/**
 * Organizer contact info nested in {@link EventDetailData}.
 */
export interface EventOrganizerContact {
    readonly email?: string;
    readonly phone?: string;
    readonly website?: string;
}

/**
 * Organizer social networks nested in {@link EventDetailData}.
 */
export interface EventOrganizerSocial {
    readonly facebook?: string;
    readonly instagram?: string;
    readonly twitter?: string;
    readonly youtube?: string;
    readonly linkedin?: string;
}

/**
 * Organizer data nested in {@link EventDetailData}.
 */
export interface EventDetailOrganizer {
    readonly name: string;
    readonly slug?: string;
    readonly description?: string;
    readonly logo?: string;
    readonly contactInfo?: EventOrganizerContact;
    readonly socialNetworks?: EventOrganizerSocial;
}

/**
 * Rich pricing data for the event detail page.
 */
export interface EventDetailPricing {
    /** Flat price in the smallest currency unit (centavos for ARS). */
    readonly price?: number;
    /** Lower bound of a price range. */
    readonly priceFrom?: number;
    /** Upper bound of a price range. */
    readonly priceTo?: number;
    /** ISO 4217 currency code. Defaults to `'ARS'`. */
    readonly currency: string;
    /** Whether the event is free. When true, ignore all price fields. */
    readonly isFree: boolean;
    /** Early-bird price in centavos. Only show if deadline is in the future. */
    readonly earlyBirdPrice?: number;
    /** ISO 8601 deadline for early-bird pricing. */
    readonly earlyBirdDeadline?: string;
    /** Minimum group size to qualify for the group discount. */
    readonly groupDiscountThreshold?: number;
    /** Group discount percentage (e.g. 10 = 10%). */
    readonly groupDiscountPercent?: number;
    /** Price per group in centavos. */
    readonly pricePerGroup?: number;
}

/**
 * Location data for the event detail page.
 */
export interface EventDetailLocation {
    /** Venue or place name. */
    readonly name?: string;
    /** City where the event takes place. */
    readonly city?: string;
    /**
     * Full street address built from the individual components returned by
     * the API (`street`, `number`, `floor`, `apartment`).
     */
    readonly fullAddress?: string;
    /** GPS coordinates — `null` when not provided. */
    readonly coordinates: { readonly lat: number; readonly lng: number } | null;
}

/**
 * SEO metadata nested in {@link EventDetailData}.
 */
export interface EventSeoData {
    readonly title?: string;
    readonly description?: string;
    readonly keywords?: readonly string[];
}

/**
 * Typed data shape for the event detail page.
 * Produced by `toEventDetailProps()` in `transforms.ts`.
 */
export interface EventDetailData {
    // --- Identity ---
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    /** Raw HTML content from TipTap / markdown renderer. */
    readonly contentHtml?: string;
    readonly category: string;
    readonly isFeatured: boolean;
    /** Tag slugs associated with the event. */
    readonly tags: readonly string[];

    // --- Date ---
    readonly startDate: string;
    readonly endDate?: string;
    readonly isAllDay: boolean;

    // --- Pricing ---
    readonly pricing: EventDetailPricing;

    // --- Media ---
    readonly featuredImage: {
        readonly url: string;
        readonly caption?: string;
        readonly attribution?: {
            readonly photographer: string;
            readonly sourceUrl: string;
            readonly license: string;
            readonly provider: 'unsplash' | 'pexels';
        };
    };
    readonly gallery: readonly EventGalleryImage[];

    // --- Location ---
    readonly location: EventDetailLocation;

    // --- Organizer ---
    readonly organizer?: EventDetailOrganizer;

    // --- Event contact ---
    readonly contactEmail?: string;
    readonly contactPhone?: string;
    readonly contactWebsite?: string;

    // --- SEO ---
    readonly seo: EventSeoData;

    // --- Status flags ---
    readonly isCancelled: boolean;
    readonly isRescheduled: boolean;
    /** Whether the event start date is in the past. Computed by the transform. */
    readonly isPast: boolean;
    /** Schema.org EventStatus value. */
    readonly eventStatus: 'EventScheduled' | 'EventCancelled' | 'EventRescheduled';
}

// ---------------------------------------------------------------------------
// Gastronomy card and detail data (SPEC-239)
// ---------------------------------------------------------------------------

/**
 * Opening hours entry for a single day of the week.
 * Produced by the gastronomy transform when `openingHours` is present on the API response.
 */
export interface GastronomyOpeningHoursEntry {
    /** Whether the establishment is open on this day. */
    readonly isOpen: boolean;
    /** Opening time string in HH:mm format, absent when closed. */
    readonly open?: string;
    /** Closing time string in HH:mm format, absent when closed or open 24 h. */
    readonly close?: string;
    /** Whether the establishment is open 24 hours on this day. */
    readonly open24h?: boolean;
}

/**
 * Social networks map for a gastronomy listing.
 * Mirrors the `socialNetworks` field from the `GastronomyPublicSchema`.
 */
export interface GastronomySocialNetworks {
    readonly facebook?: string | null;
    readonly instagram?: string | null;
    readonly twitter?: string | null;
    readonly youtube?: string | null;
    readonly whatsapp?: string | null;
    readonly tiktok?: string | null;
    readonly website?: string | null;
}

/**
 * Props for the GastronomyCard component (SPEC-239).
 *
 * Produced by `toGastronomyCardProps()` in `transforms.ts` and consumed by
 * the gastronomy card component. Used on the listing page and any featured
 * gastronomy sections.
 *
 * @example
 * ```ts
 * const card: GastronomyCardData = {
 *   id: 'abc-123',
 *   slug: 'la-parrilla-de-juan',
 *   name: 'La Parrilla de Juan',
 *   type: 'PARRILLA',
 *   summary: 'Las mejores carnes a la parrilla de la ciudad.',
 *   featuredImage: { url: '/images/parrilla.jpg', caption: 'Vista del salón' },
 *   destinationId: 'dest-uuid',
 *   destinationName: 'Concepción del Uruguay',
 *   priceRange: 'MID',
 *   averageRating: 4.5,
 *   reviewsCount: 28,
 *   isFeatured: true,
 *   openingHours: null,
 * };
 * ```
 */
export interface GastronomyCardData {
    /** UUID identifier for the gastronomy listing. */
    readonly id: string;
    /** URL-safe slug used to build the detail page path. */
    readonly slug: string;
    /** Display name of the establishment. */
    readonly name: string;
    /** Gastronomy type enum value (e.g. `'RESTAURANT'`, `'PARRILLA'`). */
    readonly type: string;
    /** Short description shown on the card. */
    readonly summary: string;
    /**
     * Featured image with URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? name` as `alt` text for accessibility.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /** UUID of the destination where the establishment is located. */
    readonly destinationId: string;
    /** Human-readable name of the destination (derived from API join). */
    readonly destinationName: string;
    /** Price tier enum value (`'BUDGET'` | `'MID'` | `'HIGH'` | `'PREMIUM'`). Null when not set. */
    readonly priceRange: string | null;
    /** Average star rating (0–5). */
    readonly averageRating: number;
    /** Total number of reviews contributing to `averageRating`. */
    readonly reviewsCount: number;
    /** Whether this listing appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /** Structured opening hours by day. Null when not configured by the owner. */
    readonly openingHours: Record<string, GastronomyOpeningHoursEntry> | null;
    /** ISO 8601 creation date. Used to derive "new" badge (< 30 days). */
    readonly createdAt?: string | null;
}

/**
 * Typed data shape for the gastronomy detail page (SPEC-239).
 * Produced by `toGastronomyDetailPageProps()` in `transforms.ts`.
 *
 * Extends `GastronomyCardData` with fields only needed for the full detail view.
 */
export interface GastronomyDetailData extends GastronomyCardData {
    /** Full plain-text description of the establishment. */
    readonly description: string;
    /** Optional rich-text (markdown) description (entitlement-gated). */
    readonly richDescription?: string | null;
    /** External URL for the establishment's menu. Null when not provided. */
    readonly menuUrl?: string | null;
    /** Social network links provided by the owner. */
    readonly socialNetworks: GastronomySocialNetworks | null;
    /** SEO metadata fields. */
    readonly seo: { readonly title: string | null; readonly description: string | null } | null;
    /** Tag slugs associated with the listing. */
    readonly tags?: readonly string[];
    /** FAQ items configured by the owner. */
    readonly faqs: readonly DetailFaq[];
    /** Public owner data from the users table JOIN. */
    readonly owner: {
        readonly id: string;
        readonly name: string | null;
        readonly image: string | null;
        readonly createdAt: string | null;
    } | null;
}

// ---------------------------------------------------------------------------
// Experience card and detail data (SPEC-240)
// ---------------------------------------------------------------------------

/**
 * Opening hours entry for a single day of the week.
 * Shared shape with GastronomyOpeningHoursEntry — experience uses the same
 * structured hours sub-system from the SPEC-239 commerce-listing core.
 */
export interface ExperienceOpeningHoursEntry {
    /** Whether the experience is available on this day. */
    readonly isOpen: boolean;
    /** Opening time string in HH:mm format, absent when closed. */
    readonly open?: string;
    /** Closing time string in HH:mm format, absent when closed or open 24 h. */
    readonly close?: string;
    /** Whether available 24 hours on this day. */
    readonly open24h?: boolean;
}

/**
 * Social networks map for an experience listing.
 * Mirrors GastronomySocialNetworks — same fields from the commerce-listing core.
 */
export interface ExperienceSocialNetworks {
    readonly facebook?: string | null;
    readonly instagram?: string | null;
    readonly twitter?: string | null;
    readonly youtube?: string | null;
    readonly whatsapp?: string | null;
    readonly tiktok?: string | null;
    readonly website?: string | null;
}

/**
 * Contact info subset exposed on the public experience schema (SPEC-240).
 * Only `whatsapp` is surfaced publicly (for the CTA deep link).
 * Email / phone are intentionally withheld from the public tier.
 */
export interface ExperienceContactInfo {
    readonly whatsapp?: string | null;
}

/**
 * Props for the ExperienceCard component (SPEC-240).
 *
 * Produced by `toExperienceCardProps()` in `transforms.ts` and consumed by
 * the experience card component. Used on the listing page and any featured
 * experience sections.
 *
 * @example
 * ```ts
 * const card: ExperienceCardData = {
 *   id: 'abc-123',
 *   slug: 'kayak-rio-uruguay',
 *   name: 'Kayak en el Río Uruguay',
 *   type: 'KAYAK_RENTAL',
 *   summary: 'Alquiler de kayaks para recorrer el río.',
 *   featuredImage: { url: '/images/kayak.jpg', caption: 'Vista del río' },
 *   destinationId: 'dest-uuid',
 *   destinationName: 'Concepción del Uruguay',
 *   priceFrom: 150000,
 *   priceUnit: 'per_hour',
 *   isPriceOnRequest: false,
 *   averageRating: 4.8,
 *   reviewsCount: 12,
 *   isFeatured: true,
 *   openingHours: null,
 * };
 * ```
 */
export interface ExperienceCardData {
    /** UUID identifier for the experience listing. */
    readonly id: string;
    /** URL-safe slug used to build the detail page path. */
    readonly slug: string;
    /** Display name of the experience. */
    readonly name: string;
    /** Experience type enum value (e.g. `'KAYAK_RENTAL'`, `'EXCURSION'`). */
    readonly type: string;
    /** Short description shown on the card. */
    readonly summary: string;
    /**
     * Featured image with URL and optional caption.
     * Components should use `featuredImage.url` as `src` and prefer
     * `featuredImage.caption ?? name` as `alt` text for accessibility.
     */
    readonly featuredImage: { readonly url: string; readonly caption?: string };
    /** UUID of the destination where the experience is based. */
    readonly destinationId: string;
    /** Human-readable name of the destination (derived from API join). */
    readonly destinationName: string;
    /**
     * Base price in centavos (integer). Divide by 100 for display.
     * Zero when `isPriceOnRequest` is true (price stored as 0 per the spec decision).
     */
    readonly priceFrom: number;
    /** Billing unit for the price (per_day | per_hour | per_person | per_group). */
    readonly priceUnit: string;
    /**
     * When true the UI shows "Consultar precio" instead of the numeric price.
     * The stored `priceFrom` value is ignored on display.
     */
    readonly isPriceOnRequest: boolean;
    /** Average star rating (0-5). */
    readonly averageRating: number;
    /** Total number of reviews contributing to `averageRating`. */
    readonly reviewsCount: number;
    /** Whether this listing appears in featured/promoted slots. */
    readonly isFeatured: boolean;
    /** Structured opening hours by day. Null when not configured by the owner. */
    readonly openingHours: Record<string, ExperienceOpeningHoursEntry> | null;
    /** ISO 8601 creation date. Used to derive "new" badge (< 30 days). */
    readonly createdAt?: string | null;
}

/**
 * Typed data shape for the experience detail page (SPEC-240).
 * Produced by `toExperienceDetailPageProps()` in `transforms.ts`.
 *
 * Extends `ExperienceCardData` with fields only needed for the full detail view.
 */
export interface ExperienceDetailData extends ExperienceCardData {
    /** Full plain-text description of the experience. */
    readonly description: string;
    /** Optional rich-text (markdown) description (entitlement-gated). */
    readonly richDescription?: string | null;
    /** Public WhatsApp and optional social contact info. */
    readonly contactInfo: ExperienceContactInfo | null;
    /** Social network links provided by the owner. */
    readonly socialNetworks: ExperienceSocialNetworks | null;
    /** SEO metadata fields. */
    readonly seo: { readonly title: string | null; readonly description: string | null } | null;
    /** Tag slugs associated with the listing. */
    readonly tags?: readonly string[];
    /** FAQ items configured by the owner. */
    readonly faqs: readonly DetailFaq[];
    /** Public owner data from the users table JOIN. */
    readonly owner: {
        readonly id: string;
        readonly name: string | null;
        readonly image: string | null;
        readonly createdAt: string | null;
    } | null;
}
