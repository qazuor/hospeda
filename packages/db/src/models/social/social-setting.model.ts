import { BaseModelImpl } from '../../base/base.model.ts';
import { socialSettings } from '../../schemas/social/social_settings.dbschema.ts';

/** Row type inferred from the social_settings table */
type SelectSocialSetting = typeof socialSettings.$inferSelect;

/**
 * Model for the `social_settings` table.
 * Key-value configuration store for the social automation pipeline.
 * No soft-delete and no audit FKs on this table (by schema design).
 * No relations defined on this table.
 */
export class SocialSettingModel extends BaseModelImpl<SelectSocialSetting> {
    protected table = socialSettings;
    public entityName = 'social_settings';

    protected getTableName(): string {
        return 'socialSettings';
    }
}

/** Singleton instance of SocialSettingModel for use across the application. */
export const socialSettingModel = new SocialSettingModel();
