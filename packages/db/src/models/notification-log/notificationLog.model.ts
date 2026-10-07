import { BaseModelImpl } from '../../base/base.model.ts';
import { notificationLog } from '../../schemas/notification-log/notification_log.dbschema.ts';

/** Row type inferred from the notification_log table */
type NotificationLogRow = typeof notificationLog.$inferSelect;

/**
 * Model for managing notification logs in the database.
 * Extends BaseModel to provide CRUD operations for notification log entities.
 * Tracks the notifications the platform sends.
 */
export class NotificationLogModel extends BaseModelImpl<NotificationLogRow> {
    protected table = notificationLog;
    public entityName = 'notification_log';

    protected getTableName(): string {
        return 'notificationLog';
    }
}

/** Singleton instance of NotificationLogModel for use across the application. */
export const notificationLogModel = new NotificationLogModel();
