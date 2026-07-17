import { BaseModelImpl } from '../../base/base.model.ts';
import { billingMpPlans } from '../../schemas/billing/billing_mp_plan.dbschema.ts';

/** Row type inferred from the billing_mp_plans table */
type BillingMpPlan = typeof billingMpPlans.$inferSelect;

/**
 * Model for the MercadoPago plan registry (HOS-191).
 * Extends BaseModel to provide CRUD operations over `billing_mp_plans`, the link
 * between a Hospeda commercial plan variant and its MercadoPago `preapproval_plan`.
 */
export class BillingMpPlanModel extends BaseModelImpl<BillingMpPlan> {
    protected table = billingMpPlans;
    public entityName = 'billing_mp_plans';

    protected getTableName(): string {
        return 'billing_mp_plans';
    }
}

/** Singleton instance of BillingMpPlanModel for use across the application. */
export const billingMpPlanModel = new BillingMpPlanModel();
