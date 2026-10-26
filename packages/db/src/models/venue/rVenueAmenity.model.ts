import type { VenueAmenityRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rGastronomyAmenity } from '../../schemas/venue/r_venue_amenity.dbschema.ts';

/**
 * RVenueAmenityModel — DB access for gastronomy-amenity junction (SPEC-239).
 * Mirrors RAccommodationAmenityModel: thin BaseModelImpl wrapper.
 */
export class RVenueAmenityModel extends BaseModelImpl<VenueAmenityRelation> {
    protected table = rGastronomyAmenity;
    public entityName = 'rGastronomyAmenity';

    protected override readonly validRelationKeys = ['gastronomy', 'amenity'] as const;

    protected getTableName(): string {
        return 'rGastronomyAmenity';
    }
}

/** Singleton instance of RVenueAmenityModel for use across the application. */
export const rVenueAmenityModel = new RVenueAmenityModel();
