import { z } from 'zod';
import { AccommodationTypeEnumSchema } from '../../enums/accommodation-type.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/currency.schema.js';
import { LanguageEnumSchema } from '../user/user.settings.schema.js';
import { AiIntentSchema } from './ai-intent.schema.js';

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
 * **T-002 scope**: `SearchIntentSchema`, `SearchIntentOutputSchema`, and
 * `AiSearchIntentResponseDataSchema` (added in T-002).
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
     * Check-in date as an ISO date string (YYYY-MM-DD).
     *
     * MUST be a string, NOT `z.coerce.date()`: this schema is serialized to JSON
     * Schema for `generateObject` structured output, and `z.date()` has no JSON
     * Schema representation ("Date cannot be represented in JSON Schema").
     *
     * **No `.regex()` constraint here**: when `generateObject` converts this Zod
     * schema to JSON Schema, a `pattern` field is emitted for each `.regex()`.
     * Ollama's llama.cpp structured-output grammar compiler CRASHES on `pattern`
     * constraints ("model runner has unexpectedly stopped", ~265 ms, pre-inference).
     * UUID `format`, enums, numeric min/max, and arrays all compile fine — only
     * the regex `pattern` is fatal. The regex was therefore removed from this
     * model-facing schema. Date-format validation is enforced downstream:
     * the route's step-4 `safeParse` + the mapper normalise and drop malformed
     * dates (e.g. "next weekend", "2026-13-45") rather than forwarding garbage
     * to the search page. The mapper also compares dates lexicographically
     * (ISO date strings sort chronologically).
     */
    checkIn: z.string().optional(),

    /**
     * Check-out date as an ISO date string (YYYY-MM-DD).
     * If `checkOut <= checkIn`, the mapper drops both dates.
     *
     * No `.regex()` constraint — see `checkIn` JSDoc for the rationale (regex
     * `pattern` in JSON Schema crashes Ollama's grammar compiler).
     * Format validation is enforced downstream in the route and mapper.
     */
    checkOut: z.string().optional()
});

/** Inferred TypeScript type for {@link SearchIntentEntitiesSchema}. */
export type SearchIntentEntities = z.infer<typeof SearchIntentEntitiesSchema>;

// ─── SearchIntent (AiIntentSchema child extension) ────────────────────────────

/**
 * Child-spec extension of {@link AiIntentSchema} for natural-language
 * accommodation search (SPEC-199).
 *
 * Narrows the generic `kind: string` to the literal `'search'` discriminant
 * and replaces the open `entities: Record<string, unknown>` with the fully
 * typed {@link SearchIntentEntitiesSchema}. This gives exhaustive
 * switch-case guarantees in callers that dispatch on `intent.kind` without
 * coupling the base foundation schema to any one domain.
 *
 * **Usage**: validate the raw `AiIntent` returned by `extractIntent` against
 * this schema when the caller knows the intent is a search-domain object.
 *
 * ```ts
 * const intent = SearchIntentSchema.safeParse(rawIntent);
 * if (intent.success && intent.data.kind === 'search') {
 *   // intent.data.entities is fully typed as SearchIntentEntities
 * }
 * ```
 *
 * NOT `.strict()` — the mapper silently drops unrecognized fields, so
 * locking the schema here would reject valid model output containing extra
 * confidence-related internal fields.
 */
export const SearchIntentSchema = AiIntentSchema.extend({
    /**
     * Discriminant literal narrowed from `z.string()` to `z.literal('search')`.
     * Identifies this intent as a search-domain object.
     */
    kind: z.literal('search'),
    /**
     * Typed entity slots extracted from the user's NL query.
     * Replaces the open `Record<string, unknown>` from the base schema.
     */
    entities: SearchIntentEntitiesSchema
});

/** Inferred TypeScript type for {@link SearchIntentSchema}. */
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

// ─── SearchIntentOutput (generateObject output schema) ────────────────────────

/**
 * Output schema passed to `aiService.generateObject` as the `outputSchema`
 * argument (§5.5).
 *
 * The AI model is asked to produce a JSON object with:
 * - `confidence`: the model's self-assessed extraction confidence in [0, 1].
 *   Defaults to `0` when absent (safety: missing confidence → forced fallback).
 * - `entities`: the typed slot values it extracted from the user's query,
 *   validated against {@link SearchIntentEntitiesSchema}.
 *
 * **Why a wrapper, not just `SearchIntentEntitiesSchema` directly?**
 * `generateObject` cannot return a top-level array or a schema with defaults
 * at the root level without a wrapping object. More importantly, the model's
 * self-assessed confidence must be structurally coupled to its entity output
 * so both travel together as a single atomic response — preventing any
 * accidental mismatch between a confidence returned separately and the entities
 * it described. See §5.1 and §5.5 for the design rationale.
 *
 * NOT `.strict()` — the model may emit extra keys (e.g., internal metadata).
 * Unknown keys are silently stripped by the mapper (§5.3).
 */
export const SearchIntentOutputSchema = z.object({
    /**
     * Model's self-assessed confidence in the extraction, in [0, 1].
     *
     * `1.0` = fully certain all slots are correct.
     * `0.0` = no useful slots extracted.
     *
     * Defaults to `0` when absent — ensures low-confidence fallback triggers
     * even when the model omits this field entirely (defensive default).
     * The route handler sets `fallbackToKeyword: true` when `confidence < 0.5`
     * (Q5 decision).
     */
    confidence: z.number().min(0).max(1).default(0),
    /**
     * Extracted slot values from the user's NL query.
     * Validated against {@link SearchIntentEntitiesSchema} — only known slots
     * are retained; unknown model keys are silently dropped.
     */
    entities: SearchIntentEntitiesSchema
});

/** Inferred TypeScript type for {@link SearchIntentOutputSchema}. */
export type SearchIntentOutput = z.infer<typeof SearchIntentOutputSchema>;

// ─── AiSearchIntentResponseData (HTTP response envelope) ─────────────────────

/**
 * Data envelope returned by `POST /api/v1/protected/ai/search-intent` (§5.1).
 *
 * Wrapped by the standard `{ success: true, data: ... }` response structure
 * produced by `ResponseFactory`. This schema defines only the `data` payload.
 *
 * Fields:
 * - `intent`: the raw `AiIntent` envelope (generic base — not narrowed to
 *   `SearchIntent` here so that callers are not forced to re-validate). Contains
 *   `kind`, `confidence`, `entities`, and `rawQuery`.
 * - `mappedParams`: the URL-ready query parameters produced by
 *   `mapIntentToSearchParams` (§5.3). Values are strings or string arrays
 *   ready to be passed directly to `URLSearchParams`. Typed as
 *   `Record<string, unknown>` to remain compatible with future mapper
 *   extensions without a schema change.
 * - `confidence`: the model's extraction confidence, echoed from
 *   `intent.confidence` for caller convenience (avoids deep traversal).
 * - `fallbackToKeyword`: `true` when `confidence < 0.5` (Q5 decision).
 *   When `true`, the frontend SHOULD pass `rawQuery` as the keyword `q`
 *   parameter for the search instead of (or in addition to) the mapped params.
 *
 * ```ts
 * // Client usage:
 * if (data.fallbackToKeyword) {
 *   params.set('q', rawQuery);
 * } else {
 *   for (const [k, v] of Object.entries(data.mappedParams)) { ... }
 * }
 * ```
 */
export const AiSearchIntentResponseDataSchema = z.object({
    /**
     * Raw `AiIntent` envelope from the model.
     *
     * Contains `kind: 'search'`, `confidence`, `entities` (validated slots),
     * and `rawQuery` (the original user input, useful for fallback).
     * The frontend should read `rawQuery` when `fallbackToKeyword` is `true`.
     */
    intent: AiIntentSchema,
    /**
     * URL-ready mapped search parameters, serialized for direct use with
     * `URLSearchParams`. Boolean flags are already serialized as the string
     * `'true'`. Dates are ISO date strings (YYYY-MM-DD). Empty when no slots
     * could be extracted or confidence is below threshold.
     *
     * `Record<string, unknown>` is intentionally open — the mapper contract
     * (§5.3) ensures only valid `AccommodationSearchHttpSchema` keys are written.
     */
    mappedParams: z.record(z.string(), z.unknown()),
    /**
     * Model's extraction confidence in [0, 1], echoed from `intent.confidence`.
     * Provided at the top level for convenience — avoids `data.intent.confidence`
     * traversal in common UI logic.
     */
    confidence: z.number().min(0).max(1),
    /**
     * `true` when `confidence < 0.5` (Q5 decision).
     *
     * When `true`, the frontend SHOULD pass `intent.rawQuery` as the keyword
     * `q` parameter and surface a soft message to the user ("We couldn't fully
     * understand your query — showing results for: <rawQuery>").
     */
    fallbackToKeyword: z.boolean()
});

/** Inferred TypeScript type for {@link AiSearchIntentResponseDataSchema}. */
export type AiSearchIntentResponseData = z.infer<typeof AiSearchIntentResponseDataSchema>;
