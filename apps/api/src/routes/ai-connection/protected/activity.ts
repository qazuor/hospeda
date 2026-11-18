/**
 * GET /api/v1/protected/ai-connections/activity
 *
 * The owner's history of what their AI assistants did on their behalf
 * (HOS-2348, spec HOS-2335 §6.9). One page of `mcp.tool.call` audit rows,
 * newest first, already projected by the shared reader.
 *
 * - **Scope.** The route injects `scope: { kind: 'own' }`; the reader then
 *   takes the user from the session actor. No input can name another user:
 *   the query is strict, so a `userId`, `actorId` or `scope` param answers 400
 *   (AC-C45, AC-C54). The reader is the same `McpActivityService.list` the
 *   admin log uses (decision D-14).
 * - **Reads toggle (D-12).** `includeReads` absent or `false` lists writes
 *   only; `true` lists reads too ("mostrar también consultas").
 * - **Link language.** `locale` (`es|en|pt`) is the language the web page is
 *   rendered in; the target links are built with it (owner decision
 *   2026-11-18, HOS-2348). Absent builds `es` links.
 * - **Privacy.** Items are allowlist-projected by the reader and validated
 *   against the strict owner item schema, so a key outside the allowlist fails
 *   the response instead of reaching the owner (AC-C46). A target the user no
 *   longer owns, or that was deleted, carries no label and no link (AC-C47).
 *
 * Deliberately NOT behind `HOSPEDA_MCP_ENABLED`, like the rest of the AI
 * connection routes: an owner can review past actions with the feature off.
 *
 * @route GET /api/v1/protected/ai-connections/activity
 * @module routes/ai-connection/protected/activity
 */
import {
    McpActivityOwnItemSchema,
    type McpActivityOwnQuery,
    McpActivityOwnQuerySchema,
    toMcpActivityOwnFilter
} from '@repo/schemas';
import { McpActivityService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { buildActivityTargetUrl } from '../../../mcp/portal/activity-target-url';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

let ownActivityReader: McpActivityService | undefined;

/**
 * The shared assistant activity reader, wired with the portal link builder.
 * Built on first use, so loading the router touches no model. Exported so a
 * test can prove the owner route and the admin route call the very same
 * reader (AC-C54).
 *
 * @returns The reader instance this route calls
 */
export function getOwnActivityReader(): McpActivityService {
    ownActivityReader ??= new McpActivityService(
        { logger: apiLogger },
        {
            buildTargetUrl: ({ target, locale }) =>
                buildActivityTargetUrl({ target, siteUrl: env.HOSPEDA_SITE_URL, locale })
        }
    );
    return ownActivityReader;
}

/**
 * Lists the session actor's assistant activity. Exported standalone for
 * testability.
 *
 * @param ctx - Hono context (carries the session actor)
 * @param query - The validated query
 * @returns The page of items and its pagination
 * @throws {ServiceError} When the reader fails
 */
export async function handleListOwnActivity(ctx: Context, query: McpActivityOwnQuery) {
    const actor = getActorFromContext(ctx);
    const { page, pageSize, locale, ...filterQuery } = query;

    const result = await getOwnActivityReader().list({
        actor,
        scope: { kind: 'own' },
        filter: toMcpActivityOwnFilter({ query: filterQuery }),
        page,
        pageSize,
        locale
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return {
        items: result.data?.items ?? [],
        pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
    };
}

/**
 * GET /api/v1/protected/ai-connections/activity
 * The actor's own assistant activity.
 */
export const listOwnAiActivityRoute = createProtectedListRoute({
    method: 'get',
    path: '/activity',
    summary: 'List what your AI assistants did',
    description:
        'Returns the calls your connected AI assistants made on your behalf, newest first, at most 20 per page. Writes only by default; includeReads=true adds read-only calls. Only your own calls are ever returned: a userId, actorId or any other unknown parameter answers 400.',
    tags: ['AI Connections'],
    requestQuery: McpActivityOwnQuerySchema.shape,
    responseSchema: McpActivityOwnItemSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => handleListOwnActivity(ctx, McpActivityOwnQuerySchema.parse(query ?? {})),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
