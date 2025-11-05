import type { DiscountCodeUsageModel } from '@repo/db';
import {
    type DiscountCodeUsage,
    GetPopularCodesSchema,
    GetUsageByClientSchema,
    GetUsageHistorySchema,
    GetUsageStatsSchema,
    GetUsageTrendsSchema,
    ListDiscountCodeUsagesSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for tracking discount code usage. Provides analytics and reporting for discount code usage patterns.
 * This is a read-only service focused on analytics - usage recording is done internally by DiscountCodeService.
 */
export class DiscountCodeUsageService extends BaseService {
    static readonly ENTITY_NAME = 'discountCodeUsage';
    protected readonly entityName = DiscountCodeUsageService.ENTITY_NAME;
    public readonly model: DiscountCodeUsageModel;

    /**
     * Initializes a new instance of the DiscountCodeUsageService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional DiscountCodeUsageModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: DiscountCodeUsageModel) {
        super(ctx, DiscountCodeUsageService.ENTITY_NAME);
        this.model = model ?? ({} as DiscountCodeUsageModel);
    }

    /**
     * Permission check for viewing discount code usage data
     */
    protected _canView(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.DISCOUNT_CODE_USAGE_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view discount code usage'
            );
        }
    }

    // ==================== ANALYTICS METHODS ====================

    /**
     * Get usage history for a specific discount code
     * @param actor - The actor requesting the history
     * @param discountCodeId - The discount code ID
     * @param page - Page number for pagination
     * @param pageSize - Number of items per page
     * @returns Usage history with pagination
     */
    public async getUsageHistory(
        actor: Actor,
        discountCodeId: string,
        page?: number,
        pageSize?: number
    ): Promise<ServiceOutput<{ items: DiscountCodeUsage[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageHistory',
            input: { actor, discountCodeId, page, pageSize },
            schema: GetUsageHistorySchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get usage history from model
                const result = await this.model.getUsageHistory(validatedData.discountCodeId, {
                    page: validatedData.page,
                    pageSize: validatedData.pageSize
                });

                return result;
            }
        });
    }

    /**
     * Get usage statistics for a discount code
     * @param actor - The actor requesting stats
     * @param discountCodeId - The discount code ID
     * @returns Usage statistics
     */
    public async getUsageStats(
        actor: Actor,
        discountCodeId: string
    ): Promise<
        ServiceOutput<{
            totalUsers: number;
            totalUsages: number;
            averageUsagesPerUser: number;
            firstUsed: Date | null;
            lastUsed: Date | null;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageStats',
            input: { actor, discountCodeId },
            schema: GetUsageStatsSchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get stats from model
                const stats = await this.model.getUsageStats(validatedData.discountCodeId);

                return stats;
            }
        });
    }

    /**
     * Get usage records by client
     * @param actor - The actor requesting the data
     * @param clientId - The client ID
     * @param page - Page number for pagination
     * @param pageSize - Number of items per page
     * @returns Usage records for the client
     */
    public async getUsageByClient(
        actor: Actor,
        clientId: string,
        page?: number,
        pageSize?: number
    ): Promise<ServiceOutput<{ items: DiscountCodeUsage[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageByClient',
            input: { actor, clientId, page, pageSize },
            schema: GetUsageByClientSchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get usage by client from model
                const result = await this.model.findByClient(validatedData.clientId, {
                    page: validatedData.page,
                    pageSize: validatedData.pageSize
                });

                return result;
            }
        });
    }

    /**
     * Get usage trends over time for a discount code
     * @param actor - The actor requesting trends
     * @param discountCodeId - The discount code ID
     * @param days - Number of days to analyze (default: 30)
     * @returns Trend data by date
     */
    public async getUsageTrends(
        actor: Actor,
        discountCodeId: string,
        days?: number
    ): Promise<
        ServiceOutput<
            Array<{
                date: string;
                newUsers: number;
                totalUsages: number;
            }>
        >
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageTrends',
            input: { actor, discountCodeId, days },
            schema: GetUsageTrendsSchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get trends from model
                const trends = await this.model.getUsageTrends(
                    validatedData.discountCodeId,
                    validatedData.days
                );

                return trends;
            }
        });
    }

    /**
     * Get popular discount codes analytics
     * @param actor - The actor requesting analytics
     * @param limit - Maximum number of codes to return (default: 10)
     * @returns Popular codes with usage statistics
     */
    public async getPopularCodes(
        actor: Actor,
        limit?: number
    ): Promise<
        ServiceOutput<
            Array<{
                discountCodeId: string;
                code: string;
                totalUsages: number;
                uniqueUsers: number;
                averageUsagesPerUser: number;
            }>
        >
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getPopularCodes',
            input: { actor, limit },
            schema: GetPopularCodesSchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get popular codes from model
                const popularCodes = await this.model.getPopularCodes(validatedData.limit);

                return popularCodes;
            }
        });
    }

    /**
     * Search/list discount code usage records with filtering
     * @param actor - The actor requesting the list
     * @param filters - Filtering options
     * @returns Filtered usage records
     */
    public async search(
        actor: Actor,
        filters: z.infer<typeof ListDiscountCodeUsagesSchema>
    ): Promise<ServiceOutput<{ items: DiscountCodeUsage[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'search',
            input: { actor, ...filters },
            schema: ListDiscountCodeUsagesSchema,
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                const { page, pageSize, discountCodeId, clientId } = validatedData;

                // If filtering by discountCodeId, use getUsageHistory
                if (discountCodeId) {
                    return this.model.getUsageHistory(discountCodeId, { page, pageSize });
                }

                // If filtering by clientId, use findByClient
                if (clientId) {
                    return this.model.findByClient(clientId, { page, pageSize });
                }

                // Otherwise, use findWithCodeDetails (gets all with JOIN)
                return this.model.findWithCodeDetails({}, { page, pageSize });
            }
        });
    }

    /**
     * Get usage count for a specific discount code and client
     * @param actor - The actor requesting the count
     * @param discountCodeId - The discount code ID
     * @param clientId - The client ID
     * @returns Usage count for the specific code/client combination
     */
    public async getUsageCount(
        actor: Actor,
        discountCodeId: string,
        clientId: string
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getUsageCount',
            input: { actor, discountCodeId, clientId },
            schema: z.object({
                discountCodeId: z.string().uuid(),
                clientId: z.string().uuid()
            }),
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get usage count from model
                const count = await this.model.getUsageCount(
                    validatedData.discountCodeId,
                    validatedData.clientId
                );

                return { count };
            }
        });
    }

    /**
     * Calculate total savings generated by discount codes
     * @param actor - The actor requesting the calculation
     * @param discountCodeId - Optional discount code ID to filter by
     * @returns Savings statistics
     */
    public async calculateSavings(
        actor: Actor,
        discountCodeId?: string
    ): Promise<
        ServiceOutput<{
            totalSavings: number;
            totalUsages: number;
            averageSavingsPerUsage: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateSavings',
            input: { actor, discountCodeId },
            schema: z.object({
                discountCodeId: z.string().uuid().optional()
            }),
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Calculate savings from model
                const savings = await this.model.calculateSavings(validatedData.discountCodeId);

                return savings;
            }
        });
    }

    /**
     * Get usage records with discount code details (JOIN)
     * @param actor - The actor requesting the data
     * @param page - Page number for pagination
     * @param pageSize - Number of items per page
     * @returns Usage records with code details
     */
    public async findWithCodeDetails(
        actor: Actor,
        page?: number,
        pageSize?: number
    ): Promise<
        ServiceOutput<{
            items: Array<
                DiscountCodeUsage & { discountCode: { code: string; discountType: string } }
            >;
            total: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'findWithCodeDetails',
            input: { actor, page, pageSize },
            schema: z.object({
                page: z.number().int().positive().optional(),
                pageSize: z.number().int().positive().max(100).optional()
            }),
            execute: async (validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor);

                // Get usage with code details from model
                const result = await this.model.findWithCodeDetails(
                    {},
                    {
                        page: validatedData.page,
                        pageSize: validatedData.pageSize
                    }
                );

                return result;
            }
        });
    }

    // ==================== INTERNAL METHODS ====================

    /**
     * Record usage of a discount code (internal use only - called by DiscountCodeService)
     * This method is NOT exposed through API - it's called internally when applying discounts
     * @param discountCodeId - The discount code ID
     * @param clientId - The client ID
     * @returns Updated or created usage record
     */
    public async recordUsageInternal(
        discountCodeId: string,
        clientId: string
    ): Promise<DiscountCodeUsage | null> {
        // This method bypasses permission checks because it's called internally
        // by DiscountCodeService.applyDiscount()
        return this.model.recordUsage(discountCodeId, clientId);
    }
}
