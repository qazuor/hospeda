import type { ProfessionalService, ProfessionalServiceCategoryEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { professionalServiceTypes } from '../schemas/services/professionalServiceType.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Professional Service Type Model
 *
 * Manages types of professional services offered to clients including
 * photography, copywriting, SEO, design, and maintenance services.
 *
 * @extends BaseModel<ProfessionalService>
 */
export class ProfessionalServiceTypeModel extends BaseModel<ProfessionalService> {
    protected table = professionalServiceTypes;
    protected entityName = 'professional-service-type';

    protected getTableName(): string {
        return 'professional_service_types';
    }

    /**
     * Find all professional service types by category
     *
     * @param category - The service category to filter by
     * @returns Array of professional service types
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
     * Find all active professional service types
     *
     * @returns Array of active professional service types
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
     * Activate a professional service type (set isActive to true)
     *
     * @param serviceTypeId - The service type ID to activate
     * @returns Updated service type
     *
     * @example
     * ```ts
     * const activated = await model.activate('service-type-123');
     * ```
     */
    async activate(serviceTypeId: string): Promise<ProfessionalService> {
        try {
            const result = await this.update({ id: serviceTypeId }, {
                isActive: true
            } as Partial<ProfessionalService>);

            if (!result) {
                throw new Error(`Professional service type not found: ${serviceTypeId}`);
            }

            logQuery(this.entityName, 'activate', { serviceTypeId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { serviceTypeId }, error as Error);
            throw error;
        }
    }

    /**
     * Deactivate a professional service type (set isActive to false)
     *
     * @param serviceTypeId - The service type ID to deactivate
     * @returns Updated service type
     *
     * @example
     * ```ts
     * const deactivated = await model.deactivate('service-type-123');
     * ```
     */
    async deactivate(serviceTypeId: string): Promise<ProfessionalService> {
        try {
            const result = await this.update({ id: serviceTypeId }, {
                isActive: false
            } as Partial<ProfessionalService>);

            if (!result) {
                throw new Error(`Professional service type not found: ${serviceTypeId}`);
            }

            logQuery(this.entityName, 'deactivate', { serviceTypeId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'deactivate', { serviceTypeId }, error as Error);
            throw error;
        }
    }
}
