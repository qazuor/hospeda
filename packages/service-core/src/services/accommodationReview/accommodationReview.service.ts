import { AccommodationModel, AccommodationReviewModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type AccommodationReview,
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
    ServiceErrorCode
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import {
    type Actor,
    type PaginatedListOutput,
    type ServiceContext,
    ServiceError,
    type ServiceOutput
} from '../../types';
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

    protected async _executeSearch(
        params: AccommodationReviewSearchParams,
        _actor: Actor
    ): Promise<PaginatedListOutput<AccommodationReview>> {
        const { page, pageSize, ...filters } = params;
        return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    }

    protected async _executeCount(
        params: AccommodationReviewSearchParams,
        _actor: Actor
    ): Promise<CountResponse> {
        const { page: _p, pageSize: _ps, ...filters } = params;
        const count = await this.model.count({ ...filters, deletedAt: null });
        return { count };
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

    /**
     * Enforces one review per user per accommodation.
     * Checks for an existing non-deleted review before allowing creation.
     * @throws {ServiceError} If the user already has a review for this accommodation.
     */
    protected async _beforeCreate(
        data: AccommodationReviewCreateInput,
        _actor: Actor
    ): Promise<Partial<AccommodationReview>> {
        const existing = await this.model.findOne({
            userId: data.userId,
            accommodationId: data.accommodationId,
            deletedAt: null
        } as Partial<AccommodationReview>);
        if (existing) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'You have already submitted a review for this accommodation.'
            );
        }
        return data as Partial<AccommodationReview>;
    }

    protected async _afterCreate(entity: AccommodationReview): Promise<AccommodationReview> {
        await this.recalculateAndUpdateAccommodationStats(entity.accommodationId);
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
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
        return entity;
    }

    protected async _afterUpdate(entity: AccommodationReview): Promise<AccommodationReview> {
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
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
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: AccommodationReview,
        _actor: Actor
    ): Promise<AccommodationReview> {
        const accommodationSlug = await this._resolveAccommodationSlug(entity.accommodationId);
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
        return entity;
    }

    /**
     * Captures the accommodationId before soft delete so stats can be recalculated after deletion.
     */
    private _lastDeletedAccommodationId: string | undefined;

    protected async _beforeSoftDelete(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastDeletedAccommodationId = review?.accommodationId;
        return id;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<CountResponse> {
        const deletedAccommodationId = this._lastDeletedAccommodationId;
        this._lastDeletedAccommodationId = undefined;
        if (deletedAccommodationId) {
            await this.recalculateAndUpdateAccommodationStats(deletedAccommodationId);
        }
        const accommodationSlug = deletedAccommodationId
            ? await this._resolveAccommodationSlug(deletedAccommodationId)
            : undefined;
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
        return result;
    }

    protected async _beforeHardDelete(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastDeletedAccommodationId = review?.accommodationId;
        return id;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<CountResponse> {
        const deletedAccommodationId = this._lastDeletedAccommodationId;
        this._lastDeletedAccommodationId = undefined;
        const accommodationSlug = deletedAccommodationId
            ? await this._resolveAccommodationSlug(deletedAccommodationId)
            : undefined;
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
        return result;
    }

    private _lastRestoredAccommodationId: string | undefined;

    protected async _beforeRestore(id: string, _actor: Actor): Promise<string> {
        const review = await this.model.findOne({ id });
        this._lastRestoredAccommodationId = review?.accommodationId;
        return id;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        if (this._lastRestoredAccommodationId) {
            await this.recalculateAndUpdateAccommodationStats(this._lastRestoredAccommodationId);
        }
        const accommodationSlug = this._lastRestoredAccommodationId
            ? await this._resolveAccommodationSlug(this._lastRestoredAccommodationId)
            : undefined;
        this._lastRestoredAccommodationId = undefined;
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
        return result;
    }

    /**
     * Gets paginated reviews for a specific accommodation.
     * Validates permissions via _canList and returns only non-deleted reviews.
     * @param actor - The actor performing the action
     * @param input - Object containing accommodationId and optional pagination
     * @returns Paginated list of reviews for the accommodation wrapped in consistent format
     */
    public async listByAccommodation(
        actor: Actor,
        input: AccommodationReviewListByAccommodationParams
    ): Promise<ServiceOutput<AccommodationReviewListWrapper>> {
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
     * @returns Paginated list of reviews by user wrapped in consistent format
     */
    public async listByUser(
        actor: Actor,
        input: AccommodationReviewsByUserInput
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
                const result = await this.model.findAll(filters, { page, pageSize });

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
     * @returns Paginated list of reviews with user information wrapped in consistent format
     */
    public async listWithUser(
        actor: Actor,
        input: AccommodationReviewListWithUserParams = { page: 1, pageSize: 10 }
    ): Promise<ServiceOutput<AccommodationReviewWithUserListWrapper>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { ...input, actor },
            schema: AccommodationReviewListWithUserParamsSchema,
            execute: async (validated, validatedActor) => {
                await this._canList(validatedActor);
                const { page = 1, pageSize = 10, ...filterParams } = validated;

                // Default filters for public access
                const defaultFilters = {
                    deletedAt: null,
                    ...filterParams
                };

                const result = await this.model.findAllWithUser(defaultFilters, { page, pageSize });

                // Wrap the result in consistent format
                const accommodationReviews = Array.isArray(result.items) ? result.items : [];

                return { accommodationReviews };
            }
        });
    }
}
