import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { discountCodes } from '../../schemas/promotion/discountCode.dbschema';
import { discountCodeUsages } from '../../schemas/promotion/discountCodeUsage.dbschema';

type DiscountCodeUsage = typeof discountCodeUsages.$inferSelect;

export class DiscountCodeUsageModel extends BaseModel<DiscountCodeUsage> {
    protected table = discountCodeUsages;
    protected entityName = 'discountCodeUsage';

    protected getTableName(): string {
        return 'discount_code_usage';
    }

    /**
     * Record usage of a discount code by a client
     */
    async recordUsage(
        discountCodeId: string,
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<DiscountCodeUsage | null> {
        const db = this.getClient(tx);

        // Check if usage record already exists
        const existingUsage = await db
            .select()
            .from(discountCodeUsages)
            .where(
                and(
                    eq(discountCodeUsages.discountCodeId, discountCodeId),
                    eq(discountCodeUsages.clientId, clientId)
                )
            )
            .limit(1);

        if (existingUsage[0]) {
            // Update existing usage record
            const updated = await db
                .update(discountCodeUsages)
                .set({
                    usageCount: existingUsage[0].usageCount + 1,
                    lastUsedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(discountCodeUsages.id, existingUsage[0].id))
                .returning();

            return (updated[0] as DiscountCodeUsage) || null;
        }

        // Create new usage record
        const created = await db
            .insert(discountCodeUsages)
            .values({
                discountCodeId,
                clientId,
                usageCount: 1,
                firstUsedAt: new Date(),
                lastUsedAt: new Date()
            })
            .returning();

        return (created[0] as DiscountCodeUsage) || null;
    }

    /**
     * Get usage history for a specific discount code
     */
    async getUsageHistory(
        discountCodeId: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: DiscountCodeUsage[]; total: number }> {
        const db = this.getClient(tx);

        const baseQuery = db
            .select()
            .from(discountCodeUsages)
            .where(eq(discountCodeUsages.discountCodeId, discountCodeId))
            .orderBy(desc(discountCodeUsages.lastUsedAt));

        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const items = await baseQuery.limit(options.pageSize).offset(offset);

            // Get total count
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(discountCodeUsages)
                .where(eq(discountCodeUsages.discountCodeId, discountCodeId));

            const total = countResult[0]?.count || 0;

            return { items: items as DiscountCodeUsage[], total: total || 0 };
        }

        const items = await baseQuery;
        return { items: items as DiscountCodeUsage[], total: items.length };
    }

    /**
     * Get usage statistics for a discount code
     */
    async getUsageStats(
        discountCodeId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        totalUsers: number;
        totalUsages: number;
        averageUsagesPerUser: number;
        firstUsed: Date | null;
        lastUsed: Date | null;
    }> {
        const db = this.getClient(tx);

        const stats = await db
            .select({
                totalUsers: sql<number>`count(distinct ${discountCodeUsages.clientId})`,
                totalUsages: sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`,
                firstUsed: sql<Date>`min(${discountCodeUsages.firstUsedAt})`,
                lastUsed: sql<Date>`max(${discountCodeUsages.lastUsedAt})`
            })
            .from(discountCodeUsages)
            .where(eq(discountCodeUsages.discountCodeId, discountCodeId));

        const result = stats[0];
        const totalUsers = result?.totalUsers || 0;
        const totalUsages = result?.totalUsages ? Number(result.totalUsages) : 0;
        const averageUsagesPerUser = totalUsers > 0 ? totalUsages / totalUsers : 0;

        return {
            totalUsers,
            totalUsages,
            averageUsagesPerUser: Math.round(averageUsagesPerUser * 100) / 100,
            firstUsed: result?.firstUsed || null,
            lastUsed: result?.lastUsed || null
        };
    }

    /**
     * Find usage records by discount code
     */
    async findByCode(
        discountCode: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: DiscountCodeUsage[]; total: number }> {
        const db = this.getClient(tx);

        // First get the discount code ID
        const codeRecord = await db
            .select({ id: discountCodes.id })
            .from(discountCodes)
            .where(eq(discountCodes.code, discountCode))
            .limit(1);

        if (!codeRecord[0]) {
            return { items: [], total: 0 };
        }

        return this.getUsageHistory(codeRecord[0].id, options, tx);
    }

    /**
     * Find usage records by client
     */
    async findByClient(
        clientId: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: DiscountCodeUsage[]; total: number }> {
        const db = this.getClient(tx);

        const baseQuery = db
            .select()
            .from(discountCodeUsages)
            .where(eq(discountCodeUsages.clientId, clientId))
            .orderBy(desc(discountCodeUsages.lastUsedAt));

        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const items = await baseQuery.limit(options.pageSize).offset(offset);

            // Get total count
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(discountCodeUsages)
                .where(eq(discountCodeUsages.clientId, clientId));

            const total = countResult[0]?.count || 0;

            return { items: items as DiscountCodeUsage[], total: total || 0 };
        }

        const items = await baseQuery;
        return { items: items as DiscountCodeUsage[], total: items.length };
    }

    /**
     * Get usage count for a specific discount code and client
     */
    async getUsageCount(
        discountCodeId: string,
        clientId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);

        const result = await db
            .select({
                usageCount: discountCodeUsages.usageCount
            })
            .from(discountCodeUsages)
            .where(
                and(
                    eq(discountCodeUsages.discountCodeId, discountCodeId),
                    eq(discountCodeUsages.clientId, clientId)
                )
            )
            .limit(1);

        return result[0]?.usageCount || 0;
    }

    /**
     * Get popular discount codes analytics
     */
    async getPopularCodes(
        limit = 10,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<
        Array<{
            discountCodeId: string;
            code: string;
            totalUsages: number;
            uniqueUsers: number;
            averageUsagesPerUser: number;
        }>
    > {
        const db = this.getClient(tx);

        const results = await db
            .select({
                discountCodeId: discountCodeUsages.discountCodeId,
                code: discountCodes.code,
                totalUsages: sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`,
                uniqueUsers: sql<number>`count(distinct ${discountCodeUsages.clientId})`
            })
            .from(discountCodeUsages)
            .innerJoin(discountCodes, eq(discountCodeUsages.discountCodeId, discountCodes.id))
            .groupBy(discountCodeUsages.discountCodeId, discountCodes.code)
            .orderBy(desc(sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`))
            .limit(limit);

        return results.map((result) => {
            const totalUsages = Number(result.totalUsages) || 0;
            const uniqueUsers = result.uniqueUsers || 0;
            const averageUsagesPerUser = uniqueUsers > 0 ? totalUsages / uniqueUsers : 0;

            return {
                discountCodeId: result.discountCodeId,
                code: result.code,
                totalUsages,
                uniqueUsers,
                averageUsagesPerUser: Math.round(averageUsagesPerUser * 100) / 100
            };
        });
    }

    /**
     * Get usage trends over time
     */
    async getUsageTrends(
        discountCodeId: string,
        days = 30,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<
        Array<{
            date: string;
            newUsers: number;
            totalUsages: number;
        }>
    > {
        const db = this.getClient(tx);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const results = await db
            .select({
                date: sql<string>`date(${discountCodeUsages.lastUsedAt})`,
                newUsers: sql<number>`count(distinct ${discountCodeUsages.clientId})`,
                totalUsages: sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`
            })
            .from(discountCodeUsages)
            .where(
                and(
                    eq(discountCodeUsages.discountCodeId, discountCodeId),
                    sql`${discountCodeUsages.lastUsedAt} >= ${fromDate}`
                )
            )
            .groupBy(sql`date(${discountCodeUsages.lastUsedAt})`)
            .orderBy(sql`date(${discountCodeUsages.lastUsedAt})`);

        return results.map((result) => ({
            date: result.date,
            newUsers: result.newUsers || 0,
            totalUsages: Number(result.totalUsages) || 0
        }));
    }

    /**
     * Calculate total savings generated by discount codes
     */
    async calculateSavings(
        discountCodeId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        totalSavings: number;
        totalUsages: number;
        averageSavingsPerUsage: number;
    }> {
        // Note: This method would require additional data about the original purchase amounts
        // and discount amounts applied. For now, we'll return a basic structure.
        // This could be enhanced by joining with invoice/payment data in the future.

        const db = this.getClient(tx);

        const query = db
            .select({
                totalUsages: sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`
            })
            .from(discountCodeUsages);

        if (discountCodeId) {
            const filteredResult = await db
                .select({
                    totalUsages: sql<number>`COALESCE(SUM(${discountCodeUsages.usageCount}), 0)`
                })
                .from(discountCodeUsages)
                .where(eq(discountCodeUsages.discountCodeId, discountCodeId));

            const totalUsages = Number(filteredResult[0]?.totalUsages) || 0;
            const estimatedSavingsPerUsage = 10;
            const totalSavings = totalUsages * estimatedSavingsPerUsage;

            return {
                totalSavings,
                totalUsages,
                averageSavingsPerUsage: totalUsages > 0 ? totalSavings / totalUsages : 0
            };
        }

        const result = await query;
        const totalUsages = Number(result[0]?.totalUsages) || 0;

        // Placeholder calculation - would need actual discount amounts from invoices
        // This could be enhanced by joining with invoice_line data where discount codes are applied
        const estimatedSavingsPerUsage = 10; // Placeholder
        const totalSavings = totalUsages * estimatedSavingsPerUsage;

        return {
            totalSavings,
            totalUsages,
            averageSavingsPerUsage: totalUsages > 0 ? totalSavings / totalUsages : 0
        };
    }

    /**
     * Get usage records with discount code details
     */
    async findWithCodeDetails(
        _where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        items: Array<DiscountCodeUsage & { discountCode: { code: string; discountType: string } }>;
        total: number;
    }> {
        const db = this.getClient(tx);

        const baseQuery = db
            .select({
                id: discountCodeUsages.id,
                discountCodeId: discountCodeUsages.discountCodeId,
                clientId: discountCodeUsages.clientId,
                usageCount: discountCodeUsages.usageCount,
                firstUsedAt: discountCodeUsages.firstUsedAt,
                lastUsedAt: discountCodeUsages.lastUsedAt,
                createdAt: discountCodeUsages.createdAt,
                updatedAt: discountCodeUsages.updatedAt,
                deletedAt: discountCodeUsages.deletedAt,
                createdById: discountCodeUsages.createdById,
                updatedById: discountCodeUsages.updatedById,
                deletedById: discountCodeUsages.deletedById,
                code: discountCodes.code,
                discountType: discountCodes.discountType
            })
            .from(discountCodeUsages)
            .innerJoin(discountCodes, eq(discountCodeUsages.discountCodeId, discountCodes.id))
            .orderBy(desc(discountCodeUsages.lastUsedAt));

        if (options?.page && options?.pageSize) {
            const offset = (options.page - 1) * options.pageSize;
            const items = await baseQuery.limit(options.pageSize).offset(offset);

            // Get total count
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(discountCodeUsages)
                .innerJoin(discountCodes, eq(discountCodeUsages.discountCodeId, discountCodes.id));

            const total = countResult[0]?.count || 0;

            const formattedItems = items.map((item) => ({
                id: item.id,
                discountCodeId: item.discountCodeId,
                clientId: item.clientId,
                usageCount: item.usageCount,
                firstUsedAt: item.firstUsedAt,
                lastUsedAt: item.lastUsedAt,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                deletedAt: item.deletedAt,
                createdById: item.createdById,
                updatedById: item.updatedById,
                deletedById: item.deletedById,
                discountCode: {
                    code: item.code,
                    discountType: item.discountType
                }
            }));

            return { items: formattedItems, total: total || 0 };
        }

        const items = await baseQuery;
        const formattedItems = items.map((item) => ({
            id: item.id,
            discountCodeId: item.discountCodeId,
            clientId: item.clientId,
            usageCount: item.usageCount,
            firstUsedAt: item.firstUsedAt,
            lastUsedAt: item.lastUsedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            deletedAt: item.deletedAt,
            createdById: item.createdById,
            updatedById: item.updatedById,
            deletedById: item.deletedById,
            discountCode: {
                code: item.code,
                discountType: item.discountType
            }
        }));

        return { items: formattedItems, total: items.length };
    }
}
