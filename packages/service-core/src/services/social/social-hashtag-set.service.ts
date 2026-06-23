import {
    SocialHashtagSetModel as RealSocialHashtagSetModel,
    type SelectSocialHashtagSet,
    type SocialHashtagSetModel,
    safeIlike,
    socialHashtagSets
} from '@repo/db';
import type {
    SocialHashtagSetAdminSearch,
    SocialHashtagSetCreate,
    SocialHashtagSetUpdate
} from '@repo/schemas';
import {
    SocialHashtagSetAdminSearchSchema,
    SocialHashtagSetCreateSchema,
    SocialHashtagSetUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { generateHashtagSetSlug } from './social.helpers';
import { checkCanManageHashtagSet } from './social.permissions';

/**
 * CRUD service for `social_hashtag_sets` (named collections of hashtags).
 *
 * Slug is auto-generated from `name` on create when not explicitly provided.
 * On update, the slug is regenerated when `name` changes and no explicit `slug`
 * is supplied.
 *
 * Permission model: all operations (including read/list/search) are gated on
 * `SOCIAL_HASHTAG_SET_MANAGE` — no separate view permission exists.
 */
export class SocialHashtagSetService extends BaseCrudService<
    SelectSocialHashtagSet,
    SocialHashtagSetModel,
    typeof SocialHashtagSetCreateSchema,
    typeof SocialHashtagSetUpdateSchema,
    typeof SocialHashtagSetAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialHashtagSet';
    protected readonly entityName = SocialHashtagSetService.ENTITY_NAME;
    public readonly model: SocialHashtagSetModel;

    public readonly createSchema = SocialHashtagSetCreateSchema;
    public readonly updateSchema = SocialHashtagSetUpdateSchema;
    public readonly searchSchema = SocialHashtagSetAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialHashtagSetModel) {
        super(ctx, SocialHashtagSetService.ENTITY_NAME);
        this.model = model ?? new RealSocialHashtagSetModel();
        this.adminSearchSchema = SocialHashtagSetAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Generates a unique slug from `name` when the caller does not supply one.
     */
    protected override async _beforeCreate(
        data: SocialHashtagSetCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialHashtagSet>> {
        const slug = data.slug ?? (await generateHashtagSetSlug(data.name, this.model));
        return { ...data, slug };
    }

    /**
     * Regenerates the slug when `name` is updated and no explicit `slug` is provided.
     */
    protected override async _beforeUpdate(
        data: SocialHashtagSetUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialHashtagSet>> {
        if (data.name !== undefined && data.slug === undefined) {
            const slug = await generateHashtagSetSlug(data.name, this.model);
            return { ...data, slug };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_HASHTAG_SET_MANAGE
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialHashtagSetCreate): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialHashtagSet): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialHashtagSet): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialHashtagSet): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialHashtagSet): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialHashtagSet): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManageHashtagSet(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialHashtagSet,
        _newVisibility: unknown
    ): void {
        checkCanManageHashtagSet(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialHashtagSetAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialHashtagSet>> {
        const { page = 1, pageSize = 20, sort, platform, active, search } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialHashtagSets.name, search));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialHashtagSetAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { platform, active, search } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialHashtagSets.name, search));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
