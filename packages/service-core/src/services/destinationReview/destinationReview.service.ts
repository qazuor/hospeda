import { DestinationModel, DestinationReviewModel } from '@repo/db';
import type { DestinationReviewType, NewDestinationReviewInputType } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceLogger } from '../../types';
import { DestinationService } from '../destination/destination.service';
import { calculateStatsFromReviews } from './destinationReview.helpers';
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
export class DestinationReviewService extends BaseCrudService<
    DestinationReviewType,
    DestinationReviewModel,
    typeof CreateDestinationReviewSchema,
    typeof UpdateDestinationReviewSchema,
    typeof UpdateDestinationReviewSchema // TODO: Replace with actual search schema if different
> {
    static readonly ENTITY_NAME = 'destinationReview';
    protected readonly entityName = DestinationReviewService.ENTITY_NAME;
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
        super(ctx, DestinationReviewService.ENTITY_NAME);
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
        // Usar el helper para calcular los stats
        const stats = calculateStatsFromReviews(reviews);
        // Update stats in Destination via DestinationService
        await this.destinationService.updateStatsFromReview(destinationId, stats);
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
