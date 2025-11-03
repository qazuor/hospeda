import type { PostSponsorshipModel } from '@repo/db';
import {
    PostModel as RealPostModel,
    PostSponsorshipModel as RealPostSponsorshipModel
} from '@repo/db';
import type { PostSponsorship, PostSponsorshipSearchInput } from '@repo/schemas';
import {
    PostSponsorshipCreateInputSchema,
    PostSponsorshipSearchInputSchema,
    PostSponsorshipUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base';
import type { Actor, ServiceContext } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './postSponsorship.normalizers';
import {
    checkCanCountPostSponsorship,
    checkCanCreatePostSponsorship,
    checkCanDeletePostSponsorship,
    checkCanListPostSponsorship,
    checkCanSearchPostSponsorship,
    checkCanUpdatePostSponsorship,
    checkCanViewPostSponsorship
} from './postSponsorship.permissions';

/**
 * Service for managing PostSponsorship entities.
 * Provides CRUD operations, search, and permission checks.
 */
export class PostSponsorshipService extends BaseCrudService<
    PostSponsorship,
    PostSponsorshipModel,
    typeof PostSponsorshipCreateInputSchema,
    typeof PostSponsorshipUpdateInputSchema,
    typeof PostSponsorshipSearchInputSchema
> {
    static readonly ENTITY_NAME = 'postSponsorship';
    protected readonly entityName = PostSponsorshipService.ENTITY_NAME;
    public readonly model: PostSponsorshipModel;

    public readonly createSchema = PostSponsorshipCreateInputSchema;
    public readonly updateSchema = PostSponsorshipUpdateInputSchema;
    public readonly searchSchema = PostSponsorshipSearchInputSchema;

    protected getDefaultListRelations() {
        return { post: true, sponsor: true };
    }

    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: PostSponsorshipModel) {
        super(ctx, PostSponsorshipService.ENTITY_NAME);
        this.model = model ?? new RealPostSponsorshipModel();
    }

    protected _canCreate(actor: Actor, data: unknown) {
        checkCanCreatePostSponsorship(actor, data);
    }
    protected _canUpdate(actor: Actor, entity: unknown) {
        checkCanUpdatePostSponsorship(actor, entity);
    }
    protected _canSoftDelete(actor: Actor, entity: unknown) {
        checkCanDeletePostSponsorship(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: unknown) {
        checkCanDeletePostSponsorship(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: unknown) {
        checkCanUpdatePostSponsorship(actor, entity);
    }
    protected _canView(actor: Actor, entity: unknown) {
        checkCanViewPostSponsorship(actor, entity);
    }
    protected _canList(actor: Actor) {
        checkCanListPostSponsorship(actor);
    }
    protected _canSearch(actor: Actor) {
        checkCanSearchPostSponsorship(actor);
    }
    protected _canCount(actor: Actor) {
        checkCanCountPostSponsorship(actor);
    }
    protected _canUpdateVisibility(_actor: Actor, _entity: unknown, _newVisibility: unknown) {
        // TODO: Implement visibility update permissions if needed
    }

    /**
     * After creating a post sponsorship, update the post's sponsorship_id field
     */
    protected async _afterCreate(entity: PostSponsorship, actor: Actor): Promise<PostSponsorship> {
        try {
            this.logger.info(
                `Executing _afterCreate hook for PostSponsorship: ${entity.id} -> Post: ${entity.postId}`
            );

            const postModel = new RealPostModel();

            // Update the post's sponsorship_id to point to this new sponsorship
            const updateResult = await postModel.update(
                { id: entity.postId },
                {
                    sponsorshipId: entity.id,
                    updatedById: actor.id
                }
            );

            if (updateResult) {
                this.logger.info(
                    `Successfully updated post ${entity.postId} with sponsorship_id: ${entity.id}`
                );
            } else {
                this.logger.warn(
                    `Failed to update post ${entity.postId} with sponsorship_id: ${entity.id}`
                );
            }

            return entity;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Error in _afterCreate hook for PostSponsorship ${entity.id}: ${errorMessage}`
            );
            // Don't throw the error to avoid breaking the creation process
            return entity;
        }
    }

    /**
     * Before deleting a post sponsorship, clear the post's sponsorship_id field
     */
    protected async _beforeSoftDelete(id: string, actor: Actor): Promise<string> {
        // Get the sponsorship entity to know which post to update
        const sponsorship = await this.model.findOne({ id });
        if (sponsorship) {
            const postModel = new RealPostModel();

            // Clear the post's sponsorship_id when the sponsorship is deleted
            await postModel.update(
                { id: sponsorship.postId },
                {
                    sponsorshipId: undefined,
                    updatedById: actor.id
                }
            );
        }

        return id;
    }

    /**
     * Before hard deleting a post sponsorship, clear the post's sponsorship_id field
     */
    protected async _beforeHardDelete(id: string, actor: Actor): Promise<string> {
        // Get the sponsorship entity to know which post to update
        const sponsorship = await this.model.findOne({ id });
        if (sponsorship) {
            const postModel = new RealPostModel();

            // Clear the post's sponsorship_id when the sponsorship is hard deleted
            await postModel.update(
                { id: sponsorship.postId },
                {
                    sponsorshipId: undefined,
                    updatedById: actor.id
                }
            );
        }

        return id;
    }

    protected async _executeSearch(
        params: PostSponsorshipSearchInput,
        _actor: Actor
    ): Promise<{ items: PostSponsorship[]; total: number }> {
        const {
            sponsorId,
            postId,
            fromDate,
            toDate,
            isHighlighted,
            page = 1,
            pageSize = 10
        } = params;
        const where: Record<string, unknown> = {};
        if (sponsorId) where.sponsorId = sponsorId;
        if (postId) where.postId = postId;
        if (typeof isHighlighted === 'boolean') where.isHighlighted = isHighlighted;
        if (fromDate) where.fromDate = fromDate;
        if (toDate) where.toDate = toDate;
        return this.model.findAll(where, { page, pageSize });
    }

    protected async _executeCount(
        params: PostSponsorshipSearchInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { sponsorId, postId, fromDate, toDate, isHighlighted } = params;
        const where: Record<string, unknown> = {};
        if (sponsorId) where.sponsorId = sponsorId;
        if (postId) where.postId = postId;
        if (typeof isHighlighted === 'boolean') where.isHighlighted = isHighlighted;
        if (fromDate) where.fromDate = fromDate;
        if (toDate) where.toDate = toDate;
        const count = await this.model.count(where);
        return { count };
    }
}
