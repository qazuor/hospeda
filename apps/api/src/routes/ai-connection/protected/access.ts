/**
 * GET /api/v1/protected/ai-connections/access
 *
 * Whether the session user may use the AI assistant (HOS-2184 phase B, T-041),
 * decided by the same `resolveAiAssistantAccess` the MCP tools run on every
 * call, so the panel can never promise what the tools would refuse.
 *
 * - granted, or not gated (no plan in any owner vertical) → `{ hasAccess: true }`;
 * - refused (the owner's plans do not include it) → `{ hasAccess: false }`;
 * - undecidable (an effective set or coverage read failed) → 503
 *   `SERVICE_UNAVAILABLE`, never a `false` the panel would show as an upsell.
 *
 * @route GET /api/v1/protected/ai-connections/access
 * @module routes/ai-connection/protected/access
 */
import { AiAssistantAccessResponseSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { resolveAiAssistantAccess } from '../../../mcp/access/ai-assistant-access';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/protected/ai-connections/access
 * Whether the actor may use the AI assistant.
 */
export const getAiAssistantAccessRoute = createProtectedRoute({
    method: 'get',
    path: '/access',
    summary: 'Whether the user may use the AI assistant',
    description:
        'Returns whether the AI assistant tools answer the authenticated user, decided by the ai_assistant_access entitlement of their plans exactly as the tools decide it.',
    tags: ['AI Connections'],
    responseSchema: AiAssistantAccessResponseSchema,
    options: {
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const access = await resolveAiAssistantAccess({ userId: actor.id });

        if (access.kind === 'UNAVAILABLE') {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'AI assistant access could not be decided'
            );
        }

        return { hasAccess: access.hasAccess };
    }
});
