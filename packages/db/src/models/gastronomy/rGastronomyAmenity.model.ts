import type { GastronomyAmenityRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rGastronomyAmenity } from '../../schemas/gastronomy/r_gastronomy_amenity.dbschema.ts';

/**
 * RGastronomyAmenityModel — DB access for gastronomy-amenity junction (SPEC-239).
 * Mirrors RAccommodationAmenityModel: thin BaseModelImpl wrapper.
 */
export class RGastronomyAmenityModel extends BaseModelImpl<GastronomyAmenityRelation> {
    protected table = rGastronomyAmenity;
    public entityName = 'rGastronomyAmenity';

    protected override readonly validRelationKeys = ['gastronomy', 'amenity'] as const;

    protected getTableName(): string {
        return 'rGastronomyAmenities';
    }
}

/** Singleton instance of RGastronomyAmenityModel for use across the application. */
export const rGastronomyAmenityModel = new RGastronomyAmenityModel();
