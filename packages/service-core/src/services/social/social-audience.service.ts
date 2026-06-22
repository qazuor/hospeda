import {
    SocialAudienceModel as RealSocialAudienceModel,
    type SelectSocialAudience,
    type SocialAudienceModel,
    safeIlike,
    socialAudiences
} from '@repo/db';
import type {
    SocialAudienceAdminSearch,
    SocialAudienceCreate,
    SocialAudienceUpdate
} from '@repo/schemas';
import {
    SocialAudienceAdminSearchSchema,
    SocialAudienceCreateSchema,
    SocialAudienceUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { generateAudienceSlug } from './social.helpers';
import { checkCanManageAudience } from './social.permissions';

/**
 * CRUD service for `social_audiences` (target audience descriptors).
 *
 * Slug is auto-generated from `name` on create when not explicitly provided.
 * On update, the slug is regenerated when `name` changes and no explicit `slug`
 * is supplied.
 *
 * Permission model: all operations are gated on `SOCIAL_AUDIENCE_MANAGE`.
 */
export class SocialAudienceService extends BaseCrudService<
    SelectSocialAudience,
    SocialAudienceModel,
    typeof SocialAudienceCreateSchema,
    typeof SocialAudienceUpdateSchema,
    typeof SocialAudienceAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialAudience';
    protected readonly entityName = SocialAudienceService.ENTITY_NAME;
    public readonly model: SocialAudienceModel;

    public readonly createSchema = SocialAudienceCreateSchema;
    public readonly updateSchema = SocialAudienceUpdateSchema;
    public readonly searchSchema = SocialAudienceAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialAudienceModel) {
        super(ctx, SocialAudienceService.ENTITY_NAME);
        this.model = model ?? new RealSocialAudienceModel();
        this.adminSearchSchema = SocialAudienceAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Generates a unique slug from `name` when the caller does not supply one.
     */
    protected override async _beforeCreate(
        data: SocialAudienceCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialAudience>> {
        const slug = data.slug ?? (await generateAudienceSlug(data.name, this.model));
        return { ...data, slug };
    }

    /**
     * Regenerates the slug when `name` is updated and no explicit `slug` is provided.
     */
    protected override async _beforeUpdate(
        data: SocialAudienceUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialAudience>> {
        if (data.name !== undefined && data.slug === undefined) {
            const slug = await generateAudienceSlug(data.name, this.model);
            return { ...data, slug };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_AUDIENCE_MANAGE
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialAudienceCreate): void {
        checkCanManageAudience(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialAudience): void {
        checkCanManageAudience(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialAudience): void {
        checkCanManageAudience(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialAudience): void {
        checkCanManageAudience(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialAudience): void {
        checkCanManageAudience(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialAudience): void {
        checkCanManageAudience(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManageAudience(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManageAudience(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManageAudience(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialAudience,
        _newVisibility: unknown
    ): void {
        checkCanManageAudience(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialAudienceAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialAudience>> {
        const { page = 1, pageSize = 20, sort, active, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialAudiences.name, search));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialAudienceAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { active, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialAudiences.name, search));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
