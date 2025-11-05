/**
 * AdMediaAsset Service
 *
 * Business logic service for managing advertising media assets including
 * images, videos, and HTML content used in campaigns.
 *
 * @module AdMediaAssetService
 */

import type { AdMediaAsset, AdMediaAssetModel } from '@repo/db';
import {
    CreateAdMediaAssetSchema,
    type ListRelationsConfig,
    type MediaAssetTypeEnum,
    PermissionEnum,
    RoleEnum,
    SearchAdMediaAssetSchema,
    ServiceErrorCode,
    UpdateAdMediaAssetSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Type for performance metrics update
 */
export interface UpdatePerformanceMetrics {
    totalViews?: number;
    totalClicks?: number;
    averageViewDuration?: number;
    conversionRate?: number;
}

/**
 * AdMediaAsset Service
 *
 * Provides business logic for managing advertising media assets with
 * support for different asset types (IMAGE, HTML, VIDEO), status management,
 * and performance tracking.
 *
 * @extends BaseCrudService
 */
export class AdMediaAssetService extends BaseCrudService<
    AdMediaAsset,
    AdMediaAssetModel,
    typeof CreateAdMediaAssetSchema,
    typeof UpdateAdMediaAssetSchema,
    typeof SearchAdMediaAssetSchema
> {
    static readonly ENTITY_NAME = 'adMediaAsset';
    protected readonly entityName = AdMediaAssetService.ENTITY_NAME;
    public readonly model: AdMediaAssetModel;

    public readonly createSchema = CreateAdMediaAssetSchema;
    public readonly updateSchema = UpdateAdMediaAssetSchema;
    public readonly searchSchema = SearchAdMediaAssetSchema;

    /**
     * Creates an instance of AdMediaAssetService
     *
     * @param ctx - The service context containing the logger
     * @param model - Optional AdMediaAsset model instance (for testing/mocking)
     */
    constructor(ctx: ServiceContext, model?: AdMediaAssetModel) {
        super(ctx, AdMediaAssetService.ENTITY_NAME);
        this.model = model ?? ({} as AdMediaAssetModel);
    }

    /**
     * Returns default list relations (no relations for ad media assets)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // Permission Hooks
    // ============================================================================

    /**
     * Check if actor can create ad media assets
     *
     * @param actor - The actor performing the action
     * @param _data - The data being created (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create ad media assets'
            );
        }
    }

    /**
     * Check if actor can update ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdate(actor: Actor, _entity: AdMediaAsset): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad media assets'
            );
        }
    }

    /**
     * Check if actor can soft delete ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being deleted (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canSoftDelete(actor: Actor, _entity: AdMediaAsset): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete ad media assets'
            );
        }
    }

    /**
     * Check if actor can view ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being viewed (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canView(actor: Actor, _entity?: AdMediaAsset): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view ad media assets'
            );
        }
    }

    /**
     * Check if actor can hard delete ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being deleted (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canHardDelete(actor: Actor, _entity: AdMediaAsset): void {
        if (!actor || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete ad media assets'
            );
        }
    }

    /**
     * Check if actor can restore soft-deleted ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being restored (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canRestore(actor: Actor, _entity: AdMediaAsset): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore ad media assets'
            );
        }
    }

    /**
     * Check if actor can list ad media assets
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list ad media assets'
            );
        }
    }

    /**
     * Check if actor can search ad media assets
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search ad media assets'
            );
        }
    }

    /**
     * Check if actor can count ad media assets
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count ad media assets'
            );
        }
    }

    /**
     * Check if actor can update visibility of ad media assets
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @param _newVisibility - The new visibility value (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: AdMediaAsset,
        _newVisibility: unknown
    ): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_MEDIA_ASSET_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad media asset visibility'
            );
        }
    }

    // ============================================================================
    // Search and Count Methods
    // ============================================================================

    /**
     * Executes a search query for ad media assets.
     * This method is called by the base search method after permission checks.
     *
     * @param params - Search parameters
     * @param _actor - The actor performing the search (unused)
     * @returns Search results with items and total count
     * @protected
     */
    protected async _executeSearch(
        params: z.infer<typeof SearchAdMediaAssetSchema>
    ): Promise<{ items: AdMediaAsset[]; total: number }> {
        return this.model.search(params);
    }

    /**
     * Executes a count query for ad media assets.
     * This method is called by the base count method after permission checks.
     *
     * @param params - Search parameters for filtering
     * @param _actor - The actor performing the count (unused)
     * @returns Object with count property
     * @protected
     */
    protected async _executeCount(
        params: z.infer<typeof SearchAdMediaAssetSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params as Partial<AdMediaAsset>);
        return { count };
    }

    // ============================================================================
    // Custom Finder Methods
    // ============================================================================

    /**
     * Find all media assets for a specific campaign
     *
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID to filter by
     * @returns Service output with array of assets
     */
    async findByCampaign(actor: Actor, campaignId: string): Promise<ServiceOutput<AdMediaAsset[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const assets = await this.model.findByCampaign(campaignId);
        return { data: assets };
    }

    /**
     * Find all media assets of a specific type
     *
     * @param actor - The actor performing the action
     * @param type - The asset type (IMAGE, HTML, VIDEO)
     * @returns Service output with array of assets
     */
    async findByType(
        actor: Actor,
        type: MediaAssetTypeEnum
    ): Promise<ServiceOutput<AdMediaAsset[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const assets = await this.model.findByType(type);
        return { data: assets };
    }

    /**
     * Get all assets with a specific format (case-insensitive)
     *
     * @param actor - The actor performing the action
     * @param format - The format to filter by (e.g., 'image/jpeg')
     * @returns Service output with array of assets
     */
    async getAssetsByFormat(actor: Actor, format: string): Promise<ServiceOutput<AdMediaAsset[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const assets = await this.model.getAssetsByFormat(format);
        return { data: assets };
    }

    // ============================================================================
    // Business Logic Methods
    // ============================================================================

    /**
     * Update the status of a media asset
     *
     * @param actor - The actor performing the action
     * @param assetId - The asset ID
     * @param status - The new status
     * @returns Service output with updated asset
     */
    async updateStatus(
        actor: Actor,
        assetId: string,
        status: string
    ): Promise<ServiceOutput<AdMediaAsset>> {
        // Check update permission
        try {
            // Get current asset first to check permission
            const current = await this.model.findById(assetId);
            if (!current) {
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad media asset not found')
                };
            }
            this._canUpdate(actor, current);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Validate status enum
        const validStatuses = [
            'draft',
            'processing',
            'approved',
            'active',
            'inactive',
            'archived',
            'rejected'
        ];
        if (!validStatuses.includes(status)) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                )
            };
        }

        // Get current asset again (already validated exists)
        const current = await this.model.findById(assetId);
        if (!current) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad media asset not found')
            };
        }

        // Update specs with new status
        const currentSpecs = (current.specs || {}) as Record<string, unknown>;
        const updatedSpecs = {
            ...currentSpecs,
            status
        } as typeof current.specs;

        // Update asset
        const updated = await this.model.update({ id: assetId }, { specs: updatedSpecs });
        if (!updated) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Ad media asset not found after update'
                )
            };
        }

        return { data: updated };
    }

    /**
     * Update performance metrics for a media asset
     *
     * @param actor - The actor performing the action
     * @param assetId - The asset ID
     * @param metrics - The performance metrics to update
     * @returns Service output with updated asset
     */
    async updatePerformance(
        actor: Actor,
        assetId: string,
        metrics: UpdatePerformanceMetrics
    ): Promise<ServiceOutput<AdMediaAsset>> {
        // Check update permission
        try {
            // Get current asset first to check permission
            const current = await this.model.findById(assetId);
            if (!current) {
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad media asset not found')
                };
            }
            this._canUpdate(actor, current);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Get current asset again
        const current = await this.model.findById(assetId);
        if (!current) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad media asset not found')
            };
        }

        // Calculate engagement rate if views and clicks are provided
        let engagementRate: number | undefined;
        if (metrics.totalViews && metrics.totalClicks) {
            engagementRate = metrics.totalClicks / metrics.totalViews;
        }

        // Update specs with new performance metrics
        const currentSpecs = (current.specs || {}) as Record<string, unknown>;
        const currentPerformance = (currentSpecs.performance || {}) as Record<string, unknown>;

        const updatedPerformance = {
            ...currentPerformance,
            ...metrics,
            ...(engagementRate !== undefined && { engagementRate })
        };

        const updatedSpecs = {
            ...currentSpecs,
            performance: updatedPerformance
        } as typeof current.specs;

        // Update asset
        const updated = await this.model.update({ id: assetId }, { specs: updatedSpecs });
        if (!updated) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Ad media asset not found after update'
                )
            };
        }

        return { data: updated };
    }

    /**
     * Mark an asset as active
     *
     * @param actor - The actor performing the action
     * @param assetId - The asset ID
     * @returns Service output with updated asset
     */
    async markAsActive(actor: Actor, assetId: string): Promise<ServiceOutput<AdMediaAsset>> {
        return this.updateStatus(actor, assetId, 'active');
    }

    /**
     * Mark an asset as inactive
     *
     * @param actor - The actor performing the action
     * @param assetId - The asset ID
     * @returns Service output with updated asset
     */
    async markAsInactive(actor: Actor, assetId: string): Promise<ServiceOutput<AdMediaAsset>> {
        return this.updateStatus(actor, assetId, 'inactive');
    }

    /**
     * Archive an asset
     *
     * @param actor - The actor performing the action
     * @param assetId - The asset ID
     * @returns Service output with updated asset
     */
    async archive(actor: Actor, assetId: string): Promise<ServiceOutput<AdMediaAsset>> {
        return this.updateStatus(actor, assetId, 'archived');
    }
}
