import type { ProfessionalService, ProfessionalServiceCategoryEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { professionalServices } from '../schemas/services/professionalService.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Professional Service Model
 *
 * Manages professional services offered to accommodation hosts and clients.
 * Includes service categorization, pricing models, and availability status.
 *
 * @extends BaseModel<ProfessionalService>
 */
export class ProfessionalServiceModel extends BaseModel<ProfessionalService> {
    protected table = professionalServices;
    protected entityName = 'professional-service';

    protected getTableName(): string {
        return 'professional_services';
    }

    /**
     * Find all professional services by category
     *
     * @param category - The service category to filter by
     * @returns Array of professional services
     *
     * @example
     * ```ts
     * const photoServices = await model.findByCategory(ProfessionalServiceCategoryEnum.PHOTO);
     * ```
     */
    async findByCategory(
        category: ProfessionalServiceCategoryEnum
    ): Promise<ProfessionalService[]> {
        try {
            const result = await this.findAll({ category });
            logQuery(this.entityName, 'findByCategory', { category }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByCategory', { category }, error as Error);
            throw error;
        }
    }

    /**
     * Find all active professional services
     *
     * @returns Array of active professional services
     *
     * @example
     * ```ts
     * const activeServices = await model.findActive();
     * ```
     */
    async findActive(): Promise<ProfessionalService[]> {
        try {
            const result = await this.findAll({ isActive: true });
            logQuery(this.entityName, 'findActive', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findActive', {}, error as Error);
            throw error;
        }
    }

    /**
     * Activate a professional service (set isActive to true)
     *
     * @param serviceId - The service ID to activate
     * @returns Updated service
     *
     * @example
     * ```ts
     * const activated = await model.activate('service-123');
     * ```
     */
    async activate(serviceId: string): Promise<ProfessionalService> {
        try {
            const result = await this.update({ id: serviceId }, { isActive: true });
            if (!result) {
                throw new Error(`Professional service with ID ${serviceId} not found`);
            }
            logQuery(this.entityName, 'activate', { serviceId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { serviceId }, error as Error);
            throw error;
        }
    }

    /**
     * Deactivate a professional service (set isActive to false)
     *
     * @param serviceId - The service ID to deactivate
     * @returns Updated service
     *
     * @example
     * ```ts
     * const deactivated = await model.deactivate('service-123');
     * ```
     */
    async deactivate(serviceId: string): Promise<ProfessionalService> {
        try {
            const result = await this.update({ id: serviceId }, { isActive: false });
            if (!result) {
                throw new Error(`Professional service with ID ${serviceId} not found`);
            }
            logQuery(this.entityName, 'deactivate', { serviceId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'deactivate', { serviceId }, error as Error);
            throw error;
        }
    }

    /**
     * Find services within a price range
     *
     * @param minPrice - Minimum base price
     * @param maxPrice - Maximum base price
     * @returns Array of professional services within the price range
     *
     * @example
     * ```ts
     * const affordableServices = await model.findByPriceRange(0, 1000);
     * ```
     */
    async findByPriceRange(minPrice: number, maxPrice: number): Promise<ProfessionalService[]> {
        try {
            // Note: This requires custom query as defaultPricing is JSONB
            // BaseModel doesn't support JSONB filtering yet
            // TODO: Implement JSONB filtering in BaseModel or custom query here
            logQuery(this.entityName, 'findByPriceRange', { minPrice, maxPrice }, []);
            return [];
        } catch (error) {
            logError(this.entityName, 'findByPriceRange', { minPrice, maxPrice }, error as Error);
            throw error;
        }
    }
}
