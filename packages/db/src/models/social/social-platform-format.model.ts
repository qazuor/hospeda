import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPlatformFormats } from '../../schemas/social/social_platform_formats.dbschema.ts';

/** Row type inferred from the social_platform_formats table */
type SelectSocialPlatformFormat = typeof socialPlatformFormats.$inferSelect;

/**
 * Model for the `social_platform_formats` table.
 * Per platform × format configuration rows (e.g. INSTAGRAM × FEED_POST).
 * Supports soft-delete via `deletedAt`.
 */
export class SocialPlatformFormatModel extends BaseModelImpl<SelectSocialPlatformFormat> {
    protected table = socialPlatformFormats;
    public entityName = 'social_platform_formats';

    protected override readonly validRelationKeys = [
        'createdBy',
        'updatedBy',
        'deletedBy',
        'targets'
    ] as const;

    protected getTableName(): string {
        return 'socialPlatformFormats';
    }
}

/** Singleton instance of SocialPlatformFormatModel for use across the application. */
export const socialPlatformFormatModel = new SocialPlatformFormatModel();
