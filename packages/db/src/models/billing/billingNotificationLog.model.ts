import { BaseModelImpl } from '../../base/base.model.ts';
import { billingNotificationLog } from '../../schemas/billing/billing_notification_log.dbschema.ts';

/** Row type inferred from the billing_notification_log table */
type BillingNotificationLogRow = typeof billingNotificationLog.$inferSelect;

/**
 * Model for managing billing notification logs in the database.
 * Extends BaseModel to provide CRUD operations for notification log entities.
 * Tracks all billing-related notifications sent to customers.
 */
export class BillingNotificationLogModel extends BaseModelImpl<BillingNotificationLogRow> {
    protected table = billingNotificationLog;
    public entityName = 'billing_notification_log';

    protected getTableName(): string {
        return 'billing_notification_log';
    }
}

/** Singleton instance of BillingNotificationLogModel for use across the application. */
export const billingNotificationLogModel = new BillingNotificationLogModel();
