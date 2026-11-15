/**
 * @file caller.ts
 * @description Carries the Hospeda caller of an MCP request from the Hono
 * context into the MCP SDK, and back out inside a tool (HOS-2184 T-010).
 *
 * `mcpAuthMiddleware` (`middlewares/mcp-auth.ts`) verifies the bearer token and
 * sets `actor` and `mcpAuth` on the Hono context. The SDK never sees that
 * context: its only per-request channel is the `authInfo` handed to
 * `handler.fetch`, which it passes through untouched to tool handlers as
 * `ctx.http.authInfo`. So the route packs the caller into
 * `authInfo.extra` with {@link buildMcpAuthInfo}, and tools unpack it with
 * {@link getMcpCaller}.
 *
 * Tools MUST take the caller from {@link getMcpCaller}, never from
 * `c.get('user')`/`c.get('session')`: those come from a browser cookie the
 * request may also carry, and an MCP call acts only as the token's subject.
 */

import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Actor } from '@repo/service-core';
import type { McpAuthContext } from '../../types';

/** Key under `AuthInfo.extra` holding the {@link McpCaller}. */
export const MCP_CALLER_EXTRA_KEY = 'hospeda';

/** The Hospeda caller of an MCP request. */
export interface McpCaller {
    /** Actor built from the token subject, like the session actor. */
    readonly actor: Actor;
    /** The OAuth grant behind the request. */
    readonly mcpAuth: McpAuthContext;
}

/** Arguments for {@link buildMcpAuthInfo}. RO-RO. */
export interface BuildMcpAuthInfoArgs {
    /** The verified access token (required by the SDK's `AuthInfo`). Never log it. */
    readonly token: string;
    /** `c.get('actor')`, set by `mcpAuthMiddleware`. */
    readonly actor: Actor;
    /** `c.get('mcpAuth')`, set by `mcpAuthMiddleware`. */
    readonly mcpAuth: McpAuthContext;
    /** `HOSPEDA_MCP_RESOURCE_URL`, the audience the token was verified against. */
    readonly resourceUrl: string;
}

/**
 * Builds the SDK `authInfo` of a verified MCP request.
 *
 * @param args - Token, actor, grant and resource URL
 * @returns The `AuthInfo` to pass to `handler.fetch`
 *
 * @example
 * ```typescript
 * handler.fetch(c.req.raw, {
 *     authInfo: buildMcpAuthInfo({ token, actor, mcpAuth, resourceUrl })
 * });
 * ```
 */
export function buildMcpAuthInfo({
    token,
    actor,
    mcpAuth,
    resourceUrl
}: BuildMcpAuthInfoArgs): AuthInfo {
    const caller: McpCaller = { actor, mcpAuth };
    return {
        token,
        clientId: mcpAuth.clientId,
        scopes: [...mcpAuth.scopes],
        resource: new URL(resourceUrl),
        extra: { [MCP_CALLER_EXTRA_KEY]: caller }
    };
}

/**
 * The part of the SDK's tool context this module reads. Structural, so tools
 * can pass their `ctx` as is and tests can pass a literal.
 */
export interface McpCallerSource {
    readonly http?: { readonly authInfo?: AuthInfo };
}

/** Arguments for {@link getMcpCaller}. RO-RO. */
export interface GetMcpCallerArgs {
    /** The tool handler's context (`ctx`). */
    readonly ctx: McpCallerSource;
}

/** Narrows an unknown value to an {@link McpCaller}. */
function isMcpCaller(value: unknown): value is McpCaller {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const { actor, mcpAuth } = value as { readonly actor?: unknown; readonly mcpAuth?: unknown };
    return (
        typeof actor === 'object' &&
        actor !== null &&
        typeof (actor as { readonly id?: unknown }).id === 'string' &&
        typeof mcpAuth === 'object' &&
        mcpAuth !== null &&
        typeof (mcpAuth as { readonly clientId?: unknown }).clientId === 'string'
    );
}

/**
 * Returns the Hospeda caller of the MCP request a tool is serving.
 *
 * @param args - The tool handler's context
 * @returns The caller's actor and OAuth grant
 * @throws Error when the context carries no caller. Every `/mcp` request goes
 *   through `mcpAuthMiddleware`, so this means the endpoint was wired without
 *   it; failing loudly beats running a tool as nobody.
 *
 * @example
 * ```typescript
 * server.registerTool('list_my_listings', config, async (ctx) => {
 *     const { actor, mcpAuth } = getMcpCaller({ ctx });
 *     // ...
 * });
 * ```
 */
export function getMcpCaller({ ctx }: GetMcpCallerArgs): McpCaller {
    const candidate = ctx.http?.authInfo?.extra?.[MCP_CALLER_EXTRA_KEY];
    if (!isMcpCaller(candidate)) {
        throw new Error('MCP request has no authenticated Hospeda caller');
    }
    return candidate;
}
