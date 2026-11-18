/**
 * Assistant activity log page (HOS-2349, spec HOS-2335 §6.10).
 *
 * Admin viewer over every user's assistant (MCP) tool calls. Built on the
 * shared entity-list framework. Server-side the endpoint is gated by
 * MCP_ACTIVITY_VIEW (SUPER_ADMIN only, D-15); `requireAdminPermission` is the
 * client-side route guard and redirects without it (AC-C51).
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import {
    McpActivityPageComponent,
    McpActivityRoute
} from '@/features/mcp-activity/config/mcp-activity.config';
import { requireAdminPermission } from '@/lib/admin-api-access';

export const Route = createFileRoute('/_authed/platform/ops/mcp-activity')({
    validateSearch: McpActivityRoute.options.validateSearch,
    beforeLoad: ({ context }) => requireAdminPermission(context, PermissionEnum.MCP_ACTIVITY_VIEW),
    component: McpActivityPageComponent
});
