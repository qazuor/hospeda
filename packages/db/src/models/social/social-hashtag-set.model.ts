import { BaseModelImpl } from '../../base/base.model.ts';
import { socialHashtagSets } from '../../schemas/social/social_hashtag_sets.dbschema.ts';

/** Row type inferred from the social_hashtag_sets table */
type SelectSocialHashtagSet = typeof socialHashtagSets.$inferSelect;

/**
 * Model for the `social_hashtag_sets` table.
 * Named collections of hashtags used as base sets for posts.
 * Supports soft-delete via `deletedAt`.
 */
export class SocialHashtagSetModel extends BaseModelImpl<SelectSocialHashtagSet> {
    protected table = socialHashtagSets;
    public entityName = 'social_hashtag_sets';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'posts'
    ] as const;

    protected getTableName(): string {
        return 'socialHashtagSets';
    }
}

/** Singleton instance of SocialHashtagSetModel for use across the application. */
export const socialHashtagSetModel = new SocialHashtagSetModel();
