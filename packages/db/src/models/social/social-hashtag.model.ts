import { BaseModelImpl } from '../../base/base.model.ts';
import { socialHashtags } from '../../schemas/social/social_hashtags.dbschema.ts';

/** Row type inferred from the social_hashtags table */
type SelectSocialHashtag = typeof socialHashtags.$inferSelect;

/**
 * Model for the `social_hashtags` table.
 * Individual normalized hashtag catalog entries.
 * Supports soft-delete via `deletedAt`.
 */
export class SocialHashtagModel extends BaseModelImpl<SelectSocialHashtag> {
    protected table = socialHashtags;
    public entityName = 'social_hashtags';

    protected override readonly validRelationKeys = [
        'audience',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'postHashtags'
    ] as const;

    protected getTableName(): string {
        return 'socialHashtags';
    }
}

/** Singleton instance of SocialHashtagModel for use across the application. */
export const socialHashtagModel = new SocialHashtagModel();
