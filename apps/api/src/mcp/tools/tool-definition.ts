/**
 * @file tool-definition.ts
 * @description The transport-agnostic shape of a Hospeda assistant tool
 * (HOS-2184 T-012, spec §6.5 and §12).
 *
 * A tool is a plain function `({ actor, input, context }) → result` plus the
 * metadata every transport needs to expose it: name, description, Zod input
 * schema, read/write kind and the person-state operation. Nothing here imports
 * the MCP SDK: the MCP binding (`lib/mcp/bind-tool.ts`) is one thin consumer,
 * and the HOS-2185 WhatsApp agent is meant to be another, calling
 * `runTool`/`executeTool` (`run-tool.ts`) without MCP.
 */

import type { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { EmailUnverifiedAllowedOperation } from '@repo/verticals';
import type { z } from 'zod';

/**
 * Error code a tool may report. Every {@link ServiceErrorCode}, plus the
 * `RATE_LIMIT_EXCEEDED` literal the API's rate limiters already emit
 * (`middlewares/rate-limit.ts`), so a limiter refusal maps like any other.
 */
export type ToolErrorCode = ServiceErrorCode | 'RATE_LIMIT_EXCEEDED';

/**
 * Error payload a handler returns. Structurally a superset of the `error`
 * branch of `ServiceOutput<T>`, so a service result can be returned as is.
 */
export interface ToolErrorPayload {
    /** Machine-readable code; decides the user-facing message. */
    readonly code: ToolErrorCode;
    /** Internal message. Logged at most, never shown to the user. */
    readonly message: string;
    /** Structured details (validation field errors). */
    readonly details?: unknown;
    /** Machine-readable reason (`ServiceError.reason`). */
    readonly reason?: string;
}

/**
 * What a handler resolves to. Same discriminated shape as `ServiceOutput<T>`
 * (`data` xor `error`). A handler may also throw a `ServiceError`; the
 * executor maps both the same way.
 */
export type ToolHandlerResult<TData> =
    | { readonly data: TData; readonly error?: never }
    | { readonly data?: never; readonly error: ToolErrorPayload };

/**
 * The channel a tool call arrives through. Closed on purpose: HOS-2185 adds
 * its own member when it ships.
 */
export type ToolChannel = 'mcp';

/** Per-call context handed to a handler. Transport details stay out of it. */
export interface ToolContext {
    /** The channel serving the call. */
    readonly channel: ToolChannel;
    /**
     * The OAuth client the call comes through (MCP: the connector the user
     * authorized). Optional because other channels have none; tools that bind
     * something to the client (`reply_inquiry`'s confirmation token) refuse to
     * run without it.
     */
    readonly clientId?: string;
}

/** The single entity a call acts on, for the audit record. */
export interface ToolTarget {
    /** Entity kind, e.g. `accommodation`, `conversation`. */
    readonly type: string;
    /** Entity id. */
    readonly id: string;
}

/**
 * Behaviour hints for the client (MCP tool annotations). `readOnlyHint` is
 * not here: it is derived from {@link ToolDefinition.isWrite} so the two can
 * never disagree. `destructiveHint` and `idempotentHint` only mean something
 * on write tools.
 */
export interface ToolHints {
    /** The call may irreversibly hide or remove something (e.g. pausing a listing). */
    readonly destructiveHint?: boolean;
    /** Repeating the call with the same input has no further effect. */
    readonly idempotentHint?: boolean;
    /** The tool reaches outside Hospeda. Defaults to `false`. */
    readonly openWorldHint?: boolean;
}

/**
 * A Hospeda assistant tool.
 *
 * Callbacks use method syntax on purpose: it keeps their parameter types
 * bivariant, so a concrete `ToolDefinition<typeof schema, Data>` can sit in a
 * `readonly ToolDefinition[]` registry without casts.
 *
 * @template TSchema - Zod object schema of the input
 * @template TData - Success payload
 */
export interface ToolDefinition<TSchema extends z.ZodObject = z.ZodObject, TData = unknown> {
    /** Stable tool name (`snake_case`), e.g. `list_my_listings`. */
    readonly name: string;
    /** Short human title. */
    readonly title: string;
    /**
     * Model-facing description. Tools that return third-party text must say so
     * (append `UNTRUSTED_DATA_NOTICE` from `untrusted-data.ts`, spec §6.6).
     */
    readonly description: string;
    /** Input schema. Reuse `@repo/schemas` (`.pick()`), never a new shape. */
    readonly inputSchema: TSchema;
    /** `true` when the call changes data. Drives `readOnlyHint` and auditing. */
    readonly isWrite: boolean;
    /** Extra client hints. */
    readonly hints?: ToolHints;
    /**
     * The operation this tool performs in the email-verification allow-list
     * (`EMAIL_UNVERIFIED_ALLOWED_OPERATIONS`, `@repo/verticals`), exactly like
     * a route's `emailUnverifiedOperation`. Omit it and an unverified user is
     * refused: read tools that HTTP serves to unverified users declare
     * `READ_OWN`; ordinary writes declare nothing.
     */
    readonly emailUnverifiedOperation?: EmailUnverifiedAllowedOperation;
    /**
     * Spanish messages for specific `reason` values (e.g.
     * `MESSAGE_CONTENT_BLOCKED`), shown instead of the code's default message.
     */
    readonly reasonMessages?: Readonly<Record<string, string>>;
    /** Entity the call targets, for the audit record. Read from validated input. */
    auditTarget?(args: { readonly input: z.output<TSchema> }): ToolTarget | undefined;
    /** Length of user content the call carries (never the content), for the audit record. */
    auditContentLength?(args: { readonly input: z.output<TSchema> }): number | undefined;
    /**
     * The tool itself: a thin adapter over service-core. Receives validated
     * input and the caller's actor; must not know which transport serves it.
     */
    handler(args: {
        readonly actor: Actor;
        readonly input: z.output<TSchema>;
        readonly context: ToolContext;
    }): Promise<ToolHandlerResult<TData>>;
}

/**
 * Identity helper that infers a definition's generics from its schema and
 * handler.
 *
 * @param definition - The tool definition
 * @returns The same definition, fully typed
 *
 * @example
 * ```typescript
 * export const listMyListingsTool = defineTool({
 *     name: 'list_my_listings',
 *     title: 'Mis publicaciones',
 *     description: 'Lists the listings the user owns.',
 *     inputSchema: z.object({}).strict(),
 *     isWrite: false,
 *     emailUnverifiedOperation: 'READ_OWN',
 *     handler: async ({ actor }) => ({ data: await listOwn({ actor }) })
 * });
 * ```
 */
export function defineTool<TSchema extends z.ZodObject, TData>(
    definition: ToolDefinition<TSchema, TData>
): ToolDefinition<TSchema, TData> {
    return definition;
}
