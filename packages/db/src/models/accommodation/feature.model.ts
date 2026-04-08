import type { Feature } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { features } from '../../schemas/accommodation/feature.dbschema.ts';

export class FeatureModel extends BaseModelImpl<Feature> {
    protected table = features;
    protected entityName = 'features';

    protected getTableName(): string {
        return 'features';
    }
}
