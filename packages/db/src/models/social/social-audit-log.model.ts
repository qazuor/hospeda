import { BaseModelImpl } from '../../base/base.model.ts';
import { socialAuditLog } from '../../schemas/social/social_audit_log.dbschema.ts';

/** Row type inferred from the social_audit_log table */
type SelectSocialAuditLog = typeof socialAuditLog.$inferSelect;

/**
 * Model for the append-only `social_audit_log` table.
 * Permanent compliance record for all state transitions and admin actions
 * across the social automation pipeline.
 *
 * This table has NO soft-delete columns, NO audit FKs, and NO FK on
 * `actorId` by design — rows must survive user deletion.
 * `softDelete` and `restore` will throw at runtime (base class guards
 * on `deletedAt` presence). No relations are defined on this table.
 */
export class SocialAuditLogModel extends BaseModelImpl<SelectSocialAuditLog> {
    protected table = socialAuditLog;
    public entityName = 'social_audit_log';

    protected getTableName(): string {
        return 'socialAuditLog';
    }
}

/** Singleton instance of SocialAuditLogModel for use across the application. */
export const socialAuditLogModel = new SocialAuditLogModel();
