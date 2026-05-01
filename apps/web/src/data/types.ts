/**
 * @file types.ts
 * @description Shared TypeScript interfaces for web2 mock data and component props.
 *
 * These interfaces mirror the real API transform shapes defined in
 * `apps/web/src/lib/api/transforms.ts` (and the future web2 equivalent).
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
 * Props for the EventCard component.
 *
 * Produced by `toEventCardProps()` in `transforms.ts` and consumed
 * by `EventCard.astro`. Used in the homepage events section and
 * the full events listing page.
 *
 * @example
 * ```ts
 * const card: EventCardData = {
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
     * SPEC-095: City name derived from `eventLocation.cityDestination.name`.
     * Empty string when the API response did not carry a `cityDestination`
     * projection or when the event has no eventLocation.
     */
    readonly cityName?: string;
    /** SPEC-095: Materialized destination path for SEO breadcrumbs. */
    readonly cityPath?: string;
    /** SPEC-095: Slug of the city destination, used for `/destinos/{slug}` links. */
    readonly cityDestinationSlug?: string;
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
    readonly featuredImage: { readonly url: string; readonly caption?: string };
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
    /** Optional list of tag slugs associated with the post. */
    readonly tags?: readonly string[];
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
 * Typed data shape for the accommodation detail page.
 * Produced by `toAccommodationDetailPageProps()` in transforms.ts.
 */
export interface AccommodationDetailData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
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
         * description metadata preserved from the API response. Rendered by
         * HeroGallery and the full photo page; kept alongside `images` for
         * backward compatibility.
         */
        readonly galleryItems: readonly {
            readonly url: string;
            readonly caption?: string;
            readonly description?: string;
        }[];
        readonly videos: readonly string[];
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
