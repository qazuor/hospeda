/**
 * Shared types for the web API client.
 * Maps to the standard response shapes from @repo/schemas.
 */

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
}

/** Standard paginated response from list endpoints */
export interface PaginatedResponse<T> {
    readonly items: readonly T[];
    readonly pagination: PaginationMeta;
}

/** Standard API success response wrapper */
export interface ApiSuccessResponse<T> {
    readonly success: true;
    readonly data: T;
    readonly metadata?: {
        readonly timestamp: string;
        readonly requestId?: string;
        readonly version?: string;
    };
}

/** Standard API error response */
export interface ApiErrorResponse {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
    readonly metadata?: {
        readonly timestamp: string;
        readonly requestId?: string;
    };
}

/** API client error with status and structured info */
export interface ApiError {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly details?: unknown;
}

/** Result type for API calls: either success data or error */
export type ApiResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: ApiError };

/** Common query parameters for list endpoints */
export interface ListParams {
    readonly page?: number;
    readonly pageSize?: number;
    readonly q?: string;
    readonly sort?: string;
    readonly order?: 'asc' | 'desc';
    readonly [key: string]: string | number | boolean | undefined;
}

/**
 * Host dashboard data for the HostDashboard React island.
 * Transformed from the API response by `transformHostDashboard`.
 */
export interface HostDashboardData {
    readonly propertySummary: {
        readonly total: number;
        readonly published: number;
        readonly draft: number;
    };
    readonly planInfo: {
        readonly name: string;
        readonly status: string;
        readonly isTrial: boolean;
    } | null;
    readonly unreadCount: number;
    readonly quickActions: ReadonlyArray<{
        readonly label: string;
        readonly href: string;
        readonly icon: string;
    }>;
}

// ---------------------------------------------------------------------------
// Host Analytics Types (SPEC-207)
// ---------------------------------------------------------------------------

/** A single accommodation's view counts over the selected window */
export interface AccommodationViewsItem {
    readonly accommodationId: string;
    readonly name: string;
    readonly total: number;
    readonly unique: number;
}

/** Accommodation views data (per-property, ranked) for the ViewsWidget */
export interface AccommodationViewsData {
    readonly window: '7d' | '30d';
    readonly items: readonly AccommodationViewsItem[];
}

/** A single data point in the daily view-count series (SPEC-207) */
export interface HostViewDailySeriesPoint {
    /** Calendar date in 'YYYY-MM-DD' format */
    readonly date: string;
    /** Deduplicated total visits across all owned accommodations for this day */
    readonly total: number;
}

/** Daily view-count series for the host (gap-filled, oldest → newest) */
export interface HostViewDailySeriesData {
    /** Rolling window echoed from the request: '7d' or '30d' */
    readonly window: '7d' | '30d';
    /** One entry per calendar day — exactly 7 or 30 items */
    readonly items: readonly HostViewDailySeriesPoint[];
}

/** A single accommodation's bookmark count for the FavoritesWidget */
export interface FavoritesBreakdownItem {
    readonly accommodationId: string;
    /** Display name (resolved from id→name map); falls back to slug when name is unknown */
    readonly name: string;
    readonly bookmarkCount: number;
}

/** Favorites breakdown per accommodation (ranked, desc by bookmarkCount) */
export interface FavoritesBreakdownData {
    readonly items: readonly FavoritesBreakdownItem[];
}

/** Response rate KPI data */
export interface ResponseRateData {
    readonly responseRatePct: number;
    readonly avgResponseTimeMinutes: number | null;
}

/** Single month's inquiry count */
export interface InquiryTrendMonth {
    readonly month: string;
    readonly count: number;
}

/** Monthly inquiry trend data for the InquiryTrendWidget */
export interface InquiryTrendData {
    readonly months: readonly InquiryTrendMonth[];
}

/** Market comparison item per accommodation */
export interface MarketComparisonItem {
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly accommodationType: string;
    readonly destinationName: string | null;
    readonly yourRating: number | null;
    readonly yourReviews: number;
    readonly destinationAvgRating: number | null;
    readonly yourPrice: number | null;
    readonly destinationAvgPrice: number | null;
}

/** Market comparison data for the MarketComparisonWidget */
export interface MarketComparisonData {
    readonly items: readonly MarketComparisonItem[];
}

// ---------------------------------------------------------------------------
// Accommodation Editor Types (SPEC-208)
// ---------------------------------------------------------------------------

/**
 * Editable accommodation data for the web editor form.
 *
 * Includes all fields the host can edit via the protected PATCH endpoint.
 * The PATCH schema (`AccommodationUpdateHttpSchema`) is a `.partial()` of the
 * create schema, so every field is optional in the payload.
 *
 * NOTE: `summary` is in the domain schema but NOT in the HTTP PATCH schema.
 * The SSR page reads it from the GET response (full domain object); the form
 * displays it but the PATCH cannot persist it yet. This will be resolved when
 * the HTTP schema is extended (Phase B). For now, the field is editable in
 * the UI but excluded from the PATCH payload.
 */
export interface AccommodationEditData {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly type: string;
    readonly destinationId: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly maxGuests: number | null;
    readonly bedrooms: number | null;
    readonly bathrooms: number | null;
    readonly beds: number | null;
    readonly basePrice: number | null;
    readonly currency: string | null;
    readonly isAvailable: boolean;
    readonly isFeatured: boolean;
    readonly amenityIds: readonly string[];
    readonly featureIds: readonly string[];
    // Phase B: contact info (flat HTTP fields mapped to ContactInfoSchema)
    readonly phone: string;
    readonly email: string;
    readonly website: string;
    // Phase B: social networks (flat HTTP fields mapped to SocialNetworkSchema)
    readonly facebookUrl: string;
    readonly instagramUrl: string;
    readonly twitterUrl: string;
    readonly linkedinUrl: string;
    readonly tiktokUrl: string;
    readonly youtubeUrl: string;
}

/**
 * Image stored in an accommodation's media field.
 *
 * Shared between the photo section component and the API transform layer.
 * Only `url` is required — publicId/width/height come from Cloudinary upload
 * responses and are preserved for display/dedup purposes.
 */
export interface MediaImage {
    readonly url: string;
    readonly publicId: string;
    readonly width: number;
    readonly height: number;
}

/**
 * A media row returned by the relational accommodation_media endpoints.
 *
 * Extends `MediaImage` with the DB `id` (UUID) required to call the
 * per-operation granular endpoints (remove, set-featured). The `isFeatured`
 * flag indicates whether this row is the designated featured (portada) image.
 *
 * SPEC-204: this replaces the old JSONB-embedded `MediaImage` shape for all
 * photo-editor operations that need to persist to the DB.
 */
export interface AccommodationMediaItem {
    /** Database UUID — required for removeMedia / setFeaturedMedia calls. */
    readonly id: string;
    readonly url: string;
    readonly publicId: string;
    readonly caption?: string;
    readonly alt?: string;
    readonly width?: number;
    readonly height?: number;
    readonly isFeatured: boolean;
}

/**
 * Amenity item for the editor's multi-checkbox group.
 * Fetched from the public amenities endpoint.
 */
export interface AmenityData {
    readonly id: string;
    readonly name: string;
    readonly category: string | null;
}

/**
 * Destination item for the editor's destination select.
 * Fetched from the public destinations endpoint.
 */
export interface DestinationData {
    readonly id: string;
    readonly name: string;
    readonly path: string;
}

// ---------------------------------------------------------------------------
// Accommodation Translation Types (SPEC-212)
// ---------------------------------------------------------------------------

/**
 * Per-field i18n values for the accommodation translatable fields.
 * Each field holds the three supported locale values.
 * `null` means the locale has no content stored for that field.
 */
export interface I18nFieldValues {
    readonly es: string | null;
    readonly en: string | null;
    readonly pt: string | null;
}

/**
 * Translation data for the host-facing TranslationPanel.
 *
 * Carries the raw i18n content for each translatable field so the panel can
 * determine which locales already have content and which are missing without
 * touching or polluting `AccommodationEditData` (which drives the PATCH diff).
 *
 * @see transformAccommodationTranslations
 */
export interface AccommodationTranslationData {
    readonly name: I18nFieldValues;
    readonly summary: I18nFieldValues;
    readonly description: I18nFieldValues;
    readonly richDescription: I18nFieldValues;
}

// ---------------------------------------------------------------------------
// Owner Promotions Types (SPEC-205)
// ---------------------------------------------------------------------------

/** Discount type for an owner promotion */
export type OwnerPromotionDiscountType = 'percentage' | 'fixed' | 'free_night';

/** Lifecycle state for an owner promotion */
export type OwnerPromotionLifecycleState = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | string;

/**
 * Owner promotion item returned by the protected owner-promotions endpoint.
 * Dates are kept as ISO strings (consistent with how transforms.ts handles
 * date coercion — the raw API returns ISO strings, and web components work
 * with string representations).
 */
export interface OwnerPromotionData {
    readonly id: string;
    readonly slug: string;
    readonly ownerId: string;
    readonly accommodationId: string | null;
    readonly title: string;
    readonly description: string | null;
    readonly discountType: OwnerPromotionDiscountType;
    readonly discountValue: number;
    readonly minNights: number | null;
    readonly validFrom: string;
    readonly validUntil: string | null;
    readonly maxRedemptions: number | null;
    readonly currentRedemptions: number;
    readonly lifecycleState: OwnerPromotionLifecycleState;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/**
 * Input for creating an owner promotion.
 * Omits server-managed fields (id, currentRedemptions, audit, lifecycleState).
 * slug is optional — the server generates one if not provided.
 */
export interface OwnerPromotionCreateInput {
    readonly slug?: string;
    readonly accommodationId?: string | null;
    readonly title: string;
    readonly description?: string | null;
    readonly discountType: OwnerPromotionDiscountType;
    readonly discountValue: number;
    readonly minNights?: number | null;
    readonly validFrom: string;
    readonly validUntil?: string | null;
    readonly maxRedemptions?: number | null;
}

/**
 * Input for updating an owner promotion.
 * All fields are optional (partial update via PUT replaces provided fields).
 */
export interface OwnerPromotionUpdateInput {
    readonly slug?: string;
    readonly accommodationId?: string | null;
    readonly title?: string;
    readonly description?: string | null;
    readonly discountType?: OwnerPromotionDiscountType;
    readonly discountValue?: number;
    readonly minNights?: number | null;
    readonly validFrom?: string;
    readonly validUntil?: string | null;
    readonly maxRedemptions?: number | null;
}
