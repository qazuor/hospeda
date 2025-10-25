/**
 * Notification Schema Exports
 *
 * This module exports all notification-related schemas for the platform.
 * Includes main notification schema, CRUD operations, queries, HTTP coercion,
 * and relationship schemas with comprehensive validation and type safety.
 */

// Main notification schema
export {
    NotificationSchema,
    type Notification
} from './notification.schema.js';

// CRUD operation schemas
export {
    CreateNotificationSchema,
    UpdateNotificationSchema,
    type CreateNotification,
    type UpdateNotification
} from './notification.crud.schema.js';

// Query and search schemas
export {
    BulkNotificationOperationSchema,
    NotificationAnalyticsSchema,
    SearchNotificationsSchema,
    type BulkNotificationOperation,
    type NotificationAnalytics,
    type SearchNotifications
} from './notification.query.schema.js';

// HTTP coercion schemas
export {
    HttpBulkNotificationOperationSchema,
    HttpCreateNotificationSchema,
    HttpListNotificationsSchema,
    HttpNotificationAnalyticsSchema,
    HttpUpdateNotificationSchema,
    type HttpBulkNotificationOperation,
    type HttpCreateNotification,
    type HttpListNotifications,
    type HttpNotificationAnalytics,
    type HttpUpdateNotification
} from './notification.http.schema.js';

// Relationship schemas
export {
    BulkNotificationResultSchema,
    NotificationWithAccommodationSchema,
    NotificationWithAllRelationsSchema,
    NotificationWithDeliveryStatusSchema,
    NotificationWithPreferencesSchema,
    NotificationWithUserSchema,
    type BulkNotificationResult,
    type NotificationWithAccommodation,
    type NotificationWithAllRelations,
    type NotificationWithDeliveryStatus,
    type NotificationWithPreferences,
    type NotificationWithUser
} from './notification.relations.schema.js';
