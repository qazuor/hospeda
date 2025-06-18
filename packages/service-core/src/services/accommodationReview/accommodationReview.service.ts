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

    /**
     * Creates a new AccommodationReviewService instance.
     * Inherits from BaseService and sets up the review and accommodation models.
     */
    constructor() {
        super('accommodationReview');
    }

    /**
     * Lists all reviews for a given accommodation, paginated.
     * Validates accommodationId as a UUID and enforces page/pageSize >= 1.
     * Any authenticated or public user can list reviews.
     *
     * @param accommodationId - The accommodation UUID to filter reviews by.
     * @param page - The page number (1-based, default 1).
     * @param pageSize - The number of items per page (default 10).
     * @returns An object with items (reviews) and total count.
     * @throws ZodError if input is invalid.
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
     * Lists all reviews made by a user, paginated.
     * Only the user themselves or an admin/moderator can list all reviews by user.
     *
     * @param userId - The user UUID to filter reviews by.
     * @param page - The page number (1-based, default 1).
     * @param pageSize - The number of items per page (default 10).
     * @param actor - The user making the request (for permission check).
     * @returns An object with items (reviews) and total count.
     * @throws Error if actor is not the user and lacks moderation permission.
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
     * Recalculates and updates the average rating and review count for an accommodation.
     * Fetches all reviews for the accommodation, computes the average across all rating fields,
     * and updates the accommodation's stats in the database.
     *
     * @param accommodationId - The accommodation UUID to recalculate stats for.
     * @returns An object with averageRating and reviewsCount.
     * @throws Error if the accommodation update fails.
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

    /**
     * Checks if the actor can view the given review entity.
     * By default, all reviews are public.
     *
     * @param _actor - The user making the request.
     * @param _entity - The review entity.
     * @returns An object indicating if the review can be viewed and the reason.
     */
    protected async canViewEntity(
        _actor: Actor,
        _entity: AccommodationReviewType
    ): Promise<CanViewResult> {
        return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
    }

    /**
     * Checks if the actor can update the given review entity.
     * Only the review owner or a super admin can update.
     *
     * @param actor - The user making the request.
     * @param entity - The review entity.
     * @returns An object indicating if the review can be updated and the reason.
     */
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

    /**
     * Checks if the actor can delete the given review entity.
     * Only the review owner or a super admin can delete.
     *
     * @param actor - The user making the request.
     * @param entity - The review entity.
     * @returns An object indicating if the review can be deleted and the reason.
     */
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

    /**
     * Checks if the actor can create a review entity.
     * Any authenticated user (not GUEST) can create a review.
     *
     * @param actor - The user making the request.
     * @returns An object indicating if the review can be created and the reason.
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        const isAuthenticated = actor.role !== 'GUEST';
        return {
            canCreate: isAuthenticated,
            reason: isAuthenticated
                ? EntityPermissionReasonEnum.PUBLIC_ACCESS
                : EntityPermissionReasonEnum.NOT_PUBLIC
        };
    }

    /**
     * Checks if the actor can restore a deleted review entity.
     * Not supported for reviews (always denied).
     *
     * @param _actor - The user making the request.
     * @param _entity - The review entity.
     * @returns An object indicating if the review can be restored and the reason.
     */
    protected async canRestoreEntity(
        _actor: Actor,
        _entity: AccommodationReviewType
    ): Promise<CanRestoreResult> {
        return { canRestore: false, reason: EntityPermissionReasonEnum.DENIED };
    }

    /**
     * Checks if the actor can hard delete a review entity.
     * Not supported for reviews (always denied).
     *
     * @param _actor - The user making the request.
     * @param _entity - The review entity.
     * @returns An object indicating if the review can be hard deleted and the reason.
     */
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

    /**
     * Generates a slug for a review (not used for reviews, returns empty string).
     *
     * @returns An empty string.
     */
    public async generateSlug(): Promise<string> {
        return '';
    }

    /**
     * Lists reviews for BaseService integration, paginated.
     * Used internally by BaseService for generic listing.
     *
     * @param input - Object with optional accommodationId, userId, page, pageSize.
     * @returns An object with items (reviews) and total count.
     */
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

    /**
     * Normalizes the input for creating a review, ensuring correct types and tag normalization.
     * Used internally before creating a review entity.
     *
     * @param input - The input object for creating a review.
     * @returns The normalized input object.
     */
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

    /**
     * Normalizes the input for updating a review. (No-op by default.)
     *
     * @param input - The input object for updating a review.
     * @returns The normalized input object.
     */
    protected async normalizeUpdateInput(
        input: UpdateAccommodationReviewInputType
    ): Promise<UpdateAccommodationReviewInputType> {
        return input;
    }

    /**
     * Normalizes the input for listing reviews. (No-op by default.)
     *
     * @param input - The input object for listing reviews.
     * @returns The normalized input object.
     */
    protected async normalizeListInput(input: {
        accommodationId?: string;
        userId?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ accommodationId?: string; userId?: string; page?: number; pageSize?: number }> {
        return input;
    }
}
