import { BaseModelImpl } from '../../base/base.model.ts';
import { socialAudiences } from '../../schemas/social/social_audiences.dbschema.ts';

/** Row type inferred from the social_audiences table */
type SelectSocialAudience = typeof socialAudiences.$inferSelect;

/**
 * Model for the `social_audiences` table.
 * Named target audience descriptors (e.g. "Turistas", "Familias con niños").
 * Supports soft-delete via `deletedAt`.
 */
export class SocialAudienceModel extends BaseModelImpl<SelectSocialAudience> {
    protected table = socialAudiences;
    public entityName = 'social_audiences';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'hashtags',
        'posts'
    ] as const;

    protected getTableName(): string {
        return 'socialAudiences';
    }
}

/** Singleton instance of SocialAudienceModel for use across the application. */
export const socialAudienceModel = new SocialAudienceModel();
