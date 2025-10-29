import type { SubscriptionItem } from '@repo/schemas';
import { SubscriptionItemEntityTypeEnum, SubscriptionItemSourceTypeEnum } from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { purchases } from '../../schemas/subscription/purchase.dbschema';
import { subscriptions } from '../../schemas/subscription/subscription.dbschema';
import { subscriptionItems } from '../../schemas/subscription/subscriptionItem.dbschema';

export class SubscriptionItemModel extends BaseModel<SubscriptionItem> {
    protected table = subscriptionItems;
    protected entityName = 'subscriptionItem';

    protected getTableName(): string {
        return 'subscription_items';
    }

    /**
     * Polymorphic Queries
     */

    /**
     * Find subscription items by entity type
     */
    async findByEntityType(
        entityType: string,
        options?: { page?: number; pageSize?: number },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ items: SubscriptionItem[]; total: number }> {
        return this.findAll({ entityType }, options, tx);
    }

    /**
     * Find subscription items by linked entity
     */
    async findByLinkedEntity(
        linkedEntityId: string,
        entityType?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        const db = this.getClient(tx);

        const whereConditions = [
            eq(subscriptionItems.linkedEntityId, linkedEntityId),
            isNull(subscriptionItems.deletedAt)
        ];

        if (entityType) {
            whereConditions.push(eq(subscriptionItems.entityType, entityType));
        }

        const result = await db
            .select()
            .from(subscriptionItems)
            .where(and(...whereConditions))
            .limit(100); // Default limit for performance

        return result as SubscriptionItem[];
    }

    /**
     * Find subscription items by source (subscription or purchase)
     */
    async findBySource(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(subscriptionItems)
            .where(
                and(
                    eq(subscriptionItems.sourceId, sourceId),
                    eq(subscriptionItems.sourceType, sourceType),
                    isNull(subscriptionItems.deletedAt)
                )
            )
            .limit(100); // Default limit for performance

        return result as SubscriptionItem[];
    }

    /**
     * Business Methods
     */

    /**
     * Link an entity to a subscription or purchase
     */
    async linkToEntity(
        sourceId: string,
        sourceType: string,
        linkedEntityId: string,
        entityType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem | null> {
        // Validate that the source exists
        const sourceExists = await this.validateSourceExists(sourceId, sourceType, tx);
        if (!sourceExists) {
            throw new Error(
                `Source ${sourceType.toUpperCase()} with ID ${sourceId} does not exist`
            );
        }

        // Validate that the entity type is supported
        const validEntityTypes = Object.values(SubscriptionItemEntityTypeEnum) as string[];
        if (!validEntityTypes.includes(entityType)) {
            throw new Error(`Unsupported entity type: ${entityType}`);
        }

        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .insert(subscriptionItems)
            .values({
                sourceId,
                sourceType,
                linkedEntityId,
                entityType,
                createdAt: now,
                updatedAt: now
            })
            .returning();

        return (result[0] as SubscriptionItem) || null;
    }

    /**
     * Unlink an entity from a subscription or purchase
     */
    async unlinkFromEntity(
        sourceId: string,
        sourceType: string,
        linkedEntityId: string,
        entityType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(subscriptionItems)
            .set({
                deletedAt: now,
                updatedAt: now
            })
            .where(
                and(
                    eq(subscriptionItems.sourceId, sourceId),
                    eq(subscriptionItems.sourceType, sourceType),
                    eq(subscriptionItems.linkedEntityId, linkedEntityId),
                    eq(subscriptionItems.entityType, entityType),
                    isNull(subscriptionItems.deletedAt)
                )
            )
            .returning();

        return result.length > 0;
    }

    /**
     * Get linked entity information (polymorphic)
     */
    async getLinkedEntity(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        linkedEntityId: string;
        entityType: string;
    } | null> {
        const item = await this.findById(id, tx);
        if (!item) return null;

        return {
            linkedEntityId: item.linkedEntityId,
            entityType: item.entityType
        };
    }

    /**
     * Complex Polymorphic Joins
     */

    /**
     * Get subscription item with linked entity details (requires entity-specific implementation)
     */
    async withLinkedEntity(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        item: SubscriptionItem;
        linkedEntityId: string;
        entityType: string;
    } | null> {
        const item = await this.findById(id, tx);
        if (!item) return null;

        // This method returns basic entity info
        // Specific entity details would require separate methods per entity type
        return {
            item,
            linkedEntityId: item.linkedEntityId,
            entityType: item.entityType
        };
    }

    /**
     * Validate that entity exists (basic validation - entity-specific validation would be separate)
     */
    async validateEntityExists(
        linkedEntityId: string,
        entityType: string,
        _tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        // This is a placeholder - in a real implementation, this would check
        // the specific entity table based on entityType
        // For now, we just return true if we have the required parameters
        return Boolean(linkedEntityId && entityType);
    }

    /**
     * Validate that source exists
     */
    async validateSourceExists(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);

        if (sourceType === SubscriptionItemSourceTypeEnum.SUBSCRIPTION) {
            const result = await db
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(and(eq(subscriptions.id, sourceId), isNull(subscriptions.deletedAt)))
                .limit(1);
            return result.length > 0;
        }

        if (sourceType === SubscriptionItemSourceTypeEnum.PURCHASE) {
            const result = await db
                .select({ id: purchases.id })
                .from(purchases)
                .where(and(eq(purchases.id, sourceId), isNull(purchases.deletedAt)))
                .limit(1);
            return result.length > 0;
        }

        return false;
    }

    /**
     * Type-safe Helpers
     */

    /**
     * Find accommodation listings
     */
    async findAccommodationListings(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter(
                (item) => item.entityType === SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING
            )
        );
    }

    /**
     * Find campaigns
     */
    async findCampaigns(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter((item) => item.entityType === SubscriptionItemEntityTypeEnum.CAMPAIGN)
        );
    }

    /**
     * Find sponsorships
     */
    async findSponsorship(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter((item) => item.entityType === SubscriptionItemEntityTypeEnum.SPONSORSHIP)
        );
    }

    /**
     * Find featured accommodations
     */
    async findFeaturedAccommodations(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter(
                (item) => item.entityType === SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION
            )
        );
    }

    /**
     * Find professional service orders
     */
    async findProfessionalServiceOrders(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter(
                (item) =>
                    item.entityType === SubscriptionItemEntityTypeEnum.PROFESSIONAL_SERVICE_ORDER
            )
        );
    }

    /**
     * Find benefit listings
     */
    async findBenefitListings(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter(
                (item) => item.entityType === SubscriptionItemEntityTypeEnum.BENEFIT_LISTING
            )
        );
    }

    /**
     * Find service listings
     */
    async findServiceListings(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<SubscriptionItem[]> {
        return this.findBySource(sourceId, sourceType, tx).then((items) =>
            items.filter(
                (item) => item.entityType === SubscriptionItemEntityTypeEnum.SERVICE_LISTING
            )
        );
    }

    /**
     * Get all entity types for a source
     */
    async getEntityTypesForSource(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<string[]> {
        const items = await this.findBySource(sourceId, sourceType, tx);
        const uniqueTypes = new Set(items.map((item) => item.entityType));
        return Array.from(uniqueTypes);
    }

    /**
     * Count items by entity type for a source
     */
    async countByEntityType(
        sourceId: string,
        sourceType: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Record<string, number>> {
        const items = await this.findBySource(sourceId, sourceType, tx);
        const counts: Record<string, number> = {};

        for (const item of items) {
            counts[item.entityType] = (counts[item.entityType] || 0) + 1;
        }

        return counts;
    }
}
