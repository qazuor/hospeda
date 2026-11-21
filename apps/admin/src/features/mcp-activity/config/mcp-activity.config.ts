/**
 * Entity list configuration of the admin assistant activity log (HOS-2349,
 * spec HOS-2335 §6.10). Mirrors the audit-log viewer.
 *
 * One row per assistant (MCP) tool call of every user, from
 * `GET /api/v1/admin/mcp-activity` (gated server-side by `MCP_ACTIVITY_VIEW`).
 * Only `loggedAt` is sortable; search and the grid view are disabled.
 * Filters: user (a complete UUID only), tool (a select over `MCP_TOOL_NAMES`),
 * outcome, access (read/write), client and date range (UTC days).
 */

import { MCP_TOOL_NAMES, McpActivityItemSchema } from '@repo/schemas';
import { z } from 'zod';
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { McpActivityCoverageNote } from '../components/McpActivityCoverageNote';
import { createMcpActivityColumns } from './mcp-activity.columns';

/** The item over the wire: `loggedAt` arrives as an ISO string. */
export const McpActivityListItemSchema = McpActivityItemSchema.extend({
    loggedAt: z.coerce.date()
}).strict();

/** A complete UUID (any version), case-insensitive. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inferred item type of the list. */
export type McpActivityListItem = z.infer<typeof McpActivityListItemSchema>;

/** EntityConfig of the assistant activity log. */
export const mcpActivityConfig: EntityConfig<McpActivityListItem> = {
    name: 'mcpActivity',
    entityKey: 'mcpActivity',
    entityType: EntityType.TAG, // Closest available generic type; no LOG type exists

    apiEndpoint: '/api/v1/admin/mcp-activity',
    basePath: '/platform/ops/mcp-activity',

    listItemSchema: McpActivityListItemSchema,

    // The API does not support free-text search.
    searchConfig: {
        enabled: false,
        minChars: 99,
        debounceMs: 0
    },

    viewConfig: {
        defaultView: 'table',
        allowViewToggle: false
    },

    paginationConfig: {
        defaultPageSize: 50,
        allowedPageSizes: [20, 50, 100]
    },

    defaultSort: { id: 'loggedAt', desc: true },

    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: false,
        headerActionsComponent: McpActivityCoverageNote
    },

    filterBarConfig: {
        filters: [
            {
                type: 'text',
                paramKey: 'userId',
                labelKey: 'admin-filters.mcpActivity.userId.label',
                placeholderKey: 'admin-filters.mcpActivity.userId.placeholder',
                debounceMs: 400,
                maxLength: 36,
                // Only a complete UUID reaches the query: a half-typed id
                // would answer 400 on every debounce.
                validPattern: UUID_PATTERN,
                invalidHintKey: 'admin-filters.mcpActivity.userId.invalidHint'
            },
            {
                type: 'select',
                paramKey: 'tool',
                labelKey: 'admin-filters.mcpActivity.tool.label',
                options: MCP_TOOL_NAMES.map((name) => ({
                    value: name,
                    labelKey: `admin-filters.mcpActivity.tool.options.${name}`
                }))
            },
            {
                type: 'select',
                paramKey: 'outcome',
                labelKey: 'admin-filters.mcpActivity.outcome.label',
                options: [
                    { value: 'success', labelKey: 'admin-filters.mcpActivity.outcome.success' },
                    { value: 'denied', labelKey: 'admin-filters.mcpActivity.outcome.denied' },
                    { value: 'error', labelKey: 'admin-filters.mcpActivity.outcome.error' }
                ]
            },
            {
                type: 'select',
                paramKey: 'access',
                labelKey: 'admin-filters.mcpActivity.access.label',
                options: [
                    { value: 'read', labelKey: 'admin-filters.mcpActivity.access.read' },
                    { value: 'write', labelKey: 'admin-filters.mcpActivity.access.write' }
                ]
            },
            {
                type: 'text',
                paramKey: 'clientId',
                labelKey: 'admin-filters.mcpActivity.clientId.label',
                placeholderKey: 'admin-filters.mcpActivity.clientId.placeholder',
                debounceMs: 400,
                maxLength: 2048
            },
            {
                type: 'date-range',
                paramKey: 'loggedAt',
                labelKey: 'admin-filters.mcpActivity.loggedAt.label',
                paramKeyFrom: 'fromDate',
                paramKeyTo: 'toDate'
            }
        ]
    },

    createColumns: createMcpActivityColumns
};

const mcpActivityPage = createEntityListPage(mcpActivityConfig);

/**
 * The assistant activity list page, rendered by
 * `routes/_authed/platform/ops/mcp-activity.tsx`. The route guards it with
 * `MCP_ACTIVITY_VIEW` before it renders.
 */
export const McpActivityPageComponent = mcpActivityPage.component;

/**
 * The framework route of the list page. The file route borrows its
 * `validateSearch` (page, pageSize, sort and the filter params).
 */
export const McpActivityRoute = mcpActivityPage.route;
