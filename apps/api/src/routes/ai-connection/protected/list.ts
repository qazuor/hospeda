/**
 * GET /api/v1/protected/ai-connections
 *
 * Lists the AI assistants (OAuth clients) the authenticated user has connected
 * to the MCP server.
 *
 * `name`, `uri` and `logoUri` are client-declared and untrusted: clients
 * register themselves through the public registration endpoint.
 *
 * @route GET /api/v1/protected/ai-connections
 * @module routes/ai-connection/protected/list
 */
import { AiConnectionListSchema } from '@repo/schemas';
import { AiConnectionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const aiConnectionService = new AiConnectionService({ logger: apiLogger });

/**
 * GET /api/v1/protected/ai-connections
 * List the actor's connected AI assistants.
 */
export const listAiConnectionsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List connected AI assistants',
    description:
        'Returns the AI assistants the authenticated user has connected, oldest first, with the connection date and an approximate last-use time.',
    tags: ['AI Connections'],
    responseSchema: AiConnectionListSchema,
    options: {
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await aiConnectionService.list(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { items: result.data?.items ?? [] };
    }
});
