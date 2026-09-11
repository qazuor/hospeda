import { BaseModelImpl } from '../../base/base.model.ts';
import { billingMpAddonPlans } from '../../schemas/billing/billing_mp_addon_plan.dbschema.ts';

/** Row type inferred from the billing_mp_addon_plans table */
type BillingMpAddonPlan = typeof billingMpAddonPlans.$inferSelect;

/**
 * Model for the MercadoPago ADD-ON plan registry (HOS-847).
 *
 * Sibling of {@link BillingMpPlanModel}: it maps a recurring add-on variant
 * `(addon_id, billing_interval)` to the MercadoPago `preapproval_plan` its
 * checkout subscribes against. Deliberately a separate table from
 * `billing_mp_plans`, whose `commercial_plan_id` is `NOT NULL` with a FK to
 * `billing_plans` — an add-on is not a commercial plan.
 *
 * Unlike the commercial registry there is no `trial_days` dimension: add-on
 * plans are always provisioned with `trialDays: 0`, so the variant key is just
 * `(addon_id, billing_interval)`.
 */
export class BillingMpAddonPlanModel extends BaseModelImpl<BillingMpAddonPlan> {
    protected table = billingMpAddonPlans;
    public entityName = 'billing_mp_addon_plans';

    protected getTableName(): string {
        return 'billingMpAddonPlans';
    }
}

/** Singleton instance of BillingMpAddonPlanModel for use across the application. */
export const billingMpAddonPlanModel = new BillingMpAddonPlanModel();
