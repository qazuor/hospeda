/**
 * Accommodation Import Orchestrator Service (SPEC-222 T-019)
 *
 * Ties the entire import pipeline together in a single stateless service.
 * The route layer validates the request, builds an {@link ImportContext} from
 * env/request params, and delegates to this service.
 *
 * **Pipeline (all steps are fault-isolated — nothing throws out):**
 * 1. Parse the URL; on failure return a degraded response immediately.
 * 2. Detect the source platform (for labelling); pick the adapter by
 *    `supports()` (the authority for routing).
 * 3. Call `adapter.extract()`; on throw treat as empty extraction.
 * 4. Map raw candidates to a typed draft with `mapRawToDraft`.
 * 5. Resolve amenity names to catalog UUIDs; on throw omit them.
 * 6. Build a destination hint from scraped locality; on throw omit it.
 * 7. Collect `mediaHints` from raw image URLs.
 * 8. Compute `partial` and assemble the final response, validated against
 *    `AccommodationImportResponseSchema`.
 *
 * **Reviews/ratings are NEVER present** — `RawExtraction` excludes them by
 * design and this service adds no rating handling (SPEC-222 hard rule).
 * **`destinationId` is NEVER set** — always undefined (SPEC-222 AC-8.2).
 *
 * @module services/accommodation-import/accommodation-import.service
 */

import { type AccommodationImportResponse, AccommodationImportResponseSchema } from '@repo/schemas';

import type { Actor, ServiceConfig } from '../../types/index.js';
import { AmenityService } from '../amenity/amenity.service.js';
import { DestinationService } from '../destination/destination.service.js';
import type { ImportContext, ImportSourceAdapter, RawExtraction } from './adapter.types.js';
import { AirbnbAdapter } from './adapters/airbnb.adapter.js';
import { BookingAdapter } from './adapters/booking.adapter.js';
import { GenericAdapter } from './adapters/generic.adapter.js';
import { GooglePlacesAdapter } from './adapters/google-places.adapter.js';
import { MercadoLibreAdapter } from './adapters/mercadolibre.adapter.js';
import { detectSource } from './detect-source.js';
import { mapRawToDraft } from './mapping.js';
import { resolveAmenities } from './resolvers/amenities.js';
import { buildDestinationHint } from './resolvers/destination.js';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Human-readable message returned when the URL string cannot be parsed.
 */
const MSG_INVALID_URL =
    'No pudimos procesar la URL proporcionada. Verificá que sea una URL válida e intentá de nuevo.';

/**
 * Human-readable message returned when no usable data could be extracted.
 */
const MSG_NOTHING_EXTRACTED =
    'No pudimos extraer información de esta URL. El sitio puede estar bloqueando el acceso o la URL no corresponde a un alojamiento.';

// ---------------------------------------------------------------------------
// Type for the orchestrator's importFromUrl input
// ---------------------------------------------------------------------------

/**
 * Input for {@link AccommodationImportService.importFromUrl}.
 *
 * The HTTP route validates `url` / `legalConfirmed` via Zod and builds
 * `context` (credentials + aiExtract + limits) from env before calling the
 * service. The service therefore assumes a pre-validated URL string and the
 * provided context.
 */
export interface ImportFromUrlInput {
    /**
     * The URL of the external accommodation listing to import.
     * Must be a string that can be parsed by `new URL()`.
     */
    readonly url: string;
    /**
     * BCP-47 locale code forwarded to the adapter and AI port.
     * Defaults to `'es'` (Argentine market) when absent.
     */
    readonly locale?: string;
    /**
     * Per-request context carrying credentials, limits, and the optional AI
     * extraction port. Built by the route layer from validated env vars.
     */
    readonly context: ImportContext;
}

// ---------------------------------------------------------------------------
// AccommodationImportService
// ---------------------------------------------------------------------------

/**
 * Stateless orchestrator service for the SPEC-222 accommodation import flow.
 *
 * Does NOT extend `BaseCrudService` — this service performs a one-shot import
 * operation rather than managing a persistent entity. It composes
 * {@link AmenityService} and {@link DestinationService} for catalogue lookups,
 * following the same constructor pattern used by other composed services in
 * this package (e.g. `AccommodationService` composing `DestinationService`).
 *
 * ### Adapter routing
 *
 * The service builds a fixed registry at construction time:
 * ```
 * [MercadoLibreAdapter, GooglePlacesAdapter, BookingAdapter, AirbnbAdapter, GenericAdapter]
 * ```
 *
 * `detectSource({ url })` identifies the *platform label* (shown in the response).
 * `adapter.supports(parsedUrl)` is the **authority for actual routing** — the
 * first adapter in the registry whose `supports()` returns `true` is used for
 * extraction. `GenericAdapter.supports()` accepts any HTTPS URL, so it is kept
 * last and acts as the universal fallback.
 *
 * These two concerns are intentionally separated: the label (detectSource) is
 * cheap string matching for human-readable output; the routing (supports) lets
 * each adapter declare its own URL-matching logic independently.
 *
 * ### Fault-isolation guarantee
 *
 * Every pipeline step is wrapped in a try/catch. The service NEVER throws —
 * any unhandled error degrades to a partial/empty response (SPEC-222 US-4).
 *
 * @example
 * ```ts
 * const service = new AccommodationImportService(ctx);
 * const response = await service.importFromUrl(
 *   { url: 'https://www.airbnb.com.ar/rooms/12345', context },
 *   actor,
 * );
 * ```
 */
export class AccommodationImportService {
    /** Lazily-constructed AmenityService used to resolve scraped amenity names. */
    private readonly amenityService: AmenityService;

    /** Lazily-constructed DestinationService used to build locality hints. */
    private readonly destinationService: DestinationService;

    /**
     * Ordered adapter registry. The orchestrator iterates this list and picks
     * the first adapter whose `supports(url)` returns `true`. `GenericAdapter`
     * must remain last — it accepts any HTTPS URL.
     */
    private readonly adapters: readonly ImportSourceAdapter[];

    /**
     * Constructs the orchestrator and eagerly initialises composed services.
     *
     * Accepts {@link ServiceConfig} (the shared constructor type used throughout
     * this package). The route layer passes `{ logger: apiLogger }`.
     *
     * @param ctx - Service configuration carrying an optional logger.
     */
    constructor(ctx: ServiceConfig) {
        this.amenityService = new AmenityService(ctx);
        this.destinationService = new DestinationService(ctx);
        this.adapters = [
            new MercadoLibreAdapter(),
            new GooglePlacesAdapter(),
            new BookingAdapter(),
            new AirbnbAdapter(),
            // GenericAdapter MUST be last — it supports() any HTTPS URL.
            new GenericAdapter()
        ];
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Imports accommodation data from an external URL.
     *
     * Orchestrates the full import pipeline: URL parsing → source detection →
     * adapter selection → extraction → mapping → amenity resolution →
     * destination hint → response assembly.
     *
     * **Never throws.** Any failure at any step degrades the response rather
     * than propagating an exception to the caller (SPEC-222 US-4).
     *
     * **Reviews/ratings** are never present in the response — they are excluded
     * at the `RawExtraction` level and this service adds no rating handling.
     *
     * **`destinationId`** is never set. The `destinationHint.candidates` list
     * is purely advisory — the host picks from it in the review UI (AC-8.2).
     *
     * @param input - URL, optional locale, and per-request ImportContext.
     * @param actor - The authenticated actor performing the import (used for
     *   catalogue service calls that require permission checks).
     * @returns An {@link AccommodationImportResponse} — always a valid object,
     *   possibly with an empty `draft` and `partial: true`.
     *
     * @example
     * ```ts
     * const response = await service.importFromUrl(
     *   {
     *     url: 'https://www.airbnb.com.ar/rooms/12345',
     *     locale: 'es',
     *     context,
     *   },
     *   actor,
     * );
     * if (response.partial) {
     *   // Prompt the host to complete missing fields.
     * }
     * ```
     */
    async importFromUrl(
        input: ImportFromUrlInput,
        actor: Actor
    ): Promise<AccommodationImportResponse> {
        // -----------------------------------------------------------------------
        // Step 1: Parse URL — degrade immediately on failure.
        // -----------------------------------------------------------------------
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(input.url);
        } catch {
            return this._buildDegradedResponse(MSG_INVALID_URL);
        }

        // -----------------------------------------------------------------------
        // Step 2: Detect source (label) and pick adapter (routing authority).
        //
        // detectSource → human-readable label for the response.
        // adapter.supports() → actual routing decision.
        // The GenericAdapter is always the last resort fallback.
        // -----------------------------------------------------------------------
        const source = detectSource({ url: input.url });
        const adapter = this._pickAdapter(parsedUrl);

        // -----------------------------------------------------------------------
        // Step 3: Extract raw candidates from the URL.
        // -----------------------------------------------------------------------
        let raw: RawExtraction;
        try {
            raw = await adapter.extract(parsedUrl, input.context);
        } catch {
            // Adapter threw — treat as empty extraction.
            raw = { sourcePlatform: source };
        }

        // -----------------------------------------------------------------------
        // Step 4: Map raw candidates to a typed draft.
        // -----------------------------------------------------------------------
        const { draft, methodsUsed } = mapRawToDraft({ raw });

        // -----------------------------------------------------------------------
        // Step 5: Resolve amenity names to catalog UUIDs.
        // -----------------------------------------------------------------------
        let resolvedAmenityIds: string[] | undefined;
        let unresolvedAmenities: string[] | undefined;
        try {
            const amenityNames = [...(raw.amenityNames ?? [])];
            if (amenityNames.length > 0) {
                const amenities = await resolveAmenities({
                    names: amenityNames,
                    amenityService: this.amenityService,
                    actor
                });
                if (amenities.amenityIds.length > 0) {
                    resolvedAmenityIds = amenities.amenityIds;
                }
                if (amenities.unresolved.length > 0) {
                    unresolvedAmenities = amenities.unresolved;
                }
            }
        } catch {
            // resolveAmenities threw — omit amenity fields, continue.
        }

        // -----------------------------------------------------------------------
        // Step 6: Build destination hint from scraped locality.
        // -----------------------------------------------------------------------
        let destinationHint: AccommodationImportResponse['destinationHint'];
        try {
            const hint = await buildDestinationHint({
                locality: raw.scrapedLocality,
                country: raw.scrapedCountry,
                destinationService: this.destinationService,
                actor
            });
            // Include the hint only when it carries a locality or has candidates.
            if (hint.scrapedLocality !== undefined || hint.candidates.length > 0) {
                destinationHint = {
                    scrapedLocality: hint.scrapedLocality,
                    candidates: [...hint.candidates]
                };
            }
        } catch {
            // buildDestinationHint threw — omit hint, continue.
        }

        // -----------------------------------------------------------------------
        // Step 7: Collect media hints from raw image URLs.
        // -----------------------------------------------------------------------
        const mediaHints =
            raw.imageUrls && raw.imageUrls.length > 0
                ? { imageUrls: [...raw.imageUrls] }
                : undefined;

        // -----------------------------------------------------------------------
        // Step 8: Compute partial and determine effective source.
        //
        // A draft is considered "complete enough" only when it has name, summary,
        // and type — the three fields the creation form requires unconditionally.
        // Note: even a fully-populated draft is still partial in practice because
        // the destination FK is never auto-set (the host must confirm it from
        // `destinationHint.candidates`). We document this in code but keep the
        // formula simple: partial = !(name && summary && type).
        // -----------------------------------------------------------------------
        const hasMandatoryFields = Boolean(draft.name && draft.summary && draft.type);
        const partial = !hasMandatoryFields;

        // When nothing useful was extracted (empty draft, no hints at all), signal
        // source: 'none' so the UI can show a targeted empty-state message.
        const isDraftEmpty = Object.keys(draft).length === 0;
        const hasAnyHints =
            resolvedAmenityIds !== undefined ||
            unresolvedAmenities !== undefined ||
            destinationHint !== undefined ||
            mediaHints !== undefined;

        const effectiveSource = isDraftEmpty && !hasAnyHints ? ('none' as const) : source;
        const message = isDraftEmpty && !hasAnyHints ? MSG_NOTHING_EXTRACTED : undefined;

        // -----------------------------------------------------------------------
        // Final guard: validate assembled object against the schema.
        // If Zod somehow rejects it (should not happen), return a safe fallback.
        // -----------------------------------------------------------------------
        const assembled: AccommodationImportResponse = {
            draft,
            source: effectiveSource,
            methodsUsed,
            partial,
            ...(message !== undefined ? { message } : {}),
            ...(destinationHint !== undefined ? { destinationHint } : {}),
            ...(resolvedAmenityIds !== undefined ? { resolvedAmenityIds } : {}),
            ...(unresolvedAmenities !== undefined ? { unresolvedAmenities } : {}),
            ...(mediaHints !== undefined ? { mediaHints } : {})
        };

        const parsed = AccommodationImportResponseSchema.safeParse(assembled);
        if (!parsed.success) {
            // This should never happen in practice — degrade gracefully.
            return this._buildDegradedResponse(MSG_NOTHING_EXTRACTED);
        }

        return parsed.data;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Selects the first adapter in the registry whose `supports()` returns
     * `true` for the parsed URL.
     *
     * Falls back to `GenericAdapter` (always the last entry) which accepts any
     * HTTPS URL. Since `GenericAdapter` is last and its `supports()` always
     * returns `true` for HTTPS, the fallback is implicit — but we guard
     * explicitly to satisfy the type system.
     *
     * @param url - The parsed URL to route.
     * @returns The selected {@link ImportSourceAdapter}.
     */
    private _pickAdapter(url: URL): ImportSourceAdapter {
        const found = this.adapters.find((a) => a.supports(url));
        // Guaranteed: GenericAdapter is last and handles any HTTPS URL.
        // The non-null assertion is safe here because GenericAdapter always
        // returns true for https: protocol URLs, and URL.parse would have
        // failed before this call for non-URLs.
        // biome-ignore lint/style/noNonNullAssertion: last adapter is GenericAdapter, always matches https
        return found ?? this.adapters[this.adapters.length - 1]!;
    }

    /**
     * Builds a minimally-safe degraded {@link AccommodationImportResponse}.
     *
     * Used when URL parsing fails or the schema validation guard rejects the
     * assembled response. Always returns `source: 'none'`, an empty draft,
     * empty `methodsUsed`, and `partial: true`.
     *
     * @param message - Human-readable explanation for the host.
     * @returns A valid degraded response.
     */
    private _buildDegradedResponse(message: string): AccommodationImportResponse {
        return {
            draft: {},
            source: 'none',
            methodsUsed: [],
            partial: true,
            message
        };
    }
}
