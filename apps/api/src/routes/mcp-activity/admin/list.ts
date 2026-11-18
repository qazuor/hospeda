/**
 * Admin log of every assistant use (HOS-2349, spec HOS-2335 §6.10).
 *
 * GET /api/v1/admin/mcp-activity — every user's MCP tool calls, newest first,
 * gated by `MCP_ACTIVITY_VIEW` (SUPER_ADMIN only, decision D-15; never a role
 * check, G6). It calls the ONE assistant activity reader shared with the
 * owner's history (D-14) with the scope injected here, `{ kind: 'all' }`,
 * never read from the request.
 *
 * Filters: `userId`, `tool` (`MCP_TOOL_NAMES`, the registered tool names: a
 * typo is a 400, AC-C53), `outcome`, `access` (read | write; absent = both, D-12), `clientId`,
 * `fromDate`, `toDate`. Sort: `loggedAt:desc` (default) or `loggedAt:asc`.
 * Unknown params are a 400 (the admin list factory).
 *
 * "Every use" is not literally every use (R-16): rate-limited calls, binder
 * crashes and dropped fire-and-forget inserts leave no row.
 *
 * @module routes/mcp-activity/admin/list
 */

import {
    McpActivityAdminQuerySchema,
    McpActivityItemSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { McpActivityService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

/**
 * Query of the admin log. `tool` is an enum of `MCP_TOOL_NAMES`, kept equal to
 * the API registry by `test/mcp/tool-names-registry.guard.test.ts`.
 */
export const AdminMcpActivityQuerySchema = McpActivityAdminQuerySchema;

/** Lazy singleton: reads are stateless. No portal URL builder: owner links are not staff links. */
const mcpActivityService = (() => {
    let instance: McpActivityService | null = null;
    return () => {
        if (!instance) instance = new McpActivityService({ logger: apiLogger });
        return instance;
    };
})();

/**
 * Splits the validated query into the reader's filter and its pagination.
 *
 * @param input.query - The query as the list factory validated it.
 * @returns The filter of the `all` scope and the page.
 */
export function toAllScopeArgs(input: { readonly query: Record<string, unknown> }) {
    const { page, pageSize } = extractPaginationParams(input.query);
    const { page: _page, pageSize: _pageSize, ...rest } = input.query;
    const { sort, ...filter } = AdminMcpActivityQuerySchema.parse(rest);
    const sortDirection = sort === 'loggedAt:asc' ? 'asc' : 'desc';
    return { filter: { ...filter, sortDirection }, page, pageSize } as const;
}

/** GET / */
export const listAdminMcpActivityRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List assistant (MCP) tool calls of every user',
    description:
        'Every user assistant tool call, newest first by default, from the audit log. ' +
        'Filter by user, tool, outcome, access (read/write), client and date range. ' +
        'Paginated via page + pageSize. Requires MCP_ACTIVITY_VIEW (SUPER_ADMIN only).',
    tags: ['MCP Activity'],
    requiredPermissions: [PermissionEnum.MCP_ACTIVITY_VIEW],
    requestQuery: AdminMcpActivityQuerySchema.shape,
    responseSchema: McpActivityItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { filter, page, pageSize } = toAllScopeArgs({ query: query ?? {} });
        const result = await mcpActivityService().list({
            actor,
            // The scope is route-injected, never client-supplied (D-14).
            scope: { kind: 'all' },
            filter,
            page,
            pageSize
        });
        if (result.error) {
            if (result.error.code === ServiceErrorCode.INTERNAL_ERROR) {
                apiLogger.error(result.error, 'list admin MCP activity failed');
            }
            throw new ServiceError(result.error.code, result.error.message);
        }
        return {
            items: result.data.items,
            pagination: getPaginationResponse(result.data.total, { page, pageSize })
        };
    }
});
