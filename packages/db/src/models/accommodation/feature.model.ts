import type { Feature } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { features } from '../../schemas/accommodation/feature.dbschema.ts';

export class FeatureModel extends BaseModelImpl<Feature> {
    protected table = features;
    /** Admin catalog: restore keeps an admin-set INACTIVE state (HOS-2366). */
    protected override readonly restoreKeepsLifecycleState = true;
    public entityName = 'features';

    protected getTableName(): string {
        return 'features';
    }
}

/** Singleton instance of FeatureModel for use across the application. */
export const featureModel = new FeatureModel();
