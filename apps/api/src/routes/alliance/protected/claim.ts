/**
 * Alliance application claim endpoint (HOS-278 AC-4).
 *
 * ```
 * POST /api/v1/protected/alliance/leads/{id}/claim
 * ```
 *
 * Redeems the single-use token from a claim invitation email, linking an
 * anonymous application to the calling account. This is the ONLY way an
 * anonymous lead is ever linked to an existing account: the submitted email is
 * unverified, so matching on it alone would let anyone attach an application —
 * and whatever it carries — to someone else's account (R-1).
 *
 * - Auth-only, no `ALLIANCE_LEAD_*` permission: the token plus the caller's own
 *   email address ARE the authorization. A permission would gate the wrong
 *   thing — the person confirming is an ordinary user, not staff.
 * - Every rejection answers the same 404. Telling the caller whether the token
 *   was wrong, expired, or belonged to someone else would make this an oracle
 *   for which lead ids exist and who owns them.
 * - Actor-dependent, therefore NOT cacheable (spec §12).
 *
 * @module routes/alliance/protected/claim
 */

import {
    AllianceLeadClaimInputSchema,
    AllianceLeadKindEnum,
    AllianceLeadStatusEnum
} from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createAllianceClaimInvitePort } from '../../../lib/alliance-ports';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const allianceLeadService = new AllianceLeadService(
    { logger: apiLogger },
    createAllianceClaimInvitePort(env.HOSPEDA_SITE_URL)
);

/**
 * Request body: just the token. Derived from the canonical
 * {@link AllianceLeadClaimInputSchema} rather than re-declared, so the bound
 * the route advertises and the bound the service enforces cannot drift — `id`
 * is dropped because it travels in the path.
 */
const ClaimRequestSchema = AllianceLeadClaimInputSchema.omit({ id: true });

/**
 * Response shape — the same applicant-facing view `/leads/mine` returns, so the
 * account page can render the freshly-linked application without a second
 * round-trip. Deliberately excludes `adminNote`, the claim fields and the
 * account link.
 */
const ClaimResponseSchema = z.object({
    lead: z.object({
        id: z.string().uuid(),
        kind: AllianceLeadKindEnum,
        status: AllianceLeadStatusEnum,
        createdAt: z.coerce.date()
    })
});

/**
 * Handler for the claim endpoint. Exported standalone so it is unit-testable
 * against a mocked `Context` + spied service without booting the full app.
 */
export async function handleClaimAllianceLead(ctx: Context, params: Record<string, unknown>) {
    const actor = getActorFromContext(ctx);
    const body = (await ctx.req.json().catch(() => ({}))) as { token?: unknown };

    const result = await allianceLeadService.claimLead({
        actor,
        id: String(params.id ?? ''),
        token: typeof body.token === 'string' ? body.token : ''
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
    const lead = result.data!;

    return {
        lead: {
            id: lead.id,
            kind: lead.kind,
            status: lead.status,
            createdAt: lead.createdAt
        }
    };
}

/**
 * POST /api/v1/protected/alliance/leads/{id}/claim
 *
 * Confirms that an anonymous application belongs to the calling account.
 * Auth-only; no `ALLIANCE_LEAD_*` permission required — see module docstring.
 */
export const protectedClaimAllianceLeadRoute = createProtectedRoute({
    method: 'post',
    path: '/leads/{id}/claim',
    summary: 'Claim an alliance application',
    description:
        'Redeems the single-use token from a claim invitation email, linking the application to the calling account. Requires the caller to be signed in as the account that owns the address the invitation was sent to. Every rejection answers 404 — the endpoint never reveals whether the token was wrong, expired, or already used.',
    tags: ['Alliance'],
    requestParams: { id: z.string().uuid() },
    requestBody: ClaimRequestSchema,
    responseSchema: ClaimResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleClaimAllianceLead(ctx, params),
    options: {
        // Deliberately tight: this endpoint takes a secret, so the rate limit is
        // what stops someone grinding tokens against a known lead id.
        customRateLimit: { requests: 10, windowMs: 60_000 }
    }
});
