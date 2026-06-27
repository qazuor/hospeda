import type { ExperienceAmenityRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rExperienceAmenity } from '../../schemas/experience/r_experience_amenity.dbschema.ts';

/**
 * RExperienceAmenityModel — DB access for experience-amenity junction (SPEC-240).
 * Mirrors RGastronomyAmenityModel: thin BaseModelImpl wrapper.
 */
export class RExperienceAmenityModel extends BaseModelImpl<ExperienceAmenityRelation> {
    protected table = rExperienceAmenity;
    public entityName = 'rExperienceAmenity';

    protected override readonly validRelationKeys = ['experience', 'amenity'] as const;

    protected getTableName(): string {
        return 'rExperienceAmenities';
    }
}

/** Singleton instance of RExperienceAmenityModel for use across the application. */
export const rExperienceAmenityModel = new RExperienceAmenityModel();
