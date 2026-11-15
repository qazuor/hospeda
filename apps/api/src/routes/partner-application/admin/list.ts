import {
    AdminPartnerApplicationPanelItemSchema,
    AdminPartnerApplicationPanelQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { listPartnerApplicationPanel } from '../../../services/partner-application/partner-application-panel.service';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createAdminListRoute } from '../../../utils/route-factory';

/** GET /api/v1/admin/partner-applications — read the panel for AC:V8b:2 and PLAZO:8. */
export const adminListPartnerApplicationPanelRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List Partner applications for the admin panel (AC:V8b:2)',
    description:
        'Reads Partner applications by panel view, marking pending applications overdue using PLAZO:8.',
    requiredPermissions: [PermissionEnum.PARTNER_RESOLVE_APPLICATION],
    requestQuery: AdminPartnerApplicationPanelQuerySchema.shape,
    responseSchema: AdminPartnerApplicationPanelItemSchema,
    tags: ['Partner applications', 'Admin'],
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        rawQuery?: Record<string, unknown>
    ) => {
        const query = AdminPartnerApplicationPanelQuerySchema.parse(rawQuery ?? {});
        const now = getClock().clock.now();
        const result = await listPartnerApplicationPanel({ query, now });
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: getActorFromContext(ctx).id,
            resourceType: 'partner_application',
            resourceId: query.view,
            metadata: { subjectId: null }
        });
        return { items: result.items, pagination: result.pagination };
    }
});
