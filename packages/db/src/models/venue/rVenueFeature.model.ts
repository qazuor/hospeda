import type { VenueFeatureRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rGastronomyFeature } from '../../schemas/venue/r_venue_feature.dbschema.ts';

/**
 * RVenueFeatureModel — DB access for gastronomy-feature junction (SPEC-239).
 * Mirrors RAccommodationFeatureModel: thin BaseModelImpl wrapper.
 */
export class RVenueFeatureModel extends BaseModelImpl<VenueFeatureRelation> {
    protected table = rGastronomyFeature;
    public entityName = 'rGastronomyFeature';

    protected override readonly validRelationKeys = ['gastronomy', 'feature'] as const;

    protected getTableName(): string {
        return 'rGastronomyFeature';
    }
}

/** Singleton instance of RVenueFeatureModel for use across the application. */
export const rVenueFeatureModel = new RVenueFeatureModel();
