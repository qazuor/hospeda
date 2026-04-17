import { BaseModelImpl } from '../../base/base.model.ts';
import { billingSubscriptionEvents } from '../../schemas/billing/billing_subscription_event.dbschema.ts';

/** Row type inferred from the billing_subscription_events table */
type BillingSubscriptionEvent = typeof billingSubscriptionEvents.$inferSelect;

/**
 * Model for managing billing subscription events in the database.
 * Extends BaseModel to provide CRUD operations for subscription event entities.
 *
 * Supports two kinds of rows:
 * - State-transition events: previousStatus + newStatus are set, eventType is null.
 * - Operational events: eventType is set (e.g. 'ADDON_RECALC_COMPLETED'),
 *   previousStatus and newStatus may be null.
 */
export class BillingSubscriptionEventModel extends BaseModelImpl<BillingSubscriptionEvent> {
    protected table = billingSubscriptionEvents;
    public entityName = 'billing_subscription_events';

    protected getTableName(): string {
        return 'billing_subscription_events';
    }
}

/** Singleton instance of BillingSubscriptionEventModel for use across the application. */
export const billingSubscriptionEventModel = new BillingSubscriptionEventModel();
