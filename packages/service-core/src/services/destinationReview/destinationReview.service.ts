import { DestinationModel, DestinationReviewModel, destinationReviews, gte, lte } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
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
import type { SQL } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { DestinationService } from '../destination/destination.service';
import { calculateStatsFromReviews, computeReviewAverageRating } from './destinationReview.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './destinationReview.normalizers';
import {
    checkCanAdminList,
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
    checkCanUpdateDestinationReview,
    checkCanViewDestinationReview
} from './destinationReview.permissions';

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
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };
    private destinationModel = new DestinationModel();
    private destinationService: DestinationService;

    constructor(ctx: ServiceContext) {
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
        _actor: Actor
    ): Promise<PaginatedListOutput<DestinationReview>> {
        const { page, pageSize, ...filters } = params;
        return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    }

    protected async _executeCount(
        params: DestinationReviewSearchInput,
        _actor: Actor
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
     */
    private async recalculateAndUpdateDestinationStats(destinationId: string): Promise<void> {
        // Get all active reviews for the destination
        const reviews = await this.model
            .findAll({ destinationId, deletedAt: null }, undefined)
            .then((res) => res.items);
        // Usar el helper para calcular los stats
        const stats = calculateStatsFromReviews(reviews as DestinationReview[]);
        // Update stats in Destination via DestinationService
        await this.destinationService.updateStatsFromReview(destinationId, stats);
    }

    protected async _afterCreate(entity: DestinationReview): Promise<DestinationReview> {
        // Compute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            }
        );

        await this.recalculateAndUpdateDestinationStats(entity.destinationId);
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

    protected async _afterUpdate(entity: DestinationReview): Promise<DestinationReview> {
        // Recompute per-review average from JSONB rating dimensions and persist it
        const reviewAvg = computeReviewAverageRating(entity.rating as Record<string, unknown>);
        await this.model.update(
            { id: entity.id },
            {
                averageRating: reviewAvg
            }
        );

        // Recalculate parent destination stats after rating change
        await this.recalculateAndUpdateDestinationStats(entity.destinationId);

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
        _actor: Actor
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
    private _lastDeletedDestinationId: string | undefined;

    protected async _beforeSoftDelete(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastDeletedDestinationId = review?.destinationId;
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        const deletedDestinationId = this._lastDeletedDestinationId;
        this._lastDeletedDestinationId = undefined;
        if (deletedDestinationId) {
            await this.recalculateAndUpdateDestinationStats(deletedDestinationId);
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

    protected async _beforeHardDelete(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastDeletedDestinationId = review?.destinationId;
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        const deletedDestinationId = this._lastDeletedDestinationId;
        this._lastDeletedDestinationId = undefined;
        if (deletedDestinationId) {
            await this.recalculateAndUpdateDestinationStats(deletedDestinationId);
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

    private _lastRestoredDestinationIdForReview: string | undefined;

    protected async _beforeRestore(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastRestoredDestinationIdForReview = review?.destinationId;
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        if (this._lastRestoredDestinationIdForReview) {
            await this.recalculateAndUpdateDestinationStats(
                this._lastRestoredDestinationIdForReview
            );
        }
        const destinationSlug = this._lastRestoredDestinationIdForReview
            ? await this._resolveDestinationSlug(this._lastRestoredDestinationIdForReview)
            : undefined;
        this._lastRestoredDestinationIdForReview = undefined;
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
