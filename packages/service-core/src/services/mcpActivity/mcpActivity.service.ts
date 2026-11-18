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
    ListMcpActivityInputSchema,
    MCP_AUDIT_RETENTION_MONTHS,
    MCP_TOOL_CALL_EVENT_TYPE,
    type McpActivityAllFilter,
    type McpActivityItem,
    type McpActivityOwnFilter,
    PurgeMcpActivityInputSchema
} from '@repo/schemas';
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
 * Arguments of {@link McpActivityService.list}. The filter type follows the
 * scope: the `own` filter has no user field at all. The Zod schema
 * (`ListMcpActivityInputSchema`) still validates every call at runtime.
 */
export type ListMcpActivityArgs = {
    /** The session actor. */
    readonly actor: Actor;
    /** 1-based page. */
    readonly page: number;
    /** Rows per page (at most 100). */
    readonly pageSize: number;
    /** Optional service context. */
    readonly ctx?: ServiceContext;
} & (
    | { readonly scope: { readonly kind: 'own' }; readonly filter?: McpActivityOwnFilter }
    | { readonly scope: { readonly kind: 'all' }; readonly filter?: McpActivityAllFilter }
);

/** Output of {@link McpActivityService.list}. */
export interface ListMcpActivityOutput {
    /** The page, projected. */
    readonly items: readonly McpActivityItem[];
    /** Matching rows in the database, skipped ones included. */
    readonly total: number;
    /** Rows of this page left out of `items` because their `data` did not parse. */
    readonly skipped: number;
}

/** Output of {@link McpActivityService.purgeExpired}. */
export interface PurgeMcpActivityOutput {
    /** Rows older than this were (or, on a dry run, would be) deleted. */
    readonly cutoff: Date;
    /** Rows deleted; `0` on a dry run. */
    readonly deleted: number;
    /** Rows a dry run would delete; `0` on a real run. */
    readonly wouldDelete: number;
    /**
     * The run stopped before a short batch because it was aborted or its
     * deadline passed. The rows left are deleted by the next run.
     */
    readonly stoppedEarly: boolean;
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
     * @returns The page of items, the total count and the skipped count. A
     *   row whose `data` does not parse (never written by the binder) is left
     *   out of `items` and logged, but still counted in `total`, which is the
     *   database count; `skipped` says how many rows of this page were left
     *   out, so `items.length + skipped` is the page's row count.
     */
    public async list(input: ListMcpActivityArgs): Promise<ServiceOutput<ListMcpActivityOutput>> {
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
                return {
                    items,
                    total: result.total,
                    skipped: result.items.length - parsed.length
                };
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
     * a batch comes back short. Before each statement the run checks `signal`
     * and `deadlineAt` and stops (`stoppedEarly`) when either says so; the
     * rows left go on the next run. A dry run counts and deletes nothing.
     *
     * @param input.now - Reference instant (the cron run's start).
     * @param input.dryRun - Count only.
     * @param input.batchSize - Rows per statement, at least 1 (injectable for tests).
     * @param input.signal - Aborts the run between statements (the cron's signal).
     * @param input.deadlineAt - No statement starts after this instant.
     * @returns The cutoff, the counts and whether the run stopped early.
     * @throws {ZodError} On an invalid input (a `batchSize` below 1).
     */
    public async purgeExpired(input: {
        readonly now: Date;
        readonly dryRun?: boolean;
        readonly batchSize?: number;
        readonly signal?: AbortSignal;
        readonly deadlineAt?: Date;
    }): Promise<PurgeMcpActivityOutput> {
        const { signal, ...rest } = input;
        const validated = PurgeMcpActivityInputSchema.parse(rest);
        const cutoff = mcpAuditRetentionCutoff({ now: validated.now });
        const scope = { before: cutoff, eventType: MCP_TOOL_CALL_EVENT_TYPE };
        if (validated.dryRun) {
            const wouldDelete = await this.auditLogModel.countOlderThan(scope);
            return { cutoff, deleted: 0, wouldDelete, stoppedEarly: false };
        }
        const batchSize = validated.batchSize ?? MCP_AUDIT_RETENTION_BATCH_SIZE;
        const mustStop = (): boolean =>
            signal?.aborted === true ||
            (validated.deadlineAt !== undefined && Date.now() >= validated.deadlineAt.getTime());
        let deleted = 0;
        let stoppedEarly = false;
        for (;;) {
            if (mustStop()) {
                stoppedEarly = true;
                break;
            }
            const batch = await this.auditLogModel.purgeOlderThan({ ...scope, limit: batchSize });
            deleted += batch;
            if (batch < batchSize) break;
        }
        this.logger.info(
            { deleted, stoppedEarly, cutoff: cutoff.toISOString() },
            'mcp.tool.call retention purge completed'
        );
        return { cutoff, deleted, wouldDelete: 0, stoppedEarly };
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
