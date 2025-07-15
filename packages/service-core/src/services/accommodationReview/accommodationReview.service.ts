import { AccommodationModel, AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationRatingType,
    AccommodationReviewType,
    NewAccommodationReviewInputType
} from '@repo/types';
import type { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceContext, ServiceLogger } from '../../types';
import { AccommodationService } from '../accommodation/accommodation.service';
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
export class AccommodationReviewService extends BaseService<
    AccommodationReviewType,
    AccommodationReviewModel,
    typeof CreateAccommodationReviewSchema,
    typeof UpdateAccommodationReviewSchema,
    typeof UpdateAccommodationReviewSchema // TODO: Replace with actual search schema if different
> {
    protected readonly entityName = 'accommodationReview';
    protected readonly model: AccommodationReviewModel;
    protected readonly logger: ServiceLogger;
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
        super(ctx);
        this.logger = ctx.logger;
        this.model = new AccommodationReviewModel();
        this.accommodationService = new AccommodationService(ctx);
    }

    protected _canCreate(actor: Actor, _data: NewAccommodationReviewInputType): void {
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
        // TODO: Implement search logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    protected async _executeCount(
        _params: z.infer<typeof UpdateAccommodationReviewSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        // TODO: Implement count logic using Drizzle ORM
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
        const reviewsCount = reviews.length;
        // Initialize sums for each rating field
        const ratingFields: (keyof AccommodationRatingType)[] = [
            'cleanliness',
            'hospitality',
            'services',
            'accuracy',
            'communication',
            'location'
        ];
        const ratingSums: Record<keyof AccommodationRatingType, number> = {
            cleanliness: 0,
            hospitality: 0,
            services: 0,
            accuracy: 0,
            communication: 0,
            location: 0
        };
        let totalRatings = 0;
        let totalSum = 0;
        for (const review of reviews) {
            for (const field of ratingFields) {
                const value = review.rating[field] ?? 0;
                ratingSums[field] += value;
                totalSum += value;
                totalRatings++;
            }
        }
        // Calculate averages
        const rating: AccommodationRatingType = {
            cleanliness: reviewsCount ? ratingSums.cleanliness / reviewsCount : 0,
            hospitality: reviewsCount ? ratingSums.hospitality / reviewsCount : 0,
            services: reviewsCount ? ratingSums.services / reviewsCount : 0,
            accuracy: reviewsCount ? ratingSums.accuracy / reviewsCount : 0,
            communication: reviewsCount ? ratingSums.communication / reviewsCount : 0,
            location: reviewsCount ? ratingSums.location / reviewsCount : 0
        };
        const averageRating = totalRatings ? totalSum / totalRatings : 0;
        // Update stats in Accommodation via AccommodationService
        await this.accommodationService.updateStatsFromReview(accommodationId, {
            reviewsCount,
            averageRating,
            rating
        });
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
        // TODO: Optimize to get the accommodationId of the deleted review
        // Option 1: If you have the review ID, fetch it (example below):
        // const deletedReview = await this.model.findById(reviewId);
        // if (deletedReview) await this.recalculateAndUpdateAccommodationStats(deletedReview.accommodationId);
        // Option 2: If not, skip or log
        // For now, do nothing (or log)
        // To be implemented: pass the entity or reviewId to this hook for precise update
        return result;
    }
}
