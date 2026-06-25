/**
 * Entity list configuration for the admin audit & security log viewers (SPEC-162).
 *
 * Both viewers share one table (`audit_log_entries`) and one column set; they
 * differ only in API endpoint, route, permission (enforced server-side), and
 * page title. A small factory produces the two configs from the shared base.
 *
 * Only `loggedAt` and `severity` are sortable — those are the only fields
 * whitelisted by the API routes. Search is disabled (entries are not
 * text-searchable via the API). Grid view is disabled (dense tabular data).
 */
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { AuditLogEntrySchema } from '@repo/schemas';
import type { z } from 'zod';
import { createAuditLogsColumns } from './audit-logs.columns';

/** Inferred item type from the canonical schema. */
export type AuditLogItem = z.infer<typeof AuditLogEntrySchema>;

/** Parameters that differentiate the two log viewers. */
interface AuditLogsConfigInput {
    /** Unique entity-list name. */
    name: string;
    /** i18n entity key (`admin-entities.entities.<entityKey>`). */
    entityKey: string;
    /** API endpoint backing the list. */
    apiEndpoint: string;
    /** Route base path. */
    basePath: string;
}

/**
 * Builds an EntityConfig for an audit/security log viewer.
 *
 * @param input - The differentiating parameters (name, entityKey, endpoint, path).
 * @returns A fully configured EntityConfig.
 */
function makeAuditLogsConfig(input: AuditLogsConfigInput): EntityConfig<AuditLogItem> {
    return {
        name: input.name,
        entityKey: input.entityKey,
        entityType: EntityType.TAG, // Closest available generic type; no LOG type exists

        apiEndpoint: input.apiEndpoint,
        basePath: input.basePath,

        // TYPE-WORKAROUND: AuditLogEntrySchema carries Zod-branded effects; the structural
        // shape is fully compatible with EntityConfig<AuditLogItem>.
        listItemSchema: AuditLogEntrySchema as unknown as z.ZodSchema<AuditLogItem>,

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

        paginationConfig: {
            defaultPageSize: 50,
            allowedPageSizes: [20, 50, 100]
        },

        // Default sort: newest first
        defaultSort: { id: 'loggedAt', desc: true },

        // Read-only list — no create button
        layoutConfig: {
            showBreadcrumbs: true,
            showCreateButton: false
        },

        filterBarConfig: {
            filters: [
                {
                    type: 'select',
                    paramKey: 'severity',
                    labelKey: 'admin-filters.auditLog.severity.label',
                    options: [
                        { value: 'critical', labelKey: 'admin-filters.auditLog.severity.critical' },
                        { value: 'info', labelKey: 'admin-filters.auditLog.severity.info' }
                    ]
                },
                {
                    type: 'text',
                    paramKey: 'eventType',
                    labelKey: 'admin-filters.auditLog.eventType.label',
                    placeholderKey: 'admin-filters.auditLog.eventType.placeholder',
                    debounceMs: 400,
                    maxLength: 50
                },
                {
                    type: 'text',
                    paramKey: 'actorId',
                    labelKey: 'admin-filters.auditLog.actorId.label',
                    placeholderKey: 'admin-filters.auditLog.actorId.placeholder',
                    debounceMs: 400
                },
                {
                    type: 'date-range',
                    paramKey: 'loggedAt',
                    labelKey: 'admin-filters.auditLog.loggedAt.label',
                    paramKeyFrom: 'fromDate',
                    paramKeyTo: 'toDate'
                }
            ]
        },

        createColumns: createAuditLogsColumns
    };
}

/** EntityConfig for the audit-log viewer (admin actions). */
export const auditLogsConfig: EntityConfig<AuditLogItem> = makeAuditLogsConfig({
    name: 'auditLogs',
    entityKey: 'auditLog',
    apiEndpoint: '/api/v1/admin/audit-logs',
    basePath: '/platform/ops/audit-logs'
});

/** EntityConfig for the security-log viewer (auth events). */
export const securityLogsConfig: EntityConfig<AuditLogItem> = makeAuditLogsConfig({
    name: 'securityLogs',
    entityKey: 'securityLog',
    apiEndpoint: '/api/v1/admin/security-logs',
    basePath: '/platform/ops/security-logs'
});

const auditPage = createEntityListPage(auditLogsConfig);
const securityPage = createEntityListPage(securityLogsConfig);

export const AuditLogsPageComponent = auditPage.component;
export const AuditLogsRoute = auditPage.route;
export const SecurityLogsPageComponent = securityPage.component;
export const SecurityLogsRoute = securityPage.route;
