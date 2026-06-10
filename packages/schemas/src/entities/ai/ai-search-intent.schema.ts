import { z } from 'zod';
import { AccommodationTypeEnumSchema } from '../../enums/accommodation-type.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/currency.schema.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';

/**
 * AI natural-language search intent schemas (SPEC-199).
 *
 * Models the input contract and structured entity output for the NL search
 * feature exposed by `POST /api/v1/protected/ai/search-intent`. The route
 * uses `AiService.generateObject` with `SearchIntentEntitiesSchema` as the
 * typed output schema — NOT `extractIntent` (see §5.1 and §5.5 for rationale).
 *
 * **Design rationale — two schemas, not one**:
 * - `AiSearchIntentRequestSchema`: validates the HTTP request body. Strict to
 *   reject unknown keys at the boundary.
 * - `SearchIntentEntitiesSchema`: validates the structured entity output from
 *   the AI model. NOT strict — the model may return extra keys that are silently
 *   dropped by the mapper (see §5.3). Only populated slots are included.
 *
 * **Locale reuse**: `LanguageEnumSchema` from
 * `src/entities/user/user.settings.schema.ts` is the platform-wide locale
 * discriminator (`'es' | 'en' | 'pt'`). Reused here as the single source
 * of truth, never re-declared.
 *
 * **T-001 scope**: `AiSearchIntentRequestSchema` + `SearchIntentEntitiesSchema`.
 * `SearchIntentSchema`, `SearchIntentOutputSchema`, and
 * `AiSearchIntentResponseDataSchema` are added in T-002.
 */

// ─── Request ──────────────────────────────────────────────────────────────────

/**
 * Request body for `POST /api/v1/protected/ai/search-intent`.
 *
 * - `query`: the raw natural-language string from the user.
 *   Minimum 1 character; maximum 500 characters (Q6 decision).
 *   Clients SHOULD enforce the 500-char cap in the UI (character counter
 *   encouraged) and MAY show a 401/login prompt before sending.
 * - `locale`: optional locale hint for the AI slot extraction.
 *   When absent, the route defaults to `'es'` (Argentine market default).
 *   Providing a locale produces better amenity matching and feature extraction
 *   from locale-specific allowlists (see §5.4).
 *
 * `.strict()` rejects unknown keys so the route boundary fails fast on typos
 * or stray client fields.
 */
export const AiSearchIntentRequestSchema = z
    .object({
        /**
         * Raw natural-language accommodation search query from the user.
         *
         * Examples: "cabaña cerca del río para 4 personas con pileta, menos de $200 la noche"
         *           "cabin near the river for 4 people with a pool, under $200 per night"
         */
        query: z.string().min(1).max(500),
        /**
         * Optional locale hint for slot extraction.
         * Helps the model and amenity allowlist produce locale-aware output.
         * When absent the route handler defaults to `'es'`.
         */
        locale: LanguageEnumSchema.optional()
    })
    .strict();

/** Inferred TypeScript type for {@link AiSearchIntentRequestSchema}. */
export type AiSearchIntentRequest = z.infer<typeof AiSearchIntentRequestSchema>;

// ─── Entities (typed search slots) ───────────────────────────────────────────

/**
 * Typed entity slots that the AI model is asked to extract from a
 * natural-language query.
 *
 * All slots are optional — the model only populates slots it can confidently
 * infer from the user query. The mapping layer (`mapIntentToSearchParams`,
 * §5.3) drops any slot not in its mapping table even if the model emits extra
 * keys, so the output is always safe to forward to `AccommodationSearchHttpSchema`.
 *
 * **Key design decisions**:
 * - `locationType` is an internal hint for the mapper (determines which
 *   location strategy wins). Priority: `destinationId > city > geo`.
 *   It is NEVER forwarded as a query param.
 * - `amenitySlugs` contains matched amenity slugs from the locale allowlist
 *   (§5.4). The route resolves these slugs to UUIDs server-side via a single
 *   DB lookup before passing them to the mapper.
 * - `featureSlugs` contains matched feature slugs from the FEATURE allowlist
 *   (§5.4). Environment/atmosphere/aptitude/style concepts only — physical
 *   services (pets/wifi/parking/pool) stay in boolean shortcuts and
 *   `amenitySlugs` (anti-overlap rule, §5.4).
 * - `checkIn` / `checkOut` are coerced dates — the model may return ISO
 *   strings (YYYY-MM-DD) which `z.coerce.date()` handles transparently.
 *
 * NOT `.strict()`: the model may emit extra keys (e.g. confidence-related
 * internal fields). Unknown keys are silently stripped by the mapper. This
 * is intentional — do not add `.strict()` here.
 */
export const SearchIntentEntitiesSchema = z.object({
    // ── Location ─────────────────────────────────────────────────────────────
    /**
     * Location strategy hint for the mapper.
     * Determines which location fields take priority in `mapIntentToSearchParams`.
     * Priority rule: `destinationId > city > geo` (see §5.3).
     * Never emitted as a URL query param.
     */
    locationType: z.enum(['city', 'geo', 'destinationId']).optional(),

    /** City name when the user specifies a city (maps to `q` keyword param as fallback). */
    city: z.string().max(100).optional(),

    /** Known destination UUID when the user refers to a specific destination. */
    destinationId: z.string().uuid().optional(),

    /** Geographic latitude in degrees (-90 to 90). Only meaningful with `longitude`. */
    latitude: z.number().min(-90).max(90).optional(),

    /** Geographic longitude in degrees (-180 to 180). Only meaningful with `latitude`. */
    longitude: z.number().min(-180).max(180).optional(),

    /** Search radius in km (max 500). Only applied when `latitude` + `longitude` present. */
    radius: z.number().positive().max(500).optional(),

    // ── Accommodation type ────────────────────────────────────────────────────
    /**
     * Type of accommodation requested (maps to `type` param).
     * One of: APARTMENT, HOUSE, COUNTRY_HOUSE, CABIN, HOTEL, HOSTEL, CAMPING,
     * ROOM, MOTEL, RESORT.
     */
    accommodationType: AccommodationTypeEnumSchema.optional(),

    // ── Guest capacity ────────────────────────────────────────────────────────
    /** Minimum number of guests (1–50). */
    minGuests: z.number().int().min(1).max(50).optional(),

    /** Maximum number of guests (1–50). */
    maxGuests: z.number().int().min(1).max(50).optional(),

    // ── Bedroom count ─────────────────────────────────────────────────────────
    /** Minimum number of bedrooms (0–50). */
    minBedrooms: z.number().int().min(0).max(50).optional(),

    /** Maximum number of bedrooms (0–50). */
    maxBedrooms: z.number().int().min(0).max(50).optional(),

    // ── Bathroom count ────────────────────────────────────────────────────────
    /** Minimum number of bathrooms (0–50). */
    minBathrooms: z.number().int().min(0).max(50).optional(),

    /** Maximum number of bathrooms (0–50). */
    maxBathrooms: z.number().int().min(0).max(50).optional(),

    // ── Price ─────────────────────────────────────────────────────────────────
    /** Minimum price per night (non-negative). */
    minPrice: z.number().min(0).optional(),

    /** Maximum price per night (non-negative). */
    maxPrice: z.number().min(0).optional(),

    /** Currency for price range. Only applied when `minPrice` or `maxPrice` is set. */
    currency: PriceCurrencyEnumSchema.optional(),

    // ── Rating ────────────────────────────────────────────────────────────────
    /** Minimum average rating (0–5). */
    minRating: z.number().min(0).max(5).optional(),

    /** Maximum average rating (0–5). */
    maxRating: z.number().min(0).max(5).optional(),

    // ── Boolean amenity shortcuts ─────────────────────────────────────────────
    /**
     * Maps directly to the `hasPool` boolean shortcut in
     * `AccommodationSearchHttpSchema`. Serialized as `'true'` string by the mapper.
     */
    hasPool: z.boolean().optional(),

    /**
     * Maps directly to the `hasWifi` boolean shortcut.
     * Serialized as `'true'` string by the mapper.
     */
    hasWifi: z.boolean().optional(),

    /**
     * Maps directly to the `allowsPets` boolean shortcut.
     * Serialized as `'true'` string by the mapper.
     */
    allowsPets: z.boolean().optional(),

    /**
     * Maps directly to the `hasParking` boolean shortcut.
     * Serialized as `'true'` string by the mapper.
     */
    hasParking: z.boolean().optional(),

    // ── Slug arrays (resolved server-side to UUIDs) ───────────────────────────
    /**
     * Amenity slugs matched from the locale-specific `AMENITY_ALLOWLIST` (§5.4).
     * The route resolves these to UUIDs via a DB lookup before passing to the mapper.
     * Empty array is treated as absent (no amenity filter applied).
     */
    amenitySlugs: z.array(z.string()).optional(),

    /**
     * Feature slugs matched from the locale-specific `FEATURE_ALLOWLIST` (§5.4).
     * Environment/atmosphere/aptitude/style concepts only — see anti-overlap rule.
     * The route resolves these to UUIDs via a DB lookup before passing to the mapper.
     * Empty array is treated as absent (no feature filter applied).
     */
    featureSlugs: z.array(z.string()).optional(),

    // ── Availability dates ────────────────────────────────────────────────────
    /**
     * Check-in date. The model may return ISO date strings (YYYY-MM-DD);
     * `z.coerce.date()` converts them transparently.
     */
    checkIn: z.coerce.date().optional(),

    /**
     * Check-out date. If `checkOut <= checkIn`, the mapper drops both dates.
     */
    checkOut: z.coerce.date().optional()
});

/** Inferred TypeScript type for {@link SearchIntentEntitiesSchema}. */
export type SearchIntentEntities = z.infer<typeof SearchIntentEntitiesSchema>;
