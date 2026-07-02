import type { PriceAlert } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { touristPriceAlerts } from '../../schemas/alert/tourist_price_alerts.dbschema.ts';

/**
 * Model for managing tourist price-alert subscriptions in the database
 * (SPEC-286 G-1). Extends BaseModel to provide standard CRUD/soft-delete
 * operations for the `tourist_price_alerts` entity.
 *
 * Kept minimal by design (YAGNI) — service-layer finders (duplicate-check,
 * active-count, digest evaluation queries) are added in later SPEC-286 tasks
 * (T-004+), not here.
 */
export class TouristPriceAlertModel extends BaseModelImpl<PriceAlert> {
    protected table = touristPriceAlerts;
    public entityName = 'touristPriceAlerts';

    protected override readonly validRelationKeys = ['user', 'accommodation'] as const;

    protected getTableName(): string {
        return 'touristPriceAlerts';
    }
}

/** Singleton instance of TouristPriceAlertModel for use across the application. */
export const touristPriceAlertModel = new TouristPriceAlertModel();
