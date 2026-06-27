import type { ExperienceFeatureRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rExperienceFeature } from '../../schemas/experience/r_experience_feature.dbschema.ts';

/**
 * RExperienceFeatureModel — DB access for experience-feature junction (SPEC-240).
 * Mirrors RGastronomyFeatureModel: thin BaseModelImpl wrapper.
 */
export class RExperienceFeatureModel extends BaseModelImpl<ExperienceFeatureRelation> {
    protected table = rExperienceFeature;
    public entityName = 'rExperienceFeature';

    protected override readonly validRelationKeys = ['experience', 'feature'] as const;

    protected getTableName(): string {
        return 'rExperienceFeatures';
    }
}

/** Singleton instance of RExperienceFeatureModel for use across the application. */
export const rExperienceFeatureModel = new RExperienceFeatureModel();
