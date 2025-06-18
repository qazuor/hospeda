import { AccommodationModel } from '@repo/db/models/accommodation/accommodation.model';
import { AccommodationReviewModel } from '@repo/db/models/accommodation/accommodationReview.model';
import type {
    AccommodationId,
    AccommodationReviewType,
    AccommodationType,
    NewAccommodationReviewInputType,
    TagId,
    TagType,
    UpdateAccommodationReviewInputType,
    UserId,
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
import { AccommodationReviewCreateSchema } from './accommodationReview.schemas';

export class AccommodationReviewService extends BaseService<
    AccommodationReviewType,
    NewAccommodationReviewInputType,
    UpdateAccommodationReviewInputType,
    { accommodationId?: string; userId?: string; page?: number; pageSize?: number },
    { items: AccommodationReviewType[]; total: number }
> {
    protected model = new AccommodationReviewModel();
    protected inputSchema =
        AccommodationReviewCreateSchema as unknown as z.ZodType<NewAccommodationReviewInputType>;
    protected reviewModel = new AccommodationReviewModel();
    protected accommodationModel = new AccommodationModel();

    constructor() {
        super('accommodationReview');
    }

    /**
     * List all reviews for a given accommodation, paginated.
     * @param input - accommodationId, page, pageSize
     * @returns Array of AccommodationReviewType and total count.
     */
    async listReviewsByAccommodation({
        accommodationId,
        page = 1,
        pageSize = 10
    }: {
        accommodationId: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: AccommodationReviewType[]; total: number }> {
        // Strict validation of accommodationId
        const schema = z.object({
            accommodationId: z.string().uuid(),
            page: z.number().int().min(1).optional(),
            pageSize: z.number().int().min(1).optional()
        });
        schema.parse({ accommodationId, page, pageSize });
        // Any authenticated or public user can list reviews
        // TODO: Add visibility rules if needed
        return this.reviewModel.findAll({ accommodationId }, { page, pageSize }) as Promise<{
            items: AccommodationReviewType[];
            total: number;
        }>;
    }

    /**
     * List all reviews made by a user, paginated.
     * @param input - userId, page, pageSize, actor
     * @returns Array of AccommodationReviewType and total count.
     */
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
    }): Promise<{ items: AccommodationReviewType[]; total: number }> {
        // Only the user themselves or admin/moderator can list all reviews by user
        if (
            actor.id !== userId &&
            !actor.permissions?.includes(PermissionEnum.ACCOMMODATION_REVIEW_MODERATE)
        ) {
            throw new Error('Permission denied: cannot list reviews of other users');
        }
        return this.reviewModel.findAll({ userId }, { page, pageSize }) as Promise<{
            items: AccommodationReviewType[];
            total: number;
        }>;
    }

    /**
     * Recalculate and update stats (average rating, review count) for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @returns Object with averageRating and reviewsCount.
     */
    async recalculateStats(
        accommodationId: string
    ): Promise<{ averageRating: number; reviewsCount: number }> {
        // Get all reviews for the accommodation
        const reviews = (await this.reviewModel.findAll({
            accommodationId
        })) as AccommodationReviewType[];
        const reviewsCount = reviews.length;
        let averageRating = 0;
        if (reviewsCount > 0) {
            // Sum all rating fields for all reviews
            const total = reviews.reduce((sum: number, r: AccommodationReviewType) => {
                const rating = r.rating;
                return (
                    sum +
                    rating.cleanliness +
                    rating.hospitality +
                    rating.services +
                    rating.accuracy +
                    rating.communication +
                    rating.location
                );
            }, 0);
            // 6 fields per review
            averageRating = total / (reviewsCount * 6);
        }
        // Update the accommodation stats
        await this.accommodationModel.update({ id: accommodationId }, {
            reviewsCount,
            averageRating: +averageRating.toFixed(2)
        } as Partial<AccommodationType>);
        return { averageRating: +averageRating.toFixed(2), reviewsCount };
    }

    // --- Permission logic ---
    protected async canViewEntity(
        _actor: Actor,
        _entity: AccommodationReviewType
    ): Promise<CanViewResult> {
        return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
    }
    protected async canUpdateEntity(
        actor: Actor,
        entity: AccommodationReviewType
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
        entity: AccommodationReviewType
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
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        const isAuthenticated = actor.role !== 'GUEST';
        return {
            canCreate: isAuthenticated,
            reason: isAuthenticated
                ? EntityPermissionReasonEnum.PUBLIC_ACCESS
                : EntityPermissionReasonEnum.NOT_PUBLIC
        };
    }
    protected async canRestoreEntity(
        _actor: Actor,
        _entity: AccommodationReviewType
    ): Promise<CanRestoreResult> {
        return { canRestore: false, reason: EntityPermissionReasonEnum.DENIED };
    }
    protected canHardDeleteEntity(
        _actor: Actor,
        _entity: AccommodationReviewType
    ): CanHardDeleteResult {
        return {
            canHardDelete: false,
            reason: EntityPermissionReasonEnum.DENIED,
            checkedPermission: PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
        };
    }
    public async generateSlug(): Promise<string> {
        return '';
    }

    // --- List entities for BaseService ---
    protected async listEntities(input: {
        accommodationId?: string;
        userId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: AccommodationReviewType[]; total: number }> {
        const { accommodationId, userId, page = 1, pageSize = 10 } = input;
        const where: Record<string, unknown> = {};
        if (accommodationId) where.accommodationId = accommodationId;
        if (userId) where.userId = userId;
        return this.model.findAll(where, { page, pageSize }) as Promise<{
            items: AccommodationReviewType[];
            total: number;
        }>;
    }

    protected async normalizeCreateInput(
        input: NewAccommodationReviewInputType
    ): Promise<NewAccommodationReviewInputType> {
        let adminInfo = input.adminInfo;
        if (adminInfo?.tags) {
            adminInfo = {
                ...adminInfo,
                tags: adminInfo.tags.map((tag) => ({
                    ...tag,
                    id: tag.id as TagId
                })) as TagType[]
            };
        }
        return {
            ...input,
            accommodationId: input.accommodationId as AccommodationId,
            userId: input.userId as UserId,
            adminInfo
        };
    }
    protected async normalizeUpdateInput(
        input: UpdateAccommodationReviewInputType
    ): Promise<UpdateAccommodationReviewInputType> {
        return input;
    }
    protected async normalizeListInput(input: {
        accommodationId?: string;
        userId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ accommodationId?: string; userId?: string; page?: number; pageSize?: number }> {
        return input;
    }
}
