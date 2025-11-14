import type { CampaignModel } from '@repo/db';
import type { Campaign, ListRelationsConfig } from '@repo/schemas';
import { CreateCampaignSchema, SearchCampaignsSchema, UpdateCampaignSchema } from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types/index.js';
import {
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './campaign.permissions.js';

/**
 * Service for managing campaigns.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for advertising campaign management.
 */
export class CampaignService extends BaseCrudService<
    Campaign,
    CampaignModel,
    typeof CreateCampaignSchema,
    typeof UpdateCampaignSchema,
    typeof SearchCampaignsSchema
> {
    static readonly ENTITY_NAME = 'campaign';
    protected readonly entityName = CampaignService.ENTITY_NAME;

    public readonly model: CampaignModel;

    public readonly createSchema = CreateCampaignSchema;
    public readonly updateSchema = UpdateCampaignSchema;
    public readonly searchSchema = SearchCampaignsSchema;

    constructor(ctx: ServiceContext, model?: CampaignModel) {
        super(ctx, CampaignService.ENTITY_NAME);
        this.model = model ?? ({} as CampaignModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create campaigns
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update campaigns
     */
    protected _canUpdate(actor: Actor, entity: Campaign): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch campaigns
     */
    protected _canPatch(actor: Actor, entity: Campaign, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of campaigns
     */
    protected _canUpdateVisibility(actor: Actor, entity: Campaign): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete campaigns
     */
    protected _canDelete(actor: Actor, entity: Campaign): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete campaigns
     */
    protected _canHardDelete(actor: Actor, entity: Campaign): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore campaigns
     */
    protected _canRestore(actor: Actor, entity: Campaign): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view campaigns
     */
    protected _canView(actor: Actor, entity: Campaign): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list campaigns
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete campaigns
     */
    protected _canSoftDelete(actor: Actor, entity: Campaign): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search campaigns
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count campaigns
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for campaigns
     */
    protected async _executeSearch(
        _params: z.infer<typeof SearchCampaignsSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<Campaign>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for campaigns
     */
    protected async _executeCount(
        _params: z.infer<typeof SearchCampaignsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
