import type { DiscountCodeModel } from '@repo/db';
import {
    CreateDiscountCodeSchema,
    type DiscountCode,
    ListDiscountCodesSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateDiscountCodeSchema,
    type VisibilityEnum
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing discount codes. Implements business logic, permissions, and hooks for DiscountCode entities.
 * Handles discount code creation, validation, usage tracking, and application to purchases.
 * @extends BaseCrudService
 */
export class DiscountCodeService extends BaseCrudService<
    DiscountCode,
    DiscountCodeModel,
    typeof CreateDiscountCodeSchema,
    typeof UpdateDiscountCodeSchema,
    typeof ListDiscountCodesSchema
> {
    static readonly ENTITY_NAME = 'discountCode';
    protected readonly entityName = DiscountCodeService.ENTITY_NAME;
    public readonly model: DiscountCodeModel;

    public readonly createSchema = CreateDiscountCodeSchema;
    public readonly updateSchema = UpdateDiscountCodeSchema;
    public readonly searchSchema = ListDiscountCodesSchema;

    /**
     * Initializes a new instance of the DiscountCodeService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional DiscountCodeModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: DiscountCodeModel) {
        super(ctx, DiscountCodeService.ENTITY_NAME);
        this.model = model ?? ({} as DiscountCodeModel);
    }

    /**
     * Returns default list relations (no relations for discount codes by default)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    /**
     * Permission check for creating discount codes
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create discount codes'
            );
        }
    }

    /**
     * Permission check for updating discount codes
     */
    protected _canUpdate(actor: Actor, _entity: DiscountCode): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update discount codes'
            );
        }
    }

    /**
     * Permission check for soft-deleting discount codes
     */
    protected _canSoftDelete(actor: Actor, _entity: DiscountCode): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete discount codes'
            );
        }
    }

    /**
     * Permission check for viewing discount codes
     */
    protected _canView(actor: Actor, _entity: DiscountCode): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view discount codes'
            );
        }
    }

    /**
     * Permission check for restoring deleted discount codes
     */
    protected _canRestore(actor: Actor, _entity: DiscountCode): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore discount codes'
            );
        }
    }

    /**
     * Permission check for hard deleting discount codes
     */
    protected _canHardDelete(actor: Actor, _entity: DiscountCode): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_HARD_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can permanently delete discount codes'
            );
        }
    }

    /**
     * Permission check for listing discount codes
     */
    protected _canList(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list discount codes'
            );
        }
    }

    /**
     * Permission check for searching discount codes
     */
    protected _canSearch(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search discount codes'
            );
        }
    }

    /**
     * Permission check for counting discount codes
     */
    protected _canCount(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count discount codes'
            );
        }
    }

    /**
     * Permission check for updating visibility (not applicable for discount codes)
     */
    protected _canUpdateVisibility(
        _actor: Actor,
        _entity: DiscountCode,
        _newVisibility: VisibilityEnum
    ): void {
        throw new ServiceError(
            ServiceErrorCode.NOT_IMPLEMENTED,
            'Visibility updates are not applicable for discount codes'
        );
    }

    /**
     * Implementation for _executeSearch - delegates to model's findAll
     */
    protected async _executeSearch(
        filters: z.infer<typeof ListDiscountCodesSchema>,
        _actor: Actor
    ): Promise<{ items: DiscountCode[]; total: number }> {
        const { page, pageSize, ...searchFilters } = filters;
        const result = await this.model.findAll(searchFilters, { page, pageSize });
        return { items: result.items, total: result.total };
    }

    /**
     * Implementation for _executeCount - delegates to model's count
     */
    protected async _executeCount(
        filters: z.infer<typeof ListDiscountCodesSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { page, pageSize, ...searchFilters } = filters;
        const result = await this.model.findAll(searchFilters, { page, pageSize });
        return { count: result.total };
    }

    // ==================== BUSINESS METHODS ====================

    /**
     * Validate if a discount code can be applied to a purchase
     * @param actor - The actor performing the validation
     * @param code - The discount code to validate
     * @param purchaseAmountMinor - The purchase amount in minor currency units
     * @param userId - The user ID attempting to use the code
     * @returns Validation result with isValid flag and optional reason
     */
    public async validateCode(
        actor: Actor,
        code: string,
        purchaseAmountMinor: number,
        _userId: string
    ): Promise<ServiceOutput<{ isValid: boolean; reason?: string; code?: DiscountCode }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validateCode',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, _validatedActor) => {
                // Find the discount code
                const discountCode = await this.model.findOne({ code });

                if (!discountCode) {
                    return {
                        isValid: false,
                        reason: 'Code not found'
                    };
                }

                // Check if code is active
                if (!discountCode.isActive) {
                    return {
                        isValid: false,
                        reason: 'Code is not active'
                    };
                }

                // Check if code is deleted
                if (discountCode.deletedAt) {
                    return {
                        isValid: false,
                        reason: 'Code has been deleted'
                    };
                }

                // Check date validity
                const now = new Date();
                if (now < discountCode.validFrom) {
                    return {
                        isValid: false,
                        reason: 'Code is not yet valid'
                    };
                }

                if (now > discountCode.validTo) {
                    return {
                        isValid: false,
                        reason: 'Code has expired'
                    };
                }

                // Check global redemption limit
                if (
                    discountCode.maxRedemptionsGlobal !== undefined &&
                    discountCode.maxRedemptionsGlobal !== null &&
                    discountCode.usedCountGlobal >= discountCode.maxRedemptionsGlobal
                ) {
                    return {
                        isValid: false,
                        reason: 'Code has reached maximum redemptions'
                    };
                }

                // Check minimum purchase amount
                if (
                    discountCode.minimumPurchaseAmount !== undefined &&
                    discountCode.minimumPurchaseAmount !== null &&
                    purchaseAmountMinor < discountCode.minimumPurchaseAmount
                ) {
                    const minAmount = (discountCode.minimumPurchaseAmount / 100).toFixed(2);
                    return {
                        isValid: false,
                        reason: `Minimum purchase amount of $${minAmount} ${discountCode.minimumPurchaseCurrency} required`
                    };
                }

                // All checks passed
                return {
                    isValid: true,
                    code: discountCode
                };
            }
        });
    }

    /**
     * Apply a discount code to a purchase amount and calculate the final price
     * @param actor - The actor applying the discount
     * @param code - The discount code to apply
     * @param purchaseAmountMinor - The original purchase amount in minor currency units
     * @param userId - The user ID applying the discount
     * @returns Discount calculation with amounts
     */
    public async applyDiscount(
        actor: Actor,
        code: string,
        purchaseAmountMinor: number,
        userId: string
    ): Promise<
        ServiceOutput<{
            discountAmountMinor: number;
            finalAmountMinor: number;
            code: DiscountCode;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'applyDiscount',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, _validatedActor) => {
                // First validate the code
                const validation = await this.validateCode(
                    actor,
                    code,
                    purchaseAmountMinor,
                    userId
                );

                if (validation.error) {
                    throw new ServiceError(
                        validation.error.code,
                        validation.error.message,
                        validation.error.details
                    );
                }

                if (!validation.data?.isValid || !validation.data.code) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        validation.data?.reason || 'Invalid discount code'
                    );
                }

                const discountCode = validation.data.code;
                let discountAmountMinor = 0;

                // Calculate discount based on type
                if (discountCode.discountType === 'percentage' && discountCode.percentOff) {
                    discountAmountMinor = Math.round(
                        (purchaseAmountMinor * discountCode.percentOff) / 100
                    );
                } else if (
                    discountCode.discountType === 'fixed_amount' &&
                    discountCode.amountOffMinor
                ) {
                    discountAmountMinor = discountCode.amountOffMinor;
                }

                // Ensure discount doesn't exceed purchase amount (can't go negative)
                if (discountAmountMinor > purchaseAmountMinor) {
                    discountAmountMinor = purchaseAmountMinor;
                }

                const finalAmountMinor = purchaseAmountMinor - discountAmountMinor;

                return {
                    discountAmountMinor,
                    finalAmountMinor,
                    code: discountCode
                };
            }
        });
    }

    /**
     * Increment the usage counter for a discount code
     * @param actor - The actor incrementing usage
     * @param codeId - The discount code ID
     * @param userId - The user ID who used the code
     * @returns Updated discount code
     */
    public async incrementUsage(
        actor: Actor,
        codeId: string,
        _userId: string
    ): Promise<ServiceOutput<DiscountCode>> {
        return this.runWithLoggingAndValidation({
            methodName: 'incrementUsage',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Get current code
                const code = await this.model.findById(codeId);

                if (!code) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Discount code not found');
                }

                // Increment global usage counter
                const updatedCode = await this.model.update(codeId, {
                    usedCountGlobal: code.usedCountGlobal + 1,
                    updatedById: validatedActor.id
                });

                return updatedCode;
            }
        });
    }

    /**
     * Get usage statistics for a discount code
     * @param actor - The actor requesting stats
     * @param codeId - The discount code ID
     * @returns Usage statistics
     */
    public async getUsageStats(
        actor: Actor,
        codeId: string
    ): Promise<
        ServiceOutput<{
            code: string;
            usedCountGlobal: number;
            maxRedemptionsGlobal?: number | null;
            remainingRedemptions?: number;
            usagePercentage?: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageStats',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, {} as DiscountCode);

                // Get the code
                const code = await this.model.findById(codeId);

                if (!code) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Discount code not found');
                }

                const stats: {
                    code: string;
                    usedCountGlobal: number;
                    maxRedemptionsGlobal?: number | null;
                    remainingRedemptions?: number;
                    usagePercentage?: number;
                } = {
                    code: code.code,
                    usedCountGlobal: code.usedCountGlobal,
                    maxRedemptionsGlobal: code.maxRedemptionsGlobal
                };

                // Calculate remaining and percentage if there's a limit
                if (code.maxRedemptionsGlobal !== undefined && code.maxRedemptionsGlobal !== null) {
                    stats.remainingRedemptions = code.maxRedemptionsGlobal - code.usedCountGlobal;
                    stats.usagePercentage = Math.round(
                        (code.usedCountGlobal / code.maxRedemptionsGlobal) * 100
                    );
                }

                return stats;
            }
        });
    }
}
