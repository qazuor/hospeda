import type { VenueMenuItem } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venueMenuItems } from '../../schemas/venue/venue_menu_item.dbschema.ts';

/**
 * VenueMenuItemModel — DB access for the dishes on a venue's menu
 * (HOS-895).
 *
 * Thin `BaseModelImpl` wrapper. See `VenueMenuSectionModel` for why there
 * is no soft delete on this pair of tables.
 */
export class VenueMenuItemModel extends BaseModelImpl<VenueMenuItem> {
    protected table = venueMenuItems;
    public entityName = 'venueMenuItems';

    protected getTableName(): string {
        return 'venueMenuItems';
    }
}

/** Singleton instance of VenueMenuItemModel. */
export const venueMenuItemModel = new VenueMenuItemModel();
