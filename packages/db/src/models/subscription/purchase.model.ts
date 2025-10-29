import type { Purchase } from '@repo/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import { clients } from '../../schemas/client/client.dbschema';
import type * as schema from '../../schemas/index.js';
import { purchases } from '../../schemas/subscription/purchase.dbschema';
import { subscriptionItems } from '../../schemas/subscription/subscriptionItem.dbschema';

export class PurchaseModel extends BaseModel<Purchase> {
    protected table = purchases;
    protected entityName = 'purchase';

    protected getTableName(): string {
        return 'purchases';
    }

    /**
     * Business Methods
     */

    /**
     * Find purchases by client
     */
    async findByClient(
        clientId: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Purchase[]; total: number }> {
        return this.findAll({ clientId }, options, tx);
    }

    /**
     * Find purchases by pricing plan
     */
    async findByPlan(
        pricingPlanId: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: Purchase[]; total: number }> {
        return this.findAll({ pricingPlanId }, options, tx);
    }

    /**
     * Calculate total amount for a purchase (could be extended with tax logic)
     */
    async calculateTotal(
        pricingPlanId: string,
        quantity = 1,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number | null> {
        const db = this.getClient(tx);

        const result = await db
            .select({
                amountMinor: pricingPlans.amountMinor
            })
            .from(pricingPlans)
            .where(eq(pricingPlans.id, pricingPlanId))
            .limit(1);

        if (result.length === 0 || !result[0]) return null;

        // Simple calculation - can be extended with tiers, discounts, taxes, etc.
        return result[0].amountMinor * quantity;
    }

    /**
     * One-time Logic
     */

    /**
     * Create purchase from cart/order data
     */
    async createFromCart(
        purchaseData: {
            clientId: string;
            pricingPlanId: string;
            purchasedAt?: Date;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Purchase | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .insert(purchases)
            .values({
                clientId: purchaseData.clientId,
                pricingPlanId: purchaseData.pricingPlanId,
                purchasedAt: purchaseData.purchasedAt || now,
                createdAt: now,
                updatedAt: now
            })
            .returning();

        return (result[0] as Purchase) || null;
    }

    /**
     * Process payment for a purchase (mark as complete)
     */
    async processPayment(
        id: string,
        _paymentData?: {
            paymentId?: string;
            paymentMethod?: string;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Purchase | null> {
        const db = this.getClient(tx);
        const now = new Date();

        // For now, we just update the updated timestamp
        // In a real implementation, this might update payment status fields
        const result = await db
            .update(purchases)
            .set({
                updatedAt: now
                // Could add: paymentId, paymentStatus, etc.
            })
            .where(eq(purchases.id, id))
            .returning();

        return (result[0] as Purchase) || null;
    }

    /**
     * Mark purchase as complete
     */
    async markComplete(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Purchase | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(purchases)
            .set({
                updatedAt: now
                // In a full implementation, might set completedAt or status
            })
            .where(eq(purchases.id, id))
            .returning();

        return (result[0] as Purchase) || null;
    }

    /**
     * Complex Queries
     */

    /**
     * Find purchase with client information
     */
    async withClient(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        purchase: Purchase;
        client: {
            id: string;
            name: string;
            billingEmail: string;
        };
    } | null> {
        const db = this.getClient(tx);

        const result = await db
            .select({
                purchase: purchases,
                client: {
                    id: clients.id,
                    name: clients.name,
                    billingEmail: clients.billingEmail
                }
            })
            .from(purchases)
            .innerJoin(clients, eq(purchases.clientId, clients.id))
            .where(and(eq(purchases.id, id), isNull(purchases.deletedAt)))
            .limit(1);

        if (result.length === 0 || !result[0]) return null;

        return {
            purchase: result[0].purchase as Purchase,
            client: result[0].client
        };
    }

    /**
     * Find purchase with pricing plan information
     */
    async withPlan(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        purchase: Purchase;
        pricingPlan: {
            id: string;
            amountMinor: number;
            currency: string;
            billingScheme: string;
        };
    } | null> {
        const db = this.getClient(tx);

        const result = await db
            .select({
                purchase: purchases,
                pricingPlan: {
                    id: pricingPlans.id,
                    amountMinor: pricingPlans.amountMinor,
                    currency: pricingPlans.currency,
                    billingScheme: pricingPlans.billingScheme
                }
            })
            .from(purchases)
            .innerJoin(pricingPlans, eq(purchases.pricingPlanId, pricingPlans.id))
            .where(and(eq(purchases.id, id), isNull(purchases.deletedAt)))
            .limit(1);

        if (result.length === 0 || !result[0]) return null;

        return {
            purchase: result[0].purchase as Purchase,
            pricingPlan: result[0].pricingPlan
        };
    }

    /**
     * Get recent purchases for a client
     */
    async getRecentPurchases(
        clientId: string,
        limit = 10,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Purchase[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(purchases)
            .where(and(eq(purchases.clientId, clientId), isNull(purchases.deletedAt)))
            .orderBy(desc(purchases.purchasedAt))
            .limit(limit);

        return result as Purchase[];
    }

    /**
     * Find purchase with subscription items
     */
    async withItems(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        purchase: Purchase;
        items: Array<{
            id: string;
            linkedEntityId: string;
            entityType: string;
        }>;
    } | null> {
        const db = this.getClient(tx);

        const result = await db
            .select({
                purchase: purchases,
                item: subscriptionItems
            })
            .from(purchases)
            .leftJoin(
                subscriptionItems,
                and(
                    eq(subscriptionItems.sourceId, purchases.id),
                    eq(subscriptionItems.sourceType, 'PURCHASE'),
                    isNull(subscriptionItems.deletedAt)
                )
            )
            .where(and(eq(purchases.id, id), isNull(purchases.deletedAt)))
            .limit(1);

        if (result.length === 0 || !result[0]) return null;

        const purchase = result[0].purchase as Purchase;
        const items = result
            .filter((row) => row.item)
            .map((row) => {
                const item = row.item;
                return item
                    ? {
                          id: item.id,
                          linkedEntityId: item.linkedEntityId,
                          entityType: item.entityType
                      }
                    : null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        return { purchase, items };
    }
}
