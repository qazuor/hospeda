import { AccommodationModel, AccommodationReviewModel } from '@repo/db';
import type { AccommodationReviewType } from '@repo/types';
import { z } from 'zod';
// zod imported as a value below
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceOutput } from '../../types';
import { AccommodationService } from '../accommodation/accommodation.service';
import { calculateStatsFromReviews } from './accommodationReview.helpers';
import { normalizeCreateInput, normalizeUpdateInput } from './accommodationReview.normalizers';
import {
    checkCanCreateAccommodationReview,
    checkCanDeleteAccommodationReview,
    checkCanUpdateAccommodationReview,
    checkCanViewAccommodationReview
} from './accommodationReview.permissions';
import {
    CreateAccommodationReviewSchema,
    UpdateAccommodationReviewSchema
} from './accommodationReview.schemas';

/**
 * Service for managing accommodation reviews.
 * Provides CRUD and domain-specific logic for AccommodationReview entities.
 */
export class AccommodationReviewService extends BaseCrudService<
    AccommodationReviewType,
    AccommodationReviewModel,
    typeof CreateAccommodationReviewSchema,
    typeof UpdateAccommodationReviewSchema,
    typeof UpdateAccommodationReviewSchema // TODO: Replace with actual search schema if different
> {
    static readonly ENTITY_NAME = 'accommodationReview';
    protected readonly entityName = AccommodationReviewService.ENTITY_NAME;
    protected readonly model: AccommodationReviewModel;

    protected readonly createSchema = CreateAccommodationReviewSchema;
    protected readonly updateSchema = UpdateAccommodationReviewSchema;
    protected readonly searchSchema = UpdateAccommodationReviewSchema; // TODO: Replace if needed
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

    protected _canCreate(
        actor: Actor,
        _data: z.infer<typeof CreateAccommodationReviewSchema>
    ): void {
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
        _params: z.infer<typeof UpdateAccommodationReviewSchema>,
        _actor: Actor
    ): Promise<import('../../types').PaginatedListOutput<AccommodationReviewType>> {
        // TODO [e79b0be8-6523-4a9c-8a21-fd2072dc0111]: Implement search logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    protected async _executeCount(
        _params: z.infer<typeof UpdateAccommodationReviewSchema>,
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
        input: { accommodationId: string; page?: number; pageSize?: number }
    ): Promise<ServiceOutput<PaginatedListOutput<AccommodationReviewType>>> {
        const { accommodationId, page, pageSize } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'listByAccommodation',
            input: { actor, accommodationId, page, pageSize },
            schema: z
                .object({
                    actor: z.any(),
                    accommodationId: z.string().uuid(),
                    page: z.number().optional(),
                    pageSize: z.number().optional()
                })
                .strict(),
            execute: async (_validData, validatedActor) => {
                await this._canList(validatedActor);
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
        input: {
            page?: number;
            pageSize?: number;
            filters?: Record<string, unknown>;
        } = {}
    ): Promise<
        ServiceOutput<
            PaginatedListOutput<
                AccommodationReviewType & {
                    user?: { id: string; firstName?: string; lastName?: string; email: string };
                }
            >
        >
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'listWithUser',
            input: { actor, ...input },
            schema: z
                .object({
                    page: z.number().int().min(1).optional(),
                    pageSize: z.number().int().min(1).max(100).optional(),
                    filters: z.record(z.string(), z.unknown()).optional()
                })
                .strict(),
            execute: async (validData, validatedActor) => {
                await this._canList(validatedActor);
                const { page, pageSize, filters = {} } = validData;

                // Default filters for public access
                const defaultFilters = {
                    deletedAt: null,
                    ...filters
                };

                const result = await this.model.findAllWithUser(defaultFilters, { page, pageSize });
                return result;
            }
        });
    }
}
