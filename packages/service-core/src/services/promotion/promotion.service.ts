import type { PromotionModel } from '@repo/db';
import {
    CreatePromotionSchema,
    ListPromotionsSchema,
    type ListRelationsConfig,
    PermissionEnum,
    type Promotion,
    RoleEnum,
    ServiceErrorCode,
    UpdatePromotionSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing promotions. Implements business logic, permissions, and hooks for Promotion entities.
 * Handles marketing promotions, campaigns, and discount code distribution.
 * @extends BaseCrudService
 */
export class PromotionService extends BaseCrudService<
    Promotion,
    PromotionModel,
    typeof CreatePromotionSchema,
    typeof UpdatePromotionSchema,
    typeof ListPromotionsSchema
> {
    static readonly ENTITY_NAME = 'promotion';
    protected readonly entityName = PromotionService.ENTITY_NAME;
    public readonly model: PromotionModel;

    public readonly createSchema = CreatePromotionSchema;
    public readonly updateSchema = UpdatePromotionSchema;
    public readonly searchSchema = ListPromotionsSchema;

    /**
     * Initializes a new instance of the PromotionService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional PromotionModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: PromotionModel) {
        super(ctx, PromotionService.ENTITY_NAME);
        this.model = model ?? ({} as PromotionModel);
    }

    /**
     * Returns default list relations (no relations for promotions)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a promotion.
     * Only ADMIN and users with PROMOTION_CREATE permission can create.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.PROMOTION_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create promotions'
            );
        }
    }

    /**
     * Checks if the actor can update a promotion.
     * Admin or PROMOTION_UPDATE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update promotions'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a promotion.
     * Admin or PROMOTION_DELETE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete promotions'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a promotion.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: Promotion): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete promotions'
            );
        }
    }

    /**
     * Checks if the actor can view a promotion.
     * Admin or PROMOTION_VIEW permission holders can view.
     */
    protected _canView(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view promotions'
            );
        }
    }

    /**
     * Checks if the actor can list promotions.
     * Admin or PROMOTION_VIEW permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list promotions'
            );
        }
    }

    /**
     * Checks if the actor can restore a promotion.
     * Admin or PROMOTION_RESTORE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_RESTORE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore promotions'
            );
        }
    }

    /**
     * Checks if the actor can search promotions.
     * Admin or PROMOTION_VIEW permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search promotions'
            );
        }
    }

    /**
     * Checks if the actor can count promotions.
     * Admin or PROMOTION_VIEW permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count promotions'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a promotion.
     * Admin or PROMOTION_UPDATE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of promotions'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a promotion.
     * Admin or PROMOTION_UPDATE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: Promotion): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.PROMOTION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of promotions'
            );
        }
    }

    /**
     * Executes search for promotions.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof ListPromotionsSchema>,
        _actor: Actor
    ): Promise<{ items: Promotion[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for promotions.
     * Uses the model's count method to count promotions based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof ListPromotionsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Promotion Status and Validation
    // =========================================================================

    /**
     * Check if promotion is currently active
     *
     * Validates if a promotion is active based on dates and isActive flag.
     *
     * @param actor - Current user context
     * @param promotionId - Promotion ID
     * @returns Service output with boolean indicating if promotion is active
     */
    public async isActive(actor: Actor, promotionId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'isActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                const isActive = await this.model.isActive(promotionId);

                return isActive;
            }
        });
    }

    /**
     * Apply promotion to purchase
     *
     * Business Rules:
     * - Promotion must be active
     * - Client must meet target conditions
     * - Purchase must meet promotion rules
     *
     * @param actor - Current user context
     * @param params - Application parameters
     * @returns Service output with application result
     */
    public async applyPromotion(
        actor: Actor,
        params: {
            promotionId: string;
            clientId: string;
            purchaseData: { amount: number; items?: unknown[] };
        }
    ): Promise<
        ServiceOutput<{
            applied: boolean;
            discountAmount: number;
            finalAmount: number;
            reason?: string;
            appliedRules?: string[];
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'applyPromotion',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                const result = await this.model.applyPromotion(
                    params.promotionId,
                    params.clientId,
                    {
                        amount: params.purchaseData.amount,
                        currency: 'ARS',
                        items: params.purchaseData.items as
                            | Array<{ id: string; quantity: number; price: number }>
                            | undefined
                    }
                );

                return result;
            }
        });
    }

    /**
     * Get eligible clients for promotion
     *
     * @param actor - Current user context
     * @param params - Query parameters
     * @returns Service output with eligible clients
     */
    public async getEligibleClients(
        actor: Actor,
        params: { promotionId: string; limit?: number }
    ): Promise<ServiceOutput<Array<{ clientId: string; eligibilityScore: number }>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEligibleClients',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const clients = await this.model.getEligibleClients(
                    params.promotionId,
                    params.limit
                );

                return clients;
            }
        });
    }

    /**
     * Evaluate promotion rules for client/purchase
     *
     * @param actor - Current user context
     * @param params - Evaluation parameters
     * @returns Service output with evaluation result
     */
    public async evaluateRules(
        actor: Actor,
        params: {
            promotion: Promotion;
            clientId: string;
            purchaseData: { amount: number; items?: unknown[] };
        }
    ): Promise<ServiceOutput<{ eligible: boolean; reason?: string; appliedRules?: string[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'evaluateRules',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                const result = await this.model.evaluateRules(params.promotion, params.clientId, {
                    amount: params.purchaseData.amount,
                    currency: 'ARS',
                    items: params.purchaseData.items as
                        | Array<{ id: string; quantity: number; price: number }>
                        | undefined
                });

                return result;
            }
        });
    }

    /**
     * Check promotion conditions
     *
     * @param actor - Current user context
     * @param params - Condition check parameters
     * @returns Service output with condition check results
     */
    public async checkConditions(
        actor: Actor,
        params: { promotionId: string; conditions: Record<string, unknown> }
    ): Promise<ServiceOutput<{ met: boolean; details: Record<string, boolean> }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'checkConditions',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                const result = await this.model.checkConditions(
                    params.promotionId,
                    params.conditions
                );

                return result;
            }
        });
    }

    /**
     * Calculate benefit/discount for promotion
     *
     * @param actor - Current user context
     * @param params - Calculation parameters
     * @returns Service output with calculated benefit
     */
    public async calculateBenefit(
        actor: Actor,
        params: { promotion: Promotion; purchaseData: { amount: number; items?: unknown[] } }
    ): Promise<
        ServiceOutput<{ discountAmount: number; finalAmount: number; benefitType: string }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateBenefit',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                const result = await this.model.calculateBenefit(params.promotion, {
                    amount: params.purchaseData.amount,
                    currency: 'ARS',
                    items: params.purchaseData.items as
                        | Array<{ id: string; quantity: number; price: number }>
                        | undefined
                });

                return result;
            }
        });
    }

    // =========================================================================
    // Business Methods - Promotion Queries
    // =========================================================================

    /**
     * Find active promotions with pagination
     *
     * @param actor - Current user context
     * @param options - Pagination and sorting options
     * @returns Service output with active promotions
     */
    public async findActive(
        actor: Actor,
        options?: {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortDirection?: 'asc' | 'desc';
        }
    ): Promise<ServiceOutput<{ items: Promotion[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const result = await this.model.findActive(options);

                return result;
            }
        });
    }

    /**
     * Find promotions by date range
     *
     * @param actor - Current user context
     * @param params - Date range parameters
     * @returns Service output with promotions in date range
     */
    public async findByDate(
        actor: Actor,
        params: { startDate: Date; endDate: Date; options?: { page?: number; pageSize?: number } }
    ): Promise<ServiceOutput<{ items: Promotion[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByDate',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const result = await this.model.findByDate(
                    params.startDate,
                    params.endDate,
                    params.options
                );

                return result;
            }
        });
    }

    /**
     * Find promotions with discount codes
     *
     * @param actor - Current user context
     * @param params - Query parameters
     * @returns Service output with promotions and their discount codes
     */
    public async withDiscountCodes(
        actor: Actor,
        params?: { promotionId?: string; options?: { page?: number; pageSize?: number } }
    ): Promise<
        ServiceOutput<{ items: Array<Promotion & { discountCodes: unknown[] }>; total: number }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'withDiscountCodes',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const result = await this.model.withDiscountCodes(
                    params?.promotionId,
                    params?.options
                );

                return result;
            }
        });
    }

    /**
     * Get promotion performance analytics
     *
     * Returns aggregate statistics including:
     * - Total discount codes generated
     * - Total usage count
     * - Total discount amount
     * - Average discount per use
     * - Conversion rate
     *
     * @param actor - Current user context
     * @param promotionId - Promotion ID
     * @returns Service output with performance analytics
     */
    public async getPerformanceAnalytics(
        actor: Actor,
        promotionId: string
    ): Promise<
        ServiceOutput<{
            totalDiscountCodesGenerated: number;
            totalUsage: number;
            totalDiscountAmount: number;
            averageDiscountPerUse: number;
            conversionRate: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getPerformanceAnalytics',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Promotion);

                // Get model analytics
                const modelAnalytics = await this.model.getPerformanceAnalytics(promotionId);

                // Transform to match service output signature
                return {
                    totalDiscountCodesGenerated: modelAnalytics.totalDiscountCodesGenerated,
                    totalUsage: modelAnalytics.totalDiscountCodesUsed,
                    totalDiscountAmount: modelAnalytics.totalDiscountValue,
                    averageDiscountPerUse:
                        modelAnalytics.totalDiscountCodesUsed > 0
                            ? modelAnalytics.totalDiscountValue /
                              modelAnalytics.totalDiscountCodesUsed
                            : 0,
                    conversionRate: modelAnalytics.usageRate
                };
            }
        });
    }
}
