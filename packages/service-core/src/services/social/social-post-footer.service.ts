import {
    SocialPostFooterModel as RealSocialPostFooterModel,
    type SelectSocialPostFooter,
    type SocialPostFooterModel,
    safeIlike,
    socialPostFooters
} from '@repo/db';
import type {
    SocialPostFooterAdminSearch,
    SocialPostFooterCreate,
    SocialPostFooterUpdate
} from '@repo/schemas';
import {
    SocialPostFooterAdminSearchSchema,
    SocialPostFooterCreateSchema,
    SocialPostFooterUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { generatePostFooterSlug } from './social.helpers';
import { checkCanManagePostFooter } from './social.permissions';

/**
 * CRUD service for `social_post_footers` (reusable post footer templates).
 *
 * Slug is auto-generated from `name` on create when not explicitly provided.
 * On update, the slug is regenerated when `name` changes and no explicit `slug`
 * is supplied.
 *
 * Permission model: all operations are gated on `SOCIAL_FOOTER_MANAGE`.
 */
export class SocialPostFooterService extends BaseCrudService<
    SelectSocialPostFooter,
    SocialPostFooterModel,
    typeof SocialPostFooterCreateSchema,
    typeof SocialPostFooterUpdateSchema,
    typeof SocialPostFooterAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialPostFooter';
    protected readonly entityName = SocialPostFooterService.ENTITY_NAME;
    public readonly model: SocialPostFooterModel;

    public readonly createSchema = SocialPostFooterCreateSchema;
    public readonly updateSchema = SocialPostFooterUpdateSchema;
    public readonly searchSchema = SocialPostFooterAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialPostFooterModel) {
        super(ctx, SocialPostFooterService.ENTITY_NAME);
        this.model = model ?? new RealSocialPostFooterModel();
        this.adminSearchSchema = SocialPostFooterAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Generates a unique slug from `name` when the caller does not supply one.
     */
    protected override async _beforeCreate(
        data: SocialPostFooterCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialPostFooter>> {
        const slug = data.slug ?? (await generatePostFooterSlug(data.name, this.model));
        return { ...data, slug };
    }

    /**
     * Regenerates the slug when `name` is updated and no explicit `slug` is provided.
     */
    protected override async _beforeUpdate(
        data: SocialPostFooterUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialPostFooter>> {
        if (data.name !== undefined && data.slug === undefined) {
            const slug = await generatePostFooterSlug(data.name, this.model);
            return { ...data, slug };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_FOOTER_MANAGE
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialPostFooterCreate): void {
        checkCanManagePostFooter(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialPostFooter): void {
        checkCanManagePostFooter(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialPostFooter): void {
        checkCanManagePostFooter(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialPostFooter): void {
        checkCanManagePostFooter(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialPostFooter): void {
        checkCanManagePostFooter(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialPostFooter): void {
        checkCanManagePostFooter(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManagePostFooter(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManagePostFooter(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManagePostFooter(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialPostFooter,
        _newVisibility: unknown
    ): void {
        checkCanManagePostFooter(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialPostFooterAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialPostFooter>> {
        const { page = 1, pageSize = 20, sort, platform, active, isDefault, search } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (active !== undefined) where.active = active;
        if (isDefault !== undefined) where.isDefault = isDefault;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialPostFooters.name, search));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialPostFooterAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { platform, active, isDefault, search } = params;
        const where: Record<string, unknown> = {};

        if (platform !== undefined) where.platform = platform;
        if (active !== undefined) where.active = active;
        if (isDefault !== undefined) where.isDefault = isDefault;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialPostFooters.name, search));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
