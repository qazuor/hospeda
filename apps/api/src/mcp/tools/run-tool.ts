/**
 * @file run-tool.ts
 * @description Runs a tool definition for an actor, independent of the
 * transport (HOS-2184 T-012). {@link parseToolInput} validates raw arguments
 * (Spanish `VALIDATION_ERROR`); {@link executeTool} runs validated input.
 * {@link runTool} chains both for callers that need nothing in between (the
 * HOS-2185 agent); the MCP binding (`lib/mcp/bind-tool.ts`) calls the two
 * separately because it audits a malformed write call too.
 *
 * Order, mirroring a protected route:
 * 1. **Authentication.** A guest actor is refused (`UNAUTHORIZED`). Never
 *    reached over MCP (the bearer middleware builds a real actor); kept so a
 *    reused tool cannot run as nobody.
 * 2. **Person state (authorization step 2).** `resolvePersonStateStep` from
 *    `@repo/verticals` with the tool's `emailUnverifiedOperation`, the same
 *    predicate and allow-list `middlewares/authorization.ts` applies to
 *    routes. Bearer requests never pass through that middleware, so this is
 *    where an unverified user is stopped.
 * 3. **The handler.** Its returned or thrown error is mapped by
 *    `tool-errors.ts`. Anything else thrown is logged here and answered with
 *    the generic message: no stack or internal message leaves this module.
 */

import type { PortalLocale } from '@repo/portal-routes';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { resolvePersonStateStep } from '@repo/verticals';
import { z } from 'zod';
import { isGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { attachRefusalAction } from './refusal-action';
import type { ToolContext, ToolDefinition, ToolErrorPayload } from './tool-definition';
import {
    formatValidationMessage,
    type ToolFailure,
    toToolFailure,
    unexpectedToolFailure
} from './tool-errors';

/** Result of running a tool. */
export type ToolRunOutcome<TData> =
    | { readonly ok: true; readonly data: TData }
    | { readonly ok: false; readonly failure: ToolFailure };

/** Arguments for {@link executeTool}. RO-RO. */
export interface ExecuteToolArgs<TSchema extends z.ZodObject, TData> {
    /** The tool. */
    readonly definition: ToolDefinition<TSchema, TData>;
    /** The caller. */
    readonly actor: Actor;
    /** Input already validated against `definition.inputSchema`. */
    readonly input: z.output<TSchema>;
    /** Per-call context. */
    readonly context: ToolContext;
}

/** Logs a failure that has no specific mapping. Never throws. */
function logUnexpected(input: {
    readonly tool: string;
    readonly code: string;
    readonly error: unknown;
}): void {
    const { tool, code, error } = input;
    try {
        apiLogger.error(
            {
                tool,
                code,
                error: error instanceof Error ? error.message : String(error),
                ...(error instanceof Error && error.stack ? { stack: error.stack } : {})
            },
            'MCP tool failed unexpectedly'
        );
    } catch {
        // A logging failure must not change the tool result.
    }
}

/**
 * Maps a handler error, logs it when it has no specific mapping, and attaches
 * the portal link the tool declares for it (`refusal-action.ts`).
 */
function failWith(input: {
    readonly definition: Pick<ToolDefinition, 'name' | 'reasonMessages' | 'refusalAction'>;
    readonly error: ToolErrorPayload;
    readonly input: unknown;
    readonly cause: unknown;
    readonly locale: PortalLocale | undefined;
}): ToolFailure {
    const { definition, error, locale } = input;
    const failure = toToolFailure({ error, reasonMessages: definition.reasonMessages });
    if (failure.unexpected) {
        logUnexpected({ tool: definition.name, code: String(error.code), error: input.cause });
    }
    return attachRefusalAction({ failure, error, input: input.input, definition, locale });
}

/**
 * Runs a tool on validated input: authentication, person state, handler, and
 * error mapping. Never throws.
 *
 * @param args - Definition, actor, validated input and context
 * @returns The data, or a user-facing failure
 *
 * @example
 * ```typescript
 * const outcome = await executeTool({ definition, actor, input, context: { channel: 'mcp' } });
 * if (!outcome.ok) show(outcome.failure.message);
 * ```
 */
export async function executeTool<TSchema extends z.ZodObject, TData>({
    definition,
    actor,
    input,
    context
}: ExecuteToolArgs<TSchema, TData>): Promise<ToolRunOutcome<TData>> {
    const { name } = definition;

    if (isGuestActor(actor)) {
        return {
            ok: false,
            failure: toToolFailure({
                error: { code: ServiceErrorCode.UNAUTHORIZED, message: 'Guest actor' }
            })
        };
    }

    const personState = resolvePersonStateStep({
        emailVerified: actor.emailVerified,
        operation: definition.emailUnverifiedOperation
    });
    if (!personState.allowed) {
        return {
            ok: false,
            failure: toToolFailure({
                error: { code: ServiceErrorCode.EMAIL_NOT_VERIFIED, message: personState.reason }
            })
        };
    }

    try {
        const result = await definition.handler({ actor, input, context });
        if (result.error) {
            return {
                ok: false,
                failure: failWith({
                    definition,
                    error: result.error,
                    input,
                    cause: result.error,
                    locale: context.locale
                })
            };
        }
        return { ok: true, data: result.data as TData };
    } catch (error) {
        if (error instanceof ServiceError) {
            const payload: ToolErrorPayload = {
                code: error.code,
                message: error.message,
                details: error.details,
                reason: error.reason
            };
            return {
                ok: false,
                failure: failWith({
                    definition,
                    error: payload,
                    input,
                    cause: error,
                    locale: context.locale
                })
            };
        }
        logUnexpected({ tool: name, code: 'UNEXPECTED', error });
        return { ok: false, failure: unexpectedToolFailure() };
    }
}

/**
 * Spanish issue texts ("Valor inválido: …") for tool input. Passed per parse,
 * never through `z.config`, so the rest of the API process keeps Zod's
 * defaults. A message a schema sets itself still wins over this map. Exported
 * for schemas that validate a nested value themselves (a per-vertical
 * refinement), so those issues read in Spanish too.
 */
export const SPANISH_PARSE_PARAMS = { error: z.locales.es().localeError } as const;

/** Arguments for {@link parseToolInput}. RO-RO. */
export interface ParseToolInputArgs<TSchema extends z.ZodObject> {
    /** The tool. `name` and `refusalAction` are optional: without them the failure has no link. */
    readonly definition: Pick<ToolDefinition<TSchema>, 'inputSchema'> &
        Partial<Pick<ToolDefinition<TSchema>, 'name' | 'refusalAction'>>;
    /** Raw input (e.g. a model's tool-call arguments). */
    readonly input: unknown;
    /** Locale prefix of the refusal link. Defaults to `es`. */
    readonly locale?: PortalLocale;
}

/**
 * Validates raw input against a tool's schema. Field problems are reported
 * in the same Spanish format as a service `VALIDATION_ERROR`. The tool's
 * `refusalAction` runs here too, over the zod issues and the RAW input, so a
 * field the tool refuses by schema (`update_listing_basic` and `name`) still
 * points at the page that handles it.
 *
 * @param args - Definition and raw input
 * @returns The parsed input, or a validation failure
 */
export function parseToolInput<TSchema extends z.ZodObject>({
    definition,
    input,
    locale
}: ParseToolInputArgs<TSchema>):
    | { readonly ok: true; readonly input: z.output<TSchema> }
    | { readonly ok: false; readonly failure: ToolFailure } {
    const parsed = definition.inputSchema.safeParse(input ?? {}, SPANISH_PARSE_PARAMS);
    if (parsed.success) {
        return { ok: true, input: parsed.data };
    }
    const error: ToolErrorPayload = {
        code: ServiceErrorCode.VALIDATION_ERROR,
        message: 'Invalid tool input',
        details: parsed.error.issues
    };
    const failure: ToolFailure = {
        kind: 'error',
        code: ServiceErrorCode.VALIDATION_ERROR,
        message: formatValidationMessage({ details: parsed.error.issues }),
        requiresReauthentication: false,
        unexpected: false
    };
    return {
        ok: false,
        failure: attachRefusalAction({
            failure,
            error,
            input,
            definition: {
                name: definition.name ?? 'unknown_tool',
                refusalAction: definition.refusalAction
            },
            locale
        })
    };
}

/** Arguments for {@link runTool}. RO-RO. */
export interface RunToolArgs<TSchema extends z.ZodObject, TData>
    extends Omit<ExecuteToolArgs<TSchema, TData>, 'input'> {
    /** Raw, unvalidated input. */
    readonly input: unknown;
}

/**
 * Validates raw input, then {@link executeTool}. For callers whose transport
 * does not validate tool arguments itself. Never throws.
 *
 * @param args - Definition, actor, raw input and context
 * @returns The data, or a user-facing failure
 */
export async function runTool<TSchema extends z.ZodObject, TData>({
    definition,
    actor,
    input,
    context
}: RunToolArgs<TSchema, TData>): Promise<ToolRunOutcome<TData>> {
    const parsed = parseToolInput({ definition, input, locale: context.locale });
    if (!parsed.ok) {
        return parsed;
    }
    return executeTool({ definition, actor, input: parsed.input, context });
}
