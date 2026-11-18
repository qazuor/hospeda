/**
 * Assistant activity schemas (HOS-2335 §5.6; HOS-2348, HOS-2349).
 *
 * The assistant activity is the read model over the `mcp.tool.call` rows of
 * `audit_log_entries`: one row per MCP tool call. It has no table of its own.
 * Both the owner's history and the admin log read it through ONE reader whose
 * scope the route injects (decision D-14).
 */
import { z } from 'zod';
import { AiConnectionClientIdSchema } from '../ai-connection/ai-connection.schema.js';

/** `event_type` of the audit rows the assistant activity reads and purges. */
export const MCP_TOOL_CALL_EVENT_TYPE = 'mcp.tool.call';

/**
 * Months an `mcp.tool.call` row is kept (decision D-13). A constant, not an
 * env var: changing the retention is an owner decision, not a deploy setting.
 */
export const MCP_AUDIT_RETENTION_MONTHS = 12;

/** Every result a tool call can end in, as the binder records it. */
export const MCP_TOOL_CALL_OUTCOMES = ['success', 'denied', 'error'] as const;

/**
 * Result of one tool call. The single source of the outcome values: the API's
 * `recordMcpToolCall` and audit entry type their `outcome` from it.
 */
export const McpActivityOutcomeSchema = z.enum(MCP_TOOL_CALL_OUTCOMES);

/** TypeScript type inferred from {@link McpActivityOutcomeSchema}. */
export type McpActivityOutcome = z.infer<typeof McpActivityOutcomeSchema>;

/**
 * Whether a call read or wrote. A row recorded before reads were audited
 * (D-12) carries no `isWrite` and counts as `write`: only writes were
 * recorded then.
 */
export const McpActivityAccessSchema = z.enum(['read', 'write']);

/** TypeScript type inferred from {@link McpActivityAccessSchema}. */
export type McpActivityAccess = z.infer<typeof McpActivityAccessSchema>;

/**
 * Who the reader may return rows for. Injected by the route, never read from
 * the request (the `logType` pattern of the admin audit-log list).
 * - `own`: the session actor's rows only; no user filter is accepted.
 * - `all`: every user's rows, staff only.
 */
export const McpActivityScopeSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('own') }).strict(),
    z.object({ kind: z.literal('all') }).strict()
]);

/** TypeScript type inferred from {@link McpActivityScopeSchema}. */
export type McpActivityScope = z.infer<typeof McpActivityScopeSchema>;

/**
 * Tool name as recorded. The route narrows it to the registered tool names
 * (an enum the API owns); the reader only bounds its shape.
 */
export const McpActivityToolNameSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/);

/** A calendar date with no time (`YYYY-MM-DD`). */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The upper bound of a date range, inclusive of its whole last day: a date
 * with no time (`2026-11-18`) becomes the end of that day in UTC
 * (`2026-11-18T23:59:59.999Z`), so the rows logged on it are included. A full
 * instant is kept as given.
 */
export const McpActivityToDateSchema = z.union([
    z
        .string()
        .regex(DATE_ONLY_PATTERN)
        .transform((day) => new Date(`${day}T23:59:59.999Z`))
        .pipe(z.date()),
    z.coerce.date()
]);

/**
 * Filters of the `own` scope. Strict: a user filter (`userId`, `actorId`) is
 * a validation error, so the own scope cannot be widened by input (AC-C45,
 * AC-C54).
 */
export const McpActivityOwnFilterSchema = z
    .object({
        /** Recorded tool name. */
        tool: McpActivityToolNameSchema.optional(),
        /** Result of the call. */
        outcome: McpActivityOutcomeSchema.optional(),
        /** Reads, writes, or (absent) both. */
        access: McpActivityAccessSchema.optional(),
        /** OAuth `client_id` of the assistant. */
        clientId: AiConnectionClientIdSchema.optional(),
        /** Calls logged on or after this instant. */
        fromDate: z.coerce.date().optional(),
        /** Calls logged on or before this instant; a bare date covers its whole day. */
        toDate: McpActivityToDateSchema.optional(),
        /** `loggedAt` order. Defaults to newest first. */
        sortDirection: z.enum(['asc', 'desc']).optional()
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityOwnFilterSchema}. */
export type McpActivityOwnFilter = z.infer<typeof McpActivityOwnFilterSchema>;

/** Filters of the `all` scope: the own filters plus the user. */
export const McpActivityAllFilterSchema = McpActivityOwnFilterSchema.extend({
    /** The user the assistant acted for. */
    userId: z.string().uuid().optional()
}).strict();

/** TypeScript type inferred from {@link McpActivityAllFilterSchema}. */
export type McpActivityAllFilter = z.infer<typeof McpActivityAllFilterSchema>;

/** Largest page the reader serves. Routes may cap it lower (the owner route: 20). */
export const MCP_ACTIVITY_MAX_PAGE_SIZE = 100;

/** Page of the reader: 1-based `page` and `pageSize` (never `limit`). */
export const McpActivityPageSchema = z
    .object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(MCP_ACTIVITY_MAX_PAGE_SIZE)
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityPageSchema}. */
export type McpActivityPage = z.infer<typeof McpActivityPageSchema>;

/**
 * Entity a call targeted. `label` and `url` are present only while the row's
 * actor still owns a live target (AC-C47). A conversation never carries a
 * label: the UI shows a fixed "Consulta", and the guest's name and messages
 * are never resolved.
 */
export const McpActivityTargetSchema = z
    .object({
        type: z.string().min(1),
        id: z.string().min(1),
        label: z.string().optional(),
        url: z.string().url().optional()
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityTargetSchema}. */
export type McpActivityTarget = z.infer<typeof McpActivityTargetSchema>;

/**
 * One assistant tool call as both screens render it. It carries no private
 * text: the audit row stores lengths, never content (C-3), and the item adds
 * no free-text field besides the owner's own listing name and the assistant's
 * self-declared (untrusted) name, both rendered as plain text.
 */
export const McpActivityItemSchema = z
    .object({
        id: z.string().uuid(),
        loggedAt: z.date(),
        tool: z.string().min(1),
        /** Normalised: a row without `isWrite` is a write (D-12). */
        isWrite: z.boolean(),
        outcome: McpActivityOutcomeSchema,
        errorCode: z.string().optional(),
        /** Step of a two-step tool (`preview`, `send`, `commit`). */
        step: z.string().optional(),
        client: z
            .object({
                id: z.string().min(1),
                /** Client-declared name: untrusted, plain text only. */
                name: z.string().optional()
            })
            .strict(),
        target: McpActivityTargetSchema.optional(),
        /** The user the assistant acted for. `all` scope only. */
        actorId: z.string().uuid().optional()
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityItemSchema}. */
export type McpActivityItem = z.infer<typeof McpActivityItemSchema>;

/**
 * Input of `McpActivityService.list`, minus the actor. One strict branch per
 * scope: the `own` branch has no user filter at all, so the own scope cannot
 * be widened by input (AC-C45, AC-C54).
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

/**
 * What the reader takes from an `mcp.tool.call` row's `data` jsonb. Only these
 * keys are ever read; any other key in `data` (a future one included) never
 * reaches an item.
 */
export const McpToolCallDataSchema = z.object({
    tool: z.string().min(1),
    outcome: McpActivityOutcomeSchema,
    clientId: z.string().min(1),
    isWrite: z.boolean().optional(),
    errorCode: z.string().optional(),
    resourceType: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

/** Parsed {@link McpToolCallDataSchema}. */
export type McpToolCallData = z.infer<typeof McpToolCallDataSchema>;

/** Most rows one retention statement deletes. */
export const MCP_AUDIT_RETENTION_MAX_BATCH_SIZE = 10_000;

/**
 * Input of `McpActivityService.purgeExpired`, minus the abort signal. The batch
 * size must be at least 1: a zero batch would never come back short and the
 * loop would never end.
 */
export const PurgeMcpActivityInputSchema = z
    .object({
        now: z.date(),
        dryRun: z.boolean().optional(),
        batchSize: z.number().int().min(1).max(MCP_AUDIT_RETENTION_MAX_BATCH_SIZE).optional(),
        deadlineAt: z.date().optional()
    })
    .strict();

/** Validated {@link PurgeMcpActivityInputSchema}. */
export type PurgeMcpActivityInput = z.infer<typeof PurgeMcpActivityInputSchema>;
