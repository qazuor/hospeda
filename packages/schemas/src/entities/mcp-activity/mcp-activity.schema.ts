/**
 * Assistant activity schemas (HOS-2335 §5.6; HOS-2348, HOS-2349).
 *
 * The assistant activity is the read model over the `mcp.tool.call` rows of
 * `audit_log_entries`: one row per MCP tool call. It has no table of its own.
 * Both the owner's history and the admin log read it through ONE reader whose
 * scope the route injects (decision D-14).
 */
import { z } from 'zod';
import { createBooleanQueryParamWithDefault } from '../../common/boolean-params.js';
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
 * Names of the assistant (MCP) tools the API registers, in registry order.
 * The API registry (`apps/api/src/mcp/tools/registry.ts`) owns the tools; this
 * tuple publishes their names so the admin filter can offer them as options.
 * A guard test in `apps/api` asserts the two are equal in both directions, so
 * a new tool cannot drift from this list (HOS-2349).
 */
export const MCP_TOOL_NAMES = [
    'list_my_listings',
    'get_owner_summary',
    'get_listing',
    'update_listing_basic',
    'get_listing_amenities',
    'update_listing_amenities',
    'set_listing_publication',
    'list_amenities_and_features',
    'get_listing_stats',
    'get_listing_creation_guide',
    'create_listing',
    'list_reviews',
    'get_help',
    'list_inquiries',
    'get_inquiry',
    'reply_inquiry',
    'search_providers',
    'list_benefit_usages',
    'confirm_benefit_usage',
    'reject_benefit_usage',
    'undo_benefit_rejection'
] as const;

/** A registered tool name. */
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

/**
 * Tool name filter: one of {@link MCP_TOOL_NAMES}, so an unregistered value is
 * a validation error (400), never an empty page (AC-C53). Recorded rows keep
 * any string (`McpToolCallDataSchema`): a retired tool's rows stay readable.
 */
export const McpActivityToolNameSchema = z.enum(MCP_TOOL_NAMES);

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
 * label: the UI shows a fixed "Consulta de huésped", and the guest's name and messages
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
        actorId: z.string().uuid().optional(),
        /**
         * Display name of that user, while the account is live. `all` scope
         * only: staff-facing, as the admin users list shows it (HOS-2349).
         */
        actorName: z.string().min(1).optional(),
        /** Email of that user, while the account is live. `all` scope only (HOS-2349). */
        actorEmail: z.string().min(1).optional()
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityItemSchema}. */
export type McpActivityItem = z.infer<typeof McpActivityItemSchema>;

/**
 * One item of the owner's history (HOS-2348): the item minus `actorId`, which
 * only the `all` scope carries. Strict, so a key outside the allowlist fails
 * the response instead of reaching the owner (AC-C46).
 */
export const McpActivityOwnItemSchema = McpActivityItemSchema.omit({ actorId: true }).strict();

/** TypeScript type inferred from {@link McpActivityOwnItemSchema}. */
export type McpActivityOwnItem = z.infer<typeof McpActivityOwnItemSchema>;

/** Largest page of the owner's history (HOS-2335 §6.9). */
export const MCP_ACTIVITY_OWN_MAX_PAGE_SIZE = 20;

/** Languages the owner history can build its target links in (the web locales). */
export const McpActivityLocaleSchema = z.enum(['es', 'en', 'pt']);

/** TypeScript type inferred from {@link McpActivityLocaleSchema}. */
export type McpActivityLocale = z.infer<typeof McpActivityLocaleSchema>;

/**
 * Query of `GET /api/v1/protected/ai-connections/activity` (HOS-2335 §6.9).
 * Strict: only these keys exist, so a `userId`, `actorId` or `scope` param is
 * a 400 and the own scope cannot be widened by input (AC-C45, AC-C54).
 *
 * `includeReads` is the "mostrar también lo que solo miró" toggle (D-12):
 * absent or `false` lists writes only; `true` lists reads too.
 */
export const McpActivityOwnQuerySchema = z
    .object({
        /** 1-based page. */
        page: z.coerce.number().int().min(1).default(1),
        /** Rows per page, at most {@link MCP_ACTIVITY_OWN_MAX_PAGE_SIZE}. */
        pageSize: z.coerce
            .number()
            .int()
            .min(1)
            .max(MCP_ACTIVITY_OWN_MAX_PAGE_SIZE)
            .default(MCP_ACTIVITY_OWN_MAX_PAGE_SIZE),
        /** OAuth `client_id` of one assistant. */
        clientId: AiConnectionClientIdSchema.optional(),
        /** Result of the call. */
        outcome: McpActivityOutcomeSchema.optional(),
        /** Also list read-only calls (D-12). Writes only when absent. */
        includeReads: createBooleanQueryParamWithDefault('Also list read-only calls', false),
        /** Calls logged on or after this instant. */
        fromDate: z.coerce.date().optional(),
        /** Calls logged on or before this instant; a bare date covers its whole day. */
        toDate: McpActivityToDateSchema.optional(),
        /**
         * Language of the target links: the page language the web renders in
         * (owner decision 2026-11-18). Absent builds `es` links.
         */
        locale: McpActivityLocaleSchema.optional()
    })
    .strict();

/** Validated {@link McpActivityOwnQuerySchema}. */
export type McpActivityOwnQuery = z.infer<typeof McpActivityOwnQuerySchema>;

/**
 * Maps the owner's query to the reader's `own` filter. The toggle becomes the
 * `access` filter: off is `write`, on is no access filter (both). Nothing here
 * can name a user: the reader takes the actor from the session.
 *
 * @param input.query - The validated query.
 * @returns The `own` filter.
 */
export function toMcpActivityOwnFilter(input: {
    readonly query: Omit<McpActivityOwnQuery, 'page' | 'pageSize' | 'locale'>;
}): McpActivityOwnFilter {
    const { clientId, outcome, includeReads, fromDate, toDate } = input.query;
    return {
        ...(clientId === undefined ? {} : { clientId }),
        ...(outcome === undefined ? {} : { outcome }),
        ...(includeReads ? {} : { access: 'write' as const }),
        ...(fromDate === undefined ? {} : { fromDate }),
        ...(toDate === undefined ? {} : { toDate })
    };
}

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

/** `sort` values the admin log accepts: `loggedAt`, either direction (HOS-2349). */
export const McpActivityAdminSortSchema = z.enum(['loggedAt:desc', 'loggedAt:asc']);

/** TypeScript type inferred from {@link McpActivityAdminSortSchema}. */
export type McpActivityAdminSort = z.infer<typeof McpActivityAdminSortSchema>;

/**
 * Query of `GET /api/v1/admin/mcp-activity` (HOS-2349), minus `page` and
 * `pageSize`, which the admin list factory adds. Every filter of the `all`
 * scope, plus `sort` in the entity-list `field:direction` shape. `tool` is one
 * of {@link MCP_TOOL_NAMES}, so a typo is a 400 (AC-C53).
 */
export const McpActivityAdminQuerySchema = z
    .object({
        /** The user the assistant acted for. */
        userId: z.string().uuid().optional(),
        /** Recorded tool name. */
        tool: McpActivityToolNameSchema.optional(),
        /** Result of the call. */
        outcome: McpActivityOutcomeSchema.optional(),
        /** Reads, writes, or (absent) both: the admin sees everything by default (D-12). */
        access: McpActivityAccessSchema.optional(),
        /** OAuth `client_id` of the assistant. */
        clientId: AiConnectionClientIdSchema.optional(),
        /** Calls logged on or after this instant. */
        fromDate: z.coerce.date().optional(),
        /** Calls logged on or before this instant; a bare date covers its whole day. */
        toDate: McpActivityToDateSchema.optional(),
        /** `loggedAt` order. Defaults to `loggedAt:desc`. */
        sort: McpActivityAdminSortSchema.optional()
    })
    .strict();

/** TypeScript type inferred from {@link McpActivityAdminQuerySchema}. */
export type McpActivityAdminQuery = z.infer<typeof McpActivityAdminQuerySchema>;
