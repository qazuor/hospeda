import type { PointOfInterestCategoryRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rPoiCategory } from '../../schemas/destination/r_poi_category.dbschema.ts';

/**
 * Model for the `r_poi_category` join table (HOS-139, M2M). A point of
 * interest may belong to several categories; exactly one row per POI may
 * have `isPrimary = true` (enforced at the DB level by a partial unique
 * index, spec §6.2, and at the service level for the "at least one once
 * non-empty" half — see `PointOfInterestCategoryService`). Mirrors
 * `RDestinationPointOfInterestModel` exactly.
 *
 * NOTE: this join table has no `deletedAt` column (like
 * `r_destination_point_of_interest`) — relation rows are removed via
 * `hardDelete`, never `softDelete`.
 */
export class RPoiCategoryModel extends BaseModelImpl<PointOfInterestCategoryRelation> {
    protected table = rPoiCategory;
    public entityName = 'rPoiCategory';

    protected getTableName(): string {
        return 'rPoiCategory';
    }
}

/** Singleton instance of RPoiCategoryModel for use across the application. */
export const rPoiCategoryModel = new RPoiCategoryModel();
