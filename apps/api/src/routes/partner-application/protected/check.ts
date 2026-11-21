import { PartnerClaimCheckRequestSchema, PartnerClaimCheckResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { checkPartnerClaimEmail } from '../../../services/partner-application/partner-link-claim.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory-tiered';

/**
 * Tells the signed-in account whether it matches the claim link's mailbox, so the
 * island can warn before the claim click. Answers a boolean only (HOS-2353).
 */
export const protectedPartnerClaimCheckRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    successStatusCode: 200,
    summary: 'Check a Partner claim link against the signed-in account',
    description:
        'Returns whether the signed-in account is the account of the claim link mailbox. Never returns the mailbox.',
    tags: ['Partner claims'],
    requestBody: PartnerClaimCheckRequestSchema,
    responseSchema: PartnerClaimCheckResponseSchema,
    emailUnverifiedOperation: 'VERIFY_EMAIL',
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const request = PartnerClaimCheckRequestSchema.parse(body);
        return checkPartnerClaimEmail({ actorUserId: actor.id, ...request });
    }
});
