import type { CampaignModel } from '@repo/db';
import {
    type Campaign,
    CampaignStatusEnum,
    CreateCampaignSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    SearchCampaignsSchema,
    ServiceErrorCode,
    type UpdateCampaignBudgetSchema,
    type UpdateCampaignPerformanceSchema,
    UpdateCampaignSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing campaigns. Implements business logic, permissions, and hooks for Campaign entities.
 * Handles marketing campaigns with budget management, audience targeting, and multi-channel delivery.
 * @extends BaseCrudService
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

    /**
     * Initializes a new instance of the CampaignService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional CampaignModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: CampaignModel) {
        super(ctx, CampaignService.ENTITY_NAME);
        this.model = model ?? ({} as CampaignModel);
    }

    /**
     * Returns default list relations (no relations for campaigns)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a campaign.
     * Only ADMIN and users with CAMPAIGN_CREATE permission can create.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.CAMPAIGN_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create campaigns'
            );
        }
    }

    /**
     * Checks if the actor can update a campaign.
     * Admin or CAMPAIGN_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: Campaign): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update campaigns'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a campaign.
     * Admin or CAMPAIGN_DELETE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: Campaign): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete campaigns'
            );
        }
    }

    /**
     * Checks if the actor can view a campaign.
     * Admin or CAMPAIGN_VIEW permission holders can view.
     */
    protected _canView(actor: Actor, _entity: Campaign): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view campaigns'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a campaign.
     * Only ADMIN can permanently delete campaigns.
     */
    protected _canHardDelete(actor: Actor, _entity: Campaign): void {
        if (!actor || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete campaigns'
            );
        }
    }

    /**
     * Checks if the actor can restore a soft-deleted campaign.
     * Admin or CAMPAIGN_DELETE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: Campaign): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore campaigns'
            );
        }
    }

    /**
     * Checks if the actor can list campaigns.
     * Admin or CAMPAIGN_VIEW permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list campaigns'
            );
        }
    }

    /**
     * Checks if the actor can search campaigns.
     * Admin or CAMPAIGN_VIEW permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search campaigns'
            );
        }
    }

    /**
     * Checks if the actor can count campaigns.
     * Admin or CAMPAIGN_VIEW permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count campaigns'
            );
        }
    }

    /**
     * Checks if the actor can update the visibility of a campaign.
     * Admin or CAMPAIGN_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Campaign, _newVisibility: unknown): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CAMPAIGN_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update campaign visibility'
            );
        }
    }

    /**
     * Executes a search query for campaigns.
     * This method is called by the base search method after permission checks.
     */
    protected async _executeSearch(
        params: z.infer<typeof SearchCampaignsSchema>
    ): Promise<{ items: Campaign[]; total: number }> {
        return this.model.search(params);
    }

    /**
     * Executes a count query for campaigns.
     * This method is called by the base count method after permission checks.
     */
    protected async _executeCount(
        params: z.infer<typeof SearchCampaignsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params as Partial<Campaign>);
        return { count };
    }

    // ============================================================================
    // CAMPAIGN STATUS MANAGEMENT
    // ============================================================================

    /**
     * Activate a campaign.
     * Changes campaign status from DRAFT or SCHEDULED to ACTIVE.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @returns ServiceOutput with the updated campaign or error
     */
    async activate(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Only DRAFT or SCHEDULED campaigns can be activated
                if (
                    campaign.status !== CampaignStatusEnum.DRAFT &&
                    campaign.status !== CampaignStatusEnum.SCHEDULED
                ) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Campaign is already active or cannot be activated'
                    );
                }

                // Update status
                const updated = await this.model.update(
                    { id: campaignId },
                    { status: CampaignStatusEnum.ACTIVE }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Pause an active campaign.
     * Changes campaign status from ACTIVE to PAUSED.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @returns ServiceOutput with the updated campaign or error
     */
    async pause(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'pause',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Only ACTIVE campaigns can be paused
                if (campaign.status !== CampaignStatusEnum.ACTIVE) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Campaign is not active and cannot be paused'
                    );
                }

                // Update status
                const updated = await this.model.update(
                    { id: campaignId },
                    { status: CampaignStatusEnum.PAUSED }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Complete a campaign.
     * Changes campaign status to COMPLETED.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @returns ServiceOutput with the updated campaign or error
     */
    async complete(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'complete',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Only ACTIVE campaigns can be completed
                if (campaign.status !== CampaignStatusEnum.ACTIVE) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Campaign is not active and cannot be completed'
                    );
                }

                // Update status
                const updated = await this.model.update(
                    { id: campaignId },
                    { status: CampaignStatusEnum.COMPLETED }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Cancel a campaign.
     * Changes campaign status to CANCELLED.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @returns ServiceOutput with the updated campaign or error
     */
    async cancel(actor: Actor, campaignId: string): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Cannot cancel COMPLETED campaigns
                if (campaign.status === CampaignStatusEnum.COMPLETED) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Cannot cancel a completed campaign'
                    );
                }

                // Update status
                const updated = await this.model.update(
                    { id: campaignId },
                    { status: CampaignStatusEnum.CANCELLED }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    // ============================================================================
    // BUDGET MANAGEMENT
    // ============================================================================

    /**
     * Update campaign budget.
     * Updates total and/or daily budget for the campaign.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @param budget - Budget updates
     * @returns ServiceOutput with the updated campaign or error
     */
    async updateBudget(
        actor: Actor,
        campaignId: string,
        budget: z.infer<typeof UpdateCampaignBudgetSchema>
    ): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updateBudget',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Daily budget cannot exceed total budget
                const totalBudget = budget.totalBudget ?? campaign.budget.totalBudget;
                const dailyBudget = budget.dailyBudget ?? campaign.budget.dailyBudget;

                if (dailyBudget && dailyBudget > totalBudget) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Daily budget cannot exceed total budget'
                    );
                }

                // Update budget
                const updated = await this.model.update(
                    { id: campaignId },
                    {
                        budget: {
                            ...campaign.budget,
                            ...budget
                        }
                    }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Record campaign spending.
     * Increases the spent amount for the campaign.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @param amount - Amount spent
     * @returns ServiceOutput with the updated campaign or error
     */
    async recordSpend(
        actor: Actor,
        campaignId: string,
        amount: number
    ): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'recordSpend',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canUpdate(validatedActor, campaign);

                // Business rule: Cannot exceed total budget
                const newSpentAmount = campaign.budget.spentAmount + amount;

                if (newSpentAmount > campaign.budget.totalBudget) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Cannot spend more than total budget'
                    );
                }

                // Update spent amount
                const updated = await this.model.update(
                    { id: campaignId },
                    {
                        budget: {
                            ...campaign.budget,
                            spentAmount: newSpentAmount
                        }
                    }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    // ============================================================================
    // PERFORMANCE TRACKING
    // ============================================================================

    /**
     * Update campaign performance metrics.
     * Updates impressions, clicks, conversions, and calculated metrics.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @param metrics - Performance metrics to update
     * @returns ServiceOutput with the updated campaign or error
     */
    async updatePerformance(
        actor: Actor,
        campaignId: string,
        metrics: z.infer<typeof UpdateCampaignPerformanceSchema>
    ): Promise<ServiceOutput<Campaign>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updatePerformance',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check (requires CAMPAIGN_PERFORMANCE_VIEW permission)
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.CAMPAIGN_PERFORMANCE_VIEW
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can update campaign performance'
                    );
                }

                // Calculate derived metrics
                let clickThroughRate = 0;
                let conversionRate = 0;

                if (metrics.impressions && metrics.impressions > 0 && metrics.clicks) {
                    clickThroughRate = metrics.clicks / metrics.impressions;
                }

                if (metrics.clicks && metrics.clicks > 0 && metrics.conversions) {
                    conversionRate = metrics.conversions / metrics.clicks;
                }

                // Update performance
                const updated = await this.model.update(
                    { id: campaignId },
                    {
                        performance: {
                            ...(campaign.performance ?? {}),
                            ...metrics,
                            clickThroughRate: metrics.clickThroughRate ?? clickThroughRate,
                            conversionRate: metrics.conversionRate ?? conversionRate
                        } as Campaign['performance']
                    }
                );

                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Campaign not found after update'
                    );
                }

                return updated;
            }
        });
    }

    /**
     * Get campaign performance ROI.
     * Calculates return on investment based on spent budget and conversions.
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID
     * @returns ServiceOutput with ROI data or error
     */
    async getPerformanceROI(
        actor: Actor,
        campaignId: string
    ): Promise<ServiceOutput<{ roi: number; conversions: number; spentAmount: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPerformanceROI',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                const campaign = await this.model.findById(campaignId);

                if (!campaign) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Campaign not found');
                }

                // Permission check
                this._canView(validatedActor, campaign);

                const spentAmount = campaign.budget.spentAmount;
                const conversions = campaign.performance?.conversions ?? 0;
                const returnOnAdSpend = campaign.performance?.returnOnAdSpend ?? 0;

                // Calculate ROI
                const roi =
                    spentAmount > 0 ? ((returnOnAdSpend - spentAmount) / spentAmount) * 100 : 0;

                return {
                    roi,
                    conversions,
                    spentAmount
                };
            }
        });
    }

    // ============================================================================
    // FILTERING METHODS
    // ============================================================================

    /**
     * Find campaigns by client ID.
     * Returns all campaigns belonging to a specific client.
     * @param actor - The actor performing the action
     * @param clientId - The client ID
     * @returns ServiceOutput with array of campaigns or error
     */
    async findByClient(actor: Actor, clientId: string): Promise<ServiceOutput<Campaign[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.CAMPAIGN_VIEW
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can view campaigns'
                    );
                }

                const campaigns = await this.model.findByClient(clientId);

                return campaigns;
            }
        });
    }

    /**
     * Find active campaigns.
     * Returns all campaigns with ACTIVE status.
     * @param actor - The actor performing the action
     * @returns ServiceOutput with array of active campaigns or error
     */
    async findActive(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.CAMPAIGN_VIEW
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can view campaigns'
                    );
                }

                const campaigns = await this.model.findActive();

                return campaigns;
            }
        });
    }

    /**
     * Find scheduled campaigns.
     * Returns all campaigns with SCHEDULED status.
     * @param actor - The actor performing the action
     * @returns ServiceOutput with array of scheduled campaigns or error
     */
    async findScheduled(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findScheduled',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.CAMPAIGN_VIEW
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can view campaigns'
                    );
                }

                const result = await this.model.findAll({ status: CampaignStatusEnum.SCHEDULED });

                return result.items;
            }
        });
    }

    /**
     * Find completed campaigns.
     * Returns all campaigns with COMPLETED status.
     * @param actor - The actor performing the action
     * @returns ServiceOutput with array of completed campaigns or error
     */
    async findCompleted(actor: Actor): Promise<ServiceOutput<Campaign[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findCompleted',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.CAMPAIGN_VIEW
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can view campaigns'
                    );
                }

                const result = await this.model.findAll({ status: CampaignStatusEnum.COMPLETED });

                return result.items;
            }
        });
    }
}
