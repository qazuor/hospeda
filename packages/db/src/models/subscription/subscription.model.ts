import { SubscriptionStatusEnum } from '@repo/schemas';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import type * as schema from '../../schemas/index.js';
import { subscriptions } from '../../schemas/subscription/subscription.dbschema';
import { subscriptionItems } from '../../schemas/subscription/subscriptionItem.dbschema';

type Subscription = typeof subscriptions.$inferSelect;

export class SubscriptionModel extends BaseModel<Subscription> {
    protected table = subscriptions;
    protected entityName = 'subscription';

    protected getTableName(): string {
        return 'subscriptions';
    }

    async activate(
        id: string,
        startAt?: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Subscription | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(subscriptions)
            .set({
                status: SubscriptionStatusEnum.ACTIVE,
                startAt: startAt || now,
                updatedAt: now
            })
            .where(eq(subscriptions.id, id))
            .returning();

        return (result[0] as Subscription) || null;
    }

    // Lifecycle methods
    async cancel(
        id: string,
        cancelAt?: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Subscription | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(subscriptions)
            .set({
                status: SubscriptionStatusEnum.CANCELLED,
                endAt: cancelAt || now,
                updatedAt: now
            })
            .where(eq(subscriptions.id, id))
            .returning();

        return (result[0] as Subscription) || null;
    }

    async renew(
        id: string,
        newEndAt: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Subscription | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(subscriptions)
            .set({
                endAt: newEndAt,
                updatedAt: now
            })
            .where(eq(subscriptions.id, id))
            .returning();

        return (result[0] as Subscription) || null;
    }

    // Business methods
    async isActive(id: string): Promise<boolean> {
        const subscription = await this.findById(id);
        if (!subscription) return false;

        const now = new Date();
        return (
            subscription.status === SubscriptionStatusEnum.ACTIVE &&
            (!subscription.endAt || subscription.endAt > now)
        );
    }

    async isTrialExpiring(id: string, daysThreshold: number): Promise<boolean> {
        const subscription = await this.findById(id);
        if (!subscription || !subscription.trialEndsAt) return false;

        const now = new Date();
        const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

        return subscription.trialEndsAt <= threshold && subscription.trialEndsAt > now;
    }

    async calculateNextBilling(id: string): Promise<Date | null> {
        const db = this.getClient();

        const result = await db
            .select({
                subscription: subscriptions,
                pricingPlan: {
                    id: pricingPlans.id,
                    billingInterval: pricingPlans.interval
                }
            })
            .from(subscriptions)
            .leftJoin(pricingPlans, eq(subscriptions.pricingPlanId, pricingPlans.id))
            .where(eq(subscriptions.id, id))
            .limit(1);

        if (
            result.length === 0 ||
            !result[0] ||
            !result[0].pricingPlan?.billingInterval ||
            !result[0].subscription.startAt
        ) {
            return null;
        }

        const firstResult = result[0];
        const { subscription, pricingPlan } = firstResult;

        // Additional type safety check
        if (!pricingPlan || !subscription.startAt) {
            return null;
        }

        const startDate = new Date(subscription.startAt);

        // Use UTC methods to avoid timezone issues
        const startYear = startDate.getUTCFullYear();
        const startMonth = startDate.getUTCMonth();
        const startDay = startDate.getUTCDate();

        switch (pricingPlan.billingInterval) {
            case 'MONTH':
                // Create a local date for the next month
                return new Date(startYear, startMonth + 1, startDay);
            case 'YEAR':
                return new Date(startYear + 1, startMonth, startDay);
            case 'WEEK':
                return new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            default:
                return null;
        }
    }

    // State management
    canTransitionTo(fromStatus: SubscriptionStatusEnum, toStatus: SubscriptionStatusEnum): boolean {
        const allowedTransitions: Record<SubscriptionStatusEnum, SubscriptionStatusEnum[]> = {
            [SubscriptionStatusEnum.PENDING]: [
                SubscriptionStatusEnum.ACTIVE,
                SubscriptionStatusEnum.CANCELLED
            ],
            [SubscriptionStatusEnum.ACTIVE]: [
                SubscriptionStatusEnum.PAST_DUE,
                SubscriptionStatusEnum.CANCELLED,
                SubscriptionStatusEnum.EXPIRED,
                SubscriptionStatusEnum.PAUSED
            ],
            [SubscriptionStatusEnum.PAST_DUE]: [
                SubscriptionStatusEnum.ACTIVE,
                SubscriptionStatusEnum.CANCELLED,
                SubscriptionStatusEnum.EXPIRED
            ],
            [SubscriptionStatusEnum.PAUSED]: [
                SubscriptionStatusEnum.ACTIVE,
                SubscriptionStatusEnum.CANCELLED,
                SubscriptionStatusEnum.EXPIRED
            ],
            [SubscriptionStatusEnum.CANCELLED]: [],
            [SubscriptionStatusEnum.EXPIRED]: []
        };

        return allowedTransitions[fromStatus]?.includes(toStatus) || false;
    }

    async updateStatus(
        id: string,
        newStatus: SubscriptionStatusEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Subscription | null> {
        const subscription = await this.findById(id);
        if (!subscription) {
            throw new Error(`Subscription with ID ${id} not found`);
        }

        if (!this.canTransitionTo(subscription.status as SubscriptionStatusEnum, newStatus)) {
            throw new Error(
                `Invalid status transition from ${subscription.status} to ${newStatus}`
            );
        }

        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(subscriptions)
            .set({
                status: newStatus,
                updatedAt: now
            })
            .where(eq(subscriptions.id, id))
            .returning();

        return (result[0] as Subscription) || null;
    }

    // Complex queries
    async findActive(): Promise<Subscription[]> {
        const db = this.getClient();
        const now = new Date();

        return await db
            .select()
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.status, SubscriptionStatusEnum.ACTIVE),
                    gte(subscriptions.endAt, now)
                )
            );
    }

    async findExpiring(daysThreshold: number): Promise<Subscription[]> {
        const db = this.getClient();
        const now = new Date();
        const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

        return await db
            .select()
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.status, SubscriptionStatusEnum.ACTIVE),
                    lte(subscriptions.endAt, threshold),
                    gte(subscriptions.endAt, now)
                )
            );
    }

    async findByClient(clientId: string): Promise<Subscription[]> {
        const db = this.getClient();

        return await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId));
    }

    async withItems(subscriptionId: string): Promise<{
        subscription: Subscription;
        items: (typeof subscriptionItems.$inferSelect)[];
    } | null> {
        const db = this.getClient();

        const subscription = await this.findById(subscriptionId);
        if (!subscription) return null;

        const items = await db
            .select()
            .from(subscriptionItems)
            .where(
                and(
                    eq(subscriptionItems.sourceId, subscriptionId),
                    eq(subscriptionItems.sourceType, 'subscription')
                )
            );

        return {
            subscription,
            items
        };
    }
}
