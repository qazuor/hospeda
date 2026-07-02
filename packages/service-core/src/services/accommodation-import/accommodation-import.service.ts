/**
 * Accommodation Import Orchestrator Service (SPEC-222 T-019)
 *
 * Ties the entire import pipeline together in a single stateless service.
 * The route layer validates the request, builds an {@link ImportContext} from
 * env/request params, and delegates to this service.
 *
 * **Pipeline (all steps are fault-isolated — nothing throws out):**
 * 1. Parse the URL; on failure return a degraded response immediately.
 * 1b. Short-link resolution: when the input URL's host is a known share/redirect
 *     host (e.g. `maps.app.goo.gl`, `booking.com/Share-...`, `abnb.me`), follow
 *     the redirect chain via {@link safeExternalFetch} to obtain the canonical
 *     URL. All SSRF checks (private IP, redirect cap, scheme allow-list) are
 *     applied on every hop. Falls back to the original URL on any failure.
 * 2. Detect the source platform (for labelling); pick the adapter by
 *    `supports()` (the authority for routing).
 * 3. Call `adapter.extract()`; on throw treat as empty extraction.
 * 4+. Map raw candidates to a draft, resolve amenities/destination hint/media
 *    hints, and assemble the final response, validated against
 *    `AccommodationImportResponseSchema` — delegated to
 *    {@link finalizeImportDraft} (HOS-50 T-009) so the async status route
 *    (T-011) can reuse identical draft-building logic.
 *
 * **Reviews/ratings are NEVER present** — `RawExtraction` excludes them by
 * design and this service adds no rating handling (SPEC-222 hard rule).
 * **`destinationId` is NEVER set** — always undefined (SPEC-222 AC-8.2).
 *
 * @module services/accommodation-import/accommodation-import.service
 */

import type { AccommodationImportResponse, ImportFailureCode, ImportSource } from '@repo/schemas';
import { safeExternalFetch } from '@repo/utils/safe-fetch';

import type { Actor, ServiceConfig } from '../../types/index.js';
import { AmenityService } from '../amenity/amenity.service.js';
import { DestinationService } from '../destination/destination.service.js';
import type { ImportContext, ImportSourceAdapter, RawExtraction } from './adapter.types.js';
import { supportsAsyncExtraction } from './adapter.types.js';
import { AirbnbAdapter } from './adapters/airbnb.adapter.js';
import { BookingAdapter } from './adapters/booking.adapter.js';
import { GenericAdapter } from './adapters/generic.adapter.js';
import { GooglePlacesAdapter } from './adapters/google-places.adapter.js';
import { MercadoLibreAdapter } from './adapters/mercadolibre.adapter.js';
import { detectSource } from './detect-source.js';
import { finalizeImportDraft } from './finalize-import-draft.js';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------
// NOTE (SPEC-258 C.1): The old hardcoded Spanish message strings MSG_INVALID_URL
// and MSG_NOTHING_EXTRACTED have been replaced by machine-readable `failureCode`
// values on the response. The `message` field is now reserved for non-failure
// advisory notices (e.g. AI-quota warning). Clients map the `failureCode` to a
// localized string via i18n keys under `host.importFromUrl.errors.failure.*`.

// ---------------------------------------------------------------------------
// Short-link resolution
// ---------------------------------------------------------------------------

/**
 * Hostnames that are known share / redirect short-link hosts.
 *
 * A URL on one of these hosts CANNOT be matched or parsed by any adapter
 * without first following its redirect chain to the canonical destination URL.
 * Only these hosts trigger an extra fetch; already-canonical URLs (e.g.
 * `booking.com/hotel/...`, `airbnb.com/rooms/...`) are left untouched so the
 * pipeline incurs no extra network round-trip for them.
 *
 * Hosts included:
 * - `maps.app.goo.gl` — Google Maps modern share link (mobile "Share" button)
 * - `goo.gl`           — Legacy Google short-link (also used for Maps)
 * - `g.co`             — Google short-link variant
 * - `g.page`           — Google Business Profile short-link
 * - `abnb.me`          — Airbnb mobile share link
 */
const SHORT_LINK_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co', 'g.page', 'abnb.me']);

/**
 * Returns `true` when `url` is a known short-link / redirect host that must
 * be resolved to a canonical URL before adapter selection and extraction.
 *
 * Also detects Booking.com share stubs (`/Share-...` path pattern) even though
 * `booking.com` is not itself a short-link host — the Share path redirects to
 * the canonical hotel page.
 *
 * @param url - The parsed input URL.
 * @returns `true` when a redirect-following fetch is needed.
 */
function needsShortLinkResolution(url: URL): boolean {
    const host = url.hostname.toLowerCase();

    // Known pure short-link hostnames
    if (SHORT_LINK_HOSTS.has(host)) {
        return true;
    }

    // Booking.com share stubs: booking.com/Share-XXXXX
    // Exact host match or subdomain of booking.com; ccTLD variants (booking.com.ar
    // etc.) use a bounded regex — prevents booking.com.attacker.com from matching.
    if (
        (host === 'booking.com' ||
            host.endsWith('.booking.com') ||
            /^(?:[a-z0-9-]+\.)*booking\.com\.[a-z]{2,3}$/.test(host)) &&
        url.pathname.startsWith('/Share-')
    ) {
        return true;
    }

    return false;
}

/**
 * Resolves a short-link URL to its canonical destination by following the HTTP
 * redirect chain via {@link safeExternalFetch}.
 *
 * **SSRF safety**: every hop is validated by `safeExternalFetch` —
 * private-IP checks, per-hop DNS pinning, scheme allow-list, and the redirect
 * cap (`maxRedirects`) all apply. No additional wrapping is needed.
 *
 * **Graceful degradation**: any failure (network error, SSRF policy block,
 * redirect loop, timeout) returns the original `inputUrl` unchanged so the
 * pipeline continues as-is rather than crashing.
 *
 * **Body discard (resolve-only)**: we only need the `finalUrl` after the
 * redirect chain, not the terminal page body. The previous implementation used
 * a tiny `maxBytes` cap, but the cap fires on the TERMINAL (non-redirect)
 * response — yielding `SafeFetchBlocked` and discarding `finalUrl` whenever the
 * canonical page body exceeded the cap (e.g. the large Google Maps place page).
 * That left Google `maps.app.goo.gl` short links unresolved. We now use
 * `resolveOnly: true`, which follows the redirects and returns the terminal URL
 * without ever reading its body, so a large terminal page no longer blocks
 * resolution.
 *
 * @param inputUrl - The short-link URL string to resolve.
 * @param timeoutMs - Timeout in milliseconds, forwarded from {@link ImportContext}.
 * @returns The canonical URL string (may equal `inputUrl` on any failure).
 */
async function resolveCanonicalUrl(inputUrl: string, timeoutMs: number): Promise<string> {
    try {
        const result = await safeExternalFetch({
            url: inputUrl,
            timeoutMs,
            maxRedirects: 5,
            resolveOnly: true
        });

        if (result.ok && result.finalUrl !== inputUrl) {
            return result.finalUrl;
        }

        // ok: false (SSRF block / redirect-cap / network error) or no redirect
        // happened — fall back to the original input so the pipeline continues.
        return inputUrl;
    } catch {
        // safeExternalFetch is documented to never throw, but guard defensively.
        return inputUrl;
    }
}

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
// dispatchImportFromUrl result (HOS-50 / SPEC-277 R3 T-010)
// ---------------------------------------------------------------------------

/**
 * Result of {@link AccommodationImportService.dispatchImportFromUrl} when the
 * import resolved synchronously — either because the matched adapter has no
 * async mode, or because its async mode resolved immediately (a run handle
 * was never needed, or the run could not even be started).
 */
export interface ImportSyncDispatchResult {
    readonly kind: 'sync';
    /** The final response, identical in shape to `importFromUrl`'s return value. */
    readonly response: AccommodationImportResponse;
}

/**
 * Result of {@link AccommodationImportService.dispatchImportFromUrl} when an
 * Apify run was started and the caller must poll for it (via
 * `resolveImportRunStatus` / the status route, T-006/T-011).
 */
export interface ImportAsyncDispatchResult {
    readonly kind: 'async';
    /** Apify run id returned by `startApifyRun` (SPEC-250). */
    readonly runId: string;
    /** Apify default dataset id for this run. */
    readonly datasetId: string;
    /** The import source that triggered the async path (`airbnb` or `booking`). */
    readonly source: ImportSource;
    /** ISO 8601 timestamp when the run was started. */
    readonly startedAt: string;
    /** The resolved (post-short-link) listing URL, echoed back on every poll. */
    readonly url: string;
}

/**
 * Discriminated result of {@link AccommodationImportService.dispatchImportFromUrl}.
 * The route layer (T-010) branches on `kind` to decide between a `200` and a
 * `202` HTTP response.
 */
export type ImportDispatchResult = ImportSyncDispatchResult | ImportAsyncDispatchResult;

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
        const resolved = await this._resolveEffectiveUrlAndAdapter(
            input.url,
            input.context.timeoutMs
        );
        if (!resolved.ok) {
            return this._buildDegradedResponse(resolved.failureCode);
        }

        const { adapter, source, effectiveParsedUrl } = resolved;
        const raw = await this._extractWithFallback({
            adapter,
            source,
            effectiveParsedUrl,
            context: input.context
        });

        return finalizeImportDraft(raw, {
            source,
            actor,
            amenityService: this.amenityService,
            destinationService: this.destinationService
        });
    }

    /**
     * Async-aware dispatch entry point (HOS-50 / SPEC-277 R3 T-010).
     *
     * Shares the exact URL-resolution and adapter-selection logic with
     * {@link importFromUrl} (via {@link _resolveEffectiveUrlAndAdapter}) so a
     * short-link is only ever fetched once per request. Branches on whether the
     * matched adapter implements `extractAsync` ({@link supportsAsyncExtraction}):
     *
     * - No async mode (Google Places / MercadoLibre / Generic, and Booking's
     *   own JSON-LD-first tier is handled INSIDE Booking's `extractAsync`) →
     *   behaves exactly like `importFromUrl` and returns `{ kind: 'sync' }`.
     * - Async mode returns a run handle (`runId`/`datasetId`) → the caller
     *   (the route) should respond `202` so the client polls the status route
     *   (T-011). Returns `{ kind: 'async', ... }`.
     * - Async mode resolves immediately (`{ raw }` — e.g. Booking's JSON-LD tier
     *   was already sufficient) or fails to even start (`{ failureCode }`) →
     *   finalized through the exact same `finalizeImportDraft` pipeline as the
     *   synchronous path and returned as `{ kind: 'sync' }`.
     *
     * **Never throws** — every branch degrades the same way `importFromUrl` does.
     *
     * @param input - URL, optional locale, and per-request ImportContext.
     * @param actor - The authenticated actor performing the import.
     * @returns An {@link ImportDispatchResult} the route branches on for the
     *   HTTP status code.
     */
    async dispatchImportFromUrl(
        input: ImportFromUrlInput,
        actor: Actor
    ): Promise<ImportDispatchResult> {
        const resolved = await this._resolveEffectiveUrlAndAdapter(
            input.url,
            input.context.timeoutMs
        );
        if (!resolved.ok) {
            return { kind: 'sync', response: this._buildDegradedResponse(resolved.failureCode) };
        }

        const { adapter, source, effectiveParsedUrl, effectiveUrlStr } = resolved;

        if (!supportsAsyncExtraction(adapter)) {
            const raw = await this._extractWithFallback({
                adapter,
                source,
                effectiveParsedUrl,
                context: input.context
            });
            const response = await finalizeImportDraft(raw, {
                source,
                actor,
                amenityService: this.amenityService,
                destinationService: this.destinationService
            });
            return { kind: 'sync', response };
        }

        const asyncResult = await adapter.extractAsync(effectiveParsedUrl, input.context);

        if ('raw' in asyncResult) {
            const response = await finalizeImportDraft(asyncResult.raw, {
                source,
                actor,
                amenityService: this.amenityService,
                destinationService: this.destinationService
            });
            return { kind: 'sync', response };
        }

        if ('failureCode' in asyncResult) {
            const response = await finalizeImportDraft(
                { sourcePlatform: source, failureCode: asyncResult.failureCode },
                {
                    source,
                    actor,
                    amenityService: this.amenityService,
                    destinationService: this.destinationService
                }
            );
            return { kind: 'sync', response };
        }

        return {
            kind: 'async',
            runId: asyncResult.runId,
            datasetId: asyncResult.datasetId,
            source,
            startedAt: new Date().toISOString(),
            url: effectiveUrlStr
        };
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Resolves the effective (post-short-link) URL and picks the matching
     * adapter — steps 1, 1b, and 2 shared by {@link importFromUrl} and
     * {@link dispatchImportFromUrl}. Extracted (HOS-50 T-010) so a short-link
     * is fetched at most once per request regardless of which entry point the
     * route calls.
     *
     * @param inputUrl - The raw listing URL string from the request.
     * @param timeoutMs - Fetch timeout forwarded to short-link resolution.
     * @returns The resolved URL/source/adapter, or `{ ok: false }` with the
     *   `invalid_url` failure code when the URL cannot be parsed or routed.
     */
    private async _resolveEffectiveUrlAndAdapter(
        inputUrl: string,
        timeoutMs: number
    ): Promise<
        | {
              readonly ok: true;
              readonly effectiveUrlStr: string;
              readonly effectiveParsedUrl: URL;
              readonly source: ImportSource;
              readonly adapter: ImportSourceAdapter;
          }
        | { readonly ok: false; readonly failureCode: ImportFailureCode }
    > {
        // Step 1: Parse URL — degrade immediately on failure.
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(inputUrl);
        } catch {
            return { ok: false, failureCode: 'invalid_url' };
        }

        // Step 1b: Short-link resolution (see importFromUrl's original JSDoc for
        // the full rationale — Google Maps share links, Airbnb `abnb.me`,
        // Booking `/Share-...` stubs). Graceful degradation: any failure keeps
        // the original URL.
        let effectiveUrlStr = inputUrl;
        let effectiveParsedUrl = parsedUrl;

        if (needsShortLinkResolution(parsedUrl)) {
            const canonical = await resolveCanonicalUrl(inputUrl, timeoutMs);
            if (canonical !== inputUrl) {
                try {
                    effectiveParsedUrl = new URL(canonical);
                    effectiveUrlStr = canonical;
                } catch {
                    // Canonical URL returned by safeExternalFetch is not parseable
                    // (should be impossible) — keep the original.
                }
            }
        }

        // Step 2: Detect source (label) and pick adapter (routing authority).
        const source = detectSource({ url: effectiveUrlStr });
        const adapter = this._pickAdapter(effectiveParsedUrl);

        // When source is 'none' and no adapter could match the effective URL
        // (i.e. even GenericAdapter could not pick it up — very unusual), treat
        // as invalid_url. In practice GenericAdapter accepts any http(s) URL,
        // so this branch fires only for truly unsupported schemes.
        if (source === 'none' && !this.adapters.some((a) => a.supports(effectiveParsedUrl))) {
            return { ok: false, failureCode: 'invalid_url' };
        }

        return { ok: true, effectiveUrlStr, effectiveParsedUrl, source, adapter };
    }

    /**
     * Extracts raw candidates from the URL and applies the SPEC-277 R2
     * per-source fallback chain — steps 3 and 3b shared by {@link importFromUrl}
     * and {@link dispatchImportFromUrl}'s synchronous (non-async-capable adapter)
     * branch.
     *
     * @param params - The picked adapter, source label, effective URL, and context.
     * @returns The raw extraction, R2-fallback-resolved when applicable.
     */
    private async _extractWithFallback(params: {
        readonly adapter: ImportSourceAdapter;
        readonly source: ImportSource;
        readonly effectiveParsedUrl: URL;
        readonly context: ImportContext;
    }): Promise<RawExtraction> {
        const { adapter, source, effectiveParsedUrl, context } = params;

        // Pass `effectiveParsedUrl` (the canonical URL after short-link
        // resolution) so the adapter operates on the real listing page URL
        // rather than the opaque share stub.
        let raw: RawExtraction;
        try {
            raw = await adapter.extract(effectiveParsedUrl, context);
        } catch {
            // Adapter threw unexpectedly — treat as provider_error.
            raw = { sourcePlatform: source, failureCode: 'provider_error' };
        }

        // SPEC-277 R2: when the primary actor for a slow/blocked source
        // (Airbnb / Booking) comes back `source_blocked`, attempt ONE cheap
        // GenericAdapter pass (JSON-LD / OpenGraph) against the same URL for a
        // best-effort partial draft instead of returning nothing. Cost guard: a
        // single `safeExternalFetch`, never a second actor run. Only
        // Airbnb/Booking opt in — Google/MercadoLibre/Generic do not. The
        // `sourcePlatform` is kept as the original source (NOT relabelled to
        // `generic`) so the host sees where the data came from; `partial: true`
        // then flows naturally from the missing mandatory fields (OG rarely
        // yields name+summary+type).
        if (raw.failureCode === 'source_blocked' && (source === 'airbnb' || source === 'booking')) {
            const fallback = await this._runFallbackGenericExtract(effectiveParsedUrl, context);
            // Useful = at least one of name / summary / images. Optional chaining
            // tolerates a null/undefined fallback; the `fallback &&` in the `if`
            // both guards that case and narrows the type for the spread below.
            const hasUsefulFallback = Boolean(
                fallback?.name?.value ||
                    fallback?.summary?.value ||
                    (fallback?.imageUrls && fallback.imageUrls.length > 0)
            );
            if (fallback && hasUsefulFallback) {
                // Transport-level success via the fallback: drop the failureCode
                // but keep the real per-field source/confidence from the fallback.
                raw = { ...fallback, sourcePlatform: source, failureCode: undefined };
            }
        }

        return raw;
    }

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
     * Runs the {@link GenericAdapter} (JSON-LD / OpenGraph) as a best-effort
     * fallback against a URL whose primary adapter was blocked (SPEC-277 R2).
     *
     * Reuses the GenericAdapter instance already in the registry (always the
     * last entry) rather than constructing a new one. This is a single cheap
     * `safeExternalFetch` — no Apify actor run and no token required — so it is
     * safe to attempt after a `source_blocked` without doubling extraction cost.
     *
     * Never throws: any error from the GenericAdapter degrades to `null`, which
     * the caller treats as "fallback yielded nothing, keep the original failure".
     *
     * @param url - The canonical listing URL (after short-link resolution).
     * @param context - The import context (locale, timeouts, credentials).
     * @returns The fallback {@link RawExtraction}, or `null` on any failure.
     */
    private async _runFallbackGenericExtract(
        url: URL,
        context: ImportContext
    ): Promise<RawExtraction | null> {
        // GenericAdapter is always the last entry in the registry.
        const generic = this.adapters[this.adapters.length - 1];
        if (generic === undefined) {
            return null;
        }
        try {
            return await generic.extract(url, context);
        } catch {
            return null;
        }
    }

    /**
     * Builds a minimally-safe degraded {@link AccommodationImportResponse}.
     *
     * Used when URL parsing fails, the URL is unsupported, the adapter throws
     * unexpectedly, or the final Zod schema guard rejects the assembled object.
     * Always returns `source: 'none'`, an empty draft, empty `methodsUsed`,
     * `partial: true`, and the provided `failureCode`.
     *
     * The `message` field is intentionally left undefined for machine-classified
     * failures — clients map `failureCode` to a localized string via i18n.
     *
     * @param failureCode - Machine-readable failure classification.
     * @returns A valid degraded response.
     */
    private _buildDegradedResponse(failureCode: ImportFailureCode): AccommodationImportResponse {
        return {
            draft: {},
            source: 'none',
            methodsUsed: [],
            partial: true,
            failureCode
        };
    }
}
