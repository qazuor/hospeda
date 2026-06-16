import { BaseModelImpl } from '../../base/base.model.ts';
import { commerceListingSubscriptions } from '../../schemas/commerce/commerce_listing_subscription.dbschema.ts';

/**
 * CommerceListingSubscriptionModel — DB access for the commerce-subscription
 * link table (SPEC-239 T-022).
 *
 * Provides standard CRUD via BaseModelImpl. Custom query methods for
 * "find active subscription by entity" should be added here as the billing
 * integration is wired.
 */
export class CommerceListingSubscriptionModel extends BaseModelImpl<
    typeof commerceListingSubscriptions.$inferSelect
> {
    protected table = commerceListingSubscriptions;
    public entityName = 'commerceListingSubscriptions';

    protected getTableName(): string {
        return 'commerceListingSubscriptions';
    }
}

/** Singleton instance of CommerceListingSubscriptionModel. */
export const commerceListingSubscriptionModel = new CommerceListingSubscriptionModel();
