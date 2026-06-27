import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPostMedia } from '../../schemas/social/social_post_media.dbschema.ts';

/** Row type inferred from the social_post_media table */
type SelectSocialPostMedia = typeof socialPostMedia.$inferSelect;

/**
 * Model for the `social_post_media` table.
 * Join table linking social posts to their Cloudinary-hosted assets.
 * No soft-delete on this table (by schema design).
 */
export class SocialPostMediaModel extends BaseModelImpl<SelectSocialPostMedia> {
    protected table = socialPostMedia;
    public entityName = 'social_post_media';

    protected override readonly validRelationKeys = ['post', 'asset'] as const;

    protected getTableName(): string {
        return 'socialPostMedia';
    }
}

/** Singleton instance of SocialPostMediaModel for use across the application. */
export const socialPostMediaModel = new SocialPostMediaModel();
