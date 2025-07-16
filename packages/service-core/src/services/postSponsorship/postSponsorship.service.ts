import type { PostSponsorshipModel } from '@repo/db';
import { PostSponsorshipModel as RealPostSponsorshipModel } from '@repo/db';
import { BaseCrudService } from '@repo/service-core';
import type { PostSponsorshipType } from '@repo/types';
import type { Actor, ServiceContext, ServiceLogger } from '../../types';
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
import {
    CreatePostSponsorshipSchema,
    SearchPostSponsorshipSchema,
    UpdatePostSponsorshipSchema
} from './postSponsorship.schemas';

/**
 * Service for managing PostSponsorship entities.
 * Provides CRUD operations, search, and permission checks.
 */
export class PostSponsorshipService extends BaseCrudService<
    PostSponsorshipType,
    PostSponsorshipModel,
    typeof CreatePostSponsorshipSchema,
    typeof UpdatePostSponsorshipSchema,
    typeof SearchPostSponsorshipSchema
> {
    static readonly ENTITY_NAME = 'postSponsorship';
    protected readonly entityName = PostSponsorshipService.ENTITY_NAME;
    public readonly model: PostSponsorshipModel;
    public readonly logger: ServiceLogger;
    public readonly createSchema = CreatePostSponsorshipSchema;
    public readonly updateSchema = UpdatePostSponsorshipSchema;
    public readonly searchSchema = SearchPostSponsorshipSchema;
    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: PostSponsorshipModel) {
        super(ctx, PostSponsorshipService.ENTITY_NAME);
        this.logger = ctx.logger;
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

    protected async _executeSearch(
        params: import('./postSponsorship.schemas').SearchPostSponsorshipInput,
        _actor: Actor
    ): Promise<{ items: PostSponsorshipType[]; total: number }> {
        const { sponsorId, postId, fromDate, toDate, isHighlighted, pagination } = params;
        const where: Record<string, unknown> = {};
        if (sponsorId) where.sponsorId = sponsorId;
        if (postId) where.postId = postId;
        if (typeof isHighlighted === 'boolean') where.isHighlighted = isHighlighted;
        if (fromDate) where.fromDate = fromDate;
        if (toDate) where.toDate = toDate;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(where, { page, pageSize });
    }

    protected async _executeCount(
        params: import('./postSponsorship.schemas').SearchPostSponsorshipInput,
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
