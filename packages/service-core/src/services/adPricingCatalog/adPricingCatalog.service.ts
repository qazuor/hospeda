import type { AdPricingCatalogModel } from '@repo/db';
import {
    type AdPricingCatalog,
    AdPricingCatalogQuerySchema,
    type CampaignChannelEnum,
    CreateAdPricingCatalogSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateAdPricingCatalogSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing ad pricing catalogs. Implements business logic, permissions, and hooks for AdPricingCatalog entities.
 * Handles pricing catalogs for advertising slots with channel-specific pricing, dynamic pricing models, and time-based rate structures.
 * @extends BaseCrudService
 */
export class AdPricingCatalogService extends BaseCrudService<
    AdPricingCatalog,
    AdPricingCatalogModel,
    typeof CreateAdPricingCatalogSchema,
    typeof UpdateAdPricingCatalogSchema,
    typeof AdPricingCatalogQuerySchema
> {
    static readonly ENTITY_NAME = 'adPricingCatalog';
    protected readonly entityName = AdPricingCatalogService.ENTITY_NAME;
    public readonly model: AdPricingCatalogModel;

    public readonly createSchema = CreateAdPricingCatalogSchema;
    public readonly updateSchema = UpdateAdPricingCatalogSchema;
    public readonly searchSchema = AdPricingCatalogQuerySchema;

    /**
     * Initializes a new instance of the AdPricingCatalogService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional AdPricingCatalogModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: AdPricingCatalogModel) {
        super(ctx, AdPricingCatalogService.ENTITY_NAME);
        this.model = model ?? ({} as AdPricingCatalogModel);
    }

    /**
     * Returns default list relations (no relations for ad pricing catalogs)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create an ad pricing catalog.
     * Only ADMIN and users with AD_PRICING_CATALOG_CREATE permission can create.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to create ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can update an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can soft delete an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_DELETE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to delete ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can hard delete an ad pricing catalog.
     * Only ADMIN or AD_PRICING_CATALOG_HARD_DELETE permission holders can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(
            PermissionEnum.AD_PRICING_CATALOG_HARD_DELETE
        );

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to permanently delete ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can view an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_VIEW permission holders can view.
     */
    protected _canView(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to view ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can list ad pricing catalogs.
     * Admin or AD_PRICING_CATALOG_VIEW permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to list ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can restore an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_RESTORE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_RESTORE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to restore ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can search ad pricing catalogs.
     * Admin or AD_PRICING_CATALOG_VIEW permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to search ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can count ad pricing catalogs.
     * Admin or AD_PRICING_CATALOG_VIEW permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to count ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update visibility of ad pricing catalogs'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of an ad pricing catalog.
     * Admin or AD_PRICING_CATALOG_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: AdPricingCatalog): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_PRICING_CATALOG_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Insufficient permissions to update lifecycle state of ad pricing catalogs'
            );
        }
    }

    /**
     * Executes search for ad pricing catalogs.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof AdPricingCatalogQuerySchema>,
        _actor: Actor
    ): Promise<{ items: AdPricingCatalog[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for ad pricing catalogs.
     * Uses the model's count method to count catalogs based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof AdPricingCatalogQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Ad Pricing Catalog Queries
    // =========================================================================

    /**
     * Find all pricing catalogs for a specific ad slot
     *
     * @param actor - Current user context
     * @param adSlotId - The ad slot ID to filter by
     * @returns Service output with array of pricing catalogs
     */
    public async findByAdSlot(
        actor: Actor,
        adSlotId: string
    ): Promise<ServiceOutput<AdPricingCatalog[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByAdSlot',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const catalogs = await this.model.findByAdSlot(adSlotId);

                return catalogs;
            }
        });
    }

    /**
     * Find all pricing catalogs by campaign channel (WEB, SOCIAL)
     *
     * @param actor - Current user context
     * @param channel - The campaign channel to filter by
     * @returns Service output with array of pricing catalogs
     */
    public async findByChannel(
        actor: Actor,
        channel: CampaignChannelEnum
    ): Promise<ServiceOutput<AdPricingCatalog[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByChannel',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const catalogs = await this.model.findByChannel(channel);

                return catalogs;
            }
        });
    }

    /**
     * Find all active pricing catalogs
     *
     * @param actor - Current user context
     * @returns Service output with array of active pricing catalogs
     */
    public async findActive(actor: Actor): Promise<ServiceOutput<AdPricingCatalog[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const catalogs = await this.model.findActive();

                return catalogs;
            }
        });
    }

    /**
     * Calculate price based on catalog and campaign parameters
     *
     * Business Rules:
     * - Catalog must exist and be active
     * - Applies weekend/holiday multipliers if specified
     * - Calculates based on pricing model (CPM, CPC, FLAT)
     *
     * @param actor - Current user context
     * @param params - Pricing calculation parameters
     * @returns Service output with calculated price
     */
    public async calculatePrice(
        actor: Actor,
        params: {
            catalogId: string;
            impressions?: number;
            clicks?: number;
            isWeekend?: boolean;
            isHoliday?: boolean;
        }
    ): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculatePrice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as AdPricingCatalog);

                // Fetch catalog
                const catalog = await this.model.findById(params.catalogId);

                if (!catalog) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Pricing catalog not found: ${params.catalogId}`
                    );
                }

                // Business rule: Catalog must be active
                if (!catalog.isActive) {
                    throw new ServiceError(
                        ServiceErrorCode.BUSINESS_RULE_VIOLATION,
                        'Pricing catalog is not active'
                    );
                }

                // Calculate price using model method
                const price = await this.model.calculatePrice(params);

                return price;
            }
        });
    }
}
