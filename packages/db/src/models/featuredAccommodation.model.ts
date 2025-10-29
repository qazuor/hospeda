import type { FeaturedAccommodation, FeaturedTypeEnum } from '@repo/schemas';
import { FeaturedStatusEnum, FeaturedTypeEnum as FeaturedType } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { featuredAccommodations } from '../schemas/marketing/featuredAccommodation.dbschema';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Model for the FeaturedAccommodation entity.
 * Extends BaseModel to provide CRUD operations and specialized business logic methods.
 */
export class FeaturedAccommodationModel extends BaseModel<FeaturedAccommodation> {
    /**
     * Table reference for database operations
     */
    protected table = featuredAccommodations;

    /**
     * Entity name for logging and error handling
     */
    protected entityName = 'FeaturedAccommodation';

    /**
     * Get the table name
     */
    getTableName(): string {
        return 'featured_accommodations';
    }

    /**
     * Feature an accommodation on the home page
     */
    async featureOnHome(params: {
        clientId: string;
        accommodationId: string;
        fromDate: Date;
        toDate: Date;
        createdById?: string;
    }): Promise<FeaturedAccommodation> {
        try {
            const data = {
                clientId: params.clientId,
                accommodationId: params.accommodationId,
                featuredType: FeaturedType.HOME,
                fromDate: params.fromDate.toISOString(),
                toDate: params.toDate.toISOString(),
                status: FeaturedStatusEnum.ACTIVE,
                createdById: params.createdById
            };

            const result = await this.create(data);
            logQuery(this.entityName, 'featureOnHome', params, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'featureOnHome', params, error as Error);
            throw new DbError(this.entityName, 'featureOnHome', params, (error as Error).message);
        }
    }

    /**
     * Feature an accommodation in destination pages
     */
    async featureInDestination(params: {
        clientId: string;
        accommodationId: string;
        fromDate: Date;
        toDate: Date;
        createdById?: string;
    }): Promise<FeaturedAccommodation> {
        try {
            const data = {
                clientId: params.clientId,
                accommodationId: params.accommodationId,
                featuredType: FeaturedType.DESTINATION,
                fromDate: params.fromDate.toISOString(),
                toDate: params.toDate.toISOString(),
                status: FeaturedStatusEnum.ACTIVE,
                createdById: params.createdById
            };

            const result = await this.create(data);
            logQuery(this.entityName, 'featureInDestination', params, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'featureInDestination', params, error as Error);
            throw new DbError(
                this.entityName,
                'featureInDestination',
                params,
                (error as Error).message
            );
        }
    }

    /**
     * Feature an accommodation in search results
     */
    async featureInSearch(params: {
        clientId: string;
        accommodationId: string;
        fromDate: Date;
        toDate: Date;
        createdById?: string;
    }): Promise<FeaturedAccommodation> {
        try {
            const data = {
                clientId: params.clientId,
                accommodationId: params.accommodationId,
                featuredType: FeaturedType.SEARCH,
                fromDate: params.fromDate.toISOString(),
                toDate: params.toDate.toISOString(),
                status: FeaturedStatusEnum.ACTIVE,
                createdById: params.createdById
            };

            const result = await this.create(data);
            logQuery(this.entityName, 'featureInSearch', params, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'featureInSearch', params, error as Error);
            throw new DbError(this.entityName, 'featureInSearch', params, (error as Error).message);
        }
    }

    /**
     * Check if a featured accommodation is currently active
     */
    async isActive(featuredId: string): Promise<boolean> {
        try {
            const featured = await this.findById(featuredId);
            if (!featured) {
                return false;
            }

            const now = new Date();
            const isStatusActive = featured.status === FeaturedStatusEnum.ACTIVE;
            const fromDate = featured.fromDate ? new Date(featured.fromDate) : null;
            const toDate = featured.toDate ? new Date(featured.toDate) : null;
            const isInDateRange = (!fromDate || fromDate <= now) && (!toDate || toDate >= now);

            const result = isStatusActive && isInDateRange;
            logQuery(this.entityName, 'isActive', { featuredId }, { result });
            return result;
        } catch (error) {
            logError(this.entityName, 'isActive', { featuredId }, error as Error);
            throw new DbError(
                this.entityName,
                'isActive',
                { featuredId },
                (error as Error).message
            );
        }
    }

    /**
     * Calculate visibility score for a featured accommodation
     */
    async calculateVisibility(featuredId: string): Promise<number> {
        try {
            const featured = await this.findById(featuredId);
            if (!featured) {
                throw new Error('Featured accommodation not found');
            }

            // Base visibility calculation based on type
            let baseScore = 0;
            switch (featured.featuredType) {
                case FeaturedType.HOME:
                    baseScore = 100;
                    break;
                case FeaturedType.DESTINATION:
                    baseScore = 80;
                    break;
                case FeaturedType.SEARCH:
                    baseScore = 60;
                    break;
                default:
                    baseScore = 50;
            }

            // Adjust based on activity
            const isCurrentlyActive = await this.isActive(featuredId);
            const visibilityScore = isCurrentlyActive ? baseScore : 0;

            logQuery(this.entityName, 'calculateVisibility', { featuredId }, { visibilityScore });
            return visibilityScore;
        } catch (error) {
            logError(this.entityName, 'calculateVisibility', { featuredId }, error as Error);
            throw new DbError(
                this.entityName,
                'calculateVisibility',
                { featuredId },
                (error as Error).message
            );
        }
    }

    /**
     * Get placement statistics for a featured accommodation
     */
    async getPlacementStats(featuredId: string): Promise<{
        views: number;
        clicks: number;
        conversions: number;
        position: number;
    }> {
        try {
            const featured = await this.findById(featuredId);
            if (!featured) {
                throw new Error('Featured accommodation not found');
            }

            // Mock statistics - in real world would query analytics table
            const stats = {
                views: Math.floor(Math.random() * 5000),
                clicks: Math.floor(Math.random() * 250),
                conversions: Math.floor(Math.random() * 25),
                position: Math.floor(Math.random() * 5) + 1
            };

            logQuery(this.entityName, 'getPlacementStats', { featuredId }, stats);
            return stats;
        } catch (error) {
            logError(this.entityName, 'getPlacementStats', { featuredId }, error as Error);
            throw new DbError(
                this.entityName,
                'getPlacementStats',
                { featuredId },
                (error as Error).message
            );
        }
    }

    /**
     * Get priority of a featured accommodation (mock implementation)
     */
    async getPriority(featuredId: string): Promise<number> {
        try {
            const featured = await this.findById(featuredId);
            if (!featured) {
                throw new Error('Featured accommodation not found');
            }

            // Mock priority calculation
            const priority = Math.floor(Math.random() * 10) + 1;

            logQuery(this.entityName, 'getPriority', { featuredId }, { priority });
            return priority;
        } catch (error) {
            logError(this.entityName, 'getPriority', { featuredId }, error as Error);
            throw new DbError(
                this.entityName,
                'getPriority',
                { featuredId },
                (error as Error).message
            );
        }
    }

    /**
     * Update priority of a featured accommodation
     */
    async updatePriority(featuredId: string, priority: number): Promise<FeaturedAccommodation> {
        try {
            // In a real implementation, this would update a priority field
            // For now, we'll just update the updatedAt timestamp
            await this.updateById(featuredId, {
                updatedById: 'system' // Would come from context in real implementation
            });

            const updated = await this.findById(featuredId);
            if (!updated) {
                throw new Error('Featured accommodation not found after priority update');
            }

            logQuery(this.entityName, 'updatePriority', { featuredId, priority }, updated);
            return updated;
        } catch (error) {
            logError(this.entityName, 'updatePriority', { featuredId, priority }, error as Error);
            throw new DbError(
                this.entityName,
                'updatePriority',
                { featuredId, priority },
                (error as Error).message
            );
        }
    }

    /**
     * Resolve priority conflicts between featured accommodations
     */
    async resolvePriorityConflicts(
        featuredType: FeaturedTypeEnum
    ): Promise<FeaturedAccommodation[]> {
        try {
            const activeFeatures = await this.findAll({
                featuredType,
                status: FeaturedStatusEnum.ACTIVE
            });

            // In a real implementation, this would reorder priorities
            // For now, we'll just return the current features
            logQuery(this.entityName, 'resolvePriorityConflicts', { featuredType }, activeFeatures);
            return activeFeatures.items;
        } catch (error) {
            logError(this.entityName, 'resolvePriorityConflicts', { featuredType }, error as Error);
            throw new DbError(
                this.entityName,
                'resolvePriorityConflicts',
                { featuredType },
                (error as Error).message
            );
        }
    }

    /**
     * Find featured accommodations by type
     */
    async findByType(featuredType: FeaturedTypeEnum): Promise<FeaturedAccommodation[]> {
        try {
            const result = await this.findAll({ featuredType });
            logQuery(this.entityName, 'findByType', { featuredType }, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByType', { featuredType }, error as Error);
            throw new DbError(
                this.entityName,
                'findByType',
                { featuredType },
                (error as Error).message
            );
        }
    }

    /**
     * Find featured accommodations by accommodation ID
     */
    async findByAccommodation(accommodationId: string): Promise<FeaturedAccommodation[]> {
        try {
            const result = await this.findAll({ accommodationId });
            logQuery(this.entityName, 'findByAccommodation', { accommodationId }, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByAccommodation', { accommodationId }, error as Error);
            throw new DbError(
                this.entityName,
                'findByAccommodation',
                { accommodationId },
                (error as Error).message
            );
        }
    }

    /**
     * Find all active featured accommodations
     */
    async findActive(): Promise<FeaturedAccommodation[]> {
        try {
            const result = await this.findAll({ status: FeaturedStatusEnum.ACTIVE });
            logQuery(this.entityName, 'findActive', {}, result);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw new DbError(this.entityName, 'findActive', {}, (error as Error).message);
        }
    }

    /**
     * Get featured accommodation with accommodation details populated
     */
    async withAccommodation(
        featuredId: string
    ): Promise<FeaturedAccommodation & { accommodation?: unknown }> {
        try {
            const featured = await this.findById(featuredId);
            if (!featured) {
                throw new Error('Featured accommodation not found');
            }

            // Mock accommodation population - in real world would join with accommodations table
            const accommodation = {
                id: featured.accommodationId,
                name: 'Sample Accommodation',
                description: 'Beautiful accommodation for your stay'
            };

            const result = { ...featured, accommodation };

            logQuery(this.entityName, 'withAccommodation', { featuredId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'withAccommodation', { featuredId }, error as Error);
            throw new DbError(
                this.entityName,
                'withAccommodation',
                { featuredId },
                (error as Error).message
            );
        }
    }
}

// Export a singleton instance for convenience
export const featuredAccommodationModel = new FeaturedAccommodationModel();
