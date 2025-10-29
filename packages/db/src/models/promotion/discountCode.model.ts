import { DiscountTypeEnum } from '@repo/schemas';
import { and, desc, eq, isNull, like, sql, sum } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { discountCodes } from '../../schemas/promotion/discountCode.dbschema';
import { discountCodeUsages } from '../../schemas/promotion/discountCodeUsage.dbschema';

type DiscountCode = typeof discountCodes.$inferSelect;

export class DiscountCodeModel extends BaseModel<DiscountCode> {
    protected table = discountCodes;
    protected entityName = 'discountCode';

    protected getTableName(): string {
        return 'discount_codes';
    }

    /**
     * Check if discount code is currently valid
     */
    async isValid(code: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);
        const now = new Date();

        const discountCode = await db
            .select({
                id: discountCodes.id,
                isActive: discountCodes.isActive,
                validFrom: discountCodes.validFrom,
                validTo: discountCodes.validTo,
                deletedAt: discountCodes.deletedAt
            })
            .from(discountCodes)
            .where(
                and(
                    eq(discountCodes.code, code),
                    eq(discountCodes.isActive, 'true'),
                    isNull(discountCodes.deletedAt)
                )
            )
            .limit(1);

        if (!discountCode[0] || discountCode[0].deletedAt) {
            return false;
        }

        const code_rec = discountCode[0];
        return code_rec.validFrom <= now && code_rec.validTo >= now && code_rec.isActive === 'true';
    }

    /**
     * Check if discount code can be used by a specific client
     */
    async canBeUsed(
        code: string,
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ canUse: boolean; reason?: string }> {
        const db = this.getClient(tx);

        // First check if code is valid
        const isValidCode = await this.isValid(code, tx);
        if (!isValidCode) {
            return { canUse: false, reason: 'INVALID_CODE' };
        }

        // Get discount code details
        const discountCode = await db
            .select({
                id: discountCodes.id,
                maxRedemptionsGlobal: discountCodes.maxRedemptionsGlobal,
                maxRedemptionsPerUser: discountCodes.maxRedemptionsPerUser,
                usedCountGlobal: discountCodes.usedCountGlobal
            })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!discountCode[0]) {
            return { canUse: false, reason: 'CODE_NOT_FOUND' };
        }

        const codeData = discountCode[0];

        // Check global usage limits
        if (
            codeData.maxRedemptionsGlobal &&
            codeData.usedCountGlobal >= codeData.maxRedemptionsGlobal
        ) {
            return { canUse: false, reason: 'GLOBAL_LIMIT_EXCEEDED' };
        }

        // Check per-user usage limits
        if (codeData.maxRedemptionsPerUser) {
            const userUsage = await db
                .select({
                    usageCount: sum(discountCodeUsages.usageCount)
                })
                .from(discountCodeUsages)
                .where(
                    and(
                        eq(discountCodeUsages.discountCodeId, codeData.id),
                        eq(discountCodeUsages.clientId, clientId),
                        isNull(discountCodeUsages.deletedAt)
                    )
                );

            const currentUsage = userUsage[0]?.usageCount ? Number(userUsage[0].usageCount) : 0;
            if (currentUsage >= codeData.maxRedemptionsPerUser) {
                return { canUse: false, reason: 'USER_LIMIT_EXCEEDED' };
            }
        }

        return { canUse: true };
    }

    /**
     * Calculate discount amount for a purchase
     */
    async calculateDiscount(
        code: string,
        purchaseAmount: number,
        _currency = 'USD',
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ discountAmount: number; finalAmount: number } | null> {
        const db = this.getClient(tx);

        const discountCode = await db
            .select({
                discountType: discountCodes.discountType,
                percentOff: discountCodes.percentOff,
                amountOffMinor: discountCodes.amountOffMinor,
                currency: discountCodes.currency,
                minimumPurchaseAmount: discountCodes.minimumPurchaseAmount,
                minimumPurchaseCurrency: discountCodes.minimumPurchaseCurrency
            })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!discountCode[0]) {
            return null;
        }

        const codeData = discountCode[0];

        // Check minimum purchase requirement
        if (codeData.minimumPurchaseAmount) {
            const minAmount = Number(codeData.minimumPurchaseAmount);
            if (purchaseAmount < minAmount) {
                return { discountAmount: 0, finalAmount: purchaseAmount };
            }
        }

        let discountAmount = 0;

        if (codeData.discountType === DiscountTypeEnum.PERCENTAGE && codeData.percentOff) {
            const percentDiscount = Number(codeData.percentOff) / 100;
            discountAmount = purchaseAmount * percentDiscount;
        } else if (
            codeData.discountType === DiscountTypeEnum.FIXED_AMOUNT &&
            codeData.amountOffMinor
        ) {
            // Convert from minor currency units to major units
            discountAmount = codeData.amountOffMinor / 100;
        }

        // Ensure discount doesn't exceed purchase amount
        discountAmount = Math.min(discountAmount, purchaseAmount);
        const finalAmount = Math.max(0, purchaseAmount - discountAmount);

        return { discountAmount, finalAmount };
    }

    /**
     * Apply discount to amount (convenience method)
     */
    async applyToAmount(
        code: string,
        amount: number,
        currency = 'USD',
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const result = await this.calculateDiscount(code, amount, currency, tx);
        return result?.finalAmount ?? amount;
    }

    /**
     * Get remaining uses for a discount code
     */
    async getRemainingUses(
        code: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ globalRemaining: number | null; unlimited: boolean }> {
        const db = this.getClient(tx);

        const discountCode = await db
            .select({
                maxRedemptionsGlobal: discountCodes.maxRedemptionsGlobal,
                usedCountGlobal: discountCodes.usedCountGlobal
            })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!discountCode[0]) {
            return { globalRemaining: 0, unlimited: false };
        }

        const codeData = discountCode[0];

        if (!codeData.maxRedemptionsGlobal) {
            return { globalRemaining: null, unlimited: true };
        }

        const remaining = codeData.maxRedemptionsGlobal - codeData.usedCountGlobal;
        return { globalRemaining: Math.max(0, remaining), unlimited: false };
    }

    /**
     * Check if discount code has been used by a specific client
     */
    async hasBeenUsedByClient(
        code: string,
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);

        const codeRecord = await db
            .select({ id: discountCodes.id })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!codeRecord[0]) {
            return false;
        }

        const usage = await db
            .select({ id: discountCodeUsages.id })
            .from(discountCodeUsages)
            .where(
                and(
                    eq(discountCodeUsages.discountCodeId, codeRecord[0].id),
                    eq(discountCodeUsages.clientId, clientId),
                    isNull(discountCodeUsages.deletedAt)
                )
            )
            .limit(1);

        return usage.length > 0;
    }

    /**
     * Increment usage count for a discount code
     */
    async incrementUsage(
        code: string,
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);

        // Get discount code ID
        const codeRecord = await db
            .select({ id: discountCodes.id })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!codeRecord[0]) {
            return false;
        }

        const codeId = codeRecord[0].id;

        // Check if usage record exists
        const existingUsage = await db
            .select({
                id: discountCodeUsages.id,
                usageCount: discountCodeUsages.usageCount
            })
            .from(discountCodeUsages)
            .where(
                and(
                    eq(discountCodeUsages.discountCodeId, codeId),
                    eq(discountCodeUsages.clientId, clientId),
                    isNull(discountCodeUsages.deletedAt)
                )
            )
            .limit(1);

        if (existingUsage[0]) {
            // Update existing usage record
            await db
                .update(discountCodeUsages)
                .set({
                    usageCount: existingUsage[0].usageCount + 1,
                    lastUsedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(discountCodeUsages.id, existingUsage[0].id));
        } else {
            // Create new usage record
            await db.insert(discountCodeUsages).values({
                discountCodeId: codeId,
                clientId,
                usageCount: 1,
                firstUsedAt: new Date(),
                lastUsedAt: new Date()
            });
        }

        // Increment global usage counter
        await db
            .update(discountCodes)
            .set({
                usedCountGlobal: sql`${discountCodes.usedCountGlobal} + 1`,
                updatedAt: new Date()
            })
            .where(eq(discountCodes.id, codeId));

        return true;
    }

    /**
     * Check if discount code is expired
     */
    async checkExpiration(code: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);
        const now = new Date();

        const discountCode = await db
            .select({
                validTo: discountCodes.validTo
            })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!discountCode[0]) {
            return true; // Consider non-existent codes as expired
        }

        return discountCode[0].validTo < now;
    }

    /**
     * Check usage limits for a discount code
     */
    async checkLimits(
        code: string,
        clientId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        globalLimitReached: boolean;
        userLimitReached: boolean;
        globalRemaining: number | null;
        userRemaining: number | null;
    }> {
        const db = this.getClient(tx);

        const discountCode = await db
            .select({
                id: discountCodes.id,
                maxRedemptionsGlobal: discountCodes.maxRedemptionsGlobal,
                maxRedemptionsPerUser: discountCodes.maxRedemptionsPerUser,
                usedCountGlobal: discountCodes.usedCountGlobal
            })
            .from(discountCodes)
            .where(eq(discountCodes.code, code))
            .limit(1);

        if (!discountCode[0]) {
            return {
                globalLimitReached: true,
                userLimitReached: true,
                globalRemaining: 0,
                userRemaining: 0
            };
        }

        const codeData = discountCode[0];

        // Check global limits
        const globalLimitReached = codeData.maxRedemptionsGlobal
            ? codeData.usedCountGlobal >= codeData.maxRedemptionsGlobal
            : false;

        const globalRemaining = codeData.maxRedemptionsGlobal
            ? Math.max(0, codeData.maxRedemptionsGlobal - codeData.usedCountGlobal)
            : null;

        let userLimitReached = false;
        let userRemaining: number | null = null;

        // Check user limits if clientId provided
        if (clientId && codeData.maxRedemptionsPerUser) {
            const userUsage = await db
                .select({
                    usageCount: sum(discountCodeUsages.usageCount)
                })
                .from(discountCodeUsages)
                .where(
                    and(
                        eq(discountCodeUsages.discountCodeId, codeData.id),
                        eq(discountCodeUsages.clientId, clientId),
                        isNull(discountCodeUsages.deletedAt)
                    )
                );

            const currentUsage = userUsage[0]?.usageCount ? Number(userUsage[0].usageCount) : 0;
            userLimitReached = currentUsage >= codeData.maxRedemptionsPerUser;
            userRemaining = Math.max(0, codeData.maxRedemptionsPerUser - currentUsage);
        }

        return {
            globalLimitReached,
            userLimitReached,
            globalRemaining,
            userRemaining
        };
    }

    /**
     * Check discount code eligibility for a purchase
     */
    async checkEligibility(
        code: string,
        clientId: string,
        purchaseAmount: number,
        currency = 'USD',
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        eligible: boolean;
        reason?: string;
        discountPreview?: { discountAmount: number; finalAmount: number };
    }> {
        // Check if code is valid
        const isValidCode = await this.isValid(code, tx);
        if (!isValidCode) {
            return { eligible: false, reason: 'INVALID_CODE' };
        }

        // Check if it can be used
        const canUse = await this.canBeUsed(code, clientId, tx);
        if (!canUse.canUse) {
            return { eligible: false, reason: canUse.reason };
        }

        // Check expiration
        const isExpired = await this.checkExpiration(code, tx);
        if (isExpired) {
            return { eligible: false, reason: 'EXPIRED' };
        }

        // Calculate discount preview
        const discountPreview = await this.calculateDiscount(code, purchaseAmount, currency, tx);
        if (!discountPreview) {
            return { eligible: false, reason: 'CALCULATION_ERROR' };
        }

        return {
            eligible: true,
            discountPreview
        };
    }

    /**
     * Find discount codes by query with search support
     */
    async findAll(
        where: Record<string, unknown> & { q?: string },
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: DiscountCode[]; total: number }> {
        const { q, ...filterWhere } = where;

        // If there's a search query, handle it with a custom query
        if (q && typeof q === 'string') {
            const db = this.getClient(tx);
            const searchCondition = like(discountCodes.code, `%${q}%`);

            if (options?.page && options?.pageSize) {
                const offset = (options.page - 1) * options.pageSize;
                const items = await db
                    .select()
                    .from(discountCodes)
                    .where(searchCondition)
                    .orderBy(desc(discountCodes.createdAt))
                    .limit(options.pageSize)
                    .offset(offset);

                // Get total count for search
                const countResult = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(discountCodes)
                    .where(searchCondition);

                const total = countResult[0]?.count || 0;

                return { items: items as DiscountCode[], total };
            }

            // Return all search results
            const items = await db
                .select()
                .from(discountCodes)
                .where(searchCondition)
                .orderBy(desc(discountCodes.createdAt));

            return { items: items as DiscountCode[], total: items.length };
        }

        // Use parent method for regular filtering
        return super.findAll(filterWhere, options, tx);
    }
}
