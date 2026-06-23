import {
    SocialCampaignModel as RealSocialCampaignModel,
    type SelectSocialCampaign,
    type SocialCampaignModel,
    safeIlike,
    socialCampaigns
} from '@repo/db';
import type {
    SocialCampaignAdminSearch,
    SocialCampaignCreate,
    SocialCampaignUpdate
} from '@repo/schemas';
import {
    SocialCampaignAdminSearchSchema,
    SocialCampaignCreateSchema,
    SocialCampaignUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { gte, lte } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { generateCampaignSlug } from './social.helpers';
import { checkCanManageCampaign } from './social.permissions';

/**
 * CRUD service for `social_campaigns` (content campaign groupings).
 *
 * Slug is auto-generated from `name` on create when not explicitly provided.
 * On update, the slug is regenerated when `name` changes and no explicit `slug`
 * is supplied.
 *
 * Permission model: all operations are gated on `SOCIAL_CAMPAIGN_MANAGE`.
 */
export class SocialCampaignService extends BaseCrudService<
    SelectSocialCampaign,
    SocialCampaignModel,
    typeof SocialCampaignCreateSchema,
    typeof SocialCampaignUpdateSchema,
    typeof SocialCampaignAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialCampaign';
    protected readonly entityName = SocialCampaignService.ENTITY_NAME;
    public readonly model: SocialCampaignModel;

    public readonly createSchema = SocialCampaignCreateSchema;
    public readonly updateSchema = SocialCampaignUpdateSchema;
    public readonly searchSchema = SocialCampaignAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialCampaignModel) {
        super(ctx, SocialCampaignService.ENTITY_NAME);
        this.model = model ?? new RealSocialCampaignModel();
        this.adminSearchSchema = SocialCampaignAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Generates a unique slug from `name` when the caller does not supply one.
     */
    protected override async _beforeCreate(
        data: SocialCampaignCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialCampaign>> {
        const slug = data.slug ?? (await generateCampaignSlug(data.name, this.model));
        return { ...data, slug };
    }

    /**
     * Regenerates the slug when `name` is updated and no explicit `slug` is provided.
     */
    protected override async _beforeUpdate(
        data: SocialCampaignUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialCampaign>> {
        if (data.name !== undefined && data.slug === undefined) {
            const slug = await generateCampaignSlug(data.name, this.model);
            return { ...data, slug };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_CAMPAIGN_MANAGE
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialCampaignCreate): void {
        checkCanManageCampaign(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialCampaign): void {
        checkCanManageCampaign(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialCampaign): void {
        checkCanManageCampaign(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialCampaign): void {
        checkCanManageCampaign(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialCampaign): void {
        checkCanManageCampaign(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialCampaign): void {
        checkCanManageCampaign(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManageCampaign(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManageCampaign(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManageCampaign(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialCampaign,
        _newVisibility: unknown
    ): void {
        checkCanManageCampaign(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialCampaignAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialCampaign>> {
        const { page = 1, pageSize = 20, sort, active, startsAfter, endsBefore, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialCampaigns.name, search));
        }
        if (startsAfter !== undefined) {
            additionalConditions.push(gte(socialCampaigns.startsAt, startsAfter));
        }
        if (endsBefore !== undefined) {
            additionalConditions.push(lte(socialCampaigns.endsAt, endsBefore));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialCampaignAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { active, startsAfter, endsBefore, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialCampaigns.name, search));
        }
        if (startsAfter !== undefined) {
            additionalConditions.push(gte(socialCampaigns.startsAt, startsAfter));
        }
        if (endsBefore !== undefined) {
            additionalConditions.push(lte(socialCampaigns.endsAt, endsBefore));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
