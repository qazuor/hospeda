/**
 * Admin social audit log router — SPEC-254 T-037.
 * Mounted at /api/v1/admin/social/audit-log.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminListSocialAuditLogRoute } from './list';

const app = createRouter();

app.route('/', adminListSocialAuditLogRoute);

export { app as adminSocialAuditLogRoutes };
