import type { CampaignModel } from '@repo/db';
import type { Campaign, ListRelationsConfig } from '@repo/schemas';
import {
    CampaignStatusEnum,
    CreateCampaignSchema,
    SearchCampaignsSchema,
    ServiceErrorCode,
    UpdateCampaignSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type {
    Actor,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types/index.js';
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

    // ============================================================================
    // BUSINESS METHODS
    // ============================================================================

    /**
     * Activate a campaign
     */
    async activate(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        // Business rule: Cannot activate an already active campaign
        if (campaign.status === CampaignStatusEnum.ACTIVE) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Campaign is already active'
                }
            };
        }

        const updated = await this.model.update(
            { id: campaignId },
            { status: CampaignStatusEnum.ACTIVE }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Pause a campaign
     */
    async pause(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        // Business rule: Can only pause an active campaign
        if (campaign.status !== CampaignStatusEnum.ACTIVE) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Campaign is not active'
                }
            };
        }

        const updated = await this.model.update(
            { id: campaignId },
            { status: CampaignStatusEnum.PAUSED }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Complete a campaign
     */
    async complete(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        const updated = await this.model.update(
            { id: campaignId },
            { status: CampaignStatusEnum.COMPLETED }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Cancel a campaign
     */
    async cancel(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        const updated = await this.model.update(
            { id: campaignId },
            { status: CampaignStatusEnum.CANCELLED }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Update campaign budget
     */
    async updateBudget(
        actor: Actor,
        campaignId: string,
        newBudget: number
    ): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        // Business rule: Daily budget cannot exceed total budget
        if (campaign.budget.dailyBudget !== undefined && campaign.budget.dailyBudget > newBudget) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Daily budget cannot exceed total budget'
                }
            };
        }

        const updated = await this.model.update(
            { id: campaignId },
            {
                budget: {
                    ...campaign.budget,
                    totalBudget: newBudget
                }
            }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Record spending for a campaign
     */
    async recordSpend(
        actor: Actor,
        campaignId: string,
        amount: number
    ): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        const currentSpend = campaign.budget.spentAmount;
        const newSpend = currentSpend + amount;

        // Business rule: Spend cannot exceed total budget
        if (newSpend > campaign.budget.totalBudget) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Spend exceeds total budget'
                }
            };
        }

        const updated = await this.model.update(
            { id: campaignId },
            {
                budget: {
                    ...campaign.budget,
                    spentAmount: newSpend
                }
            }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Update performance metrics
     */
    async updatePerformance(
        actor: Actor,
        campaignId: string,
        metrics: Record<string, unknown>
    ): Promise<ServiceOutput<Campaign>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canUpdate(actor, campaign);

        const updated = await this.model.update(
            { id: campaignId },
            {
                performance: {
                    impressions: (metrics.impressions as number) ?? 0,
                    clicks: (metrics.clicks as number) ?? 0,
                    conversions: (metrics.conversions as number) ?? 0,
                    clickThroughRate: (metrics.clickThroughRate as number) ?? 0,
                    conversionRate: (metrics.conversionRate as number) ?? 0,
                    costPerClick: (metrics.costPerClick as number) ?? 0,
                    costPerConversion: (metrics.costPerConversion as number) ?? 0,
                    returnOnAdSpend: (metrics.returnOnAdSpend as number) ?? 0
                }
            }
        );
        if (!updated) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Failed to update campaign'
                }
            };
        }
        return { data: updated };
    }

    /**
     * Get performance ROI for a campaign
     */
    async getPerformanceROI(
        actor: Actor,
        campaignId: string
    ): Promise<ServiceOutput<{ roi: number; conversions: number }>> {
        const campaign = await this.model.findById(campaignId);
        if (!campaign) {
            return { error: { code: ServiceErrorCode.NOT_FOUND, message: 'Campaign not found' } };
        }

        this._canView(actor, campaign);

        const conversions = campaign.performance?.conversions ?? 0;
        const roi = campaign.performance?.returnOnAdSpend ?? 0;

        return { data: { roi, conversions } };
    }

    /**
     * Find campaigns by client
     */
    async findByClient(actor: Actor, clientId: string): Promise<ServiceOutput<Campaign[]>> {
        this._canView(actor, {} as Campaign);
        const campaigns = await this.model.findByClient(clientId);
        return { data: campaigns };
    }

    /**
     * Find active campaigns
     */
    async findActive(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        this._canView(actor, {} as Campaign);
        const campaigns = await this.model.findActive();
        return { data: campaigns };
    }

    /**
     * Find scheduled campaigns
     */
    async findScheduled(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        this._canView(actor, {} as Campaign);
        const result = await this.model.findAll({ status: CampaignStatusEnum.SCHEDULED });
        return { data: result.items || [] };
    }

    /**
     * Find completed campaigns
     */
    async findCompleted(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        this._canView(actor, {} as Campaign);
        const result = await this.model.findAll({ status: CampaignStatusEnum.COMPLETED });
        return { data: result.items || [] };
    }
}
