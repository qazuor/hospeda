/**
 * McpActivityService (HOS-2335 §5.6; HOS-2348, HOS-2349).
 *
 * The ONE reader of the assistant activity, shared by the owner's history and
 * the admin log (decision D-14), plus the 12-month retention of its rows
 * (D-13). It reads `audit_log_entries`, always constrained to
 * `event_type = 'mcp.tool.call'`; there is no table of its own.
 *
 * The scope is injected by the route, never read from the request:
 * - `own` forces `actor_id` from the session actor, and its filter is strict,
 *   so a `userId` (or `actorId`) is a validation error;
 * - `all` reads every user's rows and requires
 *   {@link MCP_ACTIVITY_ALL_SCOPE_PERMISSION}.
 *
 * @module services/mcpActivity
 */
import {
    type AuditLogEntryModel,
    auditLogEntryModel,
    type McpActivityModel,
    mcpActivityModel
} from '@repo/db';
import {
    MCP_AUDIT_RETENTION_MONTHS,
    MCP_TOOL_CALL_EVENT_TYPE,
    McpActivityAllFilterSchema,
    type McpActivityItem,
    McpActivityOwnFilterSchema,
    McpActivityPageSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types/index.js';
import { checkCanViewAllMcpActivity } from './mcpActivity.permissions.js';
import {
    collectLookupRequest,
    listingKey,
    type McpActivityLookupRequest,
    type McpActivityLookups,
    type McpActivityTargetUrlBuilder,
    type ParsedMcpToolCallRow,
    parseMcpToolCallRow,
    projectMcpActivityItem
} from './mcpActivity.projection.js';

/** Rows deleted per retention statement: bounded locks on a large backlog. */
export const MCP_AUDIT_RETENTION_BATCH_SIZE = 1000;

/**
 * Input of {@link McpActivityService.list}, minus the actor. One strict
 * branch per scope: the `own` branch has no user filter at all.
 */
export const ListMcpActivityInputSchema = z.union([
    z
        .object({
            scope: z.object({ kind: z.literal('own') }).strict(),
            filter: McpActivityOwnFilterSchema.default({}),
            ...McpActivityPageSchema.shape
        })
        .strict(),
    z
        .object({
            scope: z.object({ kind: z.literal('all') }).strict(),
            filter: McpActivityAllFilterSchema.default({}),
            ...McpActivityPageSchema.shape
        })
        .strict()
]);

/** Validated {@link ListMcpActivityInputSchema}. */
export type ListMcpActivityInput = z.infer<typeof ListMcpActivityInputSchema>;

/** Output of {@link McpActivityService.list}. */
export interface ListMcpActivityOutput {
    readonly items: readonly McpActivityItem[];
    readonly total: number;
}

/** Output of {@link McpActivityService.purgeExpired}. */
export interface PurgeMcpActivityOutput {
    /** Rows older than this were (or, on a dry run, would be) deleted. */
    readonly cutoff: Date;
    /** Rows deleted; `0` on a dry run. */
    readonly deleted: number;
    /** Rows a dry run would delete; `0` on a real run. */
    readonly wouldDelete: number;
}

/** Collaborators of {@link McpActivityService}, injectable for tests. */
export interface McpActivityServiceDeps {
    /** Read model over the `mcp.tool.call` rows. */
    readonly model?: McpActivityModel;
    /** Audit table model, for the scoped retention delete. */
    readonly auditLogModel?: AuditLogEntryModel;
    /**
     * Builds the portal URL of a target the row's actor still owns. The API
     * owns the portal route map (D-1), so the route supplies it; without it
     * items carry no `url`.
     */
    readonly buildTargetUrl?: McpActivityTargetUrlBuilder;
}

/**
 * The instant before which an `mcp.tool.call` row is past retention:
 * {@link MCP_AUDIT_RETENTION_MONTHS} calendar months before `now`, in UTC.
 *
 * @param input.now - Reference instant.
 * @returns The cutoff.
 */
export function mcpAuditRetentionCutoff(input: { readonly now: Date }): Date {
    const cutoff = new Date(input.now.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - MCP_AUDIT_RETENTION_MONTHS);
    return cutoff;
}

/**
 * Reads the assistant activity and enforces its retention.
 */
export class McpActivityService extends BaseService {
    static readonly ENTITY_NAME = 'mcpActivity';
    protected override readonly entityName = McpActivityService.ENTITY_NAME;

    private readonly model: McpActivityModel;
    private readonly auditLogModel: AuditLogEntryModel;
    private readonly buildTargetUrl?: McpActivityTargetUrlBuilder;

    constructor(config: ServiceConfig, deps: McpActivityServiceDeps = {}) {
        super(config, McpActivityService.ENTITY_NAME);
        this.model = deps.model ?? mcpActivityModel;
        this.auditLogModel = deps.auditLogModel ?? auditLogEntryModel;
        this.buildTargetUrl = deps.buildTargetUrl;
    }

    /**
     * Lists assistant tool calls, newest first by default, one page at a time.
     *
     * @param input.actor - The session actor.
     * @param input.scope - Injected by the route: `own` or `all`.
     * @param input.filter - Tool, outcome, access, client and date range
     *   (`all` adds `userId`).
     * @param input.page - 1-based page.
     * @param input.pageSize - Rows per page.
     * @param input.ctx - Optional service context.
     * @returns The page of items and the total count.
     */
    public async list(input: {
        readonly actor: Actor;
        readonly scope: ListMcpActivityInput['scope'];
        readonly filter?: Record<string, unknown>;
        readonly page: number;
        readonly pageSize: number;
        readonly ctx?: ServiceContext;
    }): Promise<ServiceOutput<ListMcpActivityOutput>> {
        const { actor, scope, filter, page, pageSize, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor, scope, filter, page, pageSize },
            schema: ListMcpActivityInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                if (validated.scope.kind === 'all') checkCanViewAllMcpActivity(validatedActor);
                // The scope predicate: `own` is the session actor, never input.
                const actorId =
                    validated.scope.kind === 'own'
                        ? validatedActor.id
                        : 'userId' in validated.filter
                          ? validated.filter.userId
                          : undefined;
                const { access, ...dataFilter } = validated.filter;
                const result = await this.model.listToolCalls(
                    {
                        ...(actorId === undefined ? {} : { actorId }),
                        ...(dataFilter.tool === undefined ? {} : { tool: dataFilter.tool }),
                        ...(dataFilter.outcome === undefined
                            ? {}
                            : { outcome: dataFilter.outcome }),
                        ...(dataFilter.clientId === undefined
                            ? {}
                            : { clientId: dataFilter.clientId }),
                        ...(access === undefined ? {} : { isWrite: access === 'write' }),
                        ...(dataFilter.fromDate === undefined
                            ? {}
                            : { fromDate: dataFilter.fromDate }),
                        ...(dataFilter.toDate === undefined ? {} : { toDate: dataFilter.toDate }),
                        page: validated.page,
                        pageSize: validated.pageSize,
                        sortDirection: dataFilter.sortDirection ?? 'desc'
                    },
                    execCtx.tx
                );
                const parsed = this.parseRows({ rows: result.items });
                const lookups = await this.lookUp({
                    request: collectLookupRequest({ rows: parsed }),
                    tx: execCtx.tx
                });
                const items = parsed.map((row) =>
                    projectMcpActivityItem({
                        parsed: row,
                        scope: validated.scope,
                        lookups,
                        buildTargetUrl: this.buildTargetUrl
                    })
                );
                return { items, total: result.total };
            }
        });
    }

    /**
     * Deletes the `mcp.tool.call` rows older than
     * {@link MCP_AUDIT_RETENTION_MONTHS} months, and nothing else (D-13): the
     * delete is scoped by `event_type`, so `mcp.connection.revoked` and every
     * admin and security row keep today's behaviour. System operation (no
     * actor). Idempotent: a second run over the same instant deletes nothing.
     *
     * Batched: {@link MCP_AUDIT_RETENTION_BATCH_SIZE} rows per statement until
     * a batch comes back short. A dry run counts and deletes nothing.
     *
     * @param input.now - Reference instant (the cron run's start).
     * @param input.dryRun - Count only.
     * @param input.batchSize - Rows per statement (injectable for tests).
     * @returns The cutoff and the counts.
     */
    public async purgeExpired(input: {
        readonly now: Date;
        readonly dryRun?: boolean;
        readonly batchSize?: number;
    }): Promise<PurgeMcpActivityOutput> {
        const cutoff = mcpAuditRetentionCutoff({ now: input.now });
        const scope = { before: cutoff, eventType: MCP_TOOL_CALL_EVENT_TYPE };
        if (input.dryRun) {
            const wouldDelete = await this.auditLogModel.countOlderThan(scope);
            return { cutoff, deleted: 0, wouldDelete };
        }
        const batchSize = input.batchSize ?? MCP_AUDIT_RETENTION_BATCH_SIZE;
        let deleted = 0;
        for (;;) {
            const batch = await this.auditLogModel.purgeOlderThan({ ...scope, limit: batchSize });
            deleted += batch;
            if (batch < batchSize) break;
        }
        this.logger.info(
            { deleted, cutoff: cutoff.toISOString() },
            'mcp.tool.call retention purge completed'
        );
        return { cutoff, deleted, wouldDelete: 0 };
    }

    /** Parses each row's `data`; a row the binder never wrote is dropped and logged. */
    private parseRows(input: {
        readonly rows: readonly {
            readonly id: string;
            readonly loggedAt: Date;
            readonly actorId: string | null;
            readonly data: Record<string, unknown> | null;
        }[];
    }): ParsedMcpToolCallRow[] {
        const parsed: ParsedMcpToolCallRow[] = [];
        for (const row of input.rows) {
            const result = parseMcpToolCallRow({ row });
            if (result) {
                parsed.push(result);
            } else {
                this.logger.warn({ id: row.id }, 'mcp.tool.call row with unreadable data skipped');
            }
        }
        return parsed;
    }

    /** Runs the page's batched lookups: one query per kind, none when empty. */
    private async lookUp(input: {
        readonly request: McpActivityLookupRequest;
        readonly tx?: ServiceContext['tx'];
    }): Promise<McpActivityLookups> {
        const { request, tx } = input;
        const verticals = [...request.listingIds.entries()];
        const [clients, conversations, ...listingPages] = await Promise.all([
            this.model.findClientNames({ clientIds: request.clientIds }, tx),
            this.model.findConversationOwners({ ids: request.conversationIds }, tx),
            ...verticals.map(([vertical, ids]) =>
                this.model.findListingNames({ vertical, ids }, tx)
            )
        ]);
        const listings = new Map<string, { readonly name: string; readonly ownerId: string }>();
        verticals.forEach(([vertical], index) => {
            for (const listing of listingPages[index] ?? []) {
                listings.set(listingKey({ vertical, id: listing.id }), {
                    name: listing.name,
                    ownerId: listing.ownerId
                });
            }
        });
        const clientNames = new Map<string, string>();
        for (const client of clients) {
            if (client.name) clientNames.set(client.clientId, client.name);
        }
        return {
            clientNames,
            listings,
            conversationOwners: new Map(conversations.map((c) => [c.id, c.ownerId]))
        };
    }
}
