/**
 * DELETE /api/v1/protected/ai-connections?clientId=<encoded>
 *
 * Disconnects one AI assistant from the authenticated user's account: deletes
 * the user's consent and refresh tokens for that client, so its next `/mcp`
 * call answers 401 and it cannot refresh (AC-11). Other users of the same
 * client are untouched and the client itself is kept.
 *
 * The client id travels in the query string, not the path: CIMD client ids are
 * URLs, and a `%2F` in a path segment is rejected by some proxies (Traefik,
 * Cloudflare).
 *
 * A client the user has not connected answers 404, whether it is unknown or
 * connected only by somebody else, so the response never confirms that the id
 * exists.
 *
 * @route DELETE /api/v1/protected/ai-connections?clientId=<encoded>
 * @module routes/ai-connection/protected/revoke
 */
import { AiConnectionClientIdSchema } from '@repo/schemas';
import { AiConnectionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const aiConnectionService = new AiConnectionService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/ai-connections?clientId=<encoded>
 * Disconnect one AI assistant (owner-scoped). 204 on success.
 */
export const revokeAiConnectionRoute = createProtectedRoute({
    method: 'delete',
    path: '/',
    summary: 'Disconnect an AI assistant',
    description:
        "Revokes the authenticated user's access for one AI assistant. Its access tokens stop working immediately and it can no longer refresh. Returns 204 No Content; 404 when the user has no such connection. The client id is the `clientId` query parameter; a URL id must be percent-encoded.",
    tags: ['AI Connections'],
    requestQuery: { clientId: AiConnectionClientIdSchema },
    responseSchema: z.null(),
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    },
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const clientId = query?.clientId as string;

        const result = await aiConnectionService.revoke(actor, { clientId });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        auditLog({
            auditEvent: AuditEventType.MCP_CONNECTION_REVOKED,
            actorId: actor.id,
            resourceType: 'oauth_client',
            resourceId: clientId,
            removed: result.data?.removed ?? { consents: 0, refreshTokens: 0, accessTokens: 0 }
        });

        return undefined;
    }
});
