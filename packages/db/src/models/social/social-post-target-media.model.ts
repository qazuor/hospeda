import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPostTargetMedia } from '../../schemas/social/social_post_target_media.dbschema.ts';

/** Row type inferred from the social_post_target_media table */
type SelectSocialPostTargetMedia = typeof socialPostTargetMedia.$inferSelect;

/**
 * Model for the `social_post_target_media` table.
 * Join table linking a social post target (one platform dispatch) to the
 * subset of the post's media pool (`social_post_media`) that target should
 * publish, with its own per-target display order (HOS-65 G-3).
 * No soft-delete on this table (by schema design).
 */
export class SocialPostTargetMediaModel extends BaseModelImpl<SelectSocialPostTargetMedia> {
    protected table = socialPostTargetMedia;
    public entityName = 'social_post_target_media';

    protected override readonly validRelationKeys = ['target', 'media'] as const;

    protected getTableName(): string {
        return 'socialPostTargetMedia';
    }
}

/** Singleton instance of SocialPostTargetMediaModel for use across the application. */
export const socialPostTargetMediaModel = new SocialPostTargetMediaModel();
