/**
 * @file social-public-data.service.ts
 *
 * Read-only public-data aggregation service for social-draft enrichment.
 *
 * Consumed by the Custom GPT (via the route added in HOS-66 T-023) to look
 * up existing public accommodations and destinations while drafting a social
 * post — e.g. to link a specific accommodation or reference a destination by
 * name/slug instead of hallucinating one.
 *
 * Scope is deliberately tight (R-1): this is NOT a general-purpose public API
 * aggregator. It only ever reads:
 *  - accommodations with `visibility = PUBLIC` and `lifecycleState = ACTIVE`
 *  - destinations with `visibility = PUBLIC` and `lifecycleState = ACTIVE`
 *
 * Extending it to another entity type is a conscious, reviewed change: add a
 * variant to `SocialPublicDataEntityTypeEnumSchema` (`@repo/schemas`), widen
 * this service, and update its scoping tests — never do it speculatively.
 *
 * This service has NO actor/permission surface. Authorization for the Custom
 * GPT happens at the route layer (the inbound `x-hospeda-ai-key` API key,
 * mirroring `apps/api/src/routes/ai/social/catalog.ts`) — by the time this
 * service runs, the caller is already authenticated and read-only access to
 * PUBLIC/ACTIVE entities carries no additional blast radius.
 *
 * @module services/social/social-public-data.service
 * @see HOS-66 T-022 (G-10)
 */

import type {
    AccommodationModel as AccommodationModelType,
    DestinationModel as DestinationModelType
} from '@repo/db';
import {
    AccommodationModel,
    DestinationModel,
    accommodations,
    destinations,
    safeIlike
} from '@repo/db';
import {
    LifecycleStatusEnum,
    ServiceErrorCode,
    type SocialPublicDataEntityType,
    type SocialPublicDataItem,
    type SocialPublicDataResponseData,
    VisibilityEnum
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { ServiceError } from '../../types';
import type { ServiceOutput } from '../../types';
import { serviceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default `limit` applied when the caller omits it — total items across both entity types. */
const DEFAULT_LIMIT = 20;

/** Hard ceiling on `limit`, regardless of caller input — prevents an unbounded pull. */
const MAX_LIMIT = 50;

// ---------------------------------------------------------------------------
// Input / row types
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialPublicDataService.getPublicData}.
 */
export interface GetPublicDataInput {
    /**
     * Optional free-text filter narrowing results by title/name
     * (case-insensitive substring match via `safeIlike`). Trimmed before use;
     * an empty/whitespace-only value is treated as omitted.
     */
    readonly query?: string;
    /**
     * Maximum number of items returned in total, across both entity types.
     * Defaults to {@link DEFAULT_LIMIT} and is clamped to
     * {@link MAX_LIMIT} regardless of the caller-supplied value.
     */
    readonly limit?: number;
}

/**
 * Minimal projection of the columns this service reads from either the
 * `accommodations` or `destinations` table. Both tables share this shape for
 * every field used here.
 */
interface PublicEntityRow {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly summary?: string | null;
    readonly media?: { readonly featuredImage?: { readonly url?: string } } | null;
    readonly createdAt: Date;
}

/** A {@link PublicEntityRow} tagged with the entity type it came from, kept until final mapping so recency sort stays correct across both sources. */
interface TaggedRow extends PublicEntityRow {
    readonly entityType: SocialPublicDataEntityType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a caller-supplied `limit` to a sane, bounded range.
 * Falls back to {@link DEFAULT_LIMIT} for missing/invalid values, and never
 * exceeds {@link MAX_LIMIT}.
 */
function clampLimit(limit: number | undefined): number {
    if (typeof limit !== 'number' || Number.isNaN(limit) || limit <= 0) {
        return DEFAULT_LIMIT;
    }
    return Math.min(Math.floor(limit), MAX_LIMIT);
}

/**
 * Maps a {@link TaggedRow} to the public `SocialPublicDataItem` shape.
 */
function toPublicDataItem(row: TaggedRow): SocialPublicDataItem {
    return {
        entityType: row.entityType,
        id: row.id,
        title: row.name,
        slug: row.slug,
        summary: row.summary ?? null,
        imageUrl: row.media?.featuredImage?.url ?? null
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Tightly-scoped read-only aggregation service returning public accommodations
 * and destinations shaped for social-draft enrichment.
 *
 * ## Responsibilities
 * - Queries only PUBLIC/ACTIVE, non-deleted accommodations and destinations.
 * - Applies an optional free-text `query` filter (title/name substring, via
 *   `safeIlike` — never the raw drizzle-orm `ilike` helper).
 * - Merges both entity types into a single list ordered by recency (most
 *   recent `createdAt` first), bounded by `limit` (default 20, max 50).
 *
 * ## Error codes used
 * | ServiceErrorCode | When                                    |
 * |------------------|------------------------------------------|
 * | INTERNAL_ERROR   | An unexpected error occurs during a query |
 *
 * HOS-66 T-022 (G-10).
 */
export class SocialPublicDataService {
    private readonly accommodationModel: AccommodationModelType;
    private readonly destinationModel: DestinationModelType;

    constructor(
        accommodationModel?: AccommodationModelType,
        destinationModel?: DestinationModelType
    ) {
        this.accommodationModel = accommodationModel ?? new AccommodationModel();
        this.destinationModel = destinationModel ?? new DestinationModel();
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Returns public accommodations and destinations shaped for social-draft
     * enrichment, most recent first.
     *
     * @param input - Optional free-text `query` and/or `limit` override.
     * @returns ServiceOutput with `{ items }` on success — never throws for
     *   an empty result set (returns `{ items: [] }`).
     *
     * @example
     * ```ts
     * const result = await service.getPublicData({ query: 'río' });
     * if (result.error) {
     *   // handle error.code / error.message
     * }
     * ```
     */
    public async getPublicData(
        input: GetPublicDataInput = {}
    ): Promise<ServiceOutput<SocialPublicDataResponseData>> {
        const limit = clampLimit(input.limit);
        const trimmedQuery = input.query?.trim();
        const effectiveQuery = trimmedQuery && trimmedQuery.length > 0 ? trimmedQuery : undefined;

        try {
            const [accommodationRows, destinationRows] = await Promise.all([
                this.fetchAccommodations(limit, effectiveQuery),
                this.fetchDestinations(limit, effectiveQuery)
            ]);

            const combined: TaggedRow[] = [
                ...accommodationRows.map(
                    (row): TaggedRow => ({ ...row, entityType: 'ACCOMMODATION' })
                ),
                ...destinationRows.map((row): TaggedRow => ({ ...row, entityType: 'DESTINATION' }))
            ];

            // Order by recency (most recent first) across both entity types,
            // then bound to `limit` total.
            combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            const items = combined.slice(0, limit).map(toPublicDataItem);

            return { data: { items } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return {
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        reason: err.reason
                    }
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            serviceLogger.error(
                { query: effectiveQuery, error: message },
                'SocialPublicDataService.getPublicData: unexpected error'
            );
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error during getPublicData: ${message}`
                }
            };
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Queries PUBLIC/ACTIVE, non-deleted accommodations, most recent first,
     * optionally narrowed by a `name` substring match.
     */
    private async fetchAccommodations(
        limit: number,
        query: string | undefined
    ): Promise<PublicEntityRow[]> {
        const additionalConditions = this.buildQueryConditions(accommodations.name, query);

        const { items } = await this.accommodationModel.findAll(
            {
                deletedAt: null,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            },
            { page: 1, pageSize: limit, sortBy: 'createdAt', sortOrder: 'desc' },
            additionalConditions
        );

        return items.map((item) => this.toPublicEntityRow(item));
    }

    /**
     * Queries PUBLIC/ACTIVE, non-deleted destinations, most recent first,
     * optionally narrowed by a `name` substring match.
     */
    private async fetchDestinations(
        limit: number,
        query: string | undefined
    ): Promise<PublicEntityRow[]> {
        const additionalConditions = this.buildQueryConditions(destinations.name, query);

        const { items } = await this.destinationModel.findAll(
            {
                deletedAt: null,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            },
            { page: 1, pageSize: limit, sortBy: 'createdAt', sortOrder: 'desc' },
            additionalConditions
        );

        return items.map((item) => this.toPublicEntityRow(item));
    }

    /**
     * Builds the `additionalConditions` array forwarded to `model.findAll` for
     * an optional free-text filter. Returns `undefined` (not an empty array)
     * when no query is supplied, matching the `findAll` contract used
     * elsewhere in service-core.
     */
    private buildQueryConditions(
        nameColumn: Parameters<typeof safeIlike>[0],
        query: string | undefined
    ): SQL[] | undefined {
        if (!query) {
            return undefined;
        }
        return [safeIlike(nameColumn, query)];
    }

    /**
     * Narrows a raw model row (typed as the domain entity but read here as an
     * unknown-shaped record) down to the minimal {@link PublicEntityRow}
     * projection this service needs.
     */
    private toPublicEntityRow(row: Record<string, unknown>): PublicEntityRow {
        return {
            id: row.id as string,
            name: row.name as string,
            slug: row.slug as string,
            summary: (row.summary as string | null | undefined) ?? null,
            media: row.media as PublicEntityRow['media'],
            createdAt: row.createdAt as Date
        };
    }
}
