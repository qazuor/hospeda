/**
 * Security Logs Page (SPEC-162).
 *
 * Admin viewer over the security family of `audit_log_entries` (auth events:
 * login failures, lockouts, access denied, signouts). Built on the shared
 * entity-list framework. Server-side the endpoint is gated by SECURITY_LOG_VIEW;
 * `requireAdminApiAccess` is the client-side route guard (the API enforces the
 * permission).
 */
import {
    SecurityLogsPageComponent,
    SecurityLogsRoute
} from '@/features/audit-logs/config/audit-logs.config';
import { requireAdminPermission } from '@/lib/admin-api-access';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/ops/security-logs')({
    validateSearch: SecurityLogsRoute.options.validateSearch,
    beforeLoad: ({ context }) => requireAdminPermission(context, PermissionEnum.SECURITY_LOG_VIEW),
    component: SecurityLogsPageComponent
});
