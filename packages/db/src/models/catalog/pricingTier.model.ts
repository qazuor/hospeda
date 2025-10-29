import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import { pricingTiers } from '../../schemas/catalog/pricingTier.dbschema';
import type * as schema from '../../schemas/index.js';

// Infer PricingTier type from the database schema
type PricingTier = typeof pricingTiers.$inferSelect;

export interface TierPriceCalculation {
    totalPrice: number;
    unitPrice: number;
    quantity: number;
    tier: PricingTier;
}

export interface RangeValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface OverlapCheckResult {
    hasOverlaps: boolean;
    overlaps: Array<{
        tier1: string;
        tier2: string;
        overlapRange: string;
    }>;
}

export interface SavingsCalculation {
    baseTotalPrice: number;
    tierTotalPrice: number;
    savingsAmount: number;
    savingsPercentage: number;
    quantity: number;
}

export interface TierStructureValidation {
    isValid: boolean;
    hasProperCoverage: boolean;
    hasOverlaps: boolean;
    errors: string[];
}

export class PricingTierModel extends BaseModel<PricingTier> {
    protected table = pricingTiers;
    protected entityName = 'pricingTier';

    protected getTableName(): string {
        return 'pricing_tiers';
    }

    /**
     * Find the applicable tier for a given quantity
     */
    async findApplicableTier(
        pricingPlanId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingTier | null> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(pricingTiers.pricingPlanId, pricingPlanId),
                    isNull(pricingTiers.deletedAt),
                    sql`${pricingTiers.minQuantity} <= ${quantity}`,
                    sql`(${pricingTiers.maxQuantity} IS NULL OR ${pricingTiers.maxQuantity} >= ${quantity})`
                )
            )
            .orderBy(asc(pricingTiers.minQuantity))
            .limit(1);

        return result.length > 0 ? (result[0] as PricingTier) : null;
    }

    /**
     * Calculate price using tier pricing
     */
    async calculatePrice(
        pricingPlanId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<TierPriceCalculation | null> {
        const tier = await this.findApplicableTier(pricingPlanId, quantity, tx);

        if (!tier) {
            return null;
        }

        const totalPrice = tier.unitPriceMinor * quantity;

        return {
            totalPrice,
            unitPrice: tier.unitPriceMinor,
            quantity,
            tier
        };
    }

    /**
     * Validate tier ranges for overlaps and gaps
     */
    async validateRanges(
        pricingPlanId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<RangeValidationResult> {
        const db = this.getClient(tx);

        const tiers = await db
            .select()
            .from(this.table)
            .where(
                and(eq(pricingTiers.pricingPlanId, pricingPlanId), isNull(pricingTiers.deletedAt))
            )
            .orderBy(asc(pricingTiers.minQuantity));

        const errors: string[] = [];

        // Check for overlaps and gaps
        for (let i = 0; i < tiers.length - 1; i++) {
            const currentTier = tiers[i];
            const nextTier = tiers[i + 1];

            if (!currentTier || !nextTier) continue;

            // Check for overlap
            if (
                currentTier.maxQuantity !== null &&
                currentTier.maxQuantity >= nextTier.minQuantity
            ) {
                errors.push(
                    `Overlap between tiers: ${currentTier.minQuantity}-${currentTier.maxQuantity} and ${nextTier.minQuantity}-${nextTier.maxQuantity}`
                );
            }

            // Check for gap
            if (
                currentTier.maxQuantity !== null &&
                currentTier.maxQuantity + 1 < nextTier.minQuantity
            ) {
                errors.push(
                    `Gap found between tier ranges: ${currentTier.maxQuantity} to ${nextTier.minQuantity}`
                );
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check for overlapping tiers
     */
    async checkOverlaps(
        pricingPlanId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<OverlapCheckResult> {
        const db = this.getClient(tx);

        const tiers = await db
            .select()
            .from(this.table)
            .where(
                and(eq(pricingTiers.pricingPlanId, pricingPlanId), isNull(pricingTiers.deletedAt))
            )
            .orderBy(asc(pricingTiers.minQuantity));

        const overlaps: OverlapCheckResult['overlaps'] = [];

        for (let i = 0; i < tiers.length; i++) {
            for (let j = i + 1; j < tiers.length; j++) {
                const tier1 = tiers[i];
                const tier2 = tiers[j];

                if (!tier1 || !tier2) continue;

                // Check if ranges overlap
                const tier1Max = tier1.maxQuantity || Number.MAX_SAFE_INTEGER;
                const tier2Max = tier2.maxQuantity || Number.MAX_SAFE_INTEGER;

                if (tier1.minQuantity <= tier2Max && tier2.minQuantity <= tier1Max) {
                    overlaps.push({
                        tier1: tier1.id,
                        tier2: tier2.id,
                        overlapRange: `${Math.max(tier1.minQuantity, tier2.minQuantity)}-${Math.min(tier1Max, tier2Max)}`
                    });
                }
            }
        }

        return {
            hasOverlaps: overlaps.length > 0,
            overlaps
        };
    }

    /**
     * Get the best tier for a specific quantity
     */
    async getTierForQuantity(
        pricingPlanId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingTier | null> {
        // Same as findApplicableTier for now
        return this.findApplicableTier(pricingPlanId, quantity, tx);
    }

    /**
     * Calculate savings compared to base plan price
     */
    async calculateSavings(
        pricingPlanId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SavingsCalculation | null> {
        const db = this.getClient(tx);

        // Get base plan price
        const planResult = await db
            .select()
            .from(pricingPlans)
            .where(eq(pricingPlans.id, pricingPlanId));

        if (planResult.length === 0) {
            return null;
        }

        const basePlan = planResult[0];
        if (!basePlan) {
            return null;
        }

        const baseTotalPrice = basePlan.amountMinor * quantity;

        // Get tier price
        const tierCalculation = await this.calculatePrice(pricingPlanId, quantity, tx);

        if (!tierCalculation) {
            return null;
        }

        const tierTotalPrice = tierCalculation.totalPrice;
        const savingsAmount = baseTotalPrice - tierTotalPrice;
        const savingsPercentage = savingsAmount > 0 ? (savingsAmount / baseTotalPrice) * 100 : 0;

        return {
            baseTotalPrice,
            tierTotalPrice,
            savingsAmount,
            savingsPercentage,
            quantity
        };
    }

    /**
     * Find all tiers for a pricing plan
     */
    async findByPlan(
        pricingPlanId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingTier[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(eq(pricingTiers.pricingPlanId, pricingPlanId), isNull(pricingTiers.deletedAt))
            )
            .orderBy(asc(pricingTiers.minQuantity));

        return result as PricingTier[];
    }

    /**
     * Validate the overall tier structure
     */
    async validateTierStructure(
        pricingPlanId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<TierStructureValidation> {
        const rangeValidation = await this.validateRanges(pricingPlanId, tx);
        const overlapCheck = await this.checkOverlaps(pricingPlanId, tx);

        const tiers = await this.findByPlan(pricingPlanId, tx);

        // Check for proper coverage (starts at 1 and has continuous coverage)
        const hasProperCoverage =
            tiers.length > 0 &&
            tiers[0]?.minQuantity === 1 &&
            tiers[tiers.length - 1]?.maxQuantity === null; // Last tier should be unlimited

        const isValid = rangeValidation.isValid && !overlapCheck.hasOverlaps && hasProperCoverage;

        return {
            isValid,
            hasProperCoverage,
            hasOverlaps: overlapCheck.hasOverlaps,
            errors: [
                ...rangeValidation.errors,
                ...(overlapCheck.hasOverlaps ? ['Overlapping tiers detected'] : []),
                ...(hasProperCoverage ? [] : ['Tier structure does not provide proper coverage'])
            ]
        };
    }

    /**
     * Get the optimal tier for volume pricing
     */
    async getOptimalTier(
        pricingPlanId: string,
        targetQuantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingTier | null> {
        const db = this.getClient(tx);

        // Find tier with lowest unit price that can accommodate the quantity
        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(pricingTiers.pricingPlanId, pricingPlanId),
                    isNull(pricingTiers.deletedAt),
                    sql`${pricingTiers.minQuantity} <= ${targetQuantity}`,
                    sql`(${pricingTiers.maxQuantity} IS NULL OR ${pricingTiers.maxQuantity} >= ${targetQuantity})`
                )
            )
            .orderBy(asc(pricingTiers.unitPriceMinor)) // Lowest price first
            .limit(1);

        return result.length > 0 ? (result[0] as PricingTier) : null;
    }
}
