/**
 * GET /api/v1/admin/email-previews (HOS-2519 §6.3).
 *
 * @module routes/email-preview/admin/list
 */

import { EmailPreviewListResponseSchema, PermissionEnum } from '@repo/schemas';
import { getEmailPreviewService } from '../../../services/email-preview/email-preview.service.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

/**
 * GET /api/v1/admin/email-previews — the whole email catalog summary, in
 * catalog order. Unpaginated on purpose: a static list of ~125 small rows
 * (`createAdminListRoute`'s `page`/`pageSize` contract does not fit a non-DB list).
 *
 * Responses:
 *   200 - `{ entries, total }`.
 *   401 - unauthenticated.
 *   403 - without admin access or without `NOTIFICATION_TEMPLATE_PREVIEW`.
 */
export const adminListEmailPreviewsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List the email template catalog',
    description:
        'Returns every email the platform can send (key, name, domain, send path, wired flag and sample scenarios), in catalog order. Read-only and unpaginated.',
    tags: ['Email previews'],
    requiredPermissions: [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW],
    responseSchema: EmailPreviewListResponseSchema,
    handler: async () => getEmailPreviewService().listEntries()
});
