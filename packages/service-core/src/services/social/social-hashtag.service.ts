import {
    SocialHashtagModel as RealSocialHashtagModel,
    type SelectSocialHashtag,
    type SocialHashtagModel,
    safeIlike,
    socialHashtags
} from '@repo/db';
import type {
    SocialHashtagAdminSearch,
    SocialHashtagCreate,
    SocialHashtagUpdate
} from '@repo/schemas';
import {
    SocialHashtagAdminSearchSchema,
    SocialHashtagCreateSchema,
    SocialHashtagUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { normalizeHashtag } from './social.helpers';
import { checkCanManageHashtag, checkCanViewHashtag } from './social.permissions';

/**
 * CRUD service for the `social_hashtags` catalog.
 *
 * Normalizes `hashtag` → `normalizedHashtag` (lowercase + `#` prefix) on
 * create and update before persistence. The `normalizedHashtag` column has a
 * unique constraint in the DB; any duplicate will surface as a DB error.
 *
 * Permission model:
 * - read / list / search / count → `SOCIAL_HASHTAG_VIEW`
 * - create / update / delete / restore / visibility → `SOCIAL_HASHTAG_MANAGE`
 */
export class SocialHashtagService extends BaseCrudService<
    SelectSocialHashtag,
    SocialHashtagModel,
    typeof SocialHashtagCreateSchema,
    typeof SocialHashtagUpdateSchema,
    typeof SocialHashtagAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialHashtag';
    protected readonly entityName = SocialHashtagService.ENTITY_NAME;
    public readonly model: SocialHashtagModel;

    public readonly createSchema = SocialHashtagCreateSchema;
    public readonly updateSchema = SocialHashtagUpdateSchema;
    public readonly searchSchema = SocialHashtagAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialHashtagModel) {
        super(ctx, SocialHashtagService.ENTITY_NAME);
        this.model = model ?? new RealSocialHashtagModel();
        this.adminSearchSchema = SocialHashtagAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Normalizes the hashtag before creation.
     * Derives `normalizedHashtag` from the provided `hashtag` field.
     */
    protected override async _beforeCreate(
        data: SocialHashtagCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialHashtag>> {
        const normalizedHashtag = normalizeHashtag(data.hashtag);
        return { ...data, normalizedHashtag };
    }

    /**
     * Re-normalizes the hashtag on update when `hashtag` is changed.
     */
    protected override async _beforeUpdate(
        data: SocialHashtagUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialHashtag>> {
        if (data.hashtag !== undefined) {
            const normalizedHashtag = normalizeHashtag(data.hashtag);
            return { ...data, normalizedHashtag };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialHashtagCreate): void {
        checkCanManageHashtag(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialHashtag): void {
        checkCanManageHashtag(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialHashtag): void {
        checkCanManageHashtag(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialHashtag): void {
        checkCanManageHashtag(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialHashtag): void {
        checkCanManageHashtag(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialHashtag): void {
        checkCanViewHashtag(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewHashtag(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewHashtag(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewHashtag(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialHashtag,
        _newVisibility: unknown
    ): void {
        checkCanManageHashtag(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialHashtagAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialHashtag>> {
        const {
            page = 1,
            pageSize = 20,
            sort,
            platform,
            category,
            audienceId,
            active,
            search
        } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (category !== undefined) where.category = category;
        if (audienceId !== undefined) where.audienceId = audienceId;
        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialHashtags.hashtag, search));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialHashtagAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { platform, category, audienceId, active, search } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (category !== undefined) where.category = category;
        if (audienceId !== undefined) where.audienceId = audienceId;
        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialHashtags.hashtag, search));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
