import { BaseModel } from '../base/base.model';
import type { Notification } from '../schemas/notification/notification.dbschema';
import { notifications } from '../schemas/notification/notification.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Notification Model
 *
 * Manages system notifications with polymorphic recipients, multi-channel delivery,
 * scheduling capabilities, and retry logic.
 *
 * Features:
 * - Polymorphic recipients (USER | CLIENT)
 * - Multi-channel delivery (email, SMS, push, in-app)
 * - Scheduled notifications
 * - Retry logic with exponential backoff
 * - Read/unread tracking
 * - Archiving support
 *
 * @extends BaseModel<Notification>
 */
export class NotificationModel extends BaseModel<Notification> {
    protected table = notifications;
    protected entityName = 'notification';

    protected getTableName(): string {
        return 'notifications';
    }

    /**
     * Find all notifications for a specific recipient
     *
     * @param recipientType - The type of recipient (USER | CLIENT)
     * @param recipientId - The recipient ID
     * @returns Array of notifications
     *
     * @example
     * ```ts
     * const userNotifications = await model.findByRecipient('USER', 'user-123');
     * ```
     */
    async findByRecipient(recipientType: string, recipientId: string): Promise<Notification[]> {
        try {
            const result = await this.findAll({ recipientType, recipientId });
            logQuery(
                this.entityName,
                'findByRecipient',
                { recipientType, recipientId },
                result.items
            );
            return result.items;
        } catch (error) {
            logError(
                this.entityName,
                'findByRecipient',
                { recipientType, recipientId },
                error as Error
            );
            throw error;
        }
    }

    /**
     * Find all notifications by type
     *
     * @param type - The notification type to filter by
     * @returns Array of notifications
     *
     * @example
     * ```ts
     * const bookingNotifications = await model.findByType('BOOKING');
     * ```
     */
    async findByType(type: string): Promise<Notification[]> {
        try {
            const result = await this.findAll({ type });
            logQuery(this.entityName, 'findByType', { type }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByType', { type }, error as Error);
            throw error;
        }
    }

    /**
     * Find all notifications by status
     *
     * @param status - The notification status to filter by
     * @returns Array of notifications
     *
     * @example
     * ```ts
     * const sentNotifications = await model.findByStatus('SENT');
     * ```
     */
    async findByStatus(status: string): Promise<Notification[]> {
        try {
            const result = await this.findAll({ status });
            logQuery(this.entityName, 'findByStatus', { status }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByStatus', { status }, error as Error);
            throw error;
        }
    }

    /**
     * Find all unread notifications for a recipient
     *
     * @param recipientId - The recipient ID
     * @returns Array of unread notifications
     *
     * @example
     * ```ts
     * const unread = await model.findUnread('user-123');
     * ```
     */
    async findUnread(recipientId: string): Promise<Notification[]> {
        try {
            const result = await this.findAll({
                recipientId,
                isRead: false
            });
            logQuery(this.entityName, 'findUnread', { recipientId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findUnread', { recipientId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all scheduled notifications
     *
     * @returns Array of scheduled notifications
     *
     * @example
     * ```ts
     * const scheduled = await model.findScheduled();
     * ```
     */
    async findScheduled(): Promise<Notification[]> {
        try {
            const result = await this.findAll({ status: 'PENDING' });
            logQuery(this.entityName, 'findScheduled', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findScheduled', {}, error as Error);
            throw error;
        }
    }

    /**
     * Find all notifications pending retry
     *
     * @returns Array of notifications pending retry
     *
     * @example
     * ```ts
     * const pendingRetry = await model.findPendingRetry();
     * ```
     */
    async findPendingRetry(): Promise<Notification[]> {
        try {
            const result = await this.findAll({ status: 'FAILED' });
            logQuery(this.entityName, 'findPendingRetry', {}, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findPendingRetry', {}, error as Error);
            throw error;
        }
    }

    /**
     * Mark a notification as read
     *
     * @param notificationId - The notification ID to mark as read
     * @returns Updated notification
     *
     * @example
     * ```ts
     * const read = await model.markAsRead('notification-123');
     * ```
     */
    async markAsRead(notificationId: string): Promise<Notification> {
        try {
            const result = await this.update({ id: notificationId }, {
                isRead: true,
                readAt: new Date()
            } as Partial<Notification>);

            if (!result) {
                throw new Error(`Notification not found: ${notificationId}`);
            }

            logQuery(this.entityName, 'markAsRead', { notificationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'markAsRead', { notificationId }, error as Error);
            throw error;
        }
    }

    /**
     * Mark a notification as delivered
     *
     * @param notificationId - The notification ID to mark as delivered
     * @returns Updated notification
     *
     * @example
     * ```ts
     * const delivered = await model.markAsDelivered('notification-123');
     * ```
     */
    async markAsDelivered(notificationId: string): Promise<Notification> {
        try {
            const result = await this.update({ id: notificationId }, {
                status: 'SENT',
                deliveredAt: new Date()
            } as Partial<Notification>);

            if (!result) {
                throw new Error(`Notification not found: ${notificationId}`);
            }

            logQuery(this.entityName, 'markAsDelivered', { notificationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'markAsDelivered', { notificationId }, error as Error);
            throw error;
        }
    }

    /**
     * Increment retry count for a notification
     *
     * @param notificationId - The notification ID to increment retry count
     * @returns Updated notification
     *
     * @example
     * ```ts
     * const retried = await model.incrementRetry('notification-123');
     * ```
     */
    async incrementRetry(notificationId: string): Promise<Notification> {
        try {
            const notification = await this.findById(notificationId);

            if (!notification) {
                throw new Error(`Notification not found: ${notificationId}`);
            }

            const result = await this.update({ id: notificationId }, {
                retryCount: notification.retryCount + 1
            } as Partial<Notification>);

            if (!result) {
                throw new Error(`Failed to update notification: ${notificationId}`);
            }

            logQuery(this.entityName, 'incrementRetry', { notificationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'incrementRetry', { notificationId }, error as Error);
            throw error;
        }
    }

    /**
     * Archive a notification
     *
     * @param notificationId - The notification ID to archive
     * @returns Updated notification
     *
     * @example
     * ```ts
     * const archived = await model.archive('notification-123');
     * ```
     */
    async archive(notificationId: string): Promise<Notification> {
        try {
            const result = await this.update({ id: notificationId }, {
                isArchived: true
            } as Partial<Notification>);

            if (!result) {
                throw new Error(`Notification not found: ${notificationId}`);
            }

            logQuery(this.entityName, 'archive', { notificationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'archive', { notificationId }, error as Error);
            throw error;
        }
    }
}
