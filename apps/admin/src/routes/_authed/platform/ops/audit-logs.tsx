/**
 * Audit Logs Page (SPEC-162).
 *
 * Admin viewer over the audit family of `audit_log_entries` (admin actions).
 * Built on the shared entity-list framework. Server-side the endpoint is gated
 * by AUDIT_LOG_VIEW; `requireAdminApiAccess` is the client-side route guard
 * (the API enforces the permission).
 */
import {
    AuditLogsPageComponent,
    AuditLogsRoute
} from '@/features/audit-logs/config/audit-logs.config';
import { requireAdminApiAccess } from '@/lib/admin-api-access';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/ops/audit-logs')({
    validateSearch: AuditLogsRoute.options.validateSearch,
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: AuditLogsPageComponent
});
