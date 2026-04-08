import { BaseModelImpl } from '../../base/base.model.ts';
import { billingSettings } from '../../schemas/billing/billing_settings.dbschema.ts';

/** Row type inferred from the billing_settings table */
type BillingSettingsRow = typeof billingSettings.$inferSelect;

/**
 * Model for managing billing settings in the database.
 * Extends BaseModel to provide CRUD operations for billing settings entities.
 * Key-value store for billing configuration (e.g. global settings).
 */
export class BillingSettingsModel extends BaseModelImpl<BillingSettingsRow> {
    protected table = billingSettings;
    protected entityName = 'billing_settings';

    protected getTableName(): string {
        return 'billing_settings';
    }
}
