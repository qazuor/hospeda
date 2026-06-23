import { BaseModelImpl } from '../../base/base.model.ts';
import { socialPublishLogs } from '../../schemas/social/social_publish_logs.dbschema.ts';

/** Row type inferred from the social_publish_logs table */
type SelectSocialPublishLog = typeof socialPublishLogs.$inferSelect;

/**
 * Model for the append-only `social_publish_logs` table.
 * Permanent operational log for every dispatch attempt and Make.com callback.
 *
 * This table has NO soft-delete columns and NO audit FKs by design —
 * rows are never deleted by application code. `softDelete` and `restore`
 * will throw at runtime (base class guards on `deletedAt` presence).
 */
export class SocialPublishLogModel extends BaseModelImpl<SelectSocialPublishLog> {
    protected table = socialPublishLogs;
    public entityName = 'social_publish_logs';

    protected override readonly validRelationKeys = ['post', 'target'] as const;

    protected getTableName(): string {
        return 'socialPublishLogs';
    }
}

/** Singleton instance of SocialPublishLogModel for use across the application. */
export const socialPublishLogModel = new SocialPublishLogModel();
