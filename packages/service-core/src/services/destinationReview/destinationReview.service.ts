import { moderateText } from '@repo/content-moderation';
import {
    DestinationModel,
    DestinationReviewModel,
    and,
    destinationReviews,
    eq,
    getDb,
    gte,
    isNull,
    lte
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type CountResponse,
    type DestinationRatingInput,
    type DestinationReview,
    DestinationReviewAdminSearchSchema,
    type DestinationReviewCreateInput,
    DestinationReviewCreateInputSchema,
    type DestinationReviewListByDestinationParams,
    DestinationReviewListByDestinationParamsSchema,
    type DestinationReviewListResponse,
    type DestinationReviewListWithUserOutput,
    type DestinationReviewSearchInput,
    DestinationReviewSearchInputSchema,
    DestinationReviewUpdateInputSchema,
    type DestinationReviewsByUserInput,
    DestinationReviewsByUserSchema,
    type EntityFilters,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { type SQL, sql } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { getThresholdForContext } from '../contentModeration/get-threshold-for-context';
import { DestinationService } from '../destination/destination.service';
import { resolveInitialModerationState } from '../moderation/review-moderation.helpers';
import { computeReviewAverageRating } from './destinationReview.helpers';
import {
    checkCanAdminList,
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
    checkCanModerateDestinationReview,
    checkCanUpdateDestinationReview,
    checkCanViewDestinationReview
} from './destinationReview.permissions';
import type { DestinationReviewHookState } from './destinationReview.types';

/** Entity-specific filter fields for destination review admin search. */
type DestinationReviewEntityFilters = EntityFilters<typeof DestinationReviewAdminSearchSchema>;

/**
 * Service for managing destination reviews.
 * Provides CRUD and domain-specific logic for DestinationReview entities.
 */
export class DestinationReviewService extends BaseCrudService<
    DestinationReview,
    DestinationReviewModel,
    typeof DestinationReviewCreateInputSchema,
    typeof DestinationReviewUpdateInputSchema,
    typeof DestinationReviewSearchInputSchema
> {
    static readonly ENTITY_NAME = 'destinationReview';
    protected readonly entityName = DestinationReviewService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('destination-review-revalidation');
    protected readonly model: DestinationReviewModel;

    protected readonly createSchema = DestinationReviewCreateInputSchema;
    protected readonly updateSchema = DestinationReviewUpdateInputSchema;
    protected readonly searchSchema = DestinationReviewSearchInputSchema;

    protected getDefaultListRelations() {
        return { user: true, destination: true };
    }

    /**
     * Returns the columns to search against when the `search` query param is provided.
     * Destination reviews are searched by title and content.
     */
    protected override getSearchableColumns(): string[] {
        return ['title', 'content'];
    }
    private destinationModel = new DestinationModel();
    private destinationService: DestinationService;

    constructor(ctx: ServiceConfig) {
        super(ctx, DestinationReviewService.ENTITY_NAME);
        this.model = new DestinationReviewModel();
        this.destinationService = new DestinationService(ctx);
        this.adminSearchSchema = DestinationReviewAdminSearchSchema;
    }

    /**
     * Schedules a non-blocking revalidation for the destination_review entity.
     * Swallows revalidation-service failures and warns via the dedicated logger
     * so the caller's transaction is never disturbed by a downstream cache miss.
     *
     * Extracted from 6 inlined copies in lifecycle hooks (T-033 / GAP-040).
     */
    private _scheduleDestinationRevalidation(destinationSlug: string | undefined): void {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'destination_review',
                destinationSlug
            });
        } catch (error) {
            DestinationReviewService.revalidationLogger.warn(
                { error, entityType: 'destination_review' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
    }

    /**
     * Resolves the destination slug for a given destinationId using the model directly
     * to avoid service-layer permission checks in lifecycle hooks.
     */
    private async _resolveDestinationSlug(destinationId: string): Promise<string | undefined> {
        try {
            const destination = await this.destinationModel.findById(destinationId);
            return destination?.slug;
        } catch {
            return undefined;
        }
    }

    /**
     * Enforces one review per user per destination, then runs the content-moderation
     * check and resolves the initial `moderationState` for the new destination review.
     *
     * Decision logic (spec §3.1 + §3.2):
     * - Destination reviews are unverified (anyone can write) → base default is PENDING.
     * - If the review text contains a blocked term (score >= threshold), the state is
     *   PENDING regardless (same result but driven by content-mod, not entity default).
     * - Clean text with no blocked terms → entity default PENDING.
     *
     * The `moderationState` is injected into the returned data object so the base
     * create path persists it with the new row.
     *
     * @throws {ServiceError} ALREADY_EXISTS if the user already has a review for this destination.
     */
    protected async _beforeCreate(
        data: DestinationReviewCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<DestinationReview>> {
        // Soft-deleted reviews are intentionally INCLUDED in this check: the DB unique
        // index on (user_id, destination_id) is plain (no deleted_at predicate), so a
        // soft-deleted row would still reject the insert. Matching the index here turns
        // that case into a clean 409 instead of an unhandled constraint violation (500).
        const existing = await this.model.findOne({
            userId: data.userId,
            destinationId: data.destinationId
        });
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You have already submitted a review for this destination.'
            );
        }

        // Content-moderation check — use combined text if available.
        const reviewText = [data.title, data.content].filter(Boolean).join(' ') || '';
        const [moderationResult, thresholds] = await Promise.all([
            reviewText
                ? moderateText({ text: reviewText, context: 'review' })
                : Promise.resolve({ score: 0 }),
            getThresholdForContext({ context: 'review' })
        ]);

        const moderationState = resolveInitialModerationState({
            entityType: 'destination',
            verificationLevel: 'none',
            moderationScore: moderationResult.score,
            pendingThreshold: thresholds.pending
        });

        return { ...data, moderationState };
    }

    protected _canCreate(actor: Actor, _data: DestinationReviewCreateInput): void {
        checkCanCreateDestinationReview(actor);
    }
    protected _canUpdate(actor: Actor, _entity: DestinationReview): void {
        checkCanUpdateDestinationReview(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: DestinationReview): void {
        checkCanDeleteDestinationReview(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: DestinationReview): void {
        checkCanDeleteDestinationReview(actor);
    }
    protected _canRestore(actor: Actor, _entity: DestinationReview): void {
        checkCanUpdateDestinationReview(actor);
    }
    protected _canView(actor: Actor, _entity: DestinationReview): void {
        checkCanViewDestinationReview(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewDestinationReview(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewDestinationReview(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewDestinationReview(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: DestinationReview,
        _newVisibility: unknown
    ): void {
        checkCanUpdateDestinationReview(actor);
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
        params: DestinationReviewSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<DestinationReview>> {
        const { page, pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = params;
        // Force-override lifecycleState=ACTIVE and moderationState=APPROVED:
        // defense-in-depth for public paths (GAP-003 / SPEC-063-gaps T-004,
        // SPEC-166 T-023). PENDING/REJECTED reviews must never surface on public
        // reads. sortBy/sortOrder are stripped to prevent WHERE-clause leak
        // (regression covered by test/services/where-leak.regression.test.ts).
        (filters as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
        (filters as Record<string, unknown>).moderationState = ModerationStatusEnum.APPROVED;
        return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    }

    protected async _executeCount(
        params: DestinationReviewSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const {
            page: _p,
            pageSize: _ps,
            sortBy: _sortBy,
            sortOrder: _sortOrder,
            ...filters
        } = params;
        // Mirror _executeSearch force-overrides so pagination `total` stays
        // consistent with the filtered items on public endpoints (SPEC-166 T-023).
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
     * @returns A paginated list of destination reviews matching the filters.
     */
    protected override async _executeAdminSearch(
        params: AdminSearchExecuteParams<DestinationReviewEntityFilters>
    ): Promise<PaginatedListOutput<DestinationReview>> {
        const { entityFilters, ...rest } = params;
        const { minRating, maxRating, ...simpleFilters } = entityFilters;

        const extraConditions: SQL[] = [...(params.extraConditions ?? [])];

        if (minRating !== undefined) {
            extraConditions.push(gte(destinationReviews.averageRating, minRating));
        }
        if (maxRating !== undefined) {
            extraConditions.push(lte(destinationReviews.averageRating, maxRating));
        }

        return super._executeAdminSearch({
            ...rest,
            entityFilters: simpleFilters,
            extraConditions
        });
    }

    /**
     * Recalculates and updates the stats (reviewsCount, averageRating, rating) for the given destination.
     * Uses a direct SQL aggregate query to avoid pagination limits that could truncate results.
     *
     * Only APPROVED, non-deleted reviews count — public stats must match the
     * public list, which filters by moderation state. PENDING and REJECTED
     * reviews are excluded (moderateReview re-runs this on every decision).
     *
     * @param destinationId - The ID of the destination whose stats need updating
     * @param tx - Optional transaction client for atomic multi-step operations
     */
    private async recalculateAndUpdateDestinationStats(
        destinationId: string,
        tx?: DrizzleClient
    ): Promise<void> {
        const db = tx ?? getDb();
        const table = destinationReviews;

        const result = await db
            .select({
                reviewsCount: sql<number>`count(*)::int`,
                avgLandscape: sql<number>`coalesce(avg((${table.rating}->>'landscape')::numeric), 0)::float`,
                avgAttractions: sql<number>`coalesce(avg((${table.rating}->>'attractions')::numeric), 0)::float`,
                avgAccessibility: sql<number>`coalesce(avg((${table.rating}->>'accessibility')::numeric), 0)::float`,
                avgSafety: sql<number>`coalesce(avg((${table.rating}->>'safety')::numeric), 0)::float`,
                avgCleanliness: sql<number>`coalesce(avg((${table.rating}->>'cleanliness')::numeric), 0)::float`,
                avgHospitality: sql<number>`coalesce(avg((${table.rating}->>'hospitality')::numeric), 0)::float`,
                avgCulturalOffer: sql<number>`coalesce(avg((${table.rating}->>'culturalOffer')::numeric), 0)::float`,
                avgGastronomy: sql<number>`coalesce(avg((${table.rating}->>'gastronomy')::numeric), 0)::float`,
                avgAffordability: sql<number>`coalesce(avg((${table.rating}->>'affordability')::numeric), 0)::float`,
                avgNightlife: sql<number>`coalesce(avg((${table.rating}->>'nightlife')::numeric), 0)::float`,
                avgInfrastructure: sql<number>`coalesce(avg((${table.rating}->>'infrastructure')::numeric), 0)::float`,
                avgEnvironmentalCare: sql<number>`coalesce(avg((${table.rating}->>'environmentalCare')::numeric), 0)::float`,
                avgWifiAvailability: sql<number>`coalesce(avg((${table.rating}->>'wifiAvailability')::numeric), 0)::float`,
                avgShopping: sql<number>`coalesce(avg((${table.rating}->>'shopping')::numeric), 0)::float`,
                avgBeaches: sql<number>`coalesce(avg((${table.rating}->>'beaches')::numeric), 0)::float`,
                avgGreenSpaces: sql<number>`coalesce(avg((${table.rating}->>'greenSpaces')::numeric), 0)::float`,
                avgLocalEvents: sql<number>`coalesce(avg((${table.rating}->>'localEvents')::numeric), 0)::float`,
                avgWeatherSatisfaction: sql<number>`coalesce(avg((${table.rating}->>'weatherSatisfaction')::numeric), 0)::float`
            })
            .from(table)
            .where(
                and(
                    eq(table.destinationId, destinationId),
                    eq(table.moderationState, ModerationStatusEnum.APPROVED),
                    isNull(table.deletedAt)
                )
            );

        const row = result[0];
        const reviewsCount = row?.reviewsCount ?? 0;

        const rating: DestinationRatingInput = {
            landscape: row?.avgLandscape ?? 0,
            attractions: row?.avgAttractions ?? 0,
            accessibility: row?.avgAccessibility ?? 0,
            safety: row?.avgSafety ?? 0,
            cleanliness: row?.avgCleanliness ?? 0,
            hospitality: row?.avgHospitality ?? 0,
            culturalOffer: row?.avgCulturalOffer ?? 0,
            gastronomy: row?.avgGastronomy ?? 0,
            affordability: row?.avgAffordability ?? 0,
            nightlife: row?.avgNightlife ?? 0,
            infrastructure: row?.avgInfrastructure ?? 0,
            environmentalCare: row?.avgEnvironmentalCare ?? 0,
            wifiAvailability: row?.avgWifiAvailability ?? 0,
            shopping: row?.avgShopping ?? 0,
            beaches: row?.avgBeaches ?? 0,
            greenSpaces: row?.avgGreenSpaces ?? 0,
            localEvents: row?.avgLocalEvents ?? 0,
            weatherSatisfaction: row?.avgWeatherSatisfaction ?? 0
        };

        const ratingValues = Object.values(rating);
        const averageRating =
            ratingValues.length > 0
                ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
                : 0;

        await this.destinationService.updateStatsFromReview(
            destinationId,
            { reviewsCount, averageRating, rating },
            tx ? { tx } : undefined
        );
    }

    /**
     * @param entity - The newly created review entity.
     * @param _actor - The actor who performed the create.
     * @param _tx - Optional transaction client. When provided, stat updates run within the transaction.
     */
    protected async _afterCreate(
        entity: DestinationReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<DestinationReview> {
        // Compute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            },
            ctx?.tx
        );

        await this.recalculateAndUpdateDestinationStats(entity.destinationId, ctx?.tx);
        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
        this._scheduleDestinationRevalidation(destinationSlug);
        return entity;
    }

    /**
     * @param entity - The updated review entity.
     * @param _actor - The actor who performed the update.
     * @param _tx - Optional transaction client. When provided, stat updates run within the transaction.
     */
    protected async _afterUpdate(
        entity: DestinationReview,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<DestinationReview> {
        // Recompute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            },
            ctx?.tx
        );

        // Recalculate parent destination stats after rating change
        await this.recalculateAndUpdateDestinationStats(entity.destinationId, ctx?.tx);

        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
        this._scheduleDestinationRevalidation(destinationSlug);
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: DestinationReview,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<DestinationReview> {
        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
        this._scheduleDestinationRevalidation(destinationSlug);
        return entity;
    }

    /**
     * Captures the destinationId before soft delete so stats can be recalculated after deletion.
     */
    protected async _beforeSoftDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.deletedDestinationId = review?.destinationId;
        }
        return id;
    }

    /**
     * @param result - The soft-delete result with count of affected rows.
     * @param _actor - The actor who performed the soft delete.
     * @param ctx - Service context with hook state for passing data between before/after hooks.
     */
    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<{ count: number }> {
        const deletedDestinationId = ctx.hookState?.deletedDestinationId;
        if (deletedDestinationId) {
            await this.recalculateAndUpdateDestinationStats(deletedDestinationId, ctx.tx);
        }
        const destinationSlug = deletedDestinationId
            ? await this._resolveDestinationSlug(deletedDestinationId)
            : undefined;
        this._scheduleDestinationRevalidation(destinationSlug);
        return result;
    }

    protected async _beforeHardDelete(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.deletedDestinationId = review?.destinationId;
        }
        return id;
    }

    /**
     * @param result - The hard-delete result with count of affected rows.
     * @param _actor - The actor who performed the hard delete.
     * @param ctx - Service context with hook state for passing data between before/after hooks.
     */
    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<{ count: number }> {
        const deletedDestinationId = ctx.hookState?.deletedDestinationId;
        if (deletedDestinationId) {
            await this.recalculateAndUpdateDestinationStats(deletedDestinationId, ctx.tx);
        }
        const destinationSlug = deletedDestinationId
            ? await this._resolveDestinationSlug(deletedDestinationId)
            : undefined;
        this._scheduleDestinationRevalidation(destinationSlug);
        return result;
    }

    protected async _beforeRestore(
        id: string,
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<string> {
        const review = await this.model.findOne({ id });
        if (ctx.hookState) {
            ctx.hookState.restoredDestinationIdForReview = review?.destinationId;
        }
        return id;
    }

    /**
     * @param result - The restore result with count of affected rows.
     * @param _actor - The actor who performed the restore.
     * @param ctx - Service context with hook state for passing data between before/after hooks.
     */
    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        ctx: ServiceContext<DestinationReviewHookState>
    ): Promise<{ count: number }> {
        const restoredDestinationId = ctx.hookState?.restoredDestinationIdForReview;
        if (restoredDestinationId) {
            await this.recalculateAndUpdateDestinationStats(restoredDestinationId, ctx.tx);
        }
        const destinationSlug = restoredDestinationId
            ? await this._resolveDestinationSlug(restoredDestinationId)
            : undefined;
        this._scheduleDestinationRevalidation(destinationSlug);
        return result;
    }

    /**
     * Gets paginated reviews for a specific user.
     * Validates permissions via _canList and returns only non-deleted reviews.
     * @param actor - The actor performing the action
     * @param input - Object containing userId and optional pagination/filter params
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns Paginated list of reviews by user with pagination metadata
     */
    public async listByUser(
        actor: Actor,
        input: DestinationReviewsByUserInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationReviewListResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByUser',
            input: { ...input, actor },
            schema: DestinationReviewsByUserSchema,
            ctx,
            execute: async (validated, validatedActor, resolvedCtx) => {
                await this._canList(validatedActor);
                // Defense-in-depth: actors may only list their own reviews via this
                // method. Admin callers use listWithUser instead.
                if (validated.userId !== validatedActor.id) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Forbidden: cannot list reviews for another user'
                    );
                }
                const { userId, page, pageSize, destinationId } = validated;
                const filters: Record<string, unknown> = { userId, deletedAt: null };
                if (destinationId) {
                    filters.destinationId = destinationId;
                }
                const result = await this.model.findAll(
                    filters,
                    { page, pageSize },
                    undefined,
                    resolvedCtx.tx
                );

                const currentPage = page || 1;
                const currentPageSize = pageSize || 10;
                const totalPages = Math.ceil(result.total / currentPageSize);

                return {
                    data: result.items,
                    pagination: {
                        page: currentPage,
                        pageSize: currentPageSize,
                        total: result.total,
                        totalPages,
                        hasNextPage: currentPage < totalPages,
                        hasPreviousPage: currentPage > 1
                    }
                } as DestinationReviewListResponse;
            }
        });
    }

    /**
     * Gets paginated reviews for a specific destination.
     *
     * Mirrors `AccommodationReviewService.listByAccommodation()`. Validates permissions
     * via `_canList` and returns only non-deleted reviews. By default, the result set
     * is restricted to records in `lifecycleState: ACTIVE` so the public tier never
     * leaks DRAFT/ARCHIVED reviews (GAP-002 / SPEC-063-gaps T-003).
     *
     * The `includeAllStates` flag is a server-side control flag supplied by the
     * calling route — it is NOT part of the validated HTTP schema, so a public
     * client cannot set it.
     *
     * @param actor - The actor performing the action
     * @param input - Object containing destinationId and optional pagination
     * @param opts - Server-side control options (not exposed via HTTP)
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns Paginated list of reviews for the destination with pagination metadata
     */
    public async listByDestination(
        actor: Actor,
        input: DestinationReviewListByDestinationParams,
        opts?: { includeAllStates?: boolean },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationReviewListResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByDestination',
            input: { ...input, actor },
            schema: DestinationReviewListByDestinationParamsSchema,
            ctx,
            execute: async (validated, validatedActor, resolvedCtx) => {
                await this._canList(validatedActor);
                const { destinationId, page, pageSize } = validated;
                const filters: Record<string, unknown> = {
                    destinationId,
                    deletedAt: null
                };
                if (!opts?.includeAllStates) {
                    // SPEC-166 T-023: public visibility = ACTIVE + APPROVED only.
                    // PENDING / REJECTED reviews must not surface to public readers.
                    filters.lifecycleState = LifecycleStatusEnum.ACTIVE;
                    filters.moderationState = ModerationStatusEnum.APPROVED;
                }
                const result = await this.model.findAll(
                    filters,
                    { page, pageSize },
                    undefined,
                    resolvedCtx.tx
                );

                const currentPage = page || 1;
                const currentPageSize = pageSize || 10;
                const totalPages = Math.ceil(result.total / currentPageSize);

                return {
                    data: result.items,
                    pagination: {
                        page: currentPage,
                        pageSize: currentPageSize,
                        total: result.total,
                        totalPages,
                        hasNextPage: currentPage < totalPages,
                        hasPreviousPage: currentPage > 1
                    }
                } as DestinationReviewListResponse;
            }
        });
    }

    /**
     * Gets paginated reviews with user information included.
     * Validates permissions via _canList and returns reviews with user data.
     * @param actor - The actor performing the action
     * @param input - Object containing optional pagination and filters
     * @param ctx - Optional service context. When provided with a transaction, model queries run within it.
     * @returns Paginated list of reviews with user information
     */
    public async listWithUser(
        actor: Actor,
        input: DestinationReviewSearchInput = { page: 1, pageSize: 10 },
        ctx?: ServiceContext
    ): Promise<ServiceOutput<DestinationReviewListWithUserOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { actor, ...input },
            schema: DestinationReviewSearchInputSchema,
            ctx,
            execute: async (validData, validatedActor, resolvedCtx) => {
                await this._canList(validatedActor);
                const { page, pageSize, ...filterParams } = validData;

                // SPEC-166 T-023: public visibility = ACTIVE + APPROVED only.
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
                    resolvedCtx.tx
                );
                const currentPage = page || 1;
                const currentPageSize = pageSize || 10;
                const totalPages = Math.ceil(result.total / currentPageSize);

                return {
                    data: result.items,
                    pagination: {
                        page: currentPage,
                        pageSize: currentPageSize,
                        total: result.total,
                        totalPages,
                        hasNextPage: currentPage < totalPages,
                        hasPreviousPage: currentPage > 1
                    }
                } as DestinationReviewListWithUserOutput;
            }
        });
    }

    /**
     * Approves or rejects a destination review (admin moderation action).
     *
     * Sets `moderationState`, `moderatedById`, `moderatedAt`, and optionally
     * `moderationReason` on the review. Does NOT touch `lifecycleState` — the
     * two fields are orthogonal (spec §3.4).
     *
     * Permission gate: {@link PermissionEnum.DESTINATION_REVIEW_MODERATE}.
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
     *   decision: ModerationStatusEnum.REJECTED,
     *   reason: 'Contains inappropriate content',
     *   actor,
     * });
     * ```
     */
    public async moderateReview(input: {
        readonly id: string;
        readonly decision: ModerationStatusEnum.APPROVED | ModerationStatusEnum.REJECTED;
        readonly reason?: string;
        readonly actor: Actor;
    }): Promise<ServiceOutput<DestinationReview>> {
        const { id, decision, reason, actor } = input;
        try {
            checkCanModerateDestinationReview(actor);

            const existing = await this.model.findById(id);
            if (!existing) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination review not found: ${id}`
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
                    `Destination review not found after update: ${id}`
                );
            }

            // Public stats only count APPROVED reviews, so every moderation
            // decision must re-aggregate and refresh the destination page.
            // Best-effort: a stats/revalidation failure must not undo the
            // moderation decision (the review row is already committed).
            try {
                await this.recalculateAndUpdateDestinationStats(updated.destinationId);
                const destinationSlug = await this._resolveDestinationSlug(updated.destinationId);
                this._scheduleDestinationRevalidation(destinationSlug);
            } catch (statsErr) {
                this.logger.warn(
                    `destinationReview.moderateReview: stats recalculation failed (best-effort, review ${id} already ${decision}): ${statsErr instanceof Error ? statsErr.message : String(statsErr)}`
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
     * Returns the count of destination reviews in `PENDING` moderation state.
     *
     * Only non-deleted rows are counted. Permission gate:
     * {@link PermissionEnum.DESTINATION_REVIEW_MODERATE}.
     *
     * @param input.actor - The requesting actor. Must hold the moderate permission.
     * @returns `{ count: number }` wrapped in `ServiceOutput`.
     */
    public async getPendingCount(input: {
        readonly actor: Actor;
    }): Promise<ServiceOutput<CountResponse>> {
        const { actor } = input;
        try {
            checkCanModerateDestinationReview(actor);

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
}
