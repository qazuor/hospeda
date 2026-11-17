import { PartnerClaimSignUpRequestSchema, PartnerClaimSignUpResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { signUpAndClaimPartner } from '../../../services/partner-application/partner-claim-entry.service.js';
import { createPublicRoute } from '../../../utils/route-factory-tiered.js';

/** Creates a verified mailbox account and claims its Partner with one token. */
export const publicPartnerClaimSignUpRoute = createPublicRoute({
    method: 'post',
    path: '/',
    summary: 'Sign up and claim a Partner',
    description: 'Creates a verified account from a valid Partner claim link and claims it.',
    tags: ['Partner claims'],
    successStatusCode: 200,
    requestBody: PartnerClaimSignUpRequestSchema,
    responseSchema: PartnerClaimSignUpResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => signUpAndClaimPartner(PartnerClaimSignUpRequestSchema.parse(body))
});
