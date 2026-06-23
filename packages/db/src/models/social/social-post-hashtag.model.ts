import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPostHashtags } from '../../schemas/social/social_post_hashtags.dbschema.ts';

/** Row type inferred from the social_post_hashtags table */
type SelectSocialPostHashtag = typeof socialPostHashtags.$inferSelect;

/**
 * Model for the `social_post_hashtags` table.
 * Join table linking social posts to individual hashtag catalog entries.
 * No soft-delete on this table (by schema design).
 */
export class SocialPostHashtagModel extends BaseModelImpl<SelectSocialPostHashtag> {
    protected table = socialPostHashtags;
    public entityName = 'social_post_hashtags';

    protected override readonly validRelationKeys = ['post', 'hashtag'] as const;

    protected getTableName(): string {
        return 'socialPostHashtags';
    }
}

/** Singleton instance of SocialPostHashtagModel for use across the application. */
export const socialPostHashtagModel = new SocialPostHashtagModel();
