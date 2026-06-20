/**
 * AccommodationExternalReputationService (SPEC-237 T-007)
 *
 * Stateless-helper service (does NOT extend BaseCrudService) for the three
 * higher-level operations on external reputation data:
 *
 * - {@link refresh}: iterate enabled listings, call adapters, upsert cache rows.
 * - {@link listForDisplay}: assemble the public-detail-page reputation block,
 *   applying master toggle, per-platform toggle filtering, and Google snippet TTL.
 * - {@link disableReputation}: admin takedown that silences all listing toggles.
 *
 * @module services/accommodation-external-reputation/accommodation-external-reputation.service
 */

import type {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import { withTransaction } from '@repo/db';
import type { AccommodationExternalListing } from '@repo/schemas';
import {
    type ExternalPlatformEnum,
    PermissionEnum,
    ServiceErrorCode,
    buildExternalReputationBlock
} from '@repo/schemas';
import type { ExternalReputationBlock } from '@repo/schemas';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { hasPermission } from '../../utils/permission.js';
import type { ReputationAdapterCredentials } from './adapters/index.js';
import { getReputationAdapter } from './adapters/index.js';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Describes a single platform fetch failure captured during {@link refresh}.
 */
export interface RefreshFailureEntry {
    /** The platform that errored. */
    readonly platform: ExternalPlatformEnum;
    /** Error message from the adapter or DB. */
    readonly error: string;
}

/**
 * Result returned by {@link AccommodationExternalReputationService.refresh}.
 *
 * AC-2.3: partial failure is the expected model — one platform erroring must
 * NOT prevent other platforms from being refreshed.
 */
export interface RefreshResult {
    /** Platform values that were fetched and upserted successfully. */
    readonly succeeded: readonly ExternalPlatformEnum[];
    /** Platform values that errored, with their error messages. */
    readonly failed: readonly RefreshFailureEntry[];
}

// ---------------------------------------------------------------------------
// Rate-limit helpers
// ---------------------------------------------------------------------------

/**
 * Parses a rate-limit string of the form `"N/S"` (N requests per S seconds).
 *
 * @param raw - Rate-limit string, e.g. `"1/600"`.
 * @returns Parsed `{ maxRequests, windowSeconds }`, or `null` when the string
 *   is not parseable (rate limiting is then skipped).
 *
 * @example
 * ```ts
 * parseRateLimit('1/600') // { maxRequests: 1, windowSeconds: 600 }
 * ```
 */
function parseRateLimit(raw: string): { maxRequests: number; windowSeconds: number } | null {
    const parts = raw.split('/');
    if (parts.length !== 2) return null;
    const maxRequests = Number.parseInt(parts[0] ?? '', 10);
    const windowSeconds = Number.parseInt(parts[1] ?? '', 10);
    if (
        Number.isNaN(maxRequests) ||
        Number.isNaN(windowSeconds) ||
        maxRequests < 1 ||
        windowSeconds < 1
    ) {
        return null;
    }
    return { maxRequests, windowSeconds };
}

/**
 * Returns `true` when the last fetch for the accommodation is within the
 * rate-limit window.
 *
 * @param lastFetchedAt - Timestamp of the last aggregate fetch (`null` → never fetched).
 * @param windowSeconds - Rate-limit window in seconds.
 * @returns `true` when re-fetch is blocked (too soon); `false` when allowed.
 */
function isRateLimited(lastFetchedAt: Date | null | undefined, windowSeconds: number): boolean {
    if (lastFetchedAt == null) return false;
    const elapsed = (Date.now() - lastFetchedAt.getTime()) / 1000;
    return elapsed < windowSeconds;
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that the actor can update the given accommodation (by ownership or
 * by admin `UPDATE_ANY`), resolving the ownerId from the accommodation model.
 *
 * @throws {ServiceError} NOT_FOUND if the accommodation is missing or deleted.
 * @throws {ServiceError} FORBIDDEN if the actor lacks the required permission.
 */
async function assertCanUpdateAccommodation(
    actor: Actor,
    accommodationId: string,
    accommodationModel: AccommodationModel,
    tx?: Parameters<AccommodationModel['findById']>[1]
): Promise<void> {
    const accommodation = await accommodationModel.findById(accommodationId, tx);
    if (!accommodation || accommodation.deletedAt !== null) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Accommodation not found: ${accommodationId}`
        );
    }

    const hasAny = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
    const hasOwn = hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);

    if (hasAny) return;
    if (hasOwn && actor.id === accommodation.ownerId) return;

    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied: ACCOMMODATION_UPDATE_OWN or ACCOMMODATION_UPDATE_ANY required, and actor must own the accommodation'
    );
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

/**
 * Dependencies injected into {@link AccommodationExternalReputationService}.
 */
export interface AccommodationExternalReputationServiceDeps {
    /** Model for `accommodation_external_listings`. */
    readonly listingModel: AccommodationExternalListingModel;
    /** Model for `accommodation_external_reputation`. */
    readonly reputationModel: AccommodationExternalReputationModel;
    /** Model for `accommodations` (ownership + master toggle). */
    readonly accommodationModel: AccommodationModel;
    /** Credentials forwarded to reputation adapters. */
    readonly adapterCredentials?: ReputationAdapterCredentials;
}

/**
 * Stateless helper service for accommodation external reputation data
 * (SPEC-237 T-007).
 *
 * Does NOT extend `BaseCrudService` — reputation rows are written exclusively
 * by automated fetch jobs (no owner CRUD pipeline needed).
 *
 * @example
 * ```ts
 * const svc = new AccommodationExternalReputationService(ctx, {
 *   listingModel,
 *   reputationModel,
 *   accommodationModel,
 *   // Pass the FULL credential set — Google key + Apify token + actor slugs.
 *   // Omitting the Apify fields silently disables Booking fallback + Airbnb.
 *   adapterCredentials: {
 *     googlePlacesApiKey: env.HOSPEDA_GOOGLE_PLACES_API_KEY,
 *     apifyToken: env.HOSPEDA_APIFY_TOKEN,
 *     apifyBookingActor: env.HOSPEDA_APIFY_BOOKING_ACTOR,
 *     apifyAirbnbActor: env.HOSPEDA_APIFY_AIRBNB_ACTOR,
 *   },
 * });
 * const result = await svc.refresh(accommodationId, actor);
 * ```
 */
export class AccommodationExternalReputationService {
    private readonly listingModel: AccommodationExternalListingModel;
    private readonly reputationModel: AccommodationExternalReputationModel;
    private readonly accommodationModel: AccommodationModel;
    private readonly adapterCredentials: ReputationAdapterCredentials;

    constructor(_ctx: ServiceConfig, deps: AccommodationExternalReputationServiceDeps) {
        this.listingModel = deps.listingModel;
        this.reputationModel = deps.reputationModel;
        this.accommodationModel = deps.accommodationModel;
        this.adapterCredentials = deps.adapterCredentials ?? {};
    }

    // -------------------------------------------------------------------------
    // refresh
    // -------------------------------------------------------------------------

    /**
     * Fetches reputation data from all enabled (showReviews=true) external
     * platforms for the given accommodation and upserts the cached rows.
     *
     * **Rate limiting**: Before iterating listings, the service reads
     * `HOSPEDA_EXTREP_REFRESH_RATE_LIMIT` from `process.env` (format `N/S`,
     * e.g. `"1/600"` = 1 refresh per accommodation per 600 s). If the most
     * recent `aggregateFetchedAt` across all reputation rows for this
     * accommodation is within the window, a `QUOTA_EXCEEDED` error is returned
     * immediately with reason `RATE_LIMIT_ERROR`.
     *
     * Set `bypassRateLimit: true` to skip the per-accommodation rate-limit check.
     * This is intended exclusively for cron/system callers that already throttle
     * the batch at the job level (e.g. the `refresh-external-reputation` weekly job).
     *
     * **Partial failure (AC-2.3)**: one platform erroring writes
     * `fetchStatus='error'` for that row and continues to the next platform.
     * The returned {@link RefreshResult} distinguishes `succeeded` from `failed`.
     *
     * @param accommodationId - UUID of the accommodation to refresh.
     * @param actor - The actor requesting the refresh. Must own the accommodation
     *   or hold `ACCOMMODATION_UPDATE_ANY`.
     * @param ctx - Optional service context (transaction).
     * @param options - Optional call options.
     * @param options.bypassRateLimit - When `true`, skips the per-accommodation
     *   rate-limit check. Defaults to `false`. For system/cron callers only.
     * @returns A discriminated ServiceOutput with {@link RefreshResult} on success.
     */
    async refresh(
        accommodationId: string,
        actor: Actor,
        ctx?: ServiceContext,
        options?: { bypassRateLimit?: boolean }
    ): Promise<ServiceOutput<RefreshResult>> {
        try {
            await assertCanUpdateAccommodation(
                actor,
                accommodationId,
                this.accommodationModel,
                ctx?.tx
            );

            // --- Rate limit check ---
            const rateLimitRaw = process.env.HOSPEDA_EXTREP_REFRESH_RATE_LIMIT ?? '1/600';
            const rateLimit = parseRateLimit(rateLimitRaw);

            if (rateLimit && !options?.bypassRateLimit) {
                // Find the most recent aggregateFetchedAt across all reputation rows for this accommodation.
                const { items: existingReps } = await this.reputationModel.findAll(
                    { accommodationId },
                    undefined,
                    undefined,
                    ctx?.tx
                );
                const mostRecentFetchedAt = existingReps.reduce<Date | null>((latest, rep) => {
                    if (rep.aggregateFetchedAt == null) return latest;
                    const d =
                        rep.aggregateFetchedAt instanceof Date
                            ? rep.aggregateFetchedAt
                            : new Date(rep.aggregateFetchedAt);
                    return latest === null || d > latest ? d : latest;
                }, null);

                if (isRateLimited(mostRecentFetchedAt, rateLimit.windowSeconds)) {
                    return {
                        error: {
                            code: ServiceErrorCode.QUOTA_EXCEEDED,
                            message: `Reputation refresh is rate-limited: at most ${rateLimit.maxRequests} refresh(es) per ${rateLimit.windowSeconds}s per accommodation`,
                            details: {
                                reason: 'RATE_LIMIT_ERROR',
                                windowSeconds: rateLimit.windowSeconds
                            }
                        }
                    };
                }
            }

            // --- Fetch enabled listings ---
            const allListings = await this.listingModel.findByAccommodation(
                accommodationId,
                ctx?.tx
            );
            const enabledListings = allListings.filter((l) => l.showReviews && l.deletedAt == null);

            const succeeded: ExternalPlatformEnum[] = [];
            const failed: RefreshFailureEntry[] = [];

            for (const listing of enabledListings) {
                try {
                    const adapter = getReputationAdapter(
                        listing.platform as ExternalPlatformEnum,
                        this.adapterCredentials
                    );
                    const fetchResult = await adapter.fetch(listing);

                    const now = new Date();
                    await this.reputationModel.upsertReputation(
                        {
                            accommodationId,
                            platform: listing.platform,
                            listingId: listing.id,
                            rating: fetchResult.rating,
                            reviewsCount: fetchResult.reviewsCount,
                            deepLink: fetchResult.deepLink,
                            snippets: fetchResult.snippets ? [...fetchResult.snippets] : null,
                            snippetsFetchedAt: fetchResult.snippets ? now : null,
                            aggregateFetchedAt: now,
                            fetchStatus: 'ok',
                            fetchMessage: null
                        },
                        ctx?.tx
                    );

                    succeeded.push(listing.platform as ExternalPlatformEnum);
                } catch (platformErr) {
                    const errorMessage =
                        platformErr instanceof Error ? platformErr.message : String(platformErr);

                    // AC-2.3: write error status and continue.
                    try {
                        await this.reputationModel.upsertReputation(
                            {
                                accommodationId,
                                platform: listing.platform,
                                listingId: listing.id,
                                rating: null,
                                reviewsCount: null,
                                deepLink: null,
                                snippets: null,
                                snippetsFetchedAt: null,
                                aggregateFetchedAt: null,
                                fetchStatus: 'error',
                                fetchMessage: errorMessage
                            },
                            ctx?.tx
                        );
                    } catch {
                        // Upsert of error row also failed — still continue.
                    }

                    failed.push({
                        platform: listing.platform as ExternalPlatformEnum,
                        error: errorMessage
                    });
                }
            }

            return { data: { succeeded, failed } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
                }
            };
        }
    }

    // -------------------------------------------------------------------------
    // listForDisplay
    // -------------------------------------------------------------------------

    /**
     * Returns the toggle-filtered, TTL-degraded reputation block for the
     * **public** accommodation detail page.
     *
     * No authentication required — this is a public-read operation.
     *
     * Filtering rules (applied in order):
     * 1. If `accommodations.showExternalReputation` is `false` → return empty block.
     * 2. Only reputation rows whose listing has `showLink OR showReviews` are
     *    included (via {@link AccommodationExternalReputationModel.findForDisplay}).
     * 3. For Google: if `snippetsFetchedAt` is older than
     *    `HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS` (default 30 d), snippets are
     *    stripped from the response (AC-7.2 degrade) but the aggregate
     *    (rating, reviewsCount) is still shown.
     * 4. Unverified listings are excluded (handled by
     *    {@link buildExternalReputationBlock}).
     *
     * @param accommodationId - UUID of the accommodation.
     * @param ctx - Optional service context.
     * @returns The public reputation block. Never returns an error; on any DB
     *   failure the empty block is returned so the detail page never breaks.
     */
    async listForDisplay(
        accommodationId: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ExternalReputationBlock>> {
        try {
            const accommodation = await this.accommodationModel.findById(accommodationId, ctx?.tx);

            // Master toggle: if off, return empty block immediately.
            if (!accommodation?.showExternalReputation) {
                return { data: { items: [] } };
            }

            const reputationRows = await this.reputationModel.findForDisplay(
                accommodationId,
                ctx?.tx
            );

            if (reputationRows.length === 0) {
                return { data: { items: [] } };
            }

            // We need the listing rows to access showLink / showReviews / verified / url.
            const allListings = await this.listingModel.findByAccommodation(
                accommodationId,
                ctx?.tx
            );

            const listingById = new Map(allListings.map((l) => [l.id, l]));

            // Determine Google snippet TTL from env.
            const ttlDays = Number.parseInt(
                process.env.HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS ?? '30',
                10
            );
            const safeDay = Number.isNaN(ttlDays) || ttlDays < 1 ? 30 : ttlDays;
            const ttlMs = safeDay * 24 * 60 * 60 * 1000;

            // Build sources for buildExternalReputationBlock.
            const sources = reputationRows.map((rep) => {
                const listing = listingById.get(rep.listingId);
                return {
                    platform: rep.platform,
                    url: listing?.url ?? '',
                    showLink: listing?.showLink ?? false,
                    showReviews: listing?.showReviews ?? false,
                    verified: listing?.verified ?? false,
                    rating: rep.rating,
                    reviewsCount: rep.reviewsCount,
                    deepLink: rep.deepLink,
                    snippets: rep.snippets,
                    snippetsFetchedAt: rep.snippetsFetchedAt
                };
            });

            const block = buildExternalReputationBlock(sources, ttlMs);
            return { data: block };
        } catch (_err) {
            // Public read: degrade gracefully — never surface 500 errors to the detail page.
            return { data: { items: [] } };
        }
    }

    // -------------------------------------------------------------------------
    // disableReputation
    // -------------------------------------------------------------------------

    /**
     * Admin-only soft-disable: sets `showLink=false` and `showReviews=false` on
     * ALL non-deleted listings for the accommodation.
     *
     * This is a minimal takedown operation (micro-decision 2). It does NOT
     * delete any rows or modify the master toggle.  To restore visibility the
     * owner must manually re-enable their listings via {@link AccommodationExternalListingService.update}.
     *
     * Requires {@link PermissionEnum.ACCOMMODATION_UPDATE_ANY}.
     *
     * @param accommodationId - UUID of the accommodation to silence.
     * @param actor - The admin actor performing the operation.
     * @param ctx - Optional service context (transaction).
     * @returns `{ data: { disabled: number } }` with the count of rows silenced.
     */
    async disableReputation(
        accommodationId: string,
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ disabled: number }>> {
        try {
            if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY)) {
                return {
                    error: {
                        code: ServiceErrorCode.FORBIDDEN,
                        message: 'Permission denied: ACCOMMODATION_UPDATE_ANY required'
                    }
                };
            }

            const accommodation = await this.accommodationModel.findById(accommodationId, ctx?.tx);
            if (!accommodation || accommodation.deletedAt !== null) {
                return {
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `Accommodation not found: ${accommodationId}`
                    }
                };
            }

            // FIX L6: wrap the update loop in a transaction so the takedown is
            // all-or-nothing. A mid-loop failure rolls back all partial updates.
            const listingModelRef = this.listingModel;
            const disabled = await withTransaction(async (tx) => {
                const listings = await listingModelRef.findByAccommodation(accommodationId, tx);

                let count = 0;
                for (const listing of listings) {
                    if (listing.deletedAt != null) continue;
                    await listingModelRef.update(
                        { id: listing.id },
                        {
                            showLink: false,
                            showReviews: false,
                            // TYPE-WORKAROUND: BaseModel.update inferred type omits the updatedById audit field.
                            updatedById: actor.id
                        } as unknown as Partial<AccommodationExternalListing>,
                        tx
                    );
                    count++;
                }
                return count;
            }, ctx?.tx);

            return { data: { disabled } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message, details: err.details } };
            }
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
                }
            };
        }
    }
}
