import {
    type PricingCalculationResult,
    PricingPlanModel,
    type PricingPlanWithTiers,
    type QuantityValidationResult,
    type UsageStats
} from '@repo/db';
import type { BillingIntervalEnum, ListRelationsConfig } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { PricingPlan } from '@repo/schemas/entities/pricingPlan';
import {
    PricingPlanCreateInputSchema,
    PricingPlanSearchSchema,
    PricingPlanUpdateInputSchema
} from '@repo/schemas/entities/pricingPlan';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing pricing plans. Implements business logic, permissions, and hooks for PricingPlan entities.
 * @extends BaseCrudService
 */
export class PricingPlanService extends BaseCrudService<
    PricingPlan,
    PricingPlanModel,
    typeof PricingPlanCreateInputSchema,
    typeof PricingPlanUpdateInputSchema,
    typeof PricingPlanSearchSchema
> {
    static readonly ENTITY_NAME = 'pricingPlan';
    protected readonly entityName = PricingPlanService.ENTITY_NAME;
    public readonly model: PricingPlanModel;

    public readonly createSchema = PricingPlanCreateInputSchema;
    public readonly updateSchema = PricingPlanUpdateInputSchema;
    public readonly searchSchema = PricingPlanSearchSchema;

    /**
     * Initializes a new instance of the PricingPlanService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PricingPlanModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PricingPlanModel) {
        super(ctx, PricingPlanService.ENTITY_NAME);
        this.model = model ?? new PricingPlanModel();
    }

    /**
     * Returns default list relations (no relations for pricing plan)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a pricing plan.
     * Only ADMIN and users with PRICING_PLAN_CREATE permission can create pricing plans.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new pricing plan.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PRICING_PLAN_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with PRICING_PLAN_CREATE can create pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can update a pricing plan.
     * Admin or PRICING_PLAN_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing plan entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: PricingPlan): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PRICING_PLAN_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can soft-delete a pricing plan.
     * Only ADMIN and users with PRICING_PLAN_DELETE permission can soft-delete pricing plans.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing plan entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: PricingPlan): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PRICING_PLAN_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can delete pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can hard-delete a pricing plan.
     * Only SUPER_ADMIN can hard-delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing plan entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: PricingPlan): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can restore a pricing plan.
     * Only ADMIN can restore.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing plan entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: PricingPlan): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can view a pricing plan.
     * Authenticated users can view pricing plans.
     * @param actor - The user or system performing the action.
     * @param _entity - The pricing plan entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: PricingPlan): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can list pricing plans.
     * Any authenticated user can list pricing plans.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can search pricing plans.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search pricing plans'
            );
        }
    }

    /**
     * Checks if the actor can count pricing plans.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count pricing plans'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for pricing plans.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of pricing plans matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for pricing plans.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of pricing plans matching the criteria.
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
     * Calculates total price for a pricing plan with given quantity.
     * @param actor - The user or system performing the action.
     * @param planId - The pricing plan ID.
     * @param quantity - The quantity to calculate pricing for.
     * @returns ServiceOutput containing pricing calculation result.
     */
    public async calculateTotal(
        actor: Actor,
        planId: string,
        quantity: number
    ): Promise<ServiceOutput<PricingCalculationResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateTotal',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: planId } as PricingPlan);

                // Execute calculation
                const calculation = await this.model.calculateTotal(planId, quantity, undefined);

                return calculation;
            }
        });
    }

    /**
     * Gets applicable pricing tiers for a plan and quantity.
     * @param actor - The user or system performing the action.
     * @param planId - The pricing plan ID.
     * @param quantity - The quantity to check tiers for.
     * @returns ServiceOutput containing array of applicable tiers.
     */
    public async getApplicableTiers(
        actor: Actor,
        planId: string,
        quantity: number
    ): Promise<
        ServiceOutput<
            Array<{
                id: string;
                minQuantity: number;
                maxQuantity: number | null;
                unitPriceMinor: number;
            }>
        >
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getApplicableTiers',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: planId } as PricingPlan);

                // Execute query
                const tiers = await this.model.getApplicableTiers(planId, quantity, undefined);

                return tiers;
            }
        });
    }

    /**
     * Validates quantity against plan constraints.
     * @param actor - The user or system performing the action.
     * @param planId - The pricing plan ID.
     * @param quantity - The quantity to validate.
     * @returns ServiceOutput containing validation result.
     */
    public async validateQuantity(
        actor: Actor,
        planId: string,
        quantity: number
    ): Promise<ServiceOutput<QuantityValidationResult>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateQuantity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: planId } as PricingPlan);

                // Execute validation
                const validation = await this.model.validateQuantity(planId, quantity);

                return validation;
            }
        });
    }

    /**
     * Finds pricing plans by product ID.
     * @param actor - The user or system performing the action.
     * @param productId - The product ID to search for.
     * @returns ServiceOutput containing the pricing plans array.
     */
    public async findByProduct(
        actor: Actor,
        productId: string
    ): Promise<ServiceOutput<PricingPlan[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByProduct',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const plans = await this.model.findByProduct(productId, undefined);

                return plans;
            }
        });
    }

    /**
     * Finds recurring pricing plans by billing interval.
     * @param actor - The user or system performing the action.
     * @param interval - The billing interval to search for.
     * @returns ServiceOutput containing array of recurring pricing plans.
     */
    public async findRecurring(
        actor: Actor,
        interval: BillingIntervalEnum
    ): Promise<ServiceOutput<PricingPlan[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findRecurring',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const plans = await this.model.findRecurring(interval, undefined);

                return plans;
            }
        });
    }

    /**
     * Finds one-time billing pricing plans.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing array of one-time pricing plans.
     */
    public async findOneTime(actor: Actor): Promise<ServiceOutput<PricingPlan[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findOneTime',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const plans = await this.model.findOneTime(undefined);

                return plans;
            }
        });
    }

    /**
     * Finds pricing plans with their pricing tiers.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing pricing plans with their tiers.
     */
    public async findWithTiers(actor: Actor): Promise<ServiceOutput<PricingPlanWithTiers[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findWithTiers',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const plans = await this.model.withTiers(undefined);

                return plans;
            }
        });
    }

    /**
     * Gets usage statistics for a pricing plan.
     * @param actor - The user or system performing the action.
     * @param planId - The pricing plan ID.
     * @returns ServiceOutput containing usage statistics.
     */
    public async getUsageStats(actor: Actor, planId: string): Promise<ServiceOutput<UsageStats>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageStats',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: planId } as PricingPlan);

                // Execute query
                const stats = await this.model.getUsageStats(planId);

                return stats;
            }
        });
    }
}
