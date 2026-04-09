import { BaseModelImpl } from '../../base/base.model.ts';
import { billingDunningAttempts } from '../../schemas/billing/billing_dunning_attempt.dbschema.ts';

/** Row type inferred from the billing_dunning_attempts table */
type BillingDunningAttempt = typeof billingDunningAttempts.$inferSelect;

/**
 * Model for managing billing dunning attempts in the database.
 * Extends BaseModel to provide CRUD operations for dunning attempt entities.
 * Tracks individual payment retry attempts for past-due subscriptions.
 */
export class BillingDunningAttemptModel extends BaseModelImpl<BillingDunningAttempt> {
    protected table = billingDunningAttempts;
    public entityName = 'billing_dunning_attempts';

    protected getTableName(): string {
        return 'billing_dunning_attempts';
    }
}

/** Singleton instance of BillingDunningAttemptModel for use across the application. */
export const billingDunningAttemptModel = new BillingDunningAttemptModel();
