import { BaseModelImpl } from '../../base/base.model.ts';
import { entitySubscriptions } from '../../schemas/billing/entity_subscription.dbschema.ts';

/**
 * `EntitySubscriptionModel` — DB access for `entity_subscriptions`, the single
 * subscription-status cache shared by accommodation, gastronomy and experience
 * (HOS-1084; formerly `CommerceListingSubscriptionModel`).
 *
 * Standard CRUD via {@link BaseModelImpl}. The hot paths (the reconciler's
 * write-through and the public read's batched lookup) use explicit Drizzle
 * queries against {@link entitySubscriptions} rather than this model, because
 * they are set-shaped (upsert-many / select-by-id-list), not row-shaped.
 */
export class EntitySubscriptionModel extends BaseModelImpl<
    typeof entitySubscriptions.$inferSelect
> {
    protected table = entitySubscriptions;
    public entityName = 'entitySubscriptions';

    protected getTableName(): string {
        return 'entitySubscriptions';
    }
}

/** Singleton instance of {@link EntitySubscriptionModel}. */
export const entitySubscriptionModel = new EntitySubscriptionModel();
