import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPostFooters } from '../../schemas/social/social_post_footers.dbschema.ts';

/** Row type inferred from the social_post_footers table */
type SelectSocialPostFooter = typeof socialPostFooters.$inferSelect;

/**
 * Model for the `social_post_footers` table.
 * Reusable footer templates appended to posts.
 * Supports soft-delete via `deletedAt`.
 */
export class SocialPostFooterModel extends BaseModelImpl<SelectSocialPostFooter> {
    protected table = socialPostFooters;
    public entityName = 'social_post_footers';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'posts'
    ] as const;

    protected getTableName(): string {
        return 'socialPostFooters';
    }
}

/** Singleton instance of SocialPostFooterModel for use across the application. */
export const socialPostFooterModel = new SocialPostFooterModel();
