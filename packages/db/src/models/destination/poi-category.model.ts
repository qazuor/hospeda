import type { PoiCategory } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { poiCategories } from '../../schemas/destination/poi-category.dbschema.ts';

/**
 * Model for the `poi_categories` table (HOS-139). Editable, admin-owned
 * taxonomy catalog for `points_of_interest`, replacing the single closed
 * `type` enum (HOS-113). Unlike `points_of_interest` (no `name` column,
 * i18n-by-slug), rows here carry their own `nameI18n` content directly,
 * mirroring `destinations.nameI18n` (spec §6.1) — standard `BaseModelImpl`
 * CRUD is sufficient, no custom query methods are needed at this layer.
 */
export class PoiCategoryModel extends BaseModelImpl<PoiCategory> {
    protected table = poiCategories;
    public entityName = 'poiCategories';

    protected getTableName(): string {
        return 'poiCategories';
    }
}

/** Singleton instance of PoiCategoryModel for use across the application. */
export const poiCategoryModel = new PoiCategoryModel();
