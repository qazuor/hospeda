import type { FeatureType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { features } from '../../schemas/accommodation/feature.dbschema';

export class FeatureModel extends BaseModel<FeatureType> {
    protected table = features;
    protected entityName = 'features';
}
