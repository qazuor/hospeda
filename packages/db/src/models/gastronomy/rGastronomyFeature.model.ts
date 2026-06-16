import { BaseModelImpl } from '../../base/base.model.ts';
import { rGastronomyFeature } from '../../schemas/gastronomy/r_gastronomy_feature.dbschema.ts';

/**
 * RGastronomyFeatureModel — DB access for gastronomy-feature junction (SPEC-239).
 * Mirrors RAccommodationFeatureModel: thin BaseModelImpl wrapper.
 */
export class RGastronomyFeatureModel extends BaseModelImpl<typeof rGastronomyFeature.$inferSelect> {
    protected table = rGastronomyFeature;
    public entityName = 'rGastronomyFeature';

    protected override readonly validRelationKeys = ['gastronomy', 'feature'] as const;

    protected getTableName(): string {
        return 'rGastronomyFeatures';
    }
}

/** Singleton instance of RGastronomyFeatureModel for use across the application. */
export const rGastronomyFeatureModel = new RGastronomyFeatureModel();
