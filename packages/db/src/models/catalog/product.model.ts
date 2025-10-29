import type { Product, ProductTypeEnum } from '@repo/schemas';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import { products } from '../../schemas/catalog/product.dbschema';
import type * as schema from '../../schemas/index.js';

export interface PricingPlan {
    id: string;
    productId: string;
    billingScheme: string;
    interval: string | null;
    amountMinor: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}

export interface ProductWithPlans extends Product {
    pricingPlans: PricingPlan[];
}

export interface PricingCalculationResult {
    basePrice: number;
    totalPrice: number;
    discount: number;
    quantity: number;
    tier?: {
        id: string;
        minQuantity: number;
        maxQuantity: number | null;
        unitPriceMinor: number;
    };
}

export class ProductModel extends BaseModel<Product> {
    protected table = products;
    protected entityName = 'product';

    protected getTableName(): string {
        return 'products';
    }

    /**
     * Find products by type
     */
    async findByType(
        type: ProductTypeEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Product[]> {
        const db = this.getClient(tx);

        const result = await db.select().from(this.table).where(eq(products.type, type));

        return result as Product[];
    }

    /**
     * Find active products
     */
    async findActive(tx?: NodePgDatabase<typeof schema>): Promise<Product[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    isNull(products.deletedAt),
                    sql`COALESCE(${products.metadata}->>'isActive', 'true')::boolean = true`
                )
            );

        return result as Product[];
    }

    /**
     * Search products by metadata field
     */
    async searchByMetadata(
        key: string,
        value: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Product[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(sql`${products.metadata}->>${key} = ${value}`);

        return result as Product[];
    }

    /**
     * Get available pricing plans for a product
     */
    async getAvailablePlans(
        productId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingPlan[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(pricingPlans)
            .where(and(eq(pricingPlans.productId, productId), isNull(pricingPlans.deletedAt)));

        return result;
    }

    /**
     * Calculate pricing for a product with given quantity
     */
    async calculatePricing(
        productId: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<PricingCalculationResult> {
        // For now, return a basic calculation (will be enhanced when pricing logic is implemented)
        const plans = await this.getAvailablePlans(productId, tx);

        if (plans.length === 0) {
            return {
                basePrice: 0,
                totalPrice: 0,
                discount: 0,
                quantity
            };
        }

        // Use first available plan for basic calculation
        const basePlan = plans[0];
        if (!basePlan) {
            return {
                basePrice: 0,
                totalPrice: 0,
                discount: 0,
                quantity
            };
        }

        const basePrice = basePlan.amountMinor;
        const totalPrice = basePrice * quantity;

        return {
            basePrice,
            totalPrice,
            discount: 0,
            quantity
        };
    }

    /**
     * Check if product is available
     */
    async isAvailable(productId: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(products.id, productId),
                    isNull(products.deletedAt),
                    sql`COALESCE(${products.metadata}->>'isDeleted', 'false')::boolean = false`
                )
            );

        return result.length > 0;
    }

    /**
     * Find products with their pricing plans
     */
    async findWithPricingPlans(tx?: NodePgDatabase<typeof schema>): Promise<ProductWithPlans[]> {
        const db = this.getClient(tx);

        const result = await db.query.products.findMany({
            with: {
                pricingPlans: true
            }
        });

        return result as ProductWithPlans[];
    }

    /**
     * Find products by category in metadata
     */
    async findByCategory(category: string, tx?: NodePgDatabase<typeof schema>): Promise<Product[]> {
        return this.searchByMetadata('category', category, tx);
    }

    /**
     * Find featured products
     */
    async findFeatured(tx?: NodePgDatabase<typeof schema>): Promise<Product[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(this.table)
            .where(
                and(
                    isNull(products.deletedAt),
                    sql`COALESCE(${products.metadata}->>'featured', 'false')::boolean = true`
                )
            );

        return result as Product[];
    }
}
