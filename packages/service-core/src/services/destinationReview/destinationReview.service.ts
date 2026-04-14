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
    type DestinationRatingInput,
    type DestinationReview,
    DestinationReviewAdminSearchSchema,
    type DestinationReviewCreateInput,
    DestinationReviewCreateInputSchema,
    type DestinationReviewListResponse,
    type DestinationReviewListWithUserOutput,
    type DestinationReviewSearchInput,
    DestinationReviewSearchInputSchema,
    DestinationReviewUpdateInputSchema,
    type DestinationReviewsByUserInput,
    DestinationReviewsByUserSchema,
    type EntityFilters
} from '@repo/schemas';
import { type SQL, sql } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { DestinationService } from '../destination/destination.service';
import { computeReviewAverageRating } from './destinationReview.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './destinationReview.normalizers';
import {
    checkCanAdminList,
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
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
    protected normalizers: CrudNormalizersFromSchemas<
        typeof DestinationReviewCreateInputSchema,
        typeof DestinationReviewUpdateInputSchema,
        typeof DestinationReviewSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };
    private destinationModel = new DestinationModel();
    private destinationService: DestinationService;

    constructor(ctx: ServiceConfig) {
        super(ctx, DestinationReviewService.ENTITY_NAME);
        this.model = new DestinationReviewModel();
        this.destinationService = new DestinationService(ctx);
        this.adminSearchSchema = DestinationReviewAdminSearchSchema;
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
        const { page, pageSize, ...filters } = params;
        return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    }

    protected async _executeCount(
        params: DestinationReviewSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { page: _p, pageSize: _ps, ...filters } = params;
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
            .where(and(eq(table.destinationId, destinationId), isNull(table.deletedAt)));

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
            tx
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
        _ctx: ServiceContext
    ): Promise<DestinationReview> {
        // Compute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            },
            _ctx.tx
        );

        await this.recalculateAndUpdateDestinationStats(entity.destinationId, _ctx.tx);
        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
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
        _ctx: ServiceContext
    ): Promise<DestinationReview> {
        // Recompute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            },
            _ctx.tx
        );

        // Recalculate parent destination stats after rating change
        await this.recalculateAndUpdateDestinationStats(entity.destinationId, _ctx.tx);

        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
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
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: DestinationReview,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<DestinationReview> {
        const destinationSlug = await this._resolveDestinationSlug(entity.destinationId);
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
        return result;
    }

    /**
     * Gets paginated reviews for a specific user.
     * Validates permissions via _canList and returns only non-deleted reviews.
     * @param actor - The actor performing the action
     * @param input - Object containing userId and optional pagination/filter params
     * @returns Paginated list of reviews by user with pagination metadata
     */
    public async listByUser(
        actor: Actor,
        input: DestinationReviewsByUserInput
    ): Promise<ServiceOutput<DestinationReviewListResponse>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByUser',
            input: { ...input, actor },
            schema: DestinationReviewsByUserSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { userId, page, pageSize, destinationId } = validated;
                const filters: Record<string, unknown> = { userId, deletedAt: null };
                if (destinationId) {
                    filters.destinationId = destinationId;
                }
                const result = await this.model.findAll(filters, { page, pageSize });

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
     * @returns Paginated list of reviews with user information
     */
    public async listWithUser(
        actor: Actor,
        input: DestinationReviewSearchInput = { page: 1, pageSize: 10 }
    ): Promise<ServiceOutput<DestinationReviewListWithUserOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { actor, ...input },
            schema: DestinationReviewSearchInputSchema,
            execute: async (validData, validatedActor) => {
                await this._canList(validatedActor);
                const { page, pageSize, ...filterParams } = validData;

                // Default filters for public access
                const defaultFilters = {
                    deletedAt: null,
                    ...filterParams
                };

                const result = await this.model.findAllWithUser(defaultFilters, { page, pageSize });
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
}
