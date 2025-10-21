import type { Feature } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { features } from '../../schemas/accommodation/feature.dbschema';

export class FeatureModel extends BaseModel<Feature> {
    protected table = features;
    protected entityName = 'features';

    protected getTableName(): string {
        return 'features';
    }
}
