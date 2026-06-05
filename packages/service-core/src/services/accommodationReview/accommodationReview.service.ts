import { moderateText } from '@repo/content-moderation';
import {
    AccommodationModel,
    AccommodationReviewModel,
    accommodationReviews,
    and,
    eq,
    getDb,
    gte,
    isNull,
    lte
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type AccommodationRatingInput,
    type AccommodationReview,
    AccommodationReviewAdminSearchSchema,
    type AccommodationReviewCreateInput,
    AccommodationReviewCreateInputSchema,
    type AccommodationReviewListByAccommodationParams,
    AccommodationReviewListByAccommodationParamsSchema,
    type AccommodationReviewListWithUserParams,
    AccommodationReviewListWithUserParamsSchema,
    type AccommodationReviewListWrapper,
    type AccommodationReviewSearchParams,
    AccommodationReviewSearchParamsSchema,
    AccommodationReviewUpdateInputSchema,
    type AccommodationReviewWithUserListWrapper,
    type AccommodationReviewsByUserInput,
    AccommodationReviewsByUserSchema,
    type CountResponse,
    type EntityFilters,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { type SQL, sql } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import {
    type Actor,
    type AdminSearchExecuteParams,
    type PaginatedListOutput,
    type ServiceConfig,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
import { AccommodationService } from '../accommodation/accommodation.service';
import { resolveInitialModerationState } from '../moderation/review-moderation.helpers';
import { computeAccommodationReviewAverage } from './accommodationReview.helpers';
import {
    checkCanAdminList,
    checkCanCreateAccommodationReview,
    checkCanDeleteAccommodationReview,
    checkCanModerateAccommodationReview,
    checkCanUpdateAccommodationReview,
    checkCanViewAccommodationReview
} from './accommodationReview.permissions';
import type { AccommodationReviewHookState } from './accommodationReview.types';

/** Entity-specific filter fields for accommodation review admin search. */
type AccommodationReviewEntityFilters = EntityFilters<typeof AccommodationReviewAdminSearchSchema>;

/**
 * Service for managing accommodation reviews.
 * Provides CRUD and domain-specific logic for AccommodationReview entities.
 */
export class AccommodationReviewService extends BaseCrudService<
    AccommodationReview,
    AccommodationReviewModel,
    typeof AccommodationReviewCreateInputSchema,
    typeof AccommodationReviewUpdateInputSchema,
    typeof AccommodationReviewSearchParamsSchema
> {
    static readonly ENTITY_NAME = 'accommodationReview';
    protected readonly entityName = AccommodationReviewService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('accommodation-review-revalidation');
    protected readonly model: AccommodationReviewModel;

    protected readonly createSchema = AccommodationReviewCreateInputSchema;
    protected readonly updateSchema = AccommodationReviewUpdateInputSchema;
    protected readonly searchSchema = AccommodationReviewSearchParamsSchema;

    protected getDefaultListRelations() {
        return {
            user: true,
            accommodation: true
        };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Accommodation reviews are searched by title and content.
     */
    protected override getSearchableColumns(): string[] {
        return ['title', 'content'];
    }

    private accommodationModel = new AccommodationModel();
    private accommodationService: AccommodationService;

    constructor(ctx: ServiceConfig) {
        super(ctx, AccommodationReviewService.ENTITY_NAME);
        this.model = new AccommodationReviewModel();
        this.accommodationService = new AccommodationService(ctx);
        this.adminSearchSchema = AccommodationReviewAdminSearchSchema;
    }

    /**
     * Resolves the accommodation slug for a given accommodationId using the model directly
     * to avoid service-layer permission checks in lifecycle hooks.
     */
    private async _resolveAccommodationSlug(accommodationId: string): Promise<string | undefined> {
        try {
            const accommodation = await this.accommodationModel.findById(accommodationId);
            return accommodation?.slug;
        } catch {
            return undefined;
        }
    }

    protected _canCreate(actor: Actor, _data: AccommodationReviewCreateInput): void {
        checkCanCreateAccommodationReview(actor);
    }
    protected _canUpdate(actor: Actor, _entity: AccommodationReview): void {
        checkCanUpdateAccommodationReview(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: AccommodationReview): void {
        checkCanDeleteAccommodationReview(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: AccommodationReview): void {
        checkCanDeleteAccommodationReview(actor);
    }
    protected _canRestore(actor: Actor, _entity: AccommodationReview): void {
        checkCanUpdateAccommodationReview(actor);
    }
    protected _canView(actor: Actor, _entity: AccommodationReview): void {
        checkCanViewAccommodationReview(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewAccommodationReview(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewAccommodationReview(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewAccommodationReview(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: AccommodationReview,
        _newVisibility: unknown
    ): void {
        checkCanUpdateAccommodationReview(actor);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }
    protected async _executeSearch(
        params: AccommodationReviewSearchParams,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<AccommodationReview>> {
        const { page, pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = params;
        // Force-override lifecycleState=ACTIVE and moderationState=APPROVED:
        // defense-in-depth for public paths (GAP-004 / SPEC-063-gaps T-005,
        // SPEC-166 T-022). PENDING/REJECTED reviews must never surface on public
        // reads. sortBy/sortOrder are stripped to prevent WHERE-clause leak
        // (regression covered by test/services/where-leak.regression.test.ts).
        (filters as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        (filters as Record<string, unknown>).moderationState = ModerationStatusEnum.APPROVED;
        return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    }

    protected async _executeCount(
        params: AccommodationReviewSearchParams,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<CountResponse> {
        const {
            page: _p,
            pageSize: _ps,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            ...filters
        } = params;
        // Mirror _executeSearch force-overrides so pagination `total` stays
        // consistent with the filtered items on public endpoints (SPEC-166 T-022).
        // sortBy/sortOrder also stripped to prevent WHERE-clause leak.
        (filters as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        (filters as Record<string, unknown>).moderationState = ModerationStatusEnum.APPROVED;
        const count = await this.model.count({ ...filters, deletedAt: null });
        return { count };
    }

    /**
     * Overrides the base admin search to handle rating range filters (minRating, maxRating).
     * These filters require SQL conditions against the numeric `averageRating` column
     * and cannot be handled by the generic where-clause builder.
     *
     * @param params - The admin search parameters assembled by `adminList()`.
     * @returns A paginated list of accommodation reviews matching the filters.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<AccommodationReviewEntityFilters>
    ): Promise<PaginatedListOutput<AccommodationReview>> {
        const { entityFilters, ...rest } = params;
        const { minRating, maxRating, ...simpleFilters } = entityFilters;

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minRating !== undefined) {
            extraConditions.push(gte(accommodationReviews.averageRating, minRating));
        }
        if (maxRating !== undefined) {
            extraConditions.push(lte(accommodationReviews.averageRating, maxRating));
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }

    /**
     * Recalculates and updates the stats (reviewsCount, averageRating, rating) for the given accommodation.
     * Uses a direct SQL aggregate query to avoid pagination limits that could truncate results.
     * @param accommodationId - The ID of the accommodation to update stats for
     * @param tx - Optional transaction client to propagate DB writes into an existing transaction
     */
    private async recalculateAndUpdateAccommodationStats(
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<void> {
        const db = tx ?? getDb();
        const table = accommodationReviews;

        const result = await db
            .select({
                reviewsCount: sql<number>`count(*)::int`,
                avgCleanliness: sql<number>`coalesce(avg((${table.rating}->>'cleanliness')::numeric), 0)::float`,
                avgHospitality: sql<number>`coalesce(avg((${table.rating}->>'hospitality')::numeric), 0)::float`,
                avgServices: sql<number>`coalesce(avg((${table.rating}->>'services')::numeric), 0)::float`,
                avgAccuracy: sql<number>`coalesce(avg((${table.rating}->>'accuracy')::numeric), 0)::float`,
                avgCommunication: sql<number>`coalesce(avg((${table.rating}->>'communication')::numeric), 0)::float`,
                avgLocation: sql<number>`coalesce(avg((${table.rating}->>'location')::numeric), 0)::float`
            })
            .from(table)
            .where(and(eq(table.accommodationId, accommodationId), isNull(table.deletedAt)));

        const row = result[0];
        const reviewsCount = row?.reviewsCount ?? 0;

        const rating: AccommodationRatingInput = {
            cleanliness: row?.avgCleanliness ?? 0,
            hospitality: row?.avgHospitality ?? 0,
            services: row?.avgServices ?? 0,
            accuracy: row?.avgAccuracy ?? 0,
            communication: row?.avgCommunication ?? 0,
            location: row?.avgLocation ?? 0
        };

        const ratingValues = Object.values(rating);
        const averageRating =
            ratingValues.length > 0
                ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
                : 0;

        await this.accommodationService.updateStatsFromReview(
            accommodationId,
            { reviewsCount, averageRating, rating },
            tx ? { tx } : undefined
        );
    }

    /**
     * Enforces one review per user per accommodation, then runs the content-moderation
     * check and resolves the initial `moderationState` for the new review.
     *
     * Decision logic (spec §3.1 + §3.2):
     * - The review text (`content` or `title`) is passed through
     *   `@repo/content-moderation/moderateText`.
     * - The returned score + entity type (`accommodation`) + verification level
     *   (`semi`) are fed into `resolveInitialModerationState` which returns
     *   `APPROVED` for clean text and `PENDING` when a blocked term is detected.
     *
     * The `moderationState` is injected into the returned data object so the
     * base create path persists it with the new row.
     *
     * @throws {ServiceError} ALREADY_EXISTS if the user already has a review.
     */
    protected async _beforeCreate(
        data: AccommodationReviewCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<AccommodationReview>> {
        const existing = await this.model.findOne({
            userId: data.userId,
            accommodationId: data.accommodationId,
            deletedAt: null
        });
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You have already submitted a review for this accommodation.'
            );
        }

        // Content-moderation check — use combined text if available.
        const reviewText = [data.title, data.content].filter(Boolean).join(' ') || '';
        const moderationResult = reviewText
            ? await moderateText({ text: reviewText, context: 'review' })
            : { score: 0 };

        const moderationState = resolveInitialModerationState({
            entityType: 'accommodation',
            verificationLevel: 'semi',
            moderationScore: moderationResult.score
        });

        return { ...data, moderationState };
    }

    /**
     * Approves or rejects an accommodation review (admin moderation action).
     *
     * Sets `moderationState`, `moderatedById`, `moderatedAt`, and optionally
     * `moderationReason` on the review. Does NOT touch `lifecycleState` — the
     * two fields are orthogonal (spec §3.4).
     *
     * Permission gate: {@link PermissionEnum.ACCOMMODATION_REVIEW_MODERATE}.
     *
     * @param input.id - UUID of the review to moderate.
     * @param input.decision - `APPROVED` or `REJECTED`.
     * @param input.reason - Optional free-text reason (required for REJECTED by convention).
     * @param input.actor - The moderating actor.
     * @returns The updated review, or an error output.
     *
     * @example
     * ```ts
     * const result = await service.moderateReview({
     *   id: reviewId,
     *   decision: ModerationStatusEnum.APPROVED,
     *   actor,
     * });
     * ```
     */
    public async moderateReview(input: {
        readonly id: string;
        readonly decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
        readonly reason?: string;
        readonly actor: Actor;
    }): Promise<ServiceOutput<AccommodationReview>> {
        const { id, decision, reason, actor } = input;
        try {
            checkCanModerateAccommodationReview(actor);

            const existing = await this.model.findById(id);
            if (!existing) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Accommodation review not found: ${id}`
                );
            }

            const updated = await this.model.update(
                { id },
                {
                    moderationState: decision,
                    moderatedById: actor.id,
                    moderatedAt: new Date(),
                    moderationReason: reason ?? null
                }
            );

            if (!updated) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Accommodation review not found after update: ${id}`
                );
            }

            return { data: updated };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message } };
            }
            const message = err instanceof Error ? err.message : String(err);
            return { error: { code: ServiceErrorCode.INTERNAL_ERROR, message } };
        }
    }

    /**
     * Returns the count of accommodation reviews in `PENDING` moderation state.
     *
     * Only non-deleted rows are counted. Permission gate:
     * {@link PermissionEnum.ACCOMMODATION_REVIEW_MODERATE}.
     *
     * @param input.actor - The requesting actor. Must hold the moderate permission.
     * @returns `{ count: number }` wrapped in `ServiceOutput`.
     */
    public async getPendingCount(input: {
        readonly actor: Actor;
    }): Promise<ServiceOutput<CountResponse>> {
        const { actor } = input;
        try {
            checkCanModerateAccommodationReview(actor);

            const count = await this.model.count({
                moderationState: ModerationStatusEnum.PENDING,
                deletedAt: null
            });

            return { data: { count } };
        } catch (err) {
            if (err instanceof ServiceError) {
                return { error: { code: err.code, message: err.message } };
            }
            const message = err instanceof Error ? err.message : String(err);
            return { error: { code: ServiceErrorCode.INTERNAL_ERROR, message } };
        }
    }

    /**
     * Computes the per-review average from the JSONB rating dimensions
     * (cleanliness, hospitality, services, accuracy, communication, location)
     * and persists it to the review's averageRating column.
     * @param entity - The accommodation review entity
     * @param tx - Optional transaction client to propagate DB writes into an existing transaction
     */
    private async computeAndStoreReviewAverage(
        entity: AccommodationReview,
        tx?: DrizzleClient
    ): Promise<void> {
        const avg = computeAccommodationReviewAverage(entity.rating);
        const roundedAvg = Math.round(avg * 100) / 100;
        await this.model.updateById(entity.id, { averageRating: roundedAvg }, tx);
    }

    protected async _afterCreate(
        entity: AccommodationReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<AccommodationReview> {
        await this.computeAndStoreReviewAverage(entity, ctx?.tx);
        await this.recalculateAndUpdateAccommodationStats(entity.accommodationId, ctx?.tx);
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return entity;
    }

    protected async _afterUpdate(
        entity: AccommodationReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<AccommodationReview> {
        await this.computeAndStoreReviewAverage(entity, ctx?.tx);
        await this.recalculateAndUpdateAccommodationStats(entity.accommodationId, ctx?.tx);
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: AccommodationReview,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<AccommodationReview> {
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return entity;
    }

    /**
     * Captures the accommodationId before soft delete so stats can be recalculated after deletion.
     */
    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.deletedAccommodationId = review?.accommodationId;
        }
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<CountResponse> {
        const deletedAccommodationId = ctx.hookState?.deletedAccommodationId;
        if (deletedAccommodationId) {
            await this.recalculateAndUpdateAccommodationStats(deletedAccommodationId, ctx.tx);
        }
        const accommodationSlug = deletedAccommodationId
            ? await this._resolveAccommodationSlug(deletedAccommodationId)
            : undefined;
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.deletedAccommodationId = review?.accommodationId;
        }
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<CountResponse> {
        const deletedAccommodationId = ctx.hookState?.deletedAccommodationId;
        if (deletedAccommodationId) {
            await this.recalculateAndUpdateAccommodationStats(deletedAccommodationId, ctx.tx);
        }
        const accommodationSlug = deletedAccommodationId
            ? await this._resolveAccommodationSlug(deletedAccommodationId)
            : undefined;
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.restoredAccommodationId = review?.accommodationId;
        }
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<AccommodationReviewHookState>
    ): Promise<{ count: number }> {
        const restoredAccommodationId = ctx.hookState?.restoredAccommodationId;
        if (restoredAccommodationId) {
            await this.recalculateAndUpdateAccommodationStats(restoredAccommodationId, ctx.tx);
        }
        const accommodationSlug = restoredAccommodationId
            ? await this._resolveAccommodationSlug(restoredAccommodationId)
            : undefined;
        this._scheduleAccommodationRevalidation(accommodationSlug);
        return result;
    }

    /**
     * Schedules a non-blocking revalidation for the accommodation_review entity.
     * Swallows revalidation-service failures (network/missing service) and warns
     * via the dedicated revalidation logger so the caller's transaction is never
     * disturbed by a downstream cache miss.
     *
     * Extracted from 6 inlined copies in lifecycle hooks (T-033 / GAP-040).
     */
    private _scheduleAccommodationRevalidation(accommodationSlug: string | undefined): void {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'accommodation_review',
                accommodationSlug
            });
        } catch (error) {
            AccommodationReviewService.revalidationLogger.warn(
                { error, entityType: 'accommodation_review' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
    }

    /**
     * Gets paginated reviews for a specific accommodation.
     *
     * Validates permissions via `_canList` and returns only non-deleted reviews.
     * By default, the result set is restricted to records in `lifecycleState: ACTIVE`
     * so the public tier never leaks DRAFT/ARCHIVED reviews (GAP-001 / SPEC-063-gaps).
     * Callers that legitimately need the full set (e.g. an owner's "my reviews" view
     * that includes drafts) can opt in by passing `opts.includeAllStates: true`.
     *
     * The `includeAllStates` flag is deliberately NOT part of the validated schema —
     * it is a server-side control flag supplied by the calling route, not an HTTP
     * query param, so a public client cannot set it.
     *
     * @param actor - The actor performing the action
     * @param input - Object containing accommodationId and optional pagination
     * @param opts - Server-side control options (not exposed via HTTP)
     * @param ctx - Optional service context for transaction propagation
     * @returns Paginated list of reviews for the accommodation wrapped in consistent format
     */
    public async listByAccommodation(
        actor: Actor,
        input: AccommodationReviewListByAccommodationParams,
        opts?: { includeAllStates?: boolean },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationReviewListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByAccommodation',
            input: { ...input, actor },
            schema: AccommodationReviewListByAccommodationParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { accommodationId, page, pageSize } = validated;
                const baseWhere: Record<string, unknown> = {
                    accommodationId,
                    deletedAt: null
                };
                if (!opts?.includeAllStates) {
                    // SPEC-166 T-022: public visibility = ACTIVE + APPROVED only.
                    // PENDING / REJECTED reviews must not surface to public readers.
                    baseWhere.lifecycleState = LifecycleStatusEnum.ACTIVE;
                    baseWhere.moderationState = ModerationStatusEnum.APPROVED;
                }
                const result = await this.model.findAll(
                    baseWhere,
                    { page, pageSize },
                    undefined,
                    ctx?.tx
                );

                // Wrap the result in consistent format with total for pagination
                const accommodationReviews = Array.isArray(result.items) ? result.items : [];

                return { accommodationReviews, total: result.total };
            }
        });
    }

    /**
     * Gets paginated reviews for a specific user.
     * Validates permissions via _canList and returns only non-deleted reviews.
     * @param actor - The actor performing the action
     * @param input - Object containing userId and optional pagination/filter params
     * @param ctx - Optional service context for transaction propagation
     * @returns Paginated list of reviews by user wrapped in consistent format
     */
    public async listByUser(
        actor: Actor,
        input: AccommodationReviewsByUserInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationReviewListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByUser',
            input: { ...input, actor },
            schema: AccommodationReviewsByUserSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { userId, page, pageSize, accommodationId } = validated;
                const filters: Record<string, unknown> = { userId, deletedAt: null };
                if (accommodationId) {
                    filters.accommodationId = accommodationId;
                }
                const result = await this.model.findAll(
                    filters,
                    { page, pageSize },
                    undefined,
                    ctx?.tx
                );

                const accommodationReviews = Array.isArray(result.items) ? result.items : [];

                return { accommodationReviews, total: result.total };
            }
        });
    }

    /**
     * Gets paginated reviews with user information included.
     * Validates permissions via _canList and returns reviews with user data.
     * @param actor - The actor performing the action
     * @param input - Object containing optional pagination and filters
     * @param ctx - Optional service context for transaction propagation
     * @returns Paginated list of reviews with user information wrapped in consistent format
     */
    public async listWithUser(
        actor: Actor,
        input: AccommodationReviewListWithUserParams = { page: 1, pageSize: 10 },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AccommodationReviewWithUserListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { ...input, actor },
            schema: AccommodationReviewListWithUserParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { page = 1, pageSize = 10, ...filterParams } = validated;

                // SPEC-166 T-022: public visibility = ACTIVE + APPROVED only.
                // Caller params are spread first, then forced values are assigned
                // AFTER the spread so no caller-supplied lifecycleState or
                // moderationState can override them (post-spread assignment pattern
                // matching _executeSearch / _executeCount in this file).
                const defaultFilters = {
                    deletedAt: null,
                    ...filterParams
                };
                (defaultFilters as Record<string, unknown>).lifecycleState =
                    LifecycleStatusEnum.ACTIVE;
                (defaultFilters as Record<string, unknown>).moderationState =
                    ModerationStatusEnum.APPROVED;

                const result = await this.model.findAllWithUser(
                    defaultFilters,
                    { page, pageSize },
                    ctx?.tx
                );

                // Wrap the result in consistent format
                const accommodationReviews = Array.isArray(result.items) ? result.items : [];

                return { accommodationReviews };
            }
        });
    }
}
