import { DestinationModel, DestinationReviewModel } from '@repo/db';
import type {
    DestinationRatingType,
    DestinationReviewType,
    NewDestinationReviewInputType
} from '@repo/types';
import type { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceContext, ServiceLogger } from '../../types';
import { DestinationService } from '../destination/destination.service';
import { normalizeCreateInput, normalizeUpdateInput } from './destinationReview.normalizers';
import {
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
    checkCanUpdateDestinationReview,
    checkCanViewDestinationReview
} from './destinationReview.permissions';
import {
    CreateDestinationReviewSchema,
    UpdateDestinationReviewSchema
} from './destinationReview.schemas';

/**
 * Service for managing destination reviews.
 * Provides CRUD and domain-specific logic for DestinationReview entities.
 */
export class DestinationReviewService extends BaseService<
    DestinationReviewType,
    DestinationReviewModel,
    typeof CreateDestinationReviewSchema,
    typeof UpdateDestinationReviewSchema,
    typeof UpdateDestinationReviewSchema // TODO: Replace with actual search schema if different
> {
    protected readonly entityName = 'destinationReview';
    protected readonly model: DestinationReviewModel;
    protected readonly logger: ServiceLogger;
    protected readonly createSchema = CreateDestinationReviewSchema;
    protected readonly updateSchema = UpdateDestinationReviewSchema;
    protected readonly searchSchema = UpdateDestinationReviewSchema; // TODO: Replace if needed
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };
    private destinationModel = new DestinationModel();
    private destinationService: DestinationService;

    constructor(ctx: ServiceContext) {
        super(ctx);
        this.logger = ctx.logger;
        this.model = new DestinationReviewModel();
        this.destinationService = new DestinationService(ctx);
    }

    protected _canCreate(actor: Actor, _data: NewDestinationReviewInputType): void {
        checkCanCreateDestinationReview(actor);
    }
    protected _canUpdate(actor: Actor, _entity: DestinationReviewType): void {
        checkCanUpdateDestinationReview(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: DestinationReviewType): void {
        checkCanDeleteDestinationReview(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: DestinationReviewType): void {
        checkCanDeleteDestinationReview(actor);
    }
    protected _canRestore(actor: Actor, _entity: DestinationReviewType): void {
        checkCanUpdateDestinationReview(actor);
    }
    protected _canView(actor: Actor, _entity: DestinationReviewType): void {
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
        _entity: DestinationReviewType,
        _newVisibility: unknown
    ): void {
        checkCanUpdateDestinationReview(actor);
    }

    protected async _executeSearch(
        _params: z.infer<typeof UpdateDestinationReviewSchema>,
        _actor: Actor
    ): Promise<import('../../types').PaginatedListOutput<DestinationReviewType>> {
        // TODO: Implement search logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    protected async _executeCount(
        _params: z.infer<typeof UpdateDestinationReviewSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        // TODO: Implement count logic using Drizzle ORM
        throw new Error('Not implemented');
    }

    /**
     * Recalculates and updates the stats (reviewsCount, averageRating, rating) for the given destination.
     */
    private async recalculateAndUpdateDestinationStats(destinationId: string): Promise<void> {
        // Get all active reviews for the destination
        const reviews = await this.model
            .findAll({ destinationId, deletedAt: null }, undefined)
            .then((res) => res.items);
        const reviewsCount = reviews.length;
        // Initialize sums for each rating field
        const ratingFields: (keyof DestinationRatingType)[] = [
            'landscape',
            'attractions',
            'accessibility',
            'safety',
            'cleanliness',
            'hospitality',
            'culturalOffer',
            'gastronomy',
            'affordability',
            'nightlife',
            'infrastructure',
            'environmentalCare',
            'wifiAvailability',
            'shopping',
            'beaches',
            'greenSpaces',
            'localEvents',
            'weatherSatisfaction'
        ];
        const ratingSums: Record<keyof DestinationRatingType, number> = {
            landscape: 0,
            attractions: 0,
            accessibility: 0,
            safety: 0,
            cleanliness: 0,
            hospitality: 0,
            culturalOffer: 0,
            gastronomy: 0,
            affordability: 0,
            nightlife: 0,
            infrastructure: 0,
            environmentalCare: 0,
            wifiAvailability: 0,
            shopping: 0,
            beaches: 0,
            greenSpaces: 0,
            localEvents: 0,
            weatherSatisfaction: 0
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
        const rating: DestinationRatingType = {
            landscape: reviewsCount ? ratingSums.landscape / reviewsCount : 0,
            attractions: reviewsCount ? ratingSums.attractions / reviewsCount : 0,
            accessibility: reviewsCount ? ratingSums.accessibility / reviewsCount : 0,
            safety: reviewsCount ? ratingSums.safety / reviewsCount : 0,
            cleanliness: reviewsCount ? ratingSums.cleanliness / reviewsCount : 0,
            hospitality: reviewsCount ? ratingSums.hospitality / reviewsCount : 0,
            culturalOffer: reviewsCount ? ratingSums.culturalOffer / reviewsCount : 0,
            gastronomy: reviewsCount ? ratingSums.gastronomy / reviewsCount : 0,
            affordability: reviewsCount ? ratingSums.affordability / reviewsCount : 0,
            nightlife: reviewsCount ? ratingSums.nightlife / reviewsCount : 0,
            infrastructure: reviewsCount ? ratingSums.infrastructure / reviewsCount : 0,
            environmentalCare: reviewsCount ? ratingSums.environmentalCare / reviewsCount : 0,
            wifiAvailability: reviewsCount ? ratingSums.wifiAvailability / reviewsCount : 0,
            shopping: reviewsCount ? ratingSums.shopping / reviewsCount : 0,
            beaches: reviewsCount ? ratingSums.beaches / reviewsCount : 0,
            greenSpaces: reviewsCount ? ratingSums.greenSpaces / reviewsCount : 0,
            localEvents: reviewsCount ? ratingSums.localEvents / reviewsCount : 0,
            weatherSatisfaction: reviewsCount ? ratingSums.weatherSatisfaction / reviewsCount : 0
        };
        const averageRating = totalRatings ? totalSum / totalRatings : 0;
        // Update stats in Destination via DestinationService
        await this.destinationService.updateStatsFromReview(destinationId, {
            reviewsCount,
            averageRating,
            rating
        });
    }

    protected async _afterCreate(entity: DestinationReviewType): Promise<DestinationReviewType> {
        await this.recalculateAndUpdateDestinationStats(entity.destinationId);
        return entity;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor
    ): Promise<{ count: number }> {
        // TODO: Implement logic to update stats after delete if needed
        return result;
    }
}
