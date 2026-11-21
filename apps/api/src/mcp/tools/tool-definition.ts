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

import type { PortalDestination, PortalLocale } from '@repo/portal-routes';
import type { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { EmailUnverifiedAllowedOperation } from '@repo/verticals';
import type { z } from 'zod';

/**
 * Error code a tool may report. Every {@link ServiceErrorCode}, plus the
 * `RATE_LIMIT_EXCEEDED` literal the API's rate limiters already emit
 * (`middlewares/rate-limit.ts`), so a limiter refusal maps like any other,
 * plus the two answers a human can give to a confirmation form the model never
 * sees (HOS-2247): `USER_DECLINED` (declined, or left `confirm` unchecked) and
 * `USER_CANCELLED` (dismissed the form, or the client sent no answer).
 */
export type ToolErrorCode =
    | ServiceErrorCode
    | 'RATE_LIMIT_EXCEEDED'
    | 'USER_DECLINED'
    | 'USER_CANCELLED';

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
    /**
     * A portal destination where the user can resolve the refusal. A handler
     * names a DESTINATION, never a URL: the executor builds the URL from the
     * configured site URL, so no handler can emit an arbitrary link. Wins over
     * {@link ToolDefinition.refusalAction}, and is subject to the same rules
     * (none for transient errors, none that would confirm an id).
     */
    readonly link?: ToolRefusalLink;
    /** Id of the help topic that explains this refusal (`get_help`, HOS-2333). */
    readonly helpTopicId?: string;
    /**
     * Audit classification the handler knows better than the code does: a
     * `VALIDATION_ERROR` that is really a refusal by Hospeda (an incomplete
     * listing, HOS-2375) names `denied` so the history does not read it as bad
     * data from the assistant. Applied only together with a matching
     * `reasonMessages` entry; absent keeps the code's classification.
     */
    readonly kind?: 'denied' | 'error';
}

/** A portal page a refusal points the user to. */
export interface ToolAction {
    /** Absolute, locale-prefixed URL, built from the configured site URL. */
    readonly url: string;
    /** Spanish label of the link. */
    readonly label: string;
}

/**
 * What {@link ToolDefinition.refusalAction} answers: where a refusal should
 * point. The executor turns the destination into a URL, so a tool never builds
 * one and the "no id in a not-found answer" rule is enforced in one place.
 */
export interface ToolRefusalLink {
    /** The portal page. */
    readonly destination: PortalDestination;
    /** Spanish label; defaults to the destination's own. */
    readonly label?: string;
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
 * A confirmation the CLIENT must ask the human, out of the model's reach
 * (HOS-2247, spec §5.7). Neutral on purpose: only `lib/mcp/` turns it into an
 * MCP elicitation, so a tool never imports the SDK.
 */
export interface ToolConfirmationRequest {
    /** Spanish text the human reads: the exact preview of what will be written. */
    readonly message: string;
    /**
     * Opaque id of the bound record in the confirmation store. The client echoes
     * it back on the retry; it carries no data and is never trusted.
     */
    readonly stateId: string;
}

/** What a covered tool answers instead of a token preview on a capable client. */
export interface ToolNeedsConfirmation {
    readonly data?: never;
    readonly error?: never;
    readonly needsConfirmation: ToolConfirmationRequest;
}

/**
 * Everything a handler may resolve to: a {@link ToolHandlerResult}, or (only
 * when the context says the client can confirm out of band) a
 * {@link ToolNeedsConfirmation}. Kept apart from `ToolHandlerResult` so readers
 * and helpers typed on it keep their `data` xor `error` narrowing.
 */
export type ToolHandlerOutput<TData> = ToolHandlerResult<TData> | ToolNeedsConfirmation;

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
    /**
     * Whether the client can ask the human for a confirmation the model never
     * sees, and the human's answer when this call is the retry of one
     * (HOS-2247). Absent on channels and clients that cannot: those keep the
     * confirmation-token flow.
     */
    readonly confirmation?: ToolConfirmationContext;
    /**
     * The locale of the user's web pages (`users.settings.languageWeb`, `es` when
     * unset or unsupported), resolved once per call by the binding. Portal links
     * carry it as their prefix. Omitted means `es`.
     */
    readonly locale?: PortalLocale;
}

/** What the human answered on the client's confirmation form. */
export type ToolConfirmationDecision = 'confirm' | 'decline' | 'cancel';

/** The answer a retried call carries. Every field came from the client: untrusted. */
export interface ToolConfirmationAnswer {
    /** The state id the client echoed back. Validated only by the store lookup. */
    readonly stateId: string;
    /** The human's answer, already reduced to one of three values. */
    readonly decision: ToolConfirmationDecision;
}

/** Out-of-band confirmation facts of one call. */
export interface ToolConfirmationContext {
    /** The client declared, on this request, that it renders confirmation forms. */
    readonly elicitationSupported: boolean;
    /** Present when this call is the retry of a confirmation request. */
    readonly answer?: ToolConfirmationAnswer;
}

/**
 * A tool's out-of-band confirmation declaration. Every tool that issues a
 * confirmation token declares it (AC-C65, registry test).
 */
export interface ToolConfirmationDeclaration {
    /** The tool confirms through the client's form on a capable client. */
    readonly elicitation: true;
}

/** The single entity a call acts on, for the audit record. */
export interface ToolTarget {
    /** Entity kind, e.g. `accommodation`, `conversation`. */
    readonly type: string;
    /** Entity id. */
    readonly id: string;
}

/** Scalar facts a tool adds to its audit row (`details`). */
export type ToolAuditDetails = Readonly<Record<string, string | number | boolean>>;

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
     * Out-of-band confirmation (HOS-2247). Every tool whose input carries a
     * `confirmationToken` declares it; a registry test enforces it (AC-C65).
     */
    readonly confirmation?: ToolConfirmationDeclaration;
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
    /**
     * Where a refusal should point the user (HOS-2326): maps the failure's
     * code, reason and offending field to a portal page. Declared next to
     * {@link reasonMessages}. The executor calls it on every failure, including
     * a malformed call (then `input` is the RAW arguments, not validated ones, so
     * read it defensively). Return `undefined` when no page helps.
     *
     * The executor, not the tool, drops the link for transient errors
     * (`SERVICE_UNAVAILABLE`, rate limit, unexpected) and for a not-found answer
     * unless the destination names no id.
     */
    refusalAction?(args: {
        readonly error: ToolErrorPayload;
        readonly input: unknown;
    }): ToolRefusalLink | undefined;
    /** Entity the call targets, for the audit record. Read from validated input. */
    auditTarget?(args: { readonly input: z.output<TSchema> }): ToolTarget | undefined;
    /**
     * Entity a SUCCESSFUL call created, read from its result, for the audit
     * record (e.g. the listing `create_listing` just inserted, whose id the input
     * cannot carry). Wins over {@link auditTarget} on success; ignored on failure.
     * `data` is typed `unknown` on purpose: typing it `TData` would make this
     * optional callback an inference site for `TData` and break definitions that
     * spread another one; read it with a schema or a guard.
     */
    auditResultTarget?(args: {
        readonly input: z.output<TSchema>;
        readonly data: unknown;
    }): ToolTarget | undefined;
    /** Length of user content the call carries (never the content), for the audit record. */
    auditContentLength?(args: { readonly input: z.output<TSchema> }): number | undefined;
    /**
     * Extra scalar facts about the call for the audit row's `details` (e.g.
     * which step of a two-step tool this call was). Read from validated input,
     * so it also applies to calls that fail. Never put user content here.
     * `context` is the call's context (its confirmation facts tell an
     * out-of-band confirmation from a token one); `data` is the success
     * payload, absent on failures and confirmation requests (typed `unknown`
     * for the reason given on {@link auditResultTarget}).
     */
    auditDetails?(args: {
        readonly input: z.output<TSchema>;
        readonly context?: ToolContext;
        readonly data?: unknown;
    }): ToolAuditDetails | undefined;
    /**
     * The tool itself: a thin adapter over service-core. Receives validated
     * input and the caller's actor; must not know which transport serves it.
     * Only a tool declaring {@link confirmation} may resolve to a
     * {@link ToolNeedsConfirmation}, and only when `context.confirmation` says
     * the client can render it.
     */
    handler(args: {
        readonly actor: Actor;
        readonly input: z.output<TSchema>;
        readonly context: ToolContext;
    }): Promise<ToolHandlerOutput<TData>>;
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
