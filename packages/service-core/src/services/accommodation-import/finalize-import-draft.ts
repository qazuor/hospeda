/**
 * Post-raw-extraction pipeline (HOS-50 T-009)
 *
 * Extracted from `AccommodationImportService.importFromUrl` ("steps 4+"):
 * maps a {@link RawExtraction} to a typed draft, resolves amenity names and
 * a destination hint, collects media hints, and assembles the final
 * {@link AccommodationImportResponse}, validated against
 * `AccommodationImportResponseSchema`.
 *
 * Kept as a standalone function (not a class method) so the async status
 * route (T-011) can reuse the exact same draft-building logic once
 * `resolveImportRunStatus` (T-005/T-006) settles with a `raw` extraction,
 * instead of duplicating it.
 *
 * @module services/accommodation-import/finalize-import-draft
 */

import {
    type AccommodationImportResponse,
    AccommodationImportResponseSchema,
    type ImportFailureCode,
    type ImportSource
} from '@repo/schemas';

import type { Actor } from '../../types/index.js';
import type { AmenityService } from '../amenity/amenity.service.js';
import type { DestinationService } from '../destination/destination.service.js';
import type { RawExtraction } from './adapter.types.js';
import { mapRawToDraft } from './mapping.js';
import { resolveAmenities } from './resolvers/amenities.js';
import { buildDestinationHint } from './resolvers/destination.js';

/**
 * Context required by {@link finalizeImportDraft}.
 */
export interface FinalizeImportDraftContext {
    /**
     * The import source label (from `detectSource`, or the original source
     * on a successful R2 fallback). Used for `AccommodationImportResponse.source`
     * when the draft carries any usable data.
     */
    readonly source: ImportSource;
    /** The authenticated actor, forwarded to the amenity/destination resolvers. */
    readonly actor: Actor;
    /** Composed AmenityService instance used to resolve scraped amenity names. */
    readonly amenityService: AmenityService;
    /** Composed DestinationService instance used to build the destination hint. */
    readonly destinationService: DestinationService;
}

/**
 * Builds a minimally-safe degraded {@link AccommodationImportResponse}.
 * Mirrors `AccommodationImportService._buildDegradedResponse` — used only
 * when the final Zod schema guard rejects the assembled object (should
 * never happen in practice).
 *
 * @param failureCode - Machine-readable failure classification.
 * @returns A valid degraded response.
 */
function buildDegradedResponse(failureCode: ImportFailureCode): AccommodationImportResponse {
    return {
        draft: {},
        source: 'none',
        methodsUsed: [],
        partial: true,
        failureCode
    };
}

/**
 * Maps a {@link RawExtraction} into the final {@link AccommodationImportResponse}.
 *
 * **Pipeline:**
 * 1. Map raw candidates to a typed draft with `mapRawToDraft`.
 * 2. Resolve amenity names to catalog UUIDs; on throw, omit them.
 * 3. Build a destination hint from scraped locality; on throw, omit it.
 * 4. Collect `mediaHints` from raw image URLs.
 * 5. Compute `partial` and assemble the final response, validated against
 *    `AccommodationImportResponseSchema`.
 *
 * **Failure code precedence:**
 * 1. Propagate `raw.failureCode` when the adapter/fallback already classified it.
 * 2. When the draft is empty and no hints exist and no failure code was set →
 *    fall back to `nothing_found`.
 * 3. When the draft has any content or hints → no failure code.
 *
 * A draft is considered "complete enough" (`partial: false`) only when it has
 * `name`, `summary`, and `type` — the three fields the creation form requires
 * unconditionally.
 *
 * **`destinationId` is NEVER set** on the returned draft (SPEC-222 AC-8.2) —
 * `mapRawToDraft` never populates it, and this function adds no FK resolution.
 *
 * **Never throws** — every step degrades gracefully on error, and the final
 * Zod guard falls back to a degraded response if the assembled object is
 * somehow invalid.
 *
 * @param raw - The raw extraction to finalize (already R2-fallback-resolved
 *   by the caller, if applicable).
 * @param ctx - The import source label, actor, and composed catalogue services.
 * @returns The final {@link AccommodationImportResponse}.
 *
 * @example
 * ```ts
 * const response = await finalizeImportDraft(raw, {
 *   source: 'airbnb',
 *   actor,
 *   amenityService,
 *   destinationService,
 * });
 * ```
 */
export async function finalizeImportDraft(
    raw: RawExtraction,
    ctx: FinalizeImportDraftContext
): Promise<AccommodationImportResponse> {
    const { source, actor, amenityService, destinationService } = ctx;

    // -----------------------------------------------------------------------
    // Step 1: Map raw candidates to a typed draft.
    // -----------------------------------------------------------------------
    const { draft, methodsUsed } = mapRawToDraft({ raw });

    // -----------------------------------------------------------------------
    // Step 2: Resolve amenity names to catalog UUIDs.
    // -----------------------------------------------------------------------
    let resolvedAmenityIds: string[] | undefined;
    let unresolvedAmenities: string[] | undefined;
    try {
        const amenityNames = [...(raw.amenityNames ?? [])];
        if (amenityNames.length > 0) {
            const amenities = await resolveAmenities({
                names: amenityNames,
                amenityService,
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
    // Step 3: Build destination hint from scraped locality.
    // -----------------------------------------------------------------------
    let destinationHint: AccommodationImportResponse['destinationHint'];
    try {
        const hint = await buildDestinationHint({
            locality: raw.scrapedLocality,
            country: raw.scrapedCountry,
            destinationService,
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
    // Step 4: Collect media hints from raw image URLs.
    // -----------------------------------------------------------------------
    const mediaHints =
        raw.imageUrls && raw.imageUrls.length > 0 ? { imageUrls: [...raw.imageUrls] } : undefined;

    // -----------------------------------------------------------------------
    // Step 5: Compute partial and determine effective source + failureCode.
    // -----------------------------------------------------------------------
    const hasMandatoryFields = Boolean(draft.name && draft.summary && draft.type);
    const partial = !hasMandatoryFields;

    const isDraftEmpty = Object.keys(draft).length === 0;
    const hasAnyHints =
        resolvedAmenityIds !== undefined ||
        unresolvedAmenities !== undefined ||
        destinationHint !== undefined ||
        mediaHints !== undefined;

    // Determine the failureCode to surface on the response.
    let responseFailureCode: ImportFailureCode | undefined;
    if (raw.failureCode !== undefined) {
        // Adapter/fallback already classified the failure — propagate it.
        responseFailureCode = raw.failureCode;
    } else if (isDraftEmpty && !hasAnyHints) {
        // Source was reachable but yielded nothing recognisable as accommodation data.
        responseFailureCode = 'nothing_found';
    }
    // If there is partial data (draft not empty or hints exist) → no failureCode.

    // When nothing useful was extracted, signal source: 'none'.
    const effectiveSource = isDraftEmpty && !hasAnyHints ? ('none' as const) : source;

    // -----------------------------------------------------------------------
    // Final guard: validate assembled object against the schema.
    // If Zod somehow rejects it (should not happen), return a safe fallback.
    // -----------------------------------------------------------------------
    const assembled: AccommodationImportResponse = {
        draft,
        source: effectiveSource,
        methodsUsed,
        partial,
        ...(responseFailureCode !== undefined ? { failureCode: responseFailureCode } : {}),
        ...(destinationHint !== undefined ? { destinationHint } : {}),
        ...(resolvedAmenityIds !== undefined ? { resolvedAmenityIds } : {}),
        ...(unresolvedAmenities !== undefined ? { unresolvedAmenities } : {}),
        ...(mediaHints !== undefined ? { mediaHints } : {})
    };

    const parsed = AccommodationImportResponseSchema.safeParse(assembled);
    if (!parsed.success) {
        // This should never happen in practice — degrade gracefully.
        return buildDegradedResponse('provider_error');
    }

    return parsed.data;
}
