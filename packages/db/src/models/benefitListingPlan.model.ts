import { BaseModel } from '../base/base.model';
import type { BenefitListingPlan } from '../schemas/services/benefitListingPlan.dbschema';
import { benefitListingPlans } from '../schemas/services/benefitListingPlan.dbschema';

/**
 * Benefit Listing Plan Model
 *
 * Manages plans that define limits and features for benefit listings.
 * Controls capabilities like max listings, analytics access, and trial periods.
 *
 * @extends BaseModel<BenefitListingPlan>
 */
export class BenefitListingPlanModel extends BaseModel<BenefitListingPlan> {
    protected table = benefitListingPlans;
    protected entityName = 'benefit-listing-plan';

    protected getTableName(): string {
        return 'benefit_listing_plans';
    }
}
