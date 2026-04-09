import { BaseModelImpl } from '../../base/base.model.ts';
import { billingAddonPurchases } from '../../schemas/billing/billing_addon_purchase.dbschema.ts';

/** Row type inferred from the billing_addon_purchases table */
type BillingAddonPurchase = typeof billingAddonPurchases.$inferSelect;

/**
 * Model for managing billing add-on purchases in the database.
 * Extends BaseModel to provide CRUD operations for add-on purchase entities.
 */
export class BillingAddonPurchaseModel extends BaseModelImpl<BillingAddonPurchase> {
    protected table = billingAddonPurchases;
    public entityName = 'billing_addon_purchases';

    protected getTableName(): string {
        return 'billing_addon_purchases';
    }
}

/** Singleton instance of BillingAddonPurchaseModel for use across the application. */
export const billingAddonPurchaseModel = new BillingAddonPurchaseModel();
