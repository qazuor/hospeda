import { MCP_TOOL_CALL_EVENT_TYPE, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, eq, gte, inArray, isNull, lte, ne, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { auditLogEntries } from '../../schemas/audit-log/audit_log_entry.dbschema.ts';
import { conversations } from '../../schemas/conversation/conversations.dbschema.ts';
import { experiences } from '../../schemas/experience/experiences.dbschema.ts';
import { oauthClients } from '../../schemas/oauth-provider/oauth-client.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import { venues } from '../../schemas/venue/venue.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Row type inferred from the audit_log_entries table. */
type AuditLogEntryRow = typeof auditLogEntries.$inferSelect;

/** Listing tables the activity resolves names from, by vertical. */
const LISTING_TABLES = {
    [VerticalEnum.ACCOMMODATION]: accommodations,
    [VerticalEnum.VENUE]: venues,
    [VerticalEnum.EXPERIENCE]: experiences
} as const;

/** A vertical whose listings carry a name and an owner. */
export type McpActivityListingVertical = keyof typeof LISTING_TABLES;

/**
 * Filters of {@link McpActivityModel.listToolCalls}. Already validated by the
 * caller (`McpActivityService`). `actorId` is the scope: the service sets it
 * from the session for the `own` scope.
 */
export interface McpToolCallListFilter {
    /** Exact acting user. */
    readonly actorId?: string;
    /** `data->>'tool'`. */
    readonly tool?: string;
    /** `data->>'outcome'`. */
    readonly outcome?: string;
    /** `data->>'clientId'`. */
    readonly clientId?: string;
    /** `data->>'isWrite'`, a missing value counting as `true` (D-12). */
    readonly isWrite?: boolean;
    /** `loggedAt` on or after. */
    readonly fromDate?: Date;
    /** `loggedAt` on or before. */
    readonly toDate?: Date;
    /** 1-based page. */
    readonly page: number;
    /** Rows per page. */
    readonly pageSize: number;
    /** `loggedAt` order. */
    readonly sortDirection: 'asc' | 'desc';
}

/**
 * Read model of the assistant activity (HOS-2335 §5.6): the `mcp.tool.call`
 * rows of `audit_log_entries`, plus the batched lookups that turn a page of
 * rows into what a screen shows (client names, listing names and owners).
 *
 * Every list is constrained to `event_type = 'mcp.tool.call'`. The tool,
 * outcome, client and access filters run over the `data` jsonb (D-16): the
 * `(event_type, logged_at)` and `(actor_id, logged_at)` indexes narrow the
 * rows first, and no index on `data` exists.
 */
export class McpActivityModel extends BaseModelImpl<AuditLogEntryRow> {
    protected table = auditLogEntries;
    public entityName = 'mcp_activity';

    protected getTableName(): string {
        return 'auditLogEntries';
    }

    /**
     * The `data` jsonb conditions of a filter, one per given field.
     *
     * @param filter - The validated filter.
     * @returns The SQL conditions (empty when no data filter is given).
     */
    buildDataConditions(
        filter: Pick<
            McpToolCallListFilter,
            'tool' | 'outcome' | 'clientId' | 'isWrite' | 'fromDate' | 'toDate'
        >
    ): SQL[] {
        const conditions: SQL[] = [];
        const data = auditLogEntries.data;
        if (filter.tool !== undefined) conditions.push(sql`${data}->>'tool' = ${filter.tool}`);
        if (filter.outcome !== undefined) {
            conditions.push(sql`${data}->>'outcome' = ${filter.outcome}`);
        }
        if (filter.clientId !== undefined) {
            conditions.push(sql`${data}->>'clientId' = ${filter.clientId}`);
        }
        if (filter.isWrite !== undefined) {
            // A row recorded before reads were audited has no isWrite: a write.
            conditions.push(
                sql`coalesce(${data}->>'isWrite', 'true') = ${filter.isWrite ? 'true' : 'false'}`
            );
        }
        if (filter.fromDate) conditions.push(gte(auditLogEntries.loggedAt, filter.fromDate));
        if (filter.toDate) conditions.push(lte(auditLogEntries.loggedAt, filter.toDate));
        return conditions;
    }

    /**
     * Lists MCP tool call rows, newest first by default, with a stable `id`
     * tie-break so pages never repeat or skip rows sharing a timestamp.
     *
     * @param filter - Scope, data filters and page.
     * @param tx - Optional transaction client.
     * @returns The page of rows and the total count.
     */
    async listToolCalls(
        filter: McpToolCallListFilter,
        tx?: DrizzleClient
    ): Promise<{ items: AuditLogEntryRow[]; total: number }> {
        const where: Record<string, unknown> = { eventType: MCP_TOOL_CALL_EVENT_TYPE };
        if (filter.actorId !== undefined) where.actorId = filter.actorId;
        const conditions = this.buildDataConditions(filter);
        return this.findAll(
            where,
            {
                page: filter.page,
                pageSize: filter.pageSize,
                sortBy: 'loggedAt',
                sortOrder: filter.sortDirection,
                thenSortBy: 'id'
            },
            conditions.length > 0 ? conditions : undefined,
            tx
        );
    }

    /**
     * Name and owner of the live (not soft-deleted) listings among `ids`. The
     * caller decides ownership: a listing whose owner is not the row's actor
     * gets no label (AC-C47).
     *
     * @param input.vertical - Which listing table.
     * @param input.ids - Listing ids of one page.
     * @param tx - Optional transaction client.
     * @returns One entry per live listing found.
     */
    async findListingNames(
        input: { readonly vertical: McpActivityListingVertical; readonly ids: readonly string[] },
        tx?: DrizzleClient
    ): Promise<{ id: string; name: string; ownerId: string }[]> {
        if (input.ids.length === 0) return [];
        const table = LISTING_TABLES[input.vertical];
        return this.getClient(tx)
            .select({ id: table.id, name: table.name, ownerId: table.ownerId })
            .from(table)
            .where(
                and(
                    inArray(table.id, [...input.ids]),
                    isNull(table.deletedAt),
                    // PURGED is final: the content is gone (day 180 or deleted at the
                    // owner's request) and `deleted_at` stays NULL (HOS-2380). Every
                    // other status, MODERATED and ARCHIVED included, is still openable.
                    ne(table.publicationStatus, PublicationStatusEnum.PURGED)
                )
            );
    }

    /**
     * Owner of each live conversation among `ids`: the owner of its
     * accommodation. Nothing else of the conversation is read (no guest name,
     * no message).
     *
     * @param input.ids - Conversation ids of one page.
     * @param tx - Optional transaction client.
     * @returns One entry per live conversation whose accommodation is live.
     */
    async findConversationOwners(
        input: { readonly ids: readonly string[] },
        tx?: DrizzleClient
    ): Promise<{ id: string; ownerId: string }[]> {
        if (input.ids.length === 0) return [];
        return this.getClient(tx)
            .select({ id: conversations.id, ownerId: accommodations.ownerId })
            .from(conversations)
            .innerJoin(accommodations, eq(accommodations.id, conversations.accommodationId))
            .where(
                and(
                    inArray(conversations.id, [...input.ids]),
                    isNull(conversations.deletedAt),
                    isNull(accommodations.deletedAt),
                    ne(accommodations.publicationStatus, PublicationStatusEnum.PURGED)
                )
            );
    }

    /**
     * Registered names of the OAuth clients among `clientIds`. The name is
     * client-declared: untrusted display text.
     *
     * @param input.clientIds - Client ids of one page.
     * @param tx - Optional transaction client.
     * @returns One entry per known client with a name.
     */
    async findClientNames(
        input: { readonly clientIds: readonly string[] },
        tx?: DrizzleClient
    ): Promise<{ clientId: string; name: string | null }[]> {
        if (input.clientIds.length === 0) return [];
        return this.getClient(tx)
            .select({ clientId: oauthClients.clientId, name: oauthClients.name })
            .from(oauthClients)
            .where(inArray(oauthClients.clientId, [...input.clientIds]));
    }

    /**
     * Display name and email of the live (not soft-deleted) users among
     * `ids`: the people the assistant acted for, shown to staff in the admin
     * log (HOS-2349, `all` scope only). A deleted user is not returned; the
     * row keeps its `actorId`.
     *
     * @param input.ids - Actor ids of one page.
     * @param tx - Optional transaction client.
     * @returns One entry per live user found.
     */
    async findUsers(
        input: { readonly ids: readonly string[] },
        tx?: DrizzleClient
    ): Promise<{ id: string; displayName: string | null; email: string }[]> {
        if (input.ids.length === 0) return [];
        return this.getClient(tx)
            .select({ id: users.id, displayName: users.displayName, email: users.email })
            .from(users)
            .where(and(inArray(users.id, [...input.ids]), isNull(users.deletedAt)));
    }
}

/** Singleton instance of {@link McpActivityModel}. */
export const mcpActivityModel = new McpActivityModel();
