/**
 * GET /api/v1/admin/email-previews/render (HOS-2519 §6.3).
 *
 * @module routes/email-preview/admin/render
 */

import {
    EmailPreviewRenderQuerySchema,
    EmailPreviewRenderResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { getEmailPreviewService } from '../../../services/email-preview/email-preview.service.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * GET /api/v1/admin/email-previews/render?key=…&scenarioId=… — renders one
 * scenario of one catalog entry through the production pipeline. Never sends,
 * never writes.
 *
 * Responses (error-contract order):
 *   200 - `{ key, scenarioId, subject, subjectPrefix, html, text, warnings }`.
 *   401 - unauthenticated.
 *   403 - without admin access or without `NOTIFICATION_TEMPLATE_PREVIEW`.
 *   400 - `VALIDATION_ERROR` for a missing or oversized `key` / `scenarioId`.
 *   404 - `NOT_FOUND` for an unknown key, or a known key with an unknown scenario.
 *   500 - `INTERNAL_ERROR` when the sample fails to render; the body never
 *         echoes the cause, which is logged with the key and scenario id.
 */
export const adminRenderEmailPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/render',
    summary: 'Render one email template scenario',
    description:
        'Renders the subject, HTML body and text body of one sample scenario of one catalog entry, exactly as the production path builds them, plus the subject prefix the inbox would show. Read-only.',
    tags: ['Email previews'],
    requiredPermissions: [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW],
    requestQuery: EmailPreviewRenderQuerySchema.shape,
    responseSchema: EmailPreviewRenderResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const { key, scenarioId } = EmailPreviewRenderQuerySchema.parse(query ?? {});
        return getEmailPreviewService().render({ key, scenarioId });
    }
});
