/**
 * Admin Notification Log API Routes
 *
 * Provides admin endpoints to view notification logs.
 * These routes require admin permissions.
 *
 * Routes:
 * - GET /api/v1/admin/billing/notifications - List notification logs with filtering
 *
 * @module routes/billing/admin/notifications
 */

import { getDb } from '@repo/db';
import { billingNotificationLog } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { type SQL, and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
    ListNotificationLogsQuerySchema,
    NotificationLogsListResponseSchema
} from '../../../schemas';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Handler for listing notification logs
 * Extracted for testing purposes
 */
export const listNotificationLogsHandler = async (
    _c: unknown,
    _params: unknown,
    _body: unknown,
    query?: Record<string, unknown>
) => {
    // NotificationRetentionService in @repo/service-core handles only retention
    // policy (mark-expired + purge). No service provides paginated read access
    // to billing_notification_log for admin listing. This is a read-only admin
    // diagnostic endpoint with no write operations or business logic, so direct
    // DB access is appropriate here.
    const db = getDb();

    try {
        // Build filter conditions
        const conditions: SQL[] = [];

        if (query?.type) {
            conditions.push(eq(billingNotificationLog.type, query.type as string));
        }

        if (query?.status) {
            conditions.push(eq(billingNotificationLog.status, query.status as string));
        }

        if (query?.startDate) {
            const startDate = new Date(query.startDate as string);
            conditions.push(gte(billingNotificationLog.createdAt, startDate));
        }

        if (query?.endDate) {
            const endDate = new Date(query.endDate as string);
            conditions.push(lte(billingNotificationLog.createdAt, endDate));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const totalResult = await db
            .select({ total: count() })
            .from(billingNotificationLog)
            .where(whereClause);

        const total = totalResult[0]?.total ?? 0;

        // Get paginated results
        const results = await db
            .select({
                id: billingNotificationLog.id,
                customerId: billingNotificationLog.customerId,
                type: billingNotificationLog.type,
                channel: billingNotificationLog.channel,
                recipient: billingNotificationLog.recipient,
                subject: billingNotificationLog.subject,
                templateId: billingNotificationLog.templateId,
                status: billingNotificationLog.status,
                sentAt: billingNotificationLog.sentAt,
                errorMessage: billingNotificationLog.errorMessage,
                metadata: billingNotificationLog.metadata,
                createdAt: billingNotificationLog.createdAt
            })
            .from(billingNotificationLog)
            .where(whereClause)
            .orderBy(desc(billingNotificationLog.createdAt))
            .limit((query?.limit ?? 50) as number)
            .offset((query?.offset ?? 0) as number);

        apiLogger.debug(
            {
                total,
                returned: results.length,
                filters: { type: query?.type, status: query?.status }
            },
            'Admin retrieved notification logs via API'
        );

        return {
            data: results.map((row) => ({
                id: row.id,
                customerId: row.customerId,
                type: row.type,
                channel: row.channel,
                recipient: row.recipient,
                subject: row.subject,
                templateId: row.templateId,
                status: row.status,
                sentAt: row.sentAt ? row.sentAt.toISOString() : null,
                errorMessage: row.errorMessage,
                metadata: row.metadata,
                createdAt: row.createdAt.toISOString()
            })),
            total: Number(total),
            limit: query?.limit ?? 50,
            offset: query?.offset ?? 0
        };
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : 'Unknown error',
                filters: query
            },
            'Admin failed to retrieve notification logs via API'
        );

        throw new HTTPException(500, {
            message: 'Failed to retrieve notification logs'
        });
    }
};

/**
 * GET /api/v1/admin/billing/notifications
 * List notification logs with filtering (admin only)
 */
export const listNotificationLogsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List notification logs',
    description:
        'Returns paginated list of notification logs with optional filtering by type, status, and date range',
    tags: ['Billing', 'Notifications'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: ListNotificationLogsQuerySchema.shape,
    responseSchema: NotificationLogsListResponseSchema,
    handler: listNotificationLogsHandler
});
