/**
 * Accommodation Import Adapter Types (SPEC-222)
 *
 * Defines the provider-agnostic contract that every import adapter must
 * implement, the loose pre-validation extraction bag (`RawExtraction`), and
 * the per-request context object (`ImportContext`) that carries credentials
 * and runtime limits to adapters.
 *
 * No adapter implementations, HTTP calls, or validation logic live here.
 * This file is pure interface/type definitions so the contract can be imported
 * cheaply without pulling in any runtime dependencies.
 *
 * @module services/accommodation-import/adapter-types
 */

import type { AccommodationImportDraft, FieldSource, ImportSource } from '@repo/schemas';

// ---------------------------------------------------------------------------
// RawExtraction
// ---------------------------------------------------------------------------

/**
 * A single candidate field value tagged with the extraction method that
 * produced it.
 *
 * The `value` is kept as `unknown` intentionally — type coercion and Zod
 * validation happen in the mapping step (a later task), not here.
 *
 * @example
 * ```ts
 * const candidateName: RawCandidateField = {
 *   value: 'Cabaña del Río',
 *   source: 'jsonld',
 * };
 * ```
 */
export interface RawCandidateField {
    /** The raw extracted value, unvalidated. May be any JSON-compatible value. */
    readonly value: unknown;
    /** Which extraction method produced this candidate value. */
    readonly source: FieldSource;
}

/**
 * Loose, pre-validation bag of candidate field values extracted from a URL.
 *
 * Each entry mirrors a field in {@link AccommodationImportDraft} but the
 * values here are `unknown` / untyped — they have NOT been Zod-validated yet.
 * The mapping step (a later task) is responsible for coercing each candidate
 * into the correct type and populating the final draft.
 *
 * **Hard rule**: Reviews and ratings MUST NEVER appear in this structure.
 * SPEC-222 explicitly forbids importing guest reviews or star-ratings from
 * external platforms to prevent scraped sentiment from polluting the
 * Hospeda review system.
 *
 * Advisory collections (`imageUrls`, `amenityNames`, `scrapedLocality`,
 * `scrapedCountry`) carry raw strings that the mapping and resolution steps
 * consume independently of the main draft fields.
 *
 * @example
 * ```ts
 * const raw: RawExtraction = {
 *   sourcePlatform: 'airbnb',
 *   name: { value: 'Cabaña del Río', source: 'jsonld' },
 *   summary: { value: 'A cozy cabin...', source: 'opengraph' },
 *   imageUrls: ['https://example.com/img1.jpg'],
 *   amenityNames: ['WiFi', 'Pool'],
 *   scrapedLocality: 'Concepción del Uruguay',
 *   scrapedCountry: 'Argentina',
 * };
 * ```
 */
export interface RawExtraction {
    /**
     * The platform this extraction came from.
     * Set by the adapter before returning — the orchestrator uses it to populate
     * `AccommodationImportResponse.source`.
     */
    readonly sourcePlatform: ImportSource;

    // -----------------------------------------------------------------------
    // Draft-mirroring candidate fields (all optional — extraction may yield nothing)
    // -----------------------------------------------------------------------

    /** Candidate accommodation name (mirrors `AccommodationImportDraft.name`). */
    readonly name?: RawCandidateField | undefined;

    /** Candidate short summary (mirrors `AccommodationImportDraft.summary`). */
    readonly summary?: RawCandidateField | undefined;

    /** Candidate long-form description (mirrors `AccommodationImportDraft.description`). */
    readonly description?: RawCandidateField | undefined;

    /** Candidate accommodation type/category (mirrors `AccommodationImportDraft.type`). */
    readonly type?: RawCandidateField | undefined;

    /** Candidate numeric capacity data (mirrors `AccommodationImportDraft.extraInfo`). */
    readonly extraInfo?:
        | {
              readonly capacity?: RawCandidateField | undefined;
              readonly bedrooms?: RawCandidateField | undefined;
              readonly beds?: RawCandidateField | undefined;
              readonly bathrooms?: RawCandidateField | undefined;
          }
        | undefined;

    /** Candidate location data (mirrors `AccommodationImportDraft.location`). */
    readonly location?:
        | {
              readonly coordinates?: RawCandidateField | undefined;
              readonly street?: RawCandidateField | undefined;
              readonly number?: RawCandidateField | undefined;
          }
        | undefined;

    /** Candidate pricing data (mirrors `AccommodationImportDraft.price`). */
    readonly price?:
        | {
              readonly price?: RawCandidateField | undefined;
              readonly currency?: RawCandidateField | undefined;
          }
        | undefined;

    /** Candidate contact info (mirrors `AccommodationImportDraft.contactInfo`). */
    readonly contactInfo?:
        | {
              readonly mobilePhone?: RawCandidateField | undefined;
              readonly website?: RawCandidateField | undefined;
          }
        | undefined;

    /**
     * Candidate SEO metadata (mirrors `AccommodationImportDraft.seo`).
     *
     * **A6 (SPEC-258) — intentionally NOT auto-derived on import.**
     * SEO title and description are host-authored content: they require the
     * host's own words, brand voice, and keyword intent. Auto-generating them
     * from scraped text would produce generic copy that conflicts with the
     * host's marketing strategy. Import adapters therefore leave this field
     * absent; the host fills it manually in the panel after the import.
     */
    readonly seo?:
        | {
              readonly title?: RawCandidateField | undefined;
              readonly description?: RawCandidateField | undefined;
          }
        | undefined;

    // -----------------------------------------------------------------------
    // Advisory collections (resolved separately from the main draft fields)
    // -----------------------------------------------------------------------

    /**
     * Absolute image URLs found on the page.
     * The host decides which (if any) to import into the accommodation's
     * media gallery. Passed through to `AccommodationImportResponse.mediaHints`.
     */
    readonly imageUrls?: readonly string[] | undefined;

    /**
     * Raw amenity strings found on the page (e.g. "WiFi", "Piscina", "AC").
     * The mapping step attempts to resolve each to a known amenity slug;
     * unresolvable strings flow to `AccommodationImportResponse.unresolvedAmenities`.
     */
    readonly amenityNames?: readonly string[] | undefined;

    /**
     * Raw locality string as found on the listing page (city / neighbourhood /
     * address fragment). Used by the destination resolution step to propose
     * `AccommodationImportResponse.destinationHint.candidates`.
     */
    readonly scrapedLocality?: string | undefined;

    /**
     * Country name or code as scraped from the listing page.
     * Used alongside `scrapedLocality` to narrow destination candidates.
     */
    readonly scrapedCountry?: string | undefined;
}

// ---------------------------------------------------------------------------
// ImportContext
// ---------------------------------------------------------------------------

/**
 * Per-request context passed to every adapter's `extract` method.
 *
 * The route handler builds this from validated environment variables and
 * request parameters before delegating to an adapter. Adapters are
 * intentionally read-only consumers — they must not mutate the context.
 *
 * Credential-degradation (US-11): when a credential field is absent the
 * adapter should return an empty (but valid) `RawExtraction` rather than
 * throwing — missing credentials are a configuration state, not an error
 * in the extraction contract.
 *
 * @example
 * ```ts
 * const ctx: ImportContext = {
 *   locale: 'es',
 *   timeoutMs: 15_000,
 *   maxBytes: 5_000_000,
 *   aiMaxChars: 4_000,
 *   credentials: {
 *     apifyToken: process.env.HOSPEDA_APIFY_TOKEN,
 *   },
 * };
 * ```
 */
export interface ImportContext {
    /**
     * BCP-47 locale code for AI-assisted extraction and text normalisation.
     * Defaults to `'es'` (Argentine market default) when absent.
     */
    readonly locale?: string | undefined;

    /**
     * Maximum wall-clock time (milliseconds) the adapter may spend fetching
     * and parsing the URL before it must return whatever it has.
     */
    readonly timeoutMs: number;

    /**
     * Maximum response body size (bytes) the adapter will accept from the
     * remote URL. Requests that exceed this limit should be aborted.
     */
    readonly maxBytes: number;

    /**
     * Maximum number of characters of page text that may be sent to the AI
     * provider for assisted extraction. Protects against runaway token usage.
     */
    readonly aiMaxChars: number;

    /**
     * Provider credentials injected from the environment.
     *
     * Each field is optional; adapters MUST degrade gracefully when their
     * required credential is absent (return empty extraction, not throw).
     */
    readonly credentials: {
        /** Apify API token for Airbnb and generic-scraper actors. */
        readonly apifyToken?: string | undefined;
        /** Apify actor ID for the Airbnb listing extractor. */
        readonly apifyAirbnbActor?: string | undefined;
        /** Apify actor ID for the Booking.com listing extractor (block/empty fallback). */
        readonly apifyBookingActor?: string | undefined;
        /** Google Places API key for the Google Maps adapter. */
        readonly googlePlacesApiKey?: string | undefined;
        /** MercadoLibre OAuth token for the MercadoLibre adapter. */
        readonly mercadoLibreToken?: string | undefined;
    };

    /**
     * Optional AI extraction port (SPEC-222 Strategy B).
     *
     * Dependency-injected by the route layer (`apps/api`), which owns the
     * configured `@repo/ai-core` engine, credentials, and cost ceiling. The
     * generic adapter calls this ONLY when structured extraction yields too
     * few fields, passing the page text already stripped to `ctx.aiMaxChars`.
     *
     * Keeping it as a port means `@repo/service-core` never imports the
     * apps/api AI factory — the adapter stays decoupled and unit-testable.
     *
     * When absent (AI feature disabled/unconfigured) the adapter skips
     * Strategy B and returns whatever the structured extraction produced.
     *
     * The implementation returns a {@link RawExtraction} whose candidate
     * fields are tagged `source: 'ai'`, or `null` when the model produced
     * nothing usable. It MUST NOT return review/rating data (SPEC-222).
     */
    readonly aiExtract?:
        | ((input: { text: string; locale?: string | undefined }) => Promise<RawExtraction | null>)
        | undefined;
}

// ---------------------------------------------------------------------------
// ImportSourceAdapter
// ---------------------------------------------------------------------------

/**
 * Contract every import adapter must satisfy.
 *
 * An adapter is responsible for a single `ImportSource` platform. It declares
 * which URLs it handles (`supports`) and performs the actual extraction
 * (`extract`). No adapter may import reviews or ratings (SPEC-222 hard rule).
 *
 * Adapters are stateless — all per-request state flows through
 * {@link ImportContext}. The orchestrator picks the right adapter via
 * `supports(url)` and calls `extract(url, ctx)`.
 *
 * @example
 * ```ts
 * export class AirbnbAdapter implements ImportSourceAdapter {
 *   readonly source = 'airbnb' as const;
 *
 *   supports(url: URL): boolean {
 *     return url.hostname.includes('airbnb.');
 *   }
 *
 *   async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
 *     if (!ctx.credentials.apifyToken) {
 *       return { sourcePlatform: this.source }; // graceful degradation
 *     }
 *     // ... fetch and parse
 *   }
 * }
 * ```
 */
export interface ImportSourceAdapter {
    /**
     * The import source platform this adapter handles.
     * Must match one of the `ImportSource` enum values (excluding `'none'`).
     */
    readonly source: ImportSource;

    /**
     * Returns `true` when this adapter can handle the given URL.
     *
     * The orchestrator iterates registered adapters in priority order and
     * calls `extract` on the first one that returns `true` here.
     *
     * @param url - The parsed URL of the listing to import.
     * @returns `true` if this adapter handles the URL; `false` otherwise.
     */
    supports(url: URL): boolean;

    /**
     * Extracts raw field candidates from the given URL.
     *
     * Must resolve within `ctx.timeoutMs` milliseconds and stay within
     * `ctx.maxBytes` of downloaded content. Returns an empty-but-valid
     * `RawExtraction` (only `sourcePlatform` set) when extraction yields
     * nothing — never throws for missing credentials or empty pages.
     *
     * **Hard rule**: The returned `RawExtraction` MUST NOT contain any
     * review or rating data (SPEC-222).
     *
     * @param url - The parsed URL of the listing to import.
     * @param ctx - Per-request context: locale, limits, credentials.
     * @returns A loose bag of candidate field values ready for mapping.
     */
    extract(url: URL, ctx: ImportContext): Promise<RawExtraction>;
}

// Re-export AccommodationImportDraft so consumers of this module can import
// the mapped output type without a second @repo/schemas import.
export type { AccommodationImportDraft };
