/**
 * RecommendationService — SPEC-284 T-005 / T-005b
 *
 * Orchestrates the tourist-facing personalized recommendations feed
 * (`.qtm/specs/SPEC-284-recommendations-feed/spec.md` §5): fetches the
 * actor's behavioral signals (favorites, recently-viewed accommodations,
 * search history), fuses them into a {@link RecommendationProfile} via
 * `buildRecommendationProfile` (T-003), scores a candidate pool against
 * that profile via `scoreAndRankCandidates` (T-004), and returns the
 * top-ranked accommodations.
 *
 * Authorization is two-layered (see {@link RecommendationService.getFeed} for
 * the full breakdown): the route-level `gateRecommendations()` entitlement
 * gate (plan axis) plus a service-level `PermissionEnum.RECOMMENDATION_VIEW`
 * check (role axis, T-005b) — never role checks directly, per this package's
 * `PermissionEnum`-only convention.
 *
 * Design notes:
 *  - Extends `BaseService` rather than `BaseCrudService` — this is a
 *    read-only orchestrator with no lifecycle/CRUD surface, exactly like
 *    `SearchHistoryService` (SPEC-289), the closest sibling in shape.
 *  - Self-scoped only: the public method takes no `userId` input — it always
 *    reads `actor.id`. Unlike an admin surface, there is no legitimate case
 *    for viewing another user's recommendation feed, so accepting a `userId`
 *    parameter would just be an unused foot-gun (a caller could otherwise
 *    "request" someone else's feed and rely on a permission check to reject
 *    it — simpler to make the wrong thing unrepresentable).
 *  - Cold-start (spec §5.5) is NOT a separate code path. The candidate pool
 *    is always scored against the (possibly cold/empty) profile via the same
 *    `scoreAndRankCandidates` call. `scoreCandidateAccommodation` (T-004) is
 *    documented as safe against an empty profile — every component except
 *    `quality` degrades to 0 (or the neutral price midpoint), so a cold
 *    profile naturally yields a ranking driven almost entirely by rating/
 *    featured status, which IS the popular/featured fallback the spec calls
 *    for. Reusing the scorer instead of a bespoke fallback path also
 *    guarantees the cold-start items satisfy `ScoredAccommodationSchema`
 *    (which requires a full `score` breakdown) without inventing a second
 *    "neutral breakdown" shape.
 *  - The candidate pool is sourced from `AccommodationModel.findTopRated`
 *    (the same query `AccommodationService.getTopRated` uses for its public
 *    "popular" list) rather than a fresh query — it already applies the
 *    public-visibility flags (excludes RESTRICTED/owner-suspended/plan-
 *    restricted/non-ACTIVE accommodations) and eager-loads `destination`
 *    (for the materialized path) and `amenities` (for the Jaccard component)
 *    in a single query. Reusing it means the personalized feed and the
 *    cold-start fallback share one sourcing + projection pipeline.
 *  - Favorites/recently-viewed accommodations are resolved through the same
 *    projection pipeline (privacy-aware location, composed media) as the
 *    pool for code-path uniformity, even though — being excluded from the
 *    final `items` — their privacy/media fields are never serialized to the
 *    client. The cost is one extra batched query, not a per-item one.
 *
 * @module services/recommendation/recommendation.service
 */
import type {
    AccommodationMediaModel,
    AccommodationModel,
    DestinationModel,
    DrizzleClient,
    EntityViewModel,
    UserBookmarkModel
} from '@repo/db';
import {
    accommodations,
    accommodationMediaModel as defaultAccommodationMediaModel,
    accommodationModel as defaultAccommodationModel,
    destinationModel as defaultDestinationModel,
    entityViewModel as defaultEntityViewModel,
    userBookmarkModel as defaultUserBookmarkModel,
    inArray
} from '@repo/db';
import type {
    Accommodation,
    ApproximateLocationType,
    RecommendationCandidateAccommodation,
    RecommendationFeedResponse,
    RecommendationProfile,
    SearchHistoryFilters
} from '@repo/schemas';
import {
    EntityTypeEnum,
    PermissionEnum,
    RecommendationFeedResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';
import { attachComposedMediaList } from '../accommodation/accommodation.media-read';
import { applyAccommodationLocationPrivacyList } from '../accommodation/accommodation.projections';
import { SearchHistoryService } from '../userSearchHistory/userSearchHistory.service';
import { buildRecommendationProfile } from './recommendation.profile';
import type { DestinationPathLookup } from './recommendation.scorer';
import { scoreAndRankCandidates } from './recommendation.scorer';

// ---------------------------------------------------------------------------
// Signal caps (spec §5.2)
// ---------------------------------------------------------------------------

/** Max favorited accommodations folded into the profile (last 20, no time window). */
const FAVORITES_CAP = 20;

/** Max search-history entries folded into the profile (last 30d, cap 10). */
const SEARCH_HISTORY_CAP = 10;

/**
 * Max candidate accommodations scored per feed request.
 *
 * Not spec-mandated — a judgment call balancing scoring cost (each candidate
 * runs through five weighted comparisons, spec §5.4) against giving the
 * ranking enough options to surface a good top-N. 150 keeps a single-request
 * scoring pass cheap (pure in-memory comparisons, no I/O) while comfortably
 * exceeding the final feed size.
 */
const CANDIDATE_POOL_CAP = 150;

/**
 * Number of items returned in the final feed.
 *
 * Not spec-mandated (OQ-3 only fixes that the count is the same across every
 * plan that has the entitlement — binary v1, no per-plan differentiation).
 * 20 mirrors a full card-grid page on `/recomendaciones`.
 */
const FEED_LIMIT = 20;

// ---------------------------------------------------------------------------
// Raw joined row shape (accommodation + destination + amenities relations)
// ---------------------------------------------------------------------------

/** One row of the `amenities` junction relation, as loaded via Drizzle RQB. */
interface AmenityJunctionRow {
    readonly amenityId: string;
}

/**
 * Shape of an `Accommodation` row after eager-loading `destination` and
 * `amenities` relations (via `findTopRated` or `findAllWithRelations`), and
 * optionally after the privacy/media projection helpers have run (which add
 * `approximateLocation` dynamically — not part of the base `Accommodation`
 * type).
 */
interface JoinedAccommodationRow extends Accommodation {
    readonly destination?: { readonly path?: string | null } | null;
    readonly amenities?: readonly AmenityJunctionRow[];
    readonly approximateLocation?: ApproximateLocationType;
}

/** Result of mapping one {@link JoinedAccommodationRow} to a candidate. */
interface MappedCandidate {
    readonly candidate: RecommendationCandidateAccommodation;
    readonly destinationPath?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Orchestrator service for the personalized recommendations feed (SPEC-284).
 *
 * Read-only: the only public method is {@link getFeed}. Composes the
 * signal-fetching models, the pure profile builder (T-003), and the pure
 * scorer (T-004) into one end-to-end feed computation.
 */
export class RecommendationService extends BaseService {
    static readonly ENTITY_NAME = 'recommendation';
    protected override readonly entityName = RecommendationService.ENTITY_NAME;

    private readonly accommodationModel: AccommodationModel;
    private readonly destinationModel: DestinationModel;
    private readonly userBookmarkModel: UserBookmarkModel;
    private readonly entityViewModel: EntityViewModel;
    private readonly accommodationMediaModel: AccommodationMediaModel;
    private readonly searchHistoryService: SearchHistoryService;

    /**
     * @param config - Service configuration (logger, etc.).
     * @param accommodationModel - Optional `AccommodationModel` (for testing/mocking).
     * @param destinationModel - Optional `DestinationModel` (for testing/mocking).
     * @param userBookmarkModel - Optional `UserBookmarkModel` (for testing/mocking).
     * @param entityViewModel - Optional `EntityViewModel` (for testing/mocking).
     * @param accommodationMediaModel - Optional `AccommodationMediaModel` (for testing/mocking).
     * @param searchHistoryService - Optional `SearchHistoryService` (for testing/mocking).
     */
    constructor(
        config: ServiceConfig,
        accommodationModel?: AccommodationModel,
        destinationModel?: DestinationModel,
        userBookmarkModel?: UserBookmarkModel,
        entityViewModel?: EntityViewModel,
        accommodationMediaModel?: AccommodationMediaModel,
        searchHistoryService?: SearchHistoryService
    ) {
        super(config, RecommendationService.ENTITY_NAME);
        this.accommodationModel = accommodationModel ?? defaultAccommodationModel;
        this.destinationModel = destinationModel ?? defaultDestinationModel;
        this.userBookmarkModel = userBookmarkModel ?? defaultUserBookmarkModel;
        this.entityViewModel = entityViewModel ?? defaultEntityViewModel;
        this.accommodationMediaModel = accommodationMediaModel ?? defaultAccommodationMediaModel;
        this.searchHistoryService = searchHistoryService ?? new SearchHistoryService(config);
    }

    // -------------------------------------------------------------------------
    // getFeed
    // -------------------------------------------------------------------------

    /**
     * Computes the actor's personalized recommendations feed.
     *
     * Authorization is enforced on TWO independent layers (SPEC-284 T-005b):
     *  1. **Route-level entitlement gate** (`gateRecommendations()`, SPEC-145
     *     pattern) — checks the actor's billing plan includes
     *     `CAN_VIEW_RECOMMENDATIONS` before the request ever reaches this
     *     service. This is the PLAN axis (free vs plus/VIP).
     *  2. **Service-level permission check** (this method, first thing
     *     `execute` does) — requires `PermissionEnum.RECOMMENDATION_VIEW`.
     *     This is the ROLE axis: it protects the service from being called
     *     directly (bypassing the route) by an actor whose role was never
     *     meant to have this feature (e.g. `SPONSOR`, `GUEST`), independent
     *     of whatever plan/entitlements they happen to carry. Always
     *     own-scoped — there is no `_ANY` variant, since a tourist can only
     *     ever view THEIR OWN feed (see the permission's doc comment in
     *     `PermissionEnum`).
     *
     * Pipeline (after authorization):
     * 1. Fetch the three behavioral signals (favorites, recently-viewed,
     *    search history — the last one is degradable, see
     *    {@link resolveSearchHistoryFilters}).
     * 2. Resolve the favorited/recently-viewed accommodations into full
     *    {@link RecommendationCandidateAccommodation} objects (needed by the
     *    profile builder, which reads their destination/type/price/amenities).
     * 3. Build the {@link RecommendationProfile} (T-003) — possibly cold.
     * 4. Source a candidate pool from the public "top rated" query, excluding
     *    accommodations the actor already bookmarked or viewed (spec: "surface
     *    new discoveries, not the already-known").
     * 5. Resolve the destination-path lookup the scorer needs (T-004).
     * 6. Score + rank (T-004) and return the top {@link FEED_LIMIT}.
     *
     * Never throws for a degraded search-history signal — only favorites and
     * recently-viewed are required for a non-empty profile. A missing
     * `RECOMMENDATION_VIEW` permission also never throws out of this method —
     * it's a `ServiceError(FORBIDDEN)` caught by `runWithLoggingAndValidation`
     * and surfaced as `{ error }` on the returned `ServiceOutput`, same as
     * every other permission check in this package.
     *
     * @param actor - The authenticated actor requesting their own feed.
     * @param ctx - Optional service context for transaction propagation.
     * @returns `{ items, isColdStart, generatedAt }` (see
     *   `RecommendationFeedResponseSchema`), or a `FORBIDDEN` error when the
     *   actor lacks `RECOMMENDATION_VIEW`.
     */
    public async getFeed(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<RecommendationFeedResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getFeed',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                // 0. Service-level permission gate (SPEC-284 T-005b) --------------------
                // Complements the route-level entitlement gate (`gateRecommendations()`)
                // rather than replacing it — see the authorization note above.
                if (!hasPermission(validatedActor, PermissionEnum.RECOMMENDATION_VIEW)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: RECOMMENDATION_VIEW required to view the recommendations feed'
                    );
                }

                const tx = execCtx?.tx;
                const destinationPaths: Record<string, string> = {};

                // 1. Behavioral signals -------------------------------------------------
                const [favoriteIds, recentlyViewedIds, searchHistoryFilters] = await Promise.all([
                    this.fetchFavoriteAccommodationIds(validatedActor.id, tx),
                    this.fetchRecentlyViewedAccommodationIds(validatedActor.id, tx),
                    this.resolveSearchHistoryFilters(validatedActor, execCtx)
                ]);

                // 2. Resolve profile-signal candidates (favorites + viewed) -------------
                const knownIds = Array.from(new Set([...favoriteIds, ...recentlyViewedIds]));
                const signalCandidatesById = await this.resolveSignalCandidates(
                    knownIds,
                    destinationPaths,
                    tx
                );

                const favoriteAccommodations = this.pickCandidates(
                    favoriteIds,
                    signalCandidatesById
                );
                const recentlyViewedAccommodations = this.pickCandidates(
                    recentlyViewedIds,
                    signalCandidatesById
                );

                // 3. Build the preference profile (T-003) --------------------------------
                const profile: RecommendationProfile = buildRecommendationProfile({
                    favoriteAccommodations,
                    recentlyViewedAccommodations,
                    searchHistoryFilters
                });

                // 4. Candidate pool: public "top rated" query, excluding known ids -------
                const knownIdSet = new Set(knownIds);
                const poolRows = (await this.accommodationModel.findTopRated(
                    {
                        // Over-fetch by the known-id count to compensate for the
                        // post-query exclusion filter below (findTopRated has no
                        // native "exclude these ids" clause).
                        limit: CANDIDATE_POOL_CAP + knownIdSet.size,
                        excludeRestricted: true,
                        excludeOwnerSuspended: true,
                        excludePlanRestricted: true,
                        activeOnly: true
                    },
                    tx
                )) as JoinedAccommodationRow[];

                const filteredPoolRows = poolRows
                    .filter((row) => !knownIdSet.has(row.id))
                    .slice(0, CANDIDATE_POOL_CAP);

                const poolCandidates = await this.resolvePoolCandidates(
                    filteredPoolRows,
                    validatedActor,
                    destinationPaths,
                    tx
                );

                // 5. Top up the destination-path lookup for the scorer (T-004) -----------
                await this.fillMissingDestinationPaths(
                    destinationPaths,
                    profile.preferredDestinations.map((preference) => preference.destinationId),
                    tx
                );

                // 6. Score + rank (T-004) and slice to the feed size ----------------------
                const scored = scoreAndRankCandidates({
                    candidates: poolCandidates,
                    profile,
                    destinationPaths: destinationPaths satisfies DestinationPathLookup
                });

                return RecommendationFeedResponseSchema.parse({
                    items: scored.slice(0, FEED_LIMIT),
                    isColdStart: profile.isCold,
                    generatedAt: new Date()
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Signal fetching
    // -------------------------------------------------------------------------

    /**
     * Returns the actor's favorited accommodation IDs, most recent first,
     * capped at {@link FAVORITES_CAP} (spec §5.2: last 20, no time window).
     */
    private async fetchFavoriteAccommodationIds(
        userId: string,
        tx?: DrizzleClient
    ): Promise<string[]> {
        const { items } = await this.userBookmarkModel.findAll(
            { userId, entityType: EntityTypeEnum.ACCOMMODATION, deletedAt: null },
            { page: 1, pageSize: FAVORITES_CAP, sortBy: 'createdAt', sortOrder: 'desc' },
            undefined,
            tx
        );
        return items.map((bookmark) => bookmark.entityId);
    }

    /**
     * Returns the actor's recently-viewed accommodation IDs, most recent
     * first. Window (30 days) and cap (25) are already enforced by
     * {@link EntityViewModel.getRecentlyViewedByUser} (T-001).
     */
    private async fetchRecentlyViewedAccommodationIds(
        userId: string,
        tx?: DrizzleClient
    ): Promise<string[]> {
        const { accommodationIds } = await this.entityViewModel.getRecentlyViewedByUser(
            { userId },
            tx
        );
        return [...accommodationIds];
    }

    /**
     * Returns the actor's recent search-filter sets, capped at
     * {@link SEARCH_HISTORY_CAP} (spec §5.2: last 30 days, cap 10 — the model
     * enforces the 30-day recency by construction: entries are hard-deleted
     * beyond a much larger global cap, but `SearchHistoryService.list` reads
     * "most recent N" which is what the profile builder needs here).
     *
     * Degradable signal (spec §5.2): a failure — or simply the actor having
     * no search history yet — resolves to an empty array rather than failing
     * the whole feed request. Errors are logged, never thrown.
     */
    private async resolveSearchHistoryFilters(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<SearchHistoryFilters[]> {
        try {
            const result = await this.searchHistoryService.list(
                actor,
                { planLimit: SEARCH_HISTORY_CAP },
                ctx
            );
            if (result.error || !result.data) {
                this.logger.warn(
                    { actorId: actor.id, error: result.error?.message },
                    'RecommendationService.getFeed: search history unavailable, degrading to no signal'
                );
                return [];
            }
            return result.data.items
                .map((entry) => entry.filtersJson)
                .filter((filters): filters is SearchHistoryFilters => filters !== null);
        } catch (error) {
            this.logger.warn(
                {
                    actorId: actor.id,
                    error: error instanceof Error ? error.message : String(error)
                },
                'RecommendationService.getFeed: unexpected search history error, degrading to no signal'
            );
            return [];
        }
    }

    // -------------------------------------------------------------------------
    // Candidate resolution
    // -------------------------------------------------------------------------

    /**
     * Resolves the profile-signal candidates (favorites + recently-viewed) in
     * ONE batched query — no privacy/media projection, since these are used
     * only to build the profile and are never returned to the client.
     *
     * Mutates `destinationPaths` in place with every resolved candidate's
     * destination path, so the pool resolution and this call share one
     * accumulator instead of requiring a second merge pass.
     */
    private async resolveSignalCandidates(
        ids: readonly string[],
        destinationPaths: Record<string, string>,
        tx?: DrizzleClient
    ): Promise<Map<string, RecommendationCandidateAccommodation>> {
        const result = new Map<string, RecommendationCandidateAccommodation>();
        if (ids.length === 0) return result;

        const { items } = await this.accommodationModel.findAllWithRelations(
            { destination: true, amenities: true },
            { deletedAt: null },
            { page: 1, pageSize: ids.length },
            [inArray(accommodations.id, [...ids])],
            tx
        );

        for (const row of items as JoinedAccommodationRow[]) {
            const mapped = this.mapRowToCandidate(row);
            if (!mapped) continue;
            result.set(mapped.candidate.id, mapped.candidate);
            if (mapped.destinationPath) {
                destinationPaths[mapped.candidate.destinationId] = mapped.destinationPath;
            }
        }

        return result;
    }

    /**
     * Projects the candidate pool rows (already sourced from `findTopRated`)
     * into privacy-aware, media-composed {@link RecommendationCandidateAccommodation}
     * objects — these DO reach the client, so the same location-privacy
     * (SPEC-097) and relational media composition (SPEC-204) applied by the
     * standard accommodation read paths must apply here too.
     *
     * Mutates `destinationPaths` in place (see {@link resolveSignalCandidates}).
     */
    private async resolvePoolCandidates(
        rows: readonly JoinedAccommodationRow[],
        actor: Actor,
        destinationPaths: Record<string, string>,
        tx?: DrizzleClient
    ): Promise<RecommendationCandidateAccommodation[]> {
        if (rows.length === 0) return [];

        const withMedia = await attachComposedMediaList({
            // TYPE-WORKAROUND: JoinedAccommodationRow carries eager-loaded destination/
            // amenities relations on top of the base Accommodation row; attachComposedMediaList
            // only reads the base Accommodation fields (id, media) and ignores the extra
            // relation keys, so the shapes are structurally compatible at runtime.
            items: rows as unknown as Accommodation[],
            mediaModel: this.accommodationMediaModel,
            tx
        });

        const salt = this.getLocationSalt();
        const withPrivacy = salt
            ? applyAccommodationLocationPrivacyList(withMedia, { actor, salt })
            : withMedia;

        const candidates: RecommendationCandidateAccommodation[] = [];
        for (const row of withPrivacy as JoinedAccommodationRow[]) {
            const mapped = this.mapRowToCandidate(row);
            if (!mapped) continue;
            candidates.push(mapped.candidate);
            if (mapped.destinationPath) {
                destinationPaths[mapped.candidate.destinationId] = mapped.destinationPath;
            }
        }

        return candidates;
    }

    /**
     * Maps one joined accommodation row to a {@link RecommendationCandidateAccommodation}.
     *
     * Returns `null` for rows missing `location` — `AccommodationSummarySchema`
     * requires it, but a handful of legacy/draft rows can have it unset (the
     * same defensive check exists in `AccommodationService.getSummary`); such
     * rows are silently excluded rather than crashing the whole feed.
     */
    private mapRowToCandidate(row: JoinedAccommodationRow): MappedCandidate | null {
        if (!row.location) return null;

        const amenityIds = (row.amenities ?? [])
            .map((relation) => relation.amenityId)
            .filter((id): id is string => typeof id === 'string');

        const candidate: RecommendationCandidateAccommodation = {
            id: row.id,
            name: row.name,
            slug: row.slug,
            summary: row.summary,
            type: row.type,
            price: row.price,
            location: row.location,
            media: row.media,
            isFeatured: row.isFeatured,
            ownerId: row.ownerId,
            reviewsCount: row.reviewsCount ?? 0,
            averageRating: row.averageRating ?? 0,
            destinationId: row.destinationId,
            amenityIds,
            ...(row.approximateLocation !== undefined
                ? { approximateLocation: row.approximateLocation }
                : {})
        };

        return {
            candidate,
            ...(row.destination?.path ? { destinationPath: row.destination.path } : {})
        };
    }

    /**
     * Reorders/filters a resolved candidate map back into the original id
     * order, dropping ids that failed to resolve (soft-deleted, missing
     * location, etc. — see {@link mapRowToCandidate}).
     */
    private pickCandidates(
        ids: readonly string[],
        byId: ReadonlyMap<string, RecommendationCandidateAccommodation>
    ): RecommendationCandidateAccommodation[] {
        const result: RecommendationCandidateAccommodation[] = [];
        for (const id of ids) {
            const candidate = byId.get(id);
            if (candidate) result.push(candidate);
        }
        return result;
    }

    /**
     * Batch-resolves the materialized `path` for any destination ID not
     * already present in `destinationPaths` (typically a destination the
     * actor searched for but that isn't the destination of any candidate in
     * the pool or the known-signal set), and merges the result in place.
     *
     * Single query via `DestinationModel.findByIds` — no N+1 regardless of
     * how many distinct preferred destinations the profile carries.
     */
    private async fillMissingDestinationPaths(
        destinationPaths: Record<string, string>,
        neededIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<void> {
        const missing = Array.from(new Set(neededIds.filter((id) => !(id in destinationPaths))));
        if (missing.length === 0) return;

        const rows = await this.destinationModel.findByIds(missing, tx);
        for (const row of rows) {
            if (row.path) destinationPaths[row.id] = row.path;
        }
    }

    /**
     * Reads the location obfuscation salt from the environment. Returns
     * `null` when missing/too short so unit tests that don't set up env can
     * skip the privacy projection gracefully — mirrors
     * `AccommodationService.getLocationSalt` (production validates the salt
     * at startup, see `apps/api/src/utils/env.ts`).
     */
    private getLocationSalt(): string | null {
        const salt = process.env.HOSPEDA_LOCATION_SALT;
        return salt && salt.length >= 32 ? salt : null;
    }
}
