import { BaseModel } from '../base/base.model';
import type { BenefitPartner } from '../schemas/services/benefitPartner.dbschema';
import { benefitPartners } from '../schemas/services/benefitPartner.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Benefit Partner Model
 *
 * Manages partner organizations that provide benefits to accommodation clients.
 * Partners can be restaurants, spas, tours, transport services, etc.
 *
 * @extends BaseModel<BenefitPartner>
 */
export class BenefitPartnerModel extends BaseModel<BenefitPartner> {
    protected table = benefitPartners;
    protected entityName = 'benefit-partner';

    protected getTableName(): string {
        return 'benefit_partners';
    }

    /**
     * Find all partners for a specific client
     *
     * @param clientId - The client ID to filter by
     * @returns Array of benefit partners
     *
     * @example
     * ```ts
     * const clientPartners = await model.findByClient('client-123');
     * ```
     */
    async findByClient(clientId: string): Promise<BenefitPartner[]> {
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
     * Find all partners by category
     *
     * @param category - The partner category to filter by (e.g., 'restaurant', 'spa', 'tour')
     * @returns Array of benefit partners
     *
     * @example
     * ```ts
     * const spaPartners = await model.findByCategory('spa');
     * ```
     */
    async findByCategory(category: string): Promise<BenefitPartner[]> {
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
