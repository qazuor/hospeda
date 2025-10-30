import { BaseModel } from '../base/base.model';
import type { TouristService } from '../schemas/serviceListing/touristService.dbschema';
import { touristServices } from '../schemas/serviceListing/touristService.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Tourist Service Model
 *
 * Manages tourist services offered by clients (tours, activities, experiences).
 * Handles service details like duration, capacity, requirements, and operating schedule.
 *
 * @extends BaseModel<TouristService>
 */
export class TouristServiceModel extends BaseModel<TouristService> {
    protected table = touristServices;
    protected entityName = 'tourist-service';

    protected getTableName(): string {
        return 'tourist_services';
    }

    /**
     * Find all services for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of tourist services
     *
     * @example
     * ```ts
     * const clientServices = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<TouristService[]> {
        try {
            const result = await this.findAll({ clientId });
            logQuery(this.entityName, 'findByClient', { clientId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByClient', { clientId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all services by category
     *
     * @param category - The service category to filter by (e.g., 'tour', 'activity', 'experience')
     * @returns Array of tourist services
     *
     * @example
     * ```ts
     * const tourServices = await model.findByCategory('tour');
     * ```
     */
    async findByCategory(category: string): Promise<TouristService[]> {
        try {
            const result = await this.findAll({ category });
            logQuery(this.entityName, 'findByCategory', { category }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByCategory', { category }, error as Error);
            throw error;
        }
    }
}
