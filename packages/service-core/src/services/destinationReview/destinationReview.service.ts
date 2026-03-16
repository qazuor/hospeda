import { DestinationModel, DestinationReviewModel } from '@repo/db';
import {
    type DestinationReview,
    type DestinationReviewCreateInput,
    DestinationReviewCreateInputSchema,
    type DestinationReviewListResponse,
    type DestinationReviewListWithUserOutput,
    type DestinationReviewSearchInput,
    DestinationReviewSearchInputSchema,
    DestinationReviewUpdateInputSchema,
    type DestinationReviewsByUserInput,
    DestinationReviewsByUserSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { DestinationService } from '../destination/destination.service';
import { calculateStatsFromReviews } from './destinationReview.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './destinationReview.normalizers';
import {
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
    checkCanUpdateDestinationReview,
    checkCanViewDestinationReview
} from './destinationReview.permissions';

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
    protected readonly model: DestinationReviewModel;

    protected readonly createSchema = DestinationReviewCreateInputSchema;
    protected readonly updateSchema = DestinationReviewUpdateInputSchema;
    protected readonly searchSchema = DestinationReviewSearchInputSchema;

    protected getDefaultListRelations() {
        return { user: true, destination: true };
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
        await this.recalculateAndUpdateDestinationStats(entity.destinationId);
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'destination_review'
        });
        return entity;
    }

    protected async _afterUpdate(entity: DestinationReview): Promise<DestinationReview> {
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'destination_review'
        });
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
        if (this._lastDeletedDestinationId) {
            await this.recalculateAndUpdateDestinationStats(this._lastDeletedDestinationId);
            this._lastDeletedDestinationId = undefined;
        }
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'destination_review'
        });
        return result;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'destination_review'
        });
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
            this._lastRestoredDestinationIdForReview = undefined;
        }
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'destination_review'
        });
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
