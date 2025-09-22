import type { PostSponsorshipModel } from '@repo/db';
import { PostSponsorshipModel as RealPostSponsorshipModel } from '@repo/db';
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
        // TODO [7ac399d9-c091-4cf9-bf7f-8d7d443bc265]: Implement visibility update permissions if needed
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
