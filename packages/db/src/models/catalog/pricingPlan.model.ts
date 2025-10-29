import type { BillingIntervalEnum } from '@repo/schemas';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import { pricingTiers } from '../../schemas/catalog/pricingTier.dbschema';
import type * as schema from '../../schemas/index.js';

// Infer PricingPlan type from the database schema
type PricingPlan = typeof pricingPlans.$inferSelect;

export interface PricingCalculationResult {
    total: number;
    currency: string;
    quantity: number;
    billingInterval?: string;
    plan: PricingPlan;
}

export interface QuantityValidationResult {
    isValid: boolean;
    quantity: number;
    error?: string;
}

export interface PricingPlanWithTiers extends PricingPlan {
    pricingTiers: Array<{
        id: string;
        minQuantity: number;
        maxQuantity: number | null;
        unitPriceMinor: number;
    }>;
}

export interface UsageStats {
    planId: string;
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalRevenue: number;
}

export class PricingPlanModel extends BaseModel<PricingPlan> {
    protected table = pricingPlans;
    protected entityName = 'pricingPlan';

    protected getTableName(): string {
        return 'pricing_plans';
    }

    /**
     * Calculate total price for a given quantity
     */
    async calculateTotal(
        planId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingCalculationResult> {
        const db = this.getClient(tx);

        const planResult = await db.select().from(this.table).where(eq(pricingPlans.id, planId));

        if (planResult.length === 0) {
            throw new Error(`Pricing plan not found: ${planId}`);
        }

        const plan = planResult[0] as PricingPlan;
        const total = plan.amountMinor * quantity;

        return {
            total,
            currency: plan.currency,
            quantity,
            billingInterval: plan.interval || undefined,
            plan
        };
    }

    /**
     * Get applicable pricing tiers for a plan and quantity
     */
    async getApplicableTiers(
        planId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<
        Array<{
            id: string;
            minQuantity: number;
            maxQuantity: number | null;
            unitPriceMinor: number;
        }>
    > {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(pricingTiers)
            .where(
                and(
                    eq(pricingTiers.pricingPlanId, planId),
                    isNull(pricingTiers.deletedAt),
                    sql`${pricingTiers.minQuantity} <= ${quantity}`,
                    sql`(${pricingTiers.maxQuantity} IS NULL OR ${pricingTiers.maxQuantity} >= ${quantity})`
                )
            )
            .orderBy(pricingTiers.minQuantity);

        return result;
    }

    /**
     * Validate quantity against plan constraints
     */
    async validateQuantity(
        _planId: string, // Reserved for future plan-specific validation
        quantity: number
    ): Promise<QuantityValidationResult> {
        if (quantity <= 0) {
            return {
                isValid: false,
                quantity,
                error: 'Quantity must be greater than 0'
            };
        }

        // For now, basic validation - can be enhanced with plan-specific rules
        return {
            isValid: true,
            quantity
        };
    }

    /**
     * Find pricing plans by product ID
     */
    async findByProduct(
        productId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingPlan[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(and(eq(pricingPlans.productId, productId), isNull(pricingPlans.deletedAt)));

        return result as PricingPlan[];
    }

    /**
     * Find recurring plans by interval
     */
    async findRecurring(
        interval: BillingIntervalEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingPlan[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(pricingPlans.billingScheme, 'RECURRING'),
                    eq(pricingPlans.interval, interval),
                    isNull(pricingPlans.deletedAt)
                )
            );

        return result as PricingPlan[];
    }

    /**
     * Find one-time billing plans
     */
    async findOneTime(tx?: NodePgDatabase<typeof schema>): Promise<PricingPlan[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(and(eq(pricingPlans.billingScheme, 'ONE_TIME'), isNull(pricingPlans.deletedAt)));

        return result as PricingPlan[];
    }

    /**
     * Find plans with their pricing tiers
     */
    async withTiers(tx?: NodePgDatabase<typeof schema>): Promise<PricingPlanWithTiers[]> {
        const db = this.getClient(tx);

        const result = await db.query.pricingPlans.findMany({
            with: {
                pricingTiers: true
            }
        });

        return result as PricingPlanWithTiers[];
    }

    /**
     * Get usage statistics for a plan
     * Note: Subscription stats disabled until subscription schema is available
     */
    async getUsageStats(planId: string): Promise<UsageStats> {
        // For now, return basic stats without subscription data
        return {
            planId,
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            totalRevenue: 0
        };
    }
}
