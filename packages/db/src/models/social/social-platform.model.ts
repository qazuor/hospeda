import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPlatforms } from '../../schemas/social/social_platforms.dbschema.ts';

/** Row type inferred from the social_platforms table */
type SelectSocialPlatform = typeof socialPlatforms.$inferSelect;

/**
 * Model for the `social_platforms` table.
 * One config row per platform (INSTAGRAM, FACEBOOK, X).
 * Supports soft-delete via `deletedAt`.
 */
export class SocialPlatformModel extends BaseModelImpl<SelectSocialPlatform> {
    protected table = socialPlatforms;
    public entityName = 'social_platforms';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'formats'
    ] as const;

    protected getTableName(): string {
        return 'socialPlatforms';
    }
}

/** Singleton instance of SocialPlatformModel for use across the application. */
export const socialPlatformModel = new SocialPlatformModel();
