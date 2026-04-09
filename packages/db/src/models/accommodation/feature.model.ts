import type { Feature } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { features } from '../../schemas/accommodation/feature.dbschema.ts';

export class FeatureModel extends BaseModelImpl<Feature> {
    protected table = features;
    public entityName = 'features';

    protected getTableName(): string {
        return 'features';
    }
}

/** Singleton instance of FeatureModel for use across the application. */
export const featureModel = new FeatureModel();
