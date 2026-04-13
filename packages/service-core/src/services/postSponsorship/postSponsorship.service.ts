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
import type { Actor, ServiceConfig, ServiceContext } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './postSponsorship.normalizers';
import {
    checkCanAdminList,
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

    constructor(ctx: ServiceConfig, model?: PostSponsorshipModel) {
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
        checkCanUpdatePostSponsorship(_actor, _entity);
    }

    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks POST_SPONSORSHIP_VIEW.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    /**
     * After creating a post sponsorship, update the post's sponsorship_id field.
     *
     * Runs inside the same transaction as the create operation so that a failure
     * here rolls back the entire operation instead of leaving orphaned data.
     *
     * @param entity - The newly created PostSponsorship entity
     * @param actor - The actor performing the operation
     * @param _tx - Optional transaction client propagated from the caller
     * @returns The unchanged entity after the post has been linked
     */
    protected async _afterCreate(
        entity: PostSponsorship,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<PostSponsorship> {
        this.logger.info(`Linking post ${entity.postId} to sponsorship ${entity.id}`);

        const postModel = new RealPostModel();

        // Update the post's sponsorship_id to point to this new sponsorship.
        // Errors are intentionally not caught so the transaction can roll back.
        await postModel.update(
            { id: entity.postId },
            { sponsorshipId: entity.id, updatedById: actor.id },
            _ctx.tx
        );

        return entity;
    }

    /**
     * Before soft-deleting a post sponsorship, clear the post's sponsorship_id field.
     *
     * @param id - The ID of the PostSponsorship being deleted
     * @param actor - The actor performing the operation
     * @param _tx - Optional transaction client propagated from the caller
     * @returns The unchanged id after the post has been unlinked
     */
    protected async _beforeSoftDelete(
        id: string,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<string> {
        // Get the sponsorship entity to know which post to update
        const sponsorship = await this.model.findOne({ id });
        if (sponsorship) {
            const postModel = new RealPostModel();

            // Clear the post's sponsorship_id when the sponsorship is deleted
            await postModel.update(
                { id: sponsorship.postId },
                { sponsorshipId: undefined, updatedById: actor.id },
                _ctx.tx
            );
        }

        return id;
    }

    /**
     * Before hard-deleting a post sponsorship, clear the post's sponsorship_id field.
     *
     * @param id - The ID of the PostSponsorship being hard deleted
     * @param actor - The actor performing the operation
     * @param _tx - Optional transaction client propagated from the caller
     * @returns The unchanged id after the post has been unlinked
     */
    protected async _beforeHardDelete(
        id: string,
        actor: Actor,
        _ctx: ServiceContext
    ): Promise<string> {
        // Get the sponsorship entity to know which post to update
        const sponsorship = await this.model.findOne({ id });
        if (sponsorship) {
            const postModel = new RealPostModel();

            // Clear the post's sponsorship_id when the sponsorship is hard deleted
            await postModel.update(
                { id: sponsorship.postId },
                { sponsorshipId: undefined, updatedById: actor.id },
                _ctx.tx
            );
        }

        return id;
    }

    protected async _executeSearch(
        params: PostSponsorshipSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
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
        _actor: Actor,
        _ctx: ServiceContext
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
