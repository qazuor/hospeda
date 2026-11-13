import { PartnerClaimRequestSchema, PartnerClaimResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { claimPartnerByLink } from '../../../services/partner-application/partner-link-claim.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory-tiered';

/** Claims a Partner using the single-use secret sent to its registered mailbox. */
export const protectedPartnerClaimRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    successStatusCode: 200,
    summary: 'Claim a Partner by link',
    description: 'Claims an approved Partner using its secret claim link.',
    tags: ['Partner claims'],
    requestBody: PartnerClaimRequestSchema,
    responseSchema: PartnerClaimResponseSchema,
    emailUnverifiedOperation: 'VERIFY_EMAIL',
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const request = PartnerClaimRequestSchema.parse(body);
        return claimPartnerByLink({
            actorUserId: actor.id,
            currentSessionId: ctx.get('session')?.id ?? null,
            ...request
        });
    }
});
