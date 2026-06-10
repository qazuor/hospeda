/**
 * Entity list configuration for the admin app-logs viewer (SPEC-184 migration).
 *
 * Migrates the bespoke AppLogsPanel onto the shared `createEntityListPage`
 * framework. Only `loggedAt` and `level` are sortable — those are the only
 * fields whitelisted by GET /api/v1/admin/logs.
 *
 * Search is disabled: app-log entries are not text-searchable via the API.
 * Grid view is disabled: the dense tabular layout is not meaningful as cards.
 */
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { AppLogEntrySchema } from '@repo/schemas';
import type { z } from 'zod';
import { createAppLogsColumns } from './app-logs.columns';

/** Inferred item type from the canonical schema. */
export type AppLogItem = z.infer<typeof AppLogEntrySchema>;

/**
 * EntityConfig for app-log entries.
 *
 * API endpoint: GET /api/v1/admin/logs
 * Default sort: loggedAt descending (newest first).
 * Search: disabled (no text-search support in the API).
 * View toggle: disabled (table-only).
 */
export const appLogsConfig: EntityConfig<AppLogItem> = {
    name: 'appLogs',
    entityKey: 'appLog',
    entityType: EntityType.TAG, // Closest available generic type; no LOG type exists

    // API
    apiEndpoint: '/api/v1/admin/logs',

    // Routes — read-only list, no detail/edit pages
    basePath: '/platform/ops/logs',

    // Schemas: `z.coerce.date()` fields handle ISO strings returned over HTTP
    // TYPE-WORKAROUND: AppLogEntrySchema carries Zod-branded effects; the structural
    // shape is fully compatible with EntityConfig<AppLogItem>.
    listItemSchema: AppLogEntrySchema as unknown as z.ZodSchema<AppLogItem>,

    // Disable search — the API does not support free-text search
    searchConfig: {
        enabled: false,
        minChars: 99,
        debounceMs: 0
    },

    // Table-only view
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: false
    },

    // Match the bespoke panel's default page size
    paginationConfig: {
        defaultPageSize: 50,
        allowedPageSizes: [20, 50, 100]
    },

    // Default sort: newest first
    defaultSort: { id: 'loggedAt', desc: true },

    // Layout: read-only list — no create button
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: false
    },

    // Filters
    filterBarConfig: {
        filters: [
            {
                type: 'select',
                paramKey: 'level',
                labelKey: 'admin-filters.appLog.level.label',
                options: [
                    {
                        value: 'WARN',
                        labelKey: 'admin-filters.appLog.level.warn'
                    },
                    {
                        value: 'ERROR',
                        labelKey: 'admin-filters.appLog.level.error'
                    }
                ]
            },
            {
                type: 'select',
                paramKey: 'method',
                labelKey: 'admin-filters.appLog.method.label',
                options: [
                    { value: 'GET', labelKey: 'admin-filters.appLog.method.get' },
                    { value: 'POST', labelKey: 'admin-filters.appLog.method.post' },
                    { value: 'PUT', labelKey: 'admin-filters.appLog.method.put' },
                    { value: 'PATCH', labelKey: 'admin-filters.appLog.method.patch' },
                    { value: 'DELETE', labelKey: 'admin-filters.appLog.method.delete' }
                ]
            },
            {
                type: 'text',
                paramKey: 'category',
                labelKey: 'admin-filters.appLog.category.label',
                placeholderKey: 'admin-filters.appLog.category.placeholder',
                debounceMs: 400
            },
            {
                type: 'text',
                paramKey: 'requestId',
                labelKey: 'admin-filters.appLog.requestId.label',
                placeholderKey: 'admin-filters.appLog.requestId.placeholder',
                debounceMs: 400,
                maxLength: 64
            },
            {
                type: 'text',
                paramKey: 'userId',
                labelKey: 'admin-filters.appLog.userId.label',
                placeholderKey: 'admin-filters.appLog.userId.placeholder',
                debounceMs: 400
            },
            {
                type: 'text',
                paramKey: 'path',
                labelKey: 'admin-filters.appLog.path.label',
                placeholderKey: 'admin-filters.appLog.path.placeholder',
                debounceMs: 400
            },
            {
                type: 'date-range',
                paramKey: 'loggedAt',
                labelKey: 'admin-filters.appLog.loggedAt.label',
                paramKeyFrom: 'fromDate',
                paramKeyTo: 'toDate'
            }
        ]
    },

    // Columns
    createColumns: createAppLogsColumns
};

const { component, route } = createEntityListPage(appLogsConfig);
export { component as AppLogsPageComponent, route as AppLogsRoute };
