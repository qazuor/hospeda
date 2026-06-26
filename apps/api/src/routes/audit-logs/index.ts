/**
 * Admin Audit & Security Log Routes (SPEC-162)
 *
 * Two routers, mounted at distinct base paths and gated by distinct permissions:
 * - GET /api/v1/admin/audit-logs    (AUDIT_LOG_VIEW)
 * - GET /api/v1/admin/security-logs (SECURITY_LOG_VIEW)
 *
 * @module routes/audit-logs
 */

import { createRouter } from '../../utils/create-app';
import { listAuditLogsRoute, listSecurityLogsRoute } from './list';

const auditApp = createRouter();
auditApp.route('/', listAuditLogsRoute);

const securityApp = createRouter();
securityApp.route('/', listSecurityLogsRoute);

export { auditApp as adminAuditLogRoutes, securityApp as adminSecurityLogRoutes };
