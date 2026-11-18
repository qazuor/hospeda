/**
 * Pure projection of `mcp.tool.call` audit rows into assistant activity
 * items (HOS-2335 §5.6). No I/O: the service gathers the lookups and this
 * module decides what each item shows.
 *
 * @module services/mcpActivity/projection
 */
import {
    type McpActivityItem,
    McpActivityOutcomeSchema,
    type McpActivityScope,
    type McpActivityTarget
} from '@repo/schemas';
import { z } from 'zod';

/** Listing verticals whose targets resolve to a name. */
export const MCP_ACTIVITY_LISTING_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** A vertical of {@link MCP_ACTIVITY_LISTING_VERTICALS}. */
export type McpActivityListingVertical = (typeof MCP_ACTIVITY_LISTING_VERTICALS)[number];

/** Target type of an inquiry: labelled by the UI ("Consulta"), never resolved. */
export const MCP_ACTIVITY_CONVERSATION_TARGET = 'conversation';

/**
 * What the reader takes from a row's `data` jsonb. Only these keys are ever
 * read; any other key in `data` (a future one included) never reaches an item.
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

/** The row fields the projection needs. */
export interface McpToolCallRow {
    readonly id: string;
    readonly loggedAt: Date;
    readonly actorId: string | null;
    readonly data: Record<string, unknown> | null;
}

/** A row whose `data` parsed. */
export interface ParsedMcpToolCallRow {
    readonly row: McpToolCallRow;
    readonly data: McpToolCallData;
}

/**
 * Parses a row's `data`. A row that does not parse (never written by the
 * binder) is `undefined`: the caller drops it rather than guess.
 *
 * @param input.row - The audit row.
 * @returns The parsed row, or `undefined`.
 */
export function parseMcpToolCallRow(input: {
    readonly row: McpToolCallRow;
}): ParsedMcpToolCallRow | undefined {
    const parsed = McpToolCallDataSchema.safeParse(input.row.data ?? {});
    return parsed.success ? { row: input.row, data: parsed.data } : undefined;
}

/**
 * `isWrite` of a row. A row recorded before reads were audited has no value
 * and is a write: only writes were recorded then (D-12).
 *
 * @param input.data - The parsed data.
 * @returns Whether the call wrote.
 */
export function resolveIsWrite(input: {
    readonly data: Pick<McpToolCallData, 'isWrite'>;
}): boolean {
    return input.data.isWrite ?? true;
}

/** Key of a listing lookup: `<vertical>:<id>`. */
export function listingKey(input: { readonly vertical: string; readonly id: string }): string {
    return `${input.vertical}:${input.id}`;
}

/** What the service looked up for one page. */
export interface McpActivityLookups {
    /** Registered client names by client id. */
    readonly clientNames: ReadonlyMap<string, string>;
    /** Live listings by {@link listingKey}: name and current owner. */
    readonly listings: ReadonlyMap<string, { readonly name: string; readonly ownerId: string }>;
    /** Live conversations by id: the owner of their accommodation. */
    readonly conversationOwners: ReadonlyMap<string, string>;
}

/** Builds the portal URL of a target the row's actor still owns. */
export type McpActivityTargetUrlBuilder = (input: {
    readonly target: { readonly type: string; readonly id: string };
}) => string | undefined;

/**
 * The target of an item. A listing gets its name and link only while the
 * row's actor owns it and it is live; a conversation gets its link only while
 * the actor owns its accommodation, and never a label. Anything else, or a
 * lost target, keeps its type and id only (AC-C47).
 */
function projectTarget(input: {
    readonly data: McpToolCallData;
    readonly actorId: string | null;
    readonly lookups: McpActivityLookups;
    readonly buildTargetUrl?: McpActivityTargetUrlBuilder;
}): McpActivityTarget | undefined {
    const { data, actorId, lookups, buildTargetUrl } = input;
    if (data.resourceType === undefined || data.resourceId === undefined) return undefined;
    const bare = { type: data.resourceType, id: data.resourceId };
    if (actorId === null) return bare;

    const listing = lookups.listings.get(listingKey({ vertical: bare.type, id: bare.id }));
    const owned =
        listing === undefined
            ? bare.type === MCP_ACTIVITY_CONVERSATION_TARGET &&
              lookups.conversationOwners.get(bare.id) === actorId
            : listing.ownerId === actorId;
    if (!owned) return bare;

    const url = buildTargetUrl?.({ target: bare });
    return {
        ...bare,
        ...(listing === undefined ? {} : { label: listing.name }),
        ...(url === undefined ? {} : { url })
    };
}

/**
 * Projects one parsed row into an item. The item is built field by field from
 * the allowlisted data keys, so nothing else in the row reaches a screen.
 *
 * @param input - The parsed row, the scope, the page lookups and the URL builder.
 * @returns The item.
 */
export function projectMcpActivityItem(input: {
    readonly parsed: ParsedMcpToolCallRow;
    readonly scope: McpActivityScope;
    readonly lookups: McpActivityLookups;
    readonly buildTargetUrl?: McpActivityTargetUrlBuilder;
}): McpActivityItem {
    const { parsed, scope, lookups, buildTargetUrl } = input;
    const { row, data } = parsed;
    const step = data.details?.step;
    const clientName = lookups.clientNames.get(data.clientId);
    const target = projectTarget({ data, actorId: row.actorId, lookups, buildTargetUrl });
    return {
        id: row.id,
        loggedAt: row.loggedAt,
        tool: data.tool,
        isWrite: resolveIsWrite({ data }),
        outcome: data.outcome,
        ...(data.errorCode === undefined ? {} : { errorCode: data.errorCode }),
        ...(typeof step === 'string' ? { step } : {}),
        client: { id: data.clientId, ...(clientName === undefined ? {} : { name: clientName }) },
        ...(target === undefined ? {} : { target }),
        ...(scope.kind === 'all' && row.actorId !== null ? { actorId: row.actorId } : {})
    };
}

/** What a page needs looked up, gathered from its parsed rows. */
export interface McpActivityLookupRequest {
    readonly clientIds: readonly string[];
    readonly listingIds: ReadonlyMap<McpActivityListingVertical, readonly string[]>;
    readonly conversationIds: readonly string[];
}

/**
 * Collects the distinct client ids, listing ids per vertical and conversation
 * ids of a page, so each lookup is one batched query.
 *
 * @param input.rows - The parsed rows of the page.
 * @returns The ids to look up.
 */
export function collectLookupRequest(input: {
    readonly rows: readonly ParsedMcpToolCallRow[];
}): McpActivityLookupRequest {
    const clientIds = new Set<string>();
    const conversationIds = new Set<string>();
    const listingIds = new Map<McpActivityListingVertical, Set<string>>();
    for (const { data } of input.rows) {
        clientIds.add(data.clientId);
        const { resourceType, resourceId } = data;
        if (resourceType === undefined || resourceId === undefined) continue;
        if (resourceType === MCP_ACTIVITY_CONVERSATION_TARGET) {
            conversationIds.add(resourceId);
            continue;
        }
        const vertical = MCP_ACTIVITY_LISTING_VERTICALS.find((v) => v === resourceType);
        if (vertical === undefined) continue;
        const ids = listingIds.get(vertical) ?? new Set<string>();
        ids.add(resourceId);
        listingIds.set(vertical, ids);
    }
    return {
        clientIds: [...clientIds],
        listingIds: new Map([...listingIds].map(([vertical, ids]) => [vertical, [...ids]])),
        conversationIds: [...conversationIds]
    };
}
