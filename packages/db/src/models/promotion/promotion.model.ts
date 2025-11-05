import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { discountCodes } from '../../schemas/promotion/discountCode.dbschema';
import { promotions } from '../../schemas/promotion/promotion.dbschema';

type Promotion = typeof promotions.$inferSelect;

export class PromotionModel extends BaseModel<Promotion> {
    protected table = promotions;
    protected entityName = 'promotion';

    protected getTableName(): string {
        return 'promotions';
    }

    /**
     * Check if promotion is currently active
     */
    async isActive(promotionId: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        try {
            const db = this.getClient(tx);
            const now = new Date();

            const promotion = await db
                .select({
                    id: promotions.id,
                    startsAt: promotions.startsAt,
                    endsAt: promotions.endsAt,
                    deletedAt: promotions.deletedAt
                })
                .from(promotions)
                .where(and(eq(promotions.id, promotionId), isNull(promotions.deletedAt)))
                .limit(1);

            if (!promotion[0] || promotion[0].deletedAt) {
                return false;
            }

            const promo = promotion[0];
            return promo.startsAt <= now && promo.endsAt >= now;
        } catch (error) {
            // Log error and return false for safety
            console.error('Error checking if promotion is active:', error);
            return false;
        }
    }

    /**
     * Apply promotion logic to a purchase (placeholder for business logic)
     */
    async applyPromotion(
        promotionId: string,
        clientId: string,
        purchaseData: {
            amount: number;
            currency: string;
            items?: Array<{ id: string; quantity: number; price: number }>;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        applied: boolean;
        discountAmount: number;
        finalAmount: number;
        reason?: string;
        appliedRules?: string[];
    }> {
        try {
            // Check if promotion is active
            const isPromoActive = await this.isActive(promotionId, tx);
            if (!isPromoActive) {
                return {
                    applied: false,
                    discountAmount: 0,
                    finalAmount: purchaseData.amount,
                    reason: 'PROMOTION_NOT_ACTIVE'
                };
            }

            // Get promotion details
            const promotion = await this.findById(promotionId, tx);
            if (!promotion) {
                return {
                    applied: false,
                    discountAmount: 0,
                    finalAmount: purchaseData.amount,
                    reason: 'PROMOTION_NOT_FOUND'
                };
            }

            // Evaluate promotion rules
            const rulesResult = await this.evaluateRules(promotion, clientId, purchaseData, tx);
            if (!rulesResult.eligible) {
                return {
                    applied: false,
                    discountAmount: 0,
                    finalAmount: purchaseData.amount,
                    reason: rulesResult.reason
                };
            }

            // Calculate benefit
            const benefitResult = await this.calculateBenefit(promotion, purchaseData, tx);

            return {
                applied: true,
                discountAmount: benefitResult.discountAmount,
                finalAmount: benefitResult.finalAmount,
                appliedRules: rulesResult.appliedRules
            };
        } catch (error) {
            // Log error and return safe default
            console.error('Error applying promotion:', error);
            return {
                applied: false,
                discountAmount: 0,
                finalAmount: purchaseData.amount,
                reason: 'INTERNAL_ERROR'
            };
        }
    }

    /**
     * Get eligible clients for a promotion (simplified implementation)
     */
    async getEligibleClients(
        promotionId: string,
        limit = 100,
        _tx?: NodePgDatabase<typeof schema>
    ): Promise<Array<{ clientId: string; eligibilityScore: number }>> {
        // This is a simplified implementation
        // In a real scenario, this would involve complex business logic
        // to determine client eligibility based on promotion rules,
        // purchase history, client segments, etc.

        const db = this.getClient(_tx);

        const promotion = await db
            .select()
            .from(promotions)
            .where(eq(promotions.id, promotionId))
            .limit(1);

        if (!promotion[0]) {
            return [];
        }

        // Placeholder logic - would be replaced with actual business rules
        // This could involve joins with client tables, purchase history, etc.
        const eligibleClients = [
            { clientId: 'client-1', eligibilityScore: 0.9 },
            { clientId: 'client-2', eligibilityScore: 0.8 },
            { clientId: 'client-3', eligibilityScore: 0.7 }
        ];

        return eligibleClients.slice(0, limit);
    }

    /**
     * Evaluate promotion rules for a specific client and purchase
     */
    async evaluateRules(
        promotion: Promotion,
        clientId: string,
        purchaseData: {
            amount: number;
            currency: string;
            items?: Array<{ id: string; quantity: number; price: number }>;
        },
        _tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        eligible: boolean;
        reason?: string;
        appliedRules?: string[];
    }> {
        const appliedRules: string[] = [];

        // Basic rule: Check if promotion rules exist
        if (!promotion.rules) {
            return {
                eligible: true,
                appliedRules: ['DEFAULT_ELIGIBLE']
            };
        }

        try {
            // Parse rules (in a real implementation, this would be more sophisticated)
            // For now, we'll treat rules as a simple JSON string
            let parsedRules: Record<string, unknown> = {};
            try {
                parsedRules = JSON.parse(promotion.rules);
            } catch {
                // If rules is not JSON, treat as simple text rules
                parsedRules = { text: promotion.rules };
            }

            // Example rule evaluations (simplified)

            // Minimum purchase amount rule
            if (
                typeof parsedRules.minimumAmount === 'number' &&
                purchaseData.amount < parsedRules.minimumAmount
            ) {
                return {
                    eligible: false,
                    reason: 'MINIMUM_AMOUNT_NOT_MET'
                };
            }
            if (parsedRules.minimumAmount) {
                appliedRules.push('MINIMUM_AMOUNT_CHECK');
            }

            // Maximum purchase amount rule
            if (
                typeof parsedRules.maximumAmount === 'number' &&
                purchaseData.amount > parsedRules.maximumAmount
            ) {
                return {
                    eligible: false,
                    reason: 'MAXIMUM_AMOUNT_EXCEEDED'
                };
            }
            if (parsedRules.maximumAmount) {
                appliedRules.push('MAXIMUM_AMOUNT_CHECK');
            }

            // Currency rule
            if (
                Array.isArray(parsedRules.allowedCurrencies) &&
                !parsedRules.allowedCurrencies.includes(purchaseData.currency)
            ) {
                return {
                    eligible: false,
                    reason: 'CURRENCY_NOT_ALLOWED'
                };
            }
            if (parsedRules.allowedCurrencies) {
                appliedRules.push('CURRENCY_CHECK');
            }

            // Text-based rules handling
            if (parsedRules.text && typeof parsedRules.text === 'string') {
                appliedRules.push('TEXT_RULES_APPLIED');
            }

            // Client-specific rules (placeholder)
            if (
                Array.isArray(parsedRules.excludedClients) &&
                parsedRules.excludedClients.includes(clientId)
            ) {
                return {
                    eligible: false,
                    reason: 'CLIENT_EXCLUDED'
                };
            }

            return {
                eligible: true,
                appliedRules
            };
        } catch {
            // If rule evaluation fails, default to not eligible
            return {
                eligible: false,
                reason: 'RULE_EVALUATION_ERROR'
            };
        }
    }

    /**
     * Check specific conditions for a promotion
     */
    async checkConditions(
        promotionId: string,
        conditions: Record<string, unknown>,
        _tx?: NodePgDatabase<typeof schema>
    ): Promise<{ met: boolean; details: Record<string, boolean> }> {
        const promotion = await this.findById(promotionId, _tx);
        if (!promotion) {
            return { met: false, details: {} };
        }

        const details: Record<string, boolean> = {};

        // Check date conditions
        if (conditions.checkDate) {
            const now = new Date();
            details.dateValid = promotion.startsAt <= now && promotion.endsAt >= now;
        }

        // Check if promotion exists and is not deleted
        details.exists = !!promotion && !promotion.deletedAt;

        // Check custom conditions from promotion rules
        if (promotion.rules && conditions.checkRules) {
            try {
                const parsedRules = JSON.parse(promotion.rules);
                details.rulesValid = !!parsedRules;
            } catch {
                details.rulesValid = false;
            }
        }

        const met = Object.values(details).every((condition) => condition === true);
        return { met, details };
    }

    /**
     * Calculate benefit/discount for a promotion
     */
    async calculateBenefit(
        promotion: Promotion,
        purchaseData: {
            amount: number;
            currency: string;
            items?: Array<{ id: string; quantity: number; price: number }>;
        },
        _tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        discountAmount: number;
        finalAmount: number;
        benefitType: string;
    }> {
        // Default benefit calculation (simplified)
        let discountAmount = 0;
        let benefitType = 'NONE';

        if (promotion.rules) {
            try {
                const parsedRules = JSON.parse(promotion.rules);

                // Percentage discount
                if (parsedRules.discountPercent) {
                    discountAmount = purchaseData.amount * (parsedRules.discountPercent / 100);
                    benefitType = 'PERCENTAGE_DISCOUNT';
                }
                // Fixed amount discount
                else if (parsedRules.discountAmount) {
                    discountAmount = Math.min(parsedRules.discountAmount, purchaseData.amount);
                    benefitType = 'FIXED_DISCOUNT';
                }
                // Buy X get Y free (placeholder)
                else if (parsedRules.buyXGetY) {
                    // Simplified implementation
                    discountAmount = purchaseData.amount * 0.1; // 10% off as example
                    benefitType = 'BUY_X_GET_Y';
                }
            } catch {
                // If rules parsing fails, no benefit
                discountAmount = 0;
            }
        }

        // Ensure discount doesn't exceed purchase amount
        discountAmount = Math.min(discountAmount, purchaseData.amount);
        const finalAmount = Math.max(0, purchaseData.amount - discountAmount);

        return {
            discountAmount,
            finalAmount,
            benefitType
        };
    }

    /**
     * Find active promotions
     */
    async findActive(
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Promotion[]; total: number }> {
        const db = this.getClient(tx);
        const now = new Date();

        const baseQuery = db
            .select()
            .from(promotions)
            .where(
                and(
                    lte(promotions.startsAt, now),
                    gte(promotions.endsAt, now),
                    isNull(promotions.deletedAt)
                )
            )
            .orderBy(desc(promotions.createdAt));

        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const items = await baseQuery.limit(options.pageSize).offset(offset);

            // Get total count
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(promotions)
                .where(
                    and(
                        lte(promotions.startsAt, now),
                        gte(promotions.endsAt, now),
                        isNull(promotions.deletedAt)
                    )
                );

            const total = countResult[0]?.count || 0;
            return { items: items as Promotion[], total };
        }

        const items = await baseQuery;
        return { items: items as Promotion[], total: items.length };
    }

    /**
     * Find promotions by date range
     */
    async findByDate(
        startDate: Date,
        endDate: Date,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Promotion[]; total: number }> {
        const db = this.getClient(tx);

        const baseQuery = db
            .select()
            .from(promotions)
            .where(
                and(
                    gte(promotions.startsAt, startDate),
                    lte(promotions.endsAt, endDate),
                    isNull(promotions.deletedAt)
                )
            )
            .orderBy(desc(promotions.startsAt));

        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const items = await baseQuery.limit(options.pageSize).offset(offset);

            // Get total count
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(promotions)
                .where(
                    and(
                        gte(promotions.startsAt, startDate),
                        lte(promotions.endsAt, endDate),
                        isNull(promotions.deletedAt)
                    )
                );

            const total = countResult[0]?.count || 0;
            return { items: items as Promotion[], total };
        }

        const items = await baseQuery;
        return { items: items as Promotion[], total: items.length };
    }

    /**
     * Find promotions with their associated discount codes
     */
    async withDiscountCodes(
        promotionId?: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        items: Array<
            Promotion & { discountCodes: Array<{ id: string; code: string; discountType: string }> }
        >;
        total: number;
    }> {
        const db = this.getClient(tx);

        // Build base query
        const baseQuery = db
            .select({
                // Promotion fields
                id: promotions.id,
                name: promotions.name,
                rules: promotions.rules,
                startsAt: promotions.startsAt,
                endsAt: promotions.endsAt,
                description: promotions.description,
                targetConditions: promotions.targetConditions,
                maxTotalUsage: promotions.maxTotalUsage,
                currentUsageCount: promotions.currentUsageCount,
                isActive: promotions.isActive,
                createdAt: promotions.createdAt,
                updatedAt: promotions.updatedAt,
                createdById: promotions.createdById,
                updatedById: promotions.updatedById,
                deletedAt: promotions.deletedAt,
                deletedById: promotions.deletedById,
                adminInfo: promotions.adminInfo,
                // Discount code fields (optional)
                discountCodeId: discountCodes.id,
                discountCode: discountCodes.code,
                discountType: discountCodes.discountType
            })
            .from(promotions)
            .leftJoin(discountCodes, eq(promotions.id, discountCodes.promotionId))
            .where(isNull(promotions.deletedAt))
            .orderBy(desc(promotions.createdAt));

        if (promotionId) {
            const filteredQuery = db
                .select({
                    // Promotion fields
                    id: promotions.id,
                    name: promotions.name,
                    rules: promotions.rules,
                    startsAt: promotions.startsAt,
                    endsAt: promotions.endsAt,
                    description: promotions.description,
                    targetConditions: promotions.targetConditions,
                    maxTotalUsage: promotions.maxTotalUsage,
                    currentUsageCount: promotions.currentUsageCount,
                    isActive: promotions.isActive,
                    createdAt: promotions.createdAt,
                    updatedAt: promotions.updatedAt,
                    createdById: promotions.createdById,
                    updatedById: promotions.updatedById,
                    deletedAt: promotions.deletedAt,
                    deletedById: promotions.deletedById,
                    adminInfo: promotions.adminInfo,
                    // Discount code fields (optional)
                    discountCodeId: discountCodes.id,
                    discountCode: discountCodes.code,
                    discountType: discountCodes.discountType
                })
                .from(promotions)
                .leftJoin(discountCodes, eq(promotions.id, discountCodes.promotionId))
                .where(and(eq(promotions.id, promotionId), isNull(promotions.deletedAt)))
                .orderBy(desc(promotions.createdAt));

            const results = await filteredQuery;

            // Process filtered results
            const promotionMap = new Map<
                string,
                Promotion & {
                    discountCodes: Array<{ id: string; code: string; discountType: string }>;
                }
            >();

            for (const row of results) {
                const promoId = row.id;

                if (!promotionMap.has(promoId)) {
                    promotionMap.set(promoId, {
                        id: row.id,
                        name: row.name,
                        rules: row.rules,
                        startsAt: row.startsAt,
                        endsAt: row.endsAt,
                        description: row.description,
                        targetConditions: row.targetConditions,
                        maxTotalUsage: row.maxTotalUsage,
                        currentUsageCount: row.currentUsageCount,
                        isActive: row.isActive,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt,
                        createdById: row.createdById,
                        updatedById: row.updatedById,
                        deletedAt: row.deletedAt,
                        deletedById: row.deletedById,
                        adminInfo: row.adminInfo,
                        discountCodes: []
                    });
                }

                // Add discount code if exists
                if (row.discountCodeId && row.discountCode && row.discountType) {
                    const promotion = promotionMap.get(promoId);
                    if (promotion) {
                        promotion.discountCodes.push({
                            id: row.discountCodeId,
                            code: row.discountCode,
                            discountType: row.discountType
                        });
                    }
                }
            }

            const items = Array.from(promotionMap.values());
            return { items, total: items.length };
        }

        // Execute query
        const results = await baseQuery;

        // Group results by promotion
        const promotionMap = new Map<
            string,
            Promotion & { discountCodes: Array<{ id: string; code: string; discountType: string }> }
        >();

        for (const row of results) {
            const promotionId = row.id;

            if (!promotionMap.has(promotionId)) {
                promotionMap.set(promotionId, {
                    id: row.id,
                    name: row.name,
                    rules: row.rules,
                    startsAt: row.startsAt,
                    endsAt: row.endsAt,
                    description: row.description,
                    targetConditions: row.targetConditions,
                    maxTotalUsage: row.maxTotalUsage,
                    currentUsageCount: row.currentUsageCount,
                    isActive: row.isActive,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                    createdById: row.createdById,
                    updatedById: row.updatedById,
                    deletedAt: row.deletedAt,
                    deletedById: row.deletedById,
                    adminInfo: row.adminInfo,
                    discountCodes: []
                });
            }

            // Add discount code if exists
            if (row.discountCodeId && row.discountCode && row.discountType) {
                const promotion = promotionMap.get(promotionId);
                if (promotion) {
                    promotion.discountCodes.push({
                        id: row.discountCodeId,
                        code: row.discountCode,
                        discountType: row.discountType
                    });
                }
            }
        }

        const items = Array.from(promotionMap.values());

        // Apply pagination if needed
        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const paginatedItems = items.slice(offset, offset + options.pageSize);
            return { items: paginatedItems, total: items.length };
        }

        return { items, total: items.length };
    }

    /**
     * Get promotion performance analytics
     */
    async getPerformanceAnalytics(
        promotionId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        totalDiscountCodesGenerated: number;
        totalDiscountCodesUsed: number;
        usageRate: number;
        totalDiscountValue: number;
        uniqueUsers: number;
    }> {
        const db = this.getClient(tx);

        // Get discount codes count for this promotion
        const codeStats = await db
            .select({
                totalCodes: sql<number>`count(*)`,
                usedCodes: sql<number>`count(case when ${discountCodes.usedCountGlobal} > 0 then 1 end)`
            })
            .from(discountCodes)
            .where(
                and(eq(discountCodes.promotionId, promotionId), isNull(discountCodes.deletedAt))
            );

        const stats = codeStats[0] || { totalCodes: 0, usedCodes: 0 };
        const usageRate = stats.totalCodes > 0 ? (stats.usedCodes / stats.totalCodes) * 100 : 0;

        // Placeholder values for other metrics (would need to join with actual usage/invoice data)
        return {
            totalDiscountCodesGenerated: stats.totalCodes || 0,
            totalDiscountCodesUsed: stats.usedCodes || 0,
            usageRate: Math.round(usageRate * 100) / 100,
            totalDiscountValue: 0, // Would calculate from actual usage
            uniqueUsers: 0 // Would calculate from usage records
        };
    }
}
