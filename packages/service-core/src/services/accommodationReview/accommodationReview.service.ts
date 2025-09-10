import { AccommodationModel, AccommodationReviewModel } from '@repo/db';
import {
    type AccommodationReviewCreateInput,
    AccommodationReviewCreateInputSchema,
    type AccommodationReviewListByAccommodationOutput,
    type AccommodationReviewListByAccommodationParams,
    AccommodationReviewListByAccommodationParamsSchema,
    type AccommodationReviewListWithUserOutput,
    type AccommodationReviewListWithUserParams,
    AccommodationReviewListWithUserParamsSchema,
    type AccommodationReviewSearchParams,
    AccommodationReviewSearchParamsSchema,
    AccommodationReviewUpdateInputSchema
} from '@repo/schemas';
import type { AccommodationReviewType } from '@repo/types';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { AccommodationService } from '../accommodation/accommodation.service';
import { calculateStatsFromReviews } from './accommodationReview.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './accommodationReview.normalizers';
import {
    checkCanCreateAccommodationReview,
    checkCanDeleteAccommodationReview,
    checkCanUpdateAccommodationReview,
    checkCanViewAccommodationReview
} from './accommodationReview.permissions';

/**
 * Service for managing accommodation reviews.
 * Provides CRUD and domain-specific logic for AccommodationReview entities.
 */
export class AccommodationReviewService extends BaseCrudService<
    AccommodationReviewType,
    AccommodationReviewModel,
    typeof AccommodationReviewCreateInputSchema,
    typeof AccommodationReviewUpdateInputSchema,
    typeof AccommodationReviewSearchParamsSchema
> {
    static readonly ENTITY_NAME = 'accommodationReview';
    protected readonly entityName = AccommodationReviewService.ENTITY_NAME;
    protected readonly model: AccommodationReviewModel;

    protected readonly createSchema = AccommodationReviewCreateInputSchema;
    protected readonly updateSchema = AccommodationReviewUpdateInputSchema;
    protected readonly searchSchema = AccommodationReviewSearchParamsSchema;
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };
    private accommodationModel = new AccommodationModel();
    private accommodationService: AccommodationService;

    constructor(ctx: ServiceContext) {
        super(ctx, AccommodationReviewService.ENTITY_NAME);
        this.model = new AccommodationReviewModel();
        this.accommodationService = new AccommodationService(ctx);
    }

    protected _canCreate(actor: Actor, _data: AccommodationReviewCreateInput): void {
        checkCanCreateAccommodationReview(actor);
    }
    protected _canUpdate(actor: Actor, _entity: AccommodationReviewType): void {
        checkCanUpdateAccommodationReview(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: AccommodationReviewType): void {
        checkCanDeleteAccommodationReview(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: AccommodationReviewType): void {
        checkCanDeleteAccommodationReview(actor);
    }
    protected _canRestore(actor: Actor, _entity: AccommodationReviewType): void {
        checkCanUpdateAccommodationReview(actor);
    }
    protected _canView(actor: Actor, _entity: AccommodationReviewType): void {
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
        _entity: AccommodationReviewType,
        _newVisibility: unknown
    ): void {
        checkCanUpdateAccommodationReview(actor);
    }

    protected async _executeSearch(
        _params: AccommodationReviewSearchParams,
        _actor: Actor
    ): Promise<import('../../types').PaginatedListOutput<AccommodationReviewType>> {
        // TODO [e79b0be8-6523-4a9c-8a21-fd2072dc0111]: Implement search logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    protected async _executeCount(
        _params: AccommodationReviewSearchParams,
        _actor: Actor
    ): Promise<{ count: number }> {
        // TODO [e7aeadab-6753-4620-ada0-a77cc0d10bf7]: Implement count logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    /**
     * Recalculates and updates the stats (reviewsCount, averageRating, rating) for the given accommodation.
     */
    private async recalculateAndUpdateAccommodationStats(accommodationId: string): Promise<void> {
        // Get all active reviews for the accommodation
        const reviews = await this.model
            .findAll({ accommodationId, deletedAt: null }, undefined)
            .then((res) => res.items);
        // Usar el helper para calcular los stats
        const stats = calculateStatsFromReviews(reviews);
        // Update stats in Accommodation via AccommodationService
        await this.accommodationService.updateStatsFromReview(accommodationId, stats);
    }

    protected async _afterCreate(
        entity: AccommodationReviewType
    ): Promise<AccommodationReviewType> {
        await this.recalculateAndUpdateAccommodationStats(entity.accommodationId);
        return entity;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        // Find the deleted review (assume last deleted)
        // If you have the review ID, use it; otherwise, you may need to pass it explicitly
        // For now, recalculate stats for all accommodations (safe fallback)
        // TODO [c82548af-a514-4756-b168-e36a8c39060b]: Optimize to get the accommodationId of the deleted review
        // Option 1: If you have the review ID, fetch it (example below):
        // const deletedReview = await this.model.findById(reviewId);
        // if (deletedReview) await this.recalculateAndUpdateAccommodationStats(deletedReview.accommodationId);
        // Option 2: If not, skip or log
        // For now, do nothing (or log)
        // To be implemented: pass the entity or reviewId to this hook for precise update
        return result;
    }

    /**
     * Gets paginated reviews for a specific accommodation.
     * Validates permissions via _canList and returns only non-deleted reviews.
     * @param actor - The actor performing the action
     * @param input - Object containing accommodationId and optional pagination
     * @returns Paginated list of reviews for the accommodation
     */
    public async listByAccommodation(
        actor: Actor,
        input: AccommodationReviewListByAccommodationParams
    ): Promise<ServiceOutput<AccommodationReviewListByAccommodationOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listByAccommodation',
            input: { ...input, actor },
            schema: AccommodationReviewListByAccommodationParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { accommodationId, page, pageSize } = validated;
                const result = await this.model.findAll(
                    { accommodationId, deletedAt: null },
                    { page, pageSize }
                );
                return result;
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
        input: AccommodationReviewListWithUserParams = {}
    ): Promise<ServiceOutput<AccommodationReviewListWithUserOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { ...input, actor },
            schema: AccommodationReviewListWithUserParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { page, pageSize, filters = {} } = validated;

                // Default filters for public access
                const defaultFilters = {
                    deletedAt: null,
                    ...filters
                };

                const result = await this.model.findAllWithUser(defaultFilters, { page, pageSize });
                return result as AccommodationReviewListWithUserOutput;
            }
        });
    }
}
