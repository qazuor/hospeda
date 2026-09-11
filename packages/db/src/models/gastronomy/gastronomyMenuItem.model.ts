import type { GastronomyMenuItem } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyMenuItems } from '../../schemas/gastronomy/gastronomy_menu_item.dbschema.ts';

/**
 * GastronomyMenuItemModel — DB access for the dishes on a venue's menu
 * (HOS-895).
 *
 * Thin `BaseModelImpl` wrapper. See `GastronomyMenuSectionModel` for why there
 * is no soft delete on this pair of tables.
 */
export class GastronomyMenuItemModel extends BaseModelImpl<GastronomyMenuItem> {
    protected table = gastronomyMenuItems;
    public entityName = 'gastronomyMenuItems';

    protected getTableName(): string {
        return 'gastronomyMenuItems';
    }
}

/** Singleton instance of GastronomyMenuItemModel. */
export const gastronomyMenuItemModel = new GastronomyMenuItemModel();
