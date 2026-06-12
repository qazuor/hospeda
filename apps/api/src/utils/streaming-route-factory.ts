/**
 * SSE streaming route factory for AI text-generation endpoints.
 *
 * Kept in a separate file (not added to route-factory.ts) to mirror the
 * existing split between route-factory.ts and route-factory-tiered.ts —
 * each specialisation lives in its own file once the base factory would
 * exceed ~500 lines.
 *
 * **SSE frame protocol (owner-approved 2026-06-05)**:
 * ```
 * event: token
 * data: {"delta":"Hola"}
 *
 * event: done
 * data: {"usage":{…},"provider":"openai","model":"gpt-4o-mini","finishReason":"stop"}
 *
 * event: error
 * data: {"code":"MODERATION_BLOCKED","message":"Content policy violation"}
 * ```
 *
 * - `token` frames carry incremental text deltas.
 * - `done` is emitted once after the iterable drains cleanly (only when `meta`
 *   is provided and resolves).
 * - `error` is emitted when the iterable throws (mid-stream or post-drain
 *   output-moderation throw). The stream is then closed — no `done` follows.
 *
 * **Pre-stream errors** (thrown before the handler returns its stream) are
 * mapped to HTTP status codes via {@link mapAiEngineErrorToHttpStatus} and
 * returned as a regular JSON error envelope — no SSE response is sent.
 *
 * @module apps/api/utils/streaming-route-factory
 */

import { createRoute } from '@hono/zod-openapi';
import type { AiSearchChatFiltersEvent } from '@repo/schemas';
import type { PermissionEnum } from '@repo/schemas';
import type { Context, MiddlewareHandler } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ZodTypeAny } from 'zod';
import { protectedAuthMiddleware } from '../middlewares/authorization';
import { mapAiEngineErrorToHttpStatus } from './ai-error-mapper';
import { createRouter } from './create-app';
import { ResponseFactory } from './response-factory';
import { createErrorResponse, handleRouteError } from './response-helpers';
import type { RouteOptions } from './route-factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single streaming delta chunk emitted by the handler's async iterable.
 */
export interface StreamTextChunk {
    /** Incremental text fragment. */
    readonly delta: string;
}

/**
 * The value returned by `streamHandler` once the stream is available.
 *
 * `meta` is optional: when omitted the `done` frame is suppressed and the
 * stream ends silently after the last `token` frame.
 */
export interface StreamHandlerResult {
    /** Async iterable that yields delta chunks. May throw post-drain. */
    readonly stream: AsyncIterable<StreamTextChunk>;
    /** Resolves after the stream drains; its JSON is emitted as the `done` frame. */
    readonly meta?: Promise<unknown>;
    /**
     * Optional debug payload emitted as the very first SSE event (`debug`)
     * before any `token` frames. Used by the admin playground to display
     * the system prompt and accommodation context sent to the model.
     */
    readonly debug?: Record<string, unknown>;
    /**
     * Optional filters payload emitted as the second SSE event (`filters`)
     * after the `debug` event (if present) and before any `token` frames.
     *
     * Used by the conversational search route (SPEC-212 T-005) to deliver
     * URL-ready accommodation search params and the extracted intent to the
     * client immediately after `generateObject` resolves, so the UI can
     * render search results while the natural-language reply is still streaming.
     *
     * When absent the `filters` frame is suppressed — existing routes are unaffected.
     */
    readonly filters?: AiSearchChatFiltersEvent;
}

/**
 * Typed context passed to the user's `streamHandler`.
 *
 * Only the Hono context is exposed — the factory owns the SSE lifecycle.
 */
export interface StreamHandlerContext {
    readonly c: Context;
}

/**
 * Options for {@link createStreamingRoute}.
 */
export interface StreamingRouteOptions {
    /**
     * HTTP method. Defaults to `'post'` because SSE-over-fetch is consumed
     * via `POST` + `ReadableStream`; `EventSource` cannot POST.
     */
    readonly method?: 'post' | 'get';
    /** OpenAPI path (e.g. `/` or `/{id}/stream`). */
    readonly path: string;
    /** Short human-readable title for OpenAPI. */
    readonly summary: string;
    /** Longer description for OpenAPI. */
    readonly description: string;
    /** OpenAPI tags array. */
    readonly tags: string[];
    /**
     * Optional Zod schema for the request body.
     *
     * When provided the factory runs `safeParse` before invoking the handler.
     * An invalid body returns HTTP 400 with the standard JSON error envelope —
     * no SSE stream is started.
     */
    readonly requestSchema?: ZodTypeAny;
    /**
     * Passthrough options (rate limiting, custom middlewares, auth flags…)
     * mirroring the `options` field on {@link CreateOpenApiRouteInterface}.
     */
    readonly options?: RouteOptions;
    /**
     * Application logic that initiates the AI stream.
     *
     * Called AFTER body validation passes (when `requestSchema` is set).
     * May throw any error before returning; the factory maps AI engine errors
     * to the correct HTTP status and returns a JSON error envelope.
     *
     * @param ctx - Thin context wrapper exposing the Hono context.
     * @returns `{ stream, meta? }` — see {@link StreamHandlerResult}.
     */
    readonly streamHandler: (ctx: StreamHandlerContext) => Promise<StreamHandlerResult>;
}

// ---------------------------------------------------------------------------
// Safe error message helper
// ---------------------------------------------------------------------------

/**
 * Returns a safe, user-facing error message that never leaks internal details.
 *
 * For AI engine errors the message is a generic description of the code; for
 * all other errors it falls back to a static string so stack traces are never
 * serialised into SSE frames.
 */
const safeErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
        MODERATION_BLOCKED: 'Content policy violation — the request was blocked.',
        FEATURE_DISABLED: 'This AI feature is currently disabled.',
        FEATURE_NOT_CONFIGURED: 'This AI feature is not configured.',
        CEILING_HIT: 'AI cost ceiling reached. Try again later.',
        ENGINE_EXHAUSTED: 'All AI providers are temporarily unavailable.',
        NO_ENABLED_PROVIDER: 'No AI provider is currently enabled.',
        PROVIDER_UNCONFIGURED: 'AI service is temporarily unavailable.',
        INTERNAL_ERROR: 'An unexpected error occurred.'
    };
    return messages[code] ?? 'An unexpected error occurred.';
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a Hono sub-app that serves a single SSE streaming endpoint.
 *
 * The factory follows the same structural conventions as {@link createCRUDRoute}
 * and {@link createSimpleRoute}:
 *
 * 1. A fresh sub-app via `createRouter()`.
 * 2. Route-specific middleware applied via `applyRouteMiddlewares` (re-used
 *    through the inline helper below so we do not expose the private function).
 * 3. An OpenAPI route registered with `text/event-stream` 200 response (from
 *    `ResponseFactory.createStreamingResponses()`).
 * 4. The handler validates body, calls `streamHandler`, and returns
 *    `streamSSE(...)` directly (factories pass through `Response` instances).
 *
 * @example
 * ```ts
 * export const chatStreamRoute = createStreamingRoute({
 *   path: '/',
 *   summary: 'Stream AI chat response',
 *   description: 'Streams incremental text tokens via SSE.',
 *   tags: ['AI - Chat'],
 *   requestSchema: z.object({ prompt: z.string().min(1) }),
 *   streamHandler: async ({ c }) => {
 *     const { prompt } = await c.req.json();
 *     const result = await aiService.streamText({ feature: 'chat', prompt });
 *     return result;
 *   }
 * });
 * ```
 */
export const createStreamingRoute = (options: StreamingRouteOptions) => {
    const method = options.method ?? 'post';
    const app = createRouter();

    // Apply per-route auth/rate-limit/custom middlewares (same mechanic as
    // applyRouteMiddlewares in route-factory.ts — inline here to avoid
    // exporting a private helper from that module).
    // OpenAPI-style `{id}` params must be converted to Hono `:id` syntax,
    // otherwise `app.use()` would silently NOT match the route path and
    // middlewares (including auth) would be skipped.
    if (options.options?.middlewares) {
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        for (const mw of options.options.middlewares) {
            app.use(honoPath, mw);
        }
    }

    const route = createRoute({
        method,
        path: options.path,
        summary: options.summary,
        description: options.description,
        tags: options.tags,
        responses: ResponseFactory.createStreamingResponses()
    });

    // biome-ignore lint/suspicious/noExplicitAny: OpenAPIHono openapi() handler typing is not generic-safe here
    app.openapi(route as any, async (c) => {
        // --- Body validation ---
        if (options.requestSchema) {
            let rawBody: unknown;
            try {
                rawBody = await c.req.json();
            } catch {
                return createErrorResponse(
                    { code: 'VALIDATION_ERROR', message: 'Invalid or missing JSON body' },
                    c,
                    400
                );
            }

            const parsed = options.requestSchema.safeParse(rawBody);
            if (!parsed.success) {
                return createErrorResponse(
                    {
                        code: 'VALIDATION_ERROR',
                        message: 'Request body validation failed',
                        details: parsed.error.issues
                    },
                    c,
                    400
                );
            }
        }

        // --- Call the stream handler ---
        let handlerResult: StreamHandlerResult;
        try {
            handlerResult = await options.streamHandler({ c });
        } catch (err) {
            // Map known AI engine errors to HTTP status before any SSE bytes
            const aiMapping = mapAiEngineErrorToHttpStatus(err);
            if (aiMapping) {
                return createErrorResponse(
                    { code: aiMapping.code, message: safeErrorMessage(aiMapping.code) },
                    c,
                    aiMapping.status
                );
            }
            // Fall back to the standard route error handler for all other errors
            return handleRouteError(err, c);
        }

        // --- SSE lifecycle ---
        return streamSSE(c, async (sseStream) => {
            try {
                // Emit debug payload as the very first event (if present).
                if (handlerResult.debug !== undefined) {
                    await sseStream.writeSSE({
                        event: 'debug',
                        data: JSON.stringify(handlerResult.debug)
                    });
                }

                // Emit filters payload as a prelude event (if present), after
                // `debug` and before any `token` frames. Allows the client to
                // render search results while the NL reply is still streaming
                // (SPEC-212 T-005). Absent for all routes that don't set it.
                if (handlerResult.filters !== undefined) {
                    await sseStream.writeSSE({
                        event: 'filters',
                        data: JSON.stringify(handlerResult.filters)
                    });
                }

                for await (const chunk of handlerResult.stream) {
                    await sseStream.writeSSE({
                        event: 'token',
                        data: JSON.stringify({ delta: chunk.delta })
                    });
                }

                // Stream drained cleanly — emit done frame if meta is present
                if (handlerResult.meta !== undefined) {
                    const metaValue = await handlerResult.meta;
                    await sseStream.writeSSE({
                        event: 'done',
                        data: JSON.stringify(metaValue)
                    });
                }
            } catch (err) {
                // Handles mid-stream and post-drain throws (e.g. output moderation)
                const aiMapping = mapAiEngineErrorToHttpStatus(err);
                const code = aiMapping?.code ?? 'INTERNAL_ERROR';
                await sseStream.writeSSE({
                    event: 'error',
                    data: JSON.stringify({ code, message: safeErrorMessage(code) })
                });
            }
        });
    });

    return app;
};

// ---------------------------------------------------------------------------
// Protected variant options
// ---------------------------------------------------------------------------

/**
 * Options for {@link createProtectedStreamingRoute}.
 *
 * Extends {@link StreamingRouteOptions} with the same `requiredPermissions`
 * and `protectedTag` fields used by {@link createProtectedRoute}.
 */
export interface ProtectedStreamingRouteOptions extends StreamingRouteOptions {
    /** Permissions the authenticated actor must hold. */
    readonly requiredPermissions?: PermissionEnum[];
    /**
     * When `true` (default) prefixes each tag with `"Protected - "` to match
     * the naming convention of the other tier-aware factories.
     */
    readonly protectedTag?: boolean;
}

/**
 * Creates a protected SSE streaming route that requires an authenticated session.
 *
 * Injects `protectedAuthMiddleware(requiredPermissions)` before calling
 * {@link createStreamingRoute}, mirroring {@link createProtectedRoute}.
 *
 * Only the protected variant is provided (YAGNI — no current use case for
 * public or admin streaming routes).
 *
 * @example
 * ```ts
 * export const chatStreamRoute = createProtectedStreamingRoute({
 *   path: '/',
 *   summary: 'Stream AI chat response',
 *   description: 'Requires authentication.',
 *   tags: ['AI - Chat'],
 *   requiredPermissions: [PermissionEnum.AI_CHAT_USE],
 *   requestSchema: z.object({ prompt: z.string().min(1) }),
 *   streamHandler: async ({ c }) => {
 *     const { prompt } = await c.req.json();
 *     return aiService.streamText({ feature: 'chat', prompt });
 *   }
 * });
 * ```
 */
export const createProtectedStreamingRoute = (options: ProtectedStreamingRouteOptions) => {
    const { protectedTag = true, requiredPermissions, ...routeOptions } = options;

    const tags = protectedTag
        ? options.tags.map((tag) => (tag.startsWith('Protected') ? tag : `Protected - ${tag}`))
        : options.tags;

    const authMw: MiddlewareHandler = protectedAuthMiddleware(requiredPermissions);

    return createStreamingRoute({
        ...routeOptions,
        tags,
        options: {
            ...routeOptions.options,
            skipAuth: false,
            middlewares: [authMw, ...(routeOptions.options?.middlewares ?? [])]
        }
    });
};
