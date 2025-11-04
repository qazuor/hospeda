import {
    type OverlapCheckResult,
    PricingTierModel,
    type RangeValidationResult,
    type SavingsCalculation,
    type TierPriceCalculation,
    type TierStructureValidation
} from '@repo/db/models';
import type { ListRelationsConfig } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { PricingTier } from '@repo/schemas/entities/pricingTier';
import {
    PricingTierCreateInputSchema,
    PricingTierSearchSchema,
    PricingTierUpdateInputSchema
} from '@repo/schemas/entities/pricingTier';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing pricing tiers. Implements business logic, permissions, and hooks for PricingTier entities.
 * @extends BaseCrudService
 */
export class PricingTierService extends BaseCrudService<
    PricingTier,
    PricingTierModel,
    typeof PricingTierCreateInputSchema,
    typeof PricingTierUpdateInputSchema,
    typeof PricingTierSearchSchema
> {
    static readonly ENTITY_NAME = 'pricingTier';
    protected readonly entityName = PricingTierService.ENTITY_NAME;
    public readonly model: PricingTierModel;

    public readonly createSchema = PricingTierCreateInputSchema;
    public readonly updateSchema = PricingTierUpdateInputSchema;
    public readonly searchSchema = PricingTierSearchSchema;

    /**
     * Initializes a new instance of the PricingTierService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PricingTierModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PricingTierModel) {
        super(ctx, PricingTierService.ENTITY_NAME);
        this.model = model ?? new PricingTierModel();
    }

    /**
     * Returns default list relations (no relations for pricing tier)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a pricing tier.
     * Only ADMIN and users with PRICING_TIER_CREATE permission can create pricing tiers.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new pricing tier.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PRICING_TIER_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with PRICING_TIER_CREATE can create pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can update a pricing tier.
     * Admin or PRICING_TIER_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing tier entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: PricingTier): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PRICING_TIER_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a pricing tier.
     * Admin or PRICING_TIER_DELETE permission holders can soft delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing tier entity to be soft deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: PricingTier): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PRICING_TIER_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can soft delete pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a pricing tier.
     * Only super admins can permanently delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing tier entity to be hard deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: PricingTier): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can restore a pricing tier.
     * Only admins can restore soft deleted pricing tiers.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing tier entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: PricingTier): void {
        if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can view a pricing tier.
     * Any authenticated user can view pricing tiers.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing tier entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: PricingTier): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can list pricing tiers.
     * Any authenticated user can list.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can search pricing tiers.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search pricing tiers'
            );
        }
    }

    /**
     * Checks if the actor can count pricing tiers.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count pricing tiers'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for pricing tiers.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of pricing tiers matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for pricing tiers.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of pricing tiers matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS
    // ============================================================================

    /**
     * Find the applicable tier for a given quantity
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param quantity - Quantity to check
     * @returns ServiceOutput with applicable tier or null
     */
    public async findApplicableTier(
        actor: Actor,
        pricingPlanId: string,
        quantity: number
    ): Promise<ServiceOutput<PricingTier | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findApplicableTier',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute
                const tier = await this.model.findApplicableTier(
                    pricingPlanId,
                    quantity,
                    undefined
                );

                return tier;
            }
        });
    }

    /**
     * Calculate price using tier pricing
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param quantity - Quantity to calculate price for
     * @returns ServiceOutput with price calculation or null
     */
    public async calculatePrice(
        actor: Actor,
        pricingPlanId: string,
        quantity: number
    ): Promise<ServiceOutput<TierPriceCalculation | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculatePrice',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute calculation
                const calculation = await this.model.calculatePrice(
                    pricingPlanId,
                    quantity,
                    undefined
                );

                return calculation;
            }
        });
    }

    /**
     * Validate tier ranges for overlaps and gaps
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @returns ServiceOutput with range validation result
     */
    public async validateRanges(
        actor: Actor,
        pricingPlanId: string
    ): Promise<ServiceOutput<RangeValidationResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateRanges',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute validation
                const validation = await this.model.validateRanges(pricingPlanId, undefined);

                return validation;
            }
        });
    }

    /**
     * Check for overlapping tiers
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @returns ServiceOutput with overlap check result
     */
    public async checkOverlaps(
        actor: Actor,
        pricingPlanId: string
    ): Promise<ServiceOutput<OverlapCheckResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkOverlaps',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute check
                const overlaps = await this.model.checkOverlaps(pricingPlanId, undefined);

                return overlaps;
            }
        });
    }

    /**
     * Get the best tier for a specific quantity
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param quantity - Quantity to check
     * @returns ServiceOutput with tier or null
     */
    public async getTierForQuantity(
        actor: Actor,
        pricingPlanId: string,
        quantity: number
    ): Promise<ServiceOutput<PricingTier | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTierForQuantity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute
                const tier = await this.model.getTierForQuantity(
                    pricingPlanId,
                    quantity,
                    undefined
                );

                return tier;
            }
        });
    }

    /**
     * Calculate savings compared to base plan price
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param quantity - Quantity to calculate savings for
     * @returns ServiceOutput with savings calculation or null
     */
    public async calculateSavings(
        actor: Actor,
        pricingPlanId: string,
        quantity: number
    ): Promise<ServiceOutput<SavingsCalculation | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateSavings',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute calculation
                const savings = await this.model.calculateSavings(
                    pricingPlanId,
                    quantity,
                    undefined
                );

                return savings;
            }
        });
    }

    /**
     * Find all tiers for a pricing plan
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @returns ServiceOutput with array of pricing tiers
     */
    public async findByPlan(
        actor: Actor,
        pricingPlanId: string
    ): Promise<ServiceOutput<PricingTier[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByPlan',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute
                const tiers = await this.model.findByPlan(pricingPlanId, undefined);

                return tiers;
            }
        });
    }

    /**
     * Validate the overall tier structure
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @returns ServiceOutput with tier structure validation
     */
    public async validateTierStructure(
        actor: Actor,
        pricingPlanId: string
    ): Promise<ServiceOutput<TierStructureValidation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateTierStructure',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute validation
                const validation = await this.model.validateTierStructure(pricingPlanId, undefined);

                return validation;
            }
        });
    }

    /**
     * Get the optimal tier for volume pricing
     * @param actor - Actor performing the operation
     * @param pricingPlanId - Pricing plan ID
     * @param targetQuantity - Target quantity
     * @returns ServiceOutput with optimal tier or null
     */
    public async getOptimalTier(
        actor: Actor,
        pricingPlanId: string,
        targetQuantity: number
    ): Promise<ServiceOutput<PricingTier | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getOptimalTier',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: pricingPlanId } as PricingTier);

                // Execute
                const tier = await this.model.getOptimalTier(
                    pricingPlanId,
                    targetQuantity,
                    undefined
                );

                return tier;
            }
        });
    }
}
