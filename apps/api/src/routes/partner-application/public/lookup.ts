import { PartnerClaimLookupRequestSchema, PartnerClaimLookupResponseSchema } from '@repo/schemas';
import type { Context } from 'hono';
import { lookupPartnerClaim } from '../../../services/partner-application/partner-claim-entry.service.js';
import { createPublicRoute } from '../../../utils/route-factory-tiered.js';

/** Looks up an account only after validating a Partner claim token. */
export const publicPartnerClaimLookupRoute = createPublicRoute({
    method: 'post',
    path: '/',
    successStatusCode: 200,
    summary: 'Look up a Partner claim account',
    description: 'Returns the mailbox account state for a valid Partner claim link.',
    tags: ['Partner claims'],
    requestBody: PartnerClaimLookupRequestSchema,
    responseSchema: PartnerClaimLookupResponseSchema,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => lookupPartnerClaim(PartnerClaimLookupRequestSchema.parse(body))
});
