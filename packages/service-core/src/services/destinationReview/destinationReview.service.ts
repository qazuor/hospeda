import { DestinationModel } from '@repo/db/models/destination/destination.model';
import { DestinationReviewModel } from '@repo/db/models/destination/destinationReview.model';
import type {
    DestinationReviewType,
    DestinationType,
    NewDestinationReviewInputType,
    UpdateDestinationReviewInputType,
    UserType
} from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import {
    type Actor,
    type CanCreateResult,
    type CanDeleteResult,
    type CanHardDeleteResult,
    type CanRestoreResult,
    type CanUpdateResult,
    type CanViewResult,
    EntityPermissionReasonEnum
} from '../../types';
import { DestinationReviewCreateSchema } from './destinationReview.schemas';

export class DestinationReviewService extends BaseService<
    DestinationReviewType,
    NewDestinationReviewInputType,
    UpdateDestinationReviewInputType,
    { destinationId?: string; userId?: string; page?: number; pageSize?: number },
    { items: DestinationReviewType[]; total: number }
> {
    protected model = new DestinationReviewModel();
    protected inputSchema =
        DestinationReviewCreateSchema as unknown as z.ZodType<NewDestinationReviewInputType>;
    protected reviewModel = new DestinationReviewModel();
    protected destinationModel = new DestinationModel();

    constructor() {
        super('destinationReview');
    }

    async listReviewsByDestination({
        destinationId,
        page = 1,
        pageSize = 10
    }: {
        destinationId: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: DestinationReviewType[]; total: number }> {
        const schema = z.object({
            destinationId: z.string().uuid(),
            page: z.number().int().min(1).optional(),
            pageSize: z.number().int().min(1).optional()
        });
        schema.parse({ destinationId, page, pageSize });
        return this.reviewModel.findAll({ destinationId }, { page, pageSize }) as Promise<{
            items: DestinationReviewType[];
            total: number;
        }>;
    }

    async listReviewsByUser({
        userId,
        page = 1,
        pageSize = 10,
        actor
    }: {
        userId: string;
        page?: number;
        pageSize?: number;
        actor: UserType;
    }): Promise<{ items: DestinationReviewType[]; total: number }> {
        if (
            actor.id !== userId &&
            !actor.permissions?.includes(PermissionEnum.DESTINATION_REVIEW_MODERATE)
        ) {
            throw new Error('You do not have permission to list reviews for other users.');
        }
        return this.reviewModel.findAll({ userId }, { page, pageSize }) as Promise<{
            items: DestinationReviewType[];
            total: number;
        }>;
    }

    async recalculateStats(
        destinationId: string
    ): Promise<{ averageRating: number; reviewsCount: number }> {
        const reviews = (await this.reviewModel.findAll({
            destinationId
        })) as DestinationReviewType[];
        const reviewsCount = reviews.length;
        let averageRating = 0;
        if (reviewsCount > 0) {
            // Sums all rating fields for all reviews
            const total = reviews.reduce((sum: number, r: DestinationReviewType) => {
                const rating = r.rating;
                // Sums all numeric fields in the rating
                const ratingSum = Object.values(rating).reduce(
                    (acc, val) => acc + (typeof val === 'number' ? val : 0),
                    0
                );
                return sum + ratingSum;
            }, 0);
            // Number of rating fields per review
            const ratingFields = reviews[0] ? Object.keys(reviews[0].rating).length : 1;
            averageRating = total / (reviewsCount * ratingFields);
        }
        await this.destinationModel.update({ id: destinationId }, {
            reviewsCount,
            averageRating: +averageRating.toFixed(2)
        } as Partial<DestinationType>);
        return { averageRating: +averageRating.toFixed(2), reviewsCount };
    }

    protected async canViewEntity(
        _actor: Actor,
        _entity: DestinationReviewType
    ): Promise<CanViewResult> {
        return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
    }

    protected async canUpdateEntity(
        actor: Actor,
        entity: DestinationReviewType
    ): Promise<CanUpdateResult> {
        const isOwner = actor.id === entity.userId;
        const isSuperAdmin = actor.role === 'SUPER_ADMIN';
        return {
            canUpdate: isOwner || isSuperAdmin,
            reason: isOwner
                ? EntityPermissionReasonEnum.OWNER
                : isSuperAdmin
                  ? EntityPermissionReasonEnum.SUPER_ADMIN
                  : EntityPermissionReasonEnum.DENIED
        };
    }

    protected async canDeleteEntity(
        actor: Actor,
        entity: DestinationReviewType
    ): Promise<CanDeleteResult> {
        const isOwner = actor.id === entity.userId;
        const isSuperAdmin = actor.role === 'SUPER_ADMIN';
        return {
            canDelete: isOwner || isSuperAdmin,
            reason: isOwner
                ? EntityPermissionReasonEnum.OWNER
                : isSuperAdmin
                  ? EntityPermissionReasonEnum.SUPER_ADMIN
                  : EntityPermissionReasonEnum.DENIED
        };
    }

    protected async canRestoreEntity(
        _actor: Actor,
        _entity: DestinationReviewType
    ): Promise<CanRestoreResult> {
        return { canRestore: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    protected canHardDeleteEntity(
        _actor: Actor,
        _entity: DestinationReviewType
    ): CanHardDeleteResult {
        return {
            canHardDelete: false,
            reason: EntityPermissionReasonEnum.DENIED,
            checkedPermission: PermissionEnum.DESTINATION_REVIEW_MODERATE
        };
    }

    public async generateSlug(): Promise<string> {
        // Slug is not used in destination reviews
        return '';
    }

    protected async listEntities(input: {
        destinationId?: string;
        userId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: DestinationReviewType[]; total: number }> {
        return this.reviewModel.findAll(input) as Promise<{
            items: DestinationReviewType[];
            total: number;
        }>;
    }

    protected async normalizeCreateInput(
        input: NewDestinationReviewInputType
    ): Promise<NewDestinationReviewInputType> {
        return input;
    }

    protected async normalizeUpdateInput(
        input: UpdateDestinationReviewInputType
    ): Promise<UpdateDestinationReviewInputType> {
        return input;
    }

    protected async normalizeListInput(input: {
        destinationId?: string;
        userId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ destinationId?: string; userId?: string; page?: number; pageSize?: number }> {
        return input;
    }

    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        const canCreate = Boolean(actor.id);
        return {
            canCreate,
            reason: canCreate ? EntityPermissionReasonEnum.OWNER : EntityPermissionReasonEnum.DENIED
        };
    }
}
