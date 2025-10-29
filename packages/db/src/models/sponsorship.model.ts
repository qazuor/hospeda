import type { Sponsorship, SponsorshipEntityTypeEnum } from '@repo/schemas';
import {
    SponsorshipEntityTypeEnum as SponsorshipEntityType,
    SponsorshipStatusEnum
} from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { getDb } from '../client';
import { sponsorships } from '../schemas/marketing/sponsorship.dbschema';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Model for the Sponsorship entity.
 * Extends BaseModel to provide CRUD operations and specialized business logic methods.
 */
export class SponsorshipModel extends BaseModel<Sponsorship> {
    /**
     * The Drizzle table schema for sponsorships.
     */
    protected table = sponsorships;

    /**
     * The entity name for logging and error context.
     */
    protected entityName = 'sponsorship';

    protected getTableName(): string {
        return 'sponsorships';
    }

    /**
     * Create a post sponsorship
     */
    async sponsorPost(params: {
        clientId: string;
        postId: string;
        fromDate: Date;
        toDate: Date;
    }): Promise<Sponsorship> {
        const db = getDb();
        try {
            const newSponsorship = {
                clientId: params.clientId,
                entityType: SponsorshipEntityType.POST,
                entityId: params.postId,
                fromDate: params.fromDate,
                toDate: params.toDate,
                status: SponsorshipStatusEnum.ACTIVE
            };

            const [result] = await db.insert(this.table).values(newSponsorship).returning();

            if (!result) {
                throw new Error('Failed to create sponsorship');
            }

            logQuery(this.entityName, 'sponsorPost', params, result);

            // Transform DB result to match Sponsorship type with default values for fields not in DB
            const sponsorship: Sponsorship = {
                id: result.id,
                clientId: result.clientId,
                entityType: result.entityType as SponsorshipEntityTypeEnum,
                entityId: result.entityId,
                fromDate: result.fromDate ?? params.fromDate,
                toDate: result.toDate ?? params.toDate,
                status: result.status as SponsorshipStatusEnum,
                priority: 50, // Default value - not in DB schema
                spentAmount: 0, // Default value - not in DB schema
                impressionCount: 0, // Default value - not in DB schema
                clickCount: 0, // Default value - not in DB schema
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                createdById: result.createdById ?? '',
                updatedById: result.updatedById ?? '',
                deletedAt: result.deletedAt ?? undefined,
                deletedById: result.deletedById ?? undefined
            };

            return sponsorship;
        } catch (error) {
            logError(this.entityName, 'sponsorPost', params, error as Error);
            throw new DbError(this.entityName, 'sponsorPost', params, (error as Error).message);
        }
    }

    /**
     * Create an event sponsorship
     */
    async sponsorEvent(params: {
        clientId: string;
        eventId: string;
        fromDate: Date;
        toDate: Date;
    }): Promise<Sponsorship> {
        const db = getDb();
        try {
            const newSponsorship = {
                clientId: params.clientId,
                entityType: SponsorshipEntityType.EVENT,
                entityId: params.eventId,
                fromDate: params.fromDate,
                toDate: params.toDate,
                status: SponsorshipStatusEnum.ACTIVE
            };

            const [result] = await db.insert(this.table).values(newSponsorship).returning();

            if (!result) {
                throw new Error('Failed to create event sponsorship');
            }

            logQuery(this.entityName, 'sponsorEvent', params, result);

            // Transform DB result to match Sponsorship type
            const sponsorship: Sponsorship = {
                id: result.id,
                clientId: result.clientId,
                entityType: result.entityType as SponsorshipEntityTypeEnum,
                entityId: result.entityId,
                fromDate: result.fromDate ?? params.fromDate,
                toDate: result.toDate ?? params.toDate,
                status: result.status as SponsorshipStatusEnum,
                priority: 50,
                spentAmount: 0,
                impressionCount: 0,
                clickCount: 0,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                createdById: result.createdById ?? '',
                updatedById: result.updatedById ?? '',
                deletedAt: result.deletedAt ?? undefined,
                deletedById: result.deletedById ?? undefined
            };

            return sponsorship;
        } catch (error) {
            logError(this.entityName, 'sponsorEvent', params, error as Error);
            throw new DbError(this.entityName, 'sponsorEvent', params, (error as Error).message);
        }
    }

    /**
     * Get the sponsored entity (post or event)
     */
    async getSponsoredEntity(_sponsorshipId: string): Promise<unknown> {
        throw new Error('Method getSponsoredEntity not implemented');
    }

    /**
     * Check if sponsorship is currently active
     */
    async isActive(sponsorshipId: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.query.sponsorships.findFirst({
                where: (fields, { eq }) => eq(fields.id, sponsorshipId),
                columns: { status: true }
            });

            logQuery(this.entityName, 'isActive', { sponsorshipId }, result);
            return result?.status === SponsorshipStatusEnum.ACTIVE;
        } catch (error) {
            logError(this.entityName, 'isActive', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'isActive',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Calculate cost for a sponsorship
     */
    async calculateCost(sponsorshipId: string): Promise<number> {
        try {
            const sponsorship = await this.findById(sponsorshipId);
            if (!sponsorship) {
                throw new Error('Sponsorship not found');
            }

            // Basic cost calculation - would be more complex in real world
            const baseCost = sponsorship.entityType === SponsorshipEntityType.POST ? 50 : 100;
            const durationDays =
                sponsorship.fromDate && sponsorship.toDate
                    ? Math.ceil(
                          (sponsorship.toDate.getTime() - sponsorship.fromDate.getTime()) /
                              (1000 * 60 * 60 * 24)
                      )
                    : 1;

            const totalCost = baseCost * durationDays;

            logQuery(this.entityName, 'calculateCost', { sponsorshipId }, { totalCost });
            return totalCost;
        } catch (error) {
            logError(this.entityName, 'calculateCost', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'calculateCost',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Get visibility statistics for a sponsorship
     */
    async getVisibilityStats(sponsorshipId: string): Promise<{
        impressions: number;
        clicks: number;
        reach: number;
        engagement: number;
    }> {
        try {
            const sponsorship = await this.findById(sponsorshipId);
            if (!sponsorship) {
                throw new Error('Sponsorship not found');
            }

            // Mock stats - in real world would query analytics table
            const stats = {
                impressions: Math.floor(Math.random() * 10000),
                clicks: Math.floor(Math.random() * 500),
                reach: Math.floor(Math.random() * 5000),
                engagement: Math.floor(Math.random() * 100)
            };

            logQuery(this.entityName, 'getVisibilityStats', { sponsorshipId }, stats);
            return stats;
        } catch (error) {
            logError(this.entityName, 'getVisibilityStats', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'getVisibilityStats',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Activate a sponsorship
     */
    async activate(sponsorshipId: string): Promise<Sponsorship> {
        try {
            await this.updateById(sponsorshipId, {
                status: SponsorshipStatusEnum.ACTIVE,
                fromDate: new Date()
            });

            const updated = await this.findById(sponsorshipId);
            if (!updated) {
                throw new Error('Sponsorship not found after activation');
            }

            logQuery(this.entityName, 'activate', { sponsorshipId }, updated);
            return updated;
        } catch (error) {
            logError(this.entityName, 'activate', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'activate',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Pause a sponsorship
     */
    async pause(sponsorshipId: string): Promise<Sponsorship> {
        try {
            await this.updateById(sponsorshipId, {
                status: SponsorshipStatusEnum.PAUSED
            });

            const updated = await this.findById(sponsorshipId);
            if (!updated) {
                throw new Error('Sponsorship not found after pause');
            }

            logQuery(this.entityName, 'pause', { sponsorshipId }, updated);
            return updated;
        } catch (error) {
            logError(this.entityName, 'pause', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'pause',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Expire a sponsorship
     */
    async expire(sponsorshipId: string): Promise<Sponsorship> {
        try {
            await this.updateById(sponsorshipId, {
                status: SponsorshipStatusEnum.EXPIRED,
                toDate: new Date()
            });

            const updated = await this.findById(sponsorshipId);
            if (!updated) {
                throw new Error('Sponsorship not found after expiry');
            }

            logQuery(this.entityName, 'expire', { sponsorshipId }, updated);
            return updated;
        } catch (error) {
            logError(this.entityName, 'expire', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'expire',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Cancel a sponsorship
     */
    async cancel(sponsorshipId: string): Promise<Sponsorship> {
        try {
            await this.updateById(sponsorshipId, {
                status: SponsorshipStatusEnum.CANCELLED
            });

            const updated = await this.findById(sponsorshipId);
            if (!updated) {
                throw new Error('Sponsorship not found after cancellation');
            }

            logQuery(this.entityName, 'cancel', { sponsorshipId }, updated);
            return updated;
        } catch (error) {
            logError(this.entityName, 'cancel', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'cancel',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Find all active sponsorships
     */
    async findActive(): Promise<Sponsorship[]> {
        try {
            const result = await this.findAll({ status: SponsorshipStatusEnum.ACTIVE });
            logQuery(this.entityName, 'findActive', {}, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw new DbError(this.entityName, 'findActive', {}, (error as Error).message);
        }
    }

    /**
     * Find sponsorships by client ID
     */
    async findByClient(clientId: string): Promise<Sponsorship[]> {
        try {
            const result = await this.findAll({ clientId });
            logQuery(this.entityName, 'findByClient', { clientId }, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByClient', { clientId }, error as Error);
            throw new DbError(
                this.entityName,
                'findByClient',
                { clientId },
                (error as Error).message
            );
        }
    }

    /**
     * Find sponsorships by entity ID and type
     */
    async findByEntity(
        entityId: string,
        entityType: SponsorshipEntityTypeEnum
    ): Promise<Sponsorship[]> {
        try {
            const result = await this.findAll({ entityId, entityType });
            logQuery(this.entityName, 'findByEntity', { entityId, entityType }, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByEntity', { entityId, entityType }, error as Error);
            throw new DbError(
                this.entityName,
                'findByEntity',
                { entityId, entityType },
                (error as Error).message
            );
        }
    }

    /**
     * Get sponsorship with target entity populated
     */
    async withTarget(sponsorshipId: string): Promise<Sponsorship & { target?: unknown }> {
        try {
            const sponsorship = await this.findById(sponsorshipId);
            if (!sponsorship) {
                throw new Error('Sponsorship not found');
            }

            // Mock target population - in real world would join with posts/events table
            const target = {
                id: sponsorship.entityId,
                type: sponsorship.entityType,
                title: `Sample ${sponsorship.entityType.toLowerCase()} title`
            };

            const result = { ...sponsorship, target };

            logQuery(this.entityName, 'withTarget', { sponsorshipId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'withTarget', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'withTarget',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Get impression count for a sponsorship
     */
    async getImpressions(sponsorshipId: string): Promise<number> {
        try {
            const sponsorship = await this.findById(sponsorshipId);
            if (!sponsorship) {
                throw new Error('Sponsorship not found');
            }

            // Mock impressions - in real world would query analytics table
            const impressions = Math.floor(Math.random() * 10000);

            logQuery(this.entityName, 'getImpressions', { sponsorshipId }, { impressions });
            return impressions;
        } catch (error) {
            logError(this.entityName, 'getImpressions', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'getImpressions',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Get click count for a sponsorship
     */
    async getClicks(sponsorshipId: string): Promise<number> {
        try {
            const sponsorship = await this.findById(sponsorshipId);
            if (!sponsorship) {
                throw new Error('Sponsorship not found');
            }

            // Mock clicks - in real world would query analytics table
            const clicks = Math.floor(Math.random() * 500);

            logQuery(this.entityName, 'getClicks', { sponsorshipId }, { clicks });
            return clicks;
        } catch (error) {
            logError(this.entityName, 'getClicks', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'getClicks',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }

    /**
     * Calculate return on investment for a sponsorship
     */
    async calculateROI(sponsorshipId: string): Promise<number> {
        try {
            const cost = await this.calculateCost(sponsorshipId);
            const clicks = await this.getClicks(sponsorshipId);

            // Simple ROI calculation: (clicks * assumed_value_per_click - cost) / cost
            const valuePerClick = 2; // $2 value per click
            const revenue = clicks * valuePerClick;
            const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

            logQuery(this.entityName, 'calculateROI', { sponsorshipId }, { roi, cost, revenue });
            return roi;
        } catch (error) {
            logError(this.entityName, 'calculateROI', { sponsorshipId }, error as Error);
            throw new DbError(
                this.entityName,
                'calculateROI',
                { sponsorshipId },
                (error as Error).message
            );
        }
    }
}

// Export a singleton instance for convenience
export const sponsorshipModel = new SponsorshipModel();
