/**
 * The partner's own mentions log (HOS-377 T-017).
 *
 * ```
 * GET /api/v1/protected/partners/mine/mentions
 * ```
 *
 * Auth-only, no `PARTNER_*` permission — the same gate as `GET /mine`, and for
 * the same reason (HOS-278 AC-7): an approved partner is an ordinary account, so
 * demanding an admin perk would lock them out of their own log. Ownership IS the
 * gate, and it lives in `listForOwner`, which resolves the partner from
 * `ownerUserId = actor.id` and fails CLOSED — an actor with no real identity and
 * an actor who owns no partner both get an empty log, never a 403 that would
 * confirm a partner exists.
 *
 * Note the path carries no id. There is nothing to address but your own log,
 * which is what makes "a partner cannot read another's" structural rather than a
 * check that could be forgotten.
 *
 * `internalNote` and the audit authors are stripped by the SERVICE, not here, so
 * the guarantee travels with the data instead of depending on this route
 * remembering to omit them. This module deliberately does not re-omit anything:
 * a second, hand-maintained mask is how the two drift apart.
 *
 * Actor-dependent, therefore NOT cacheable. No `cacheTTL`, and it may never move
 * to the public tier.
 *
 * @module routes/partners/protected/mine-mentions
 */

import { partnerMentionBatchSchema } from '@repo/schemas';
import { PartnerMentionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const mentionService = new PartnerMentionService({ logger: apiLogger });

/**
 * Response shape.
 *
 * `batches` is an array and never null: owning no partner, or owning one with
 * nothing logged yet, are both ordinary states that render as an empty log. A
 * 404 would make "nothing has been promoted yet" look like a broken page.
 */
const MyMentionsResponseSchema = z.object({
    batches: z.array(partnerMentionBatchSchema)
});

/**
 * Handler for the read. Exported standalone so it is unit-testable against a
 * mocked `Context` without booting Hono, matching `handleGetMyPartner`.
 */
export async function handleGetMyMentions(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await mentionService.listForOwner(actor);

    if (result.error) {
        // `listForOwner` has no gated failure path — no permission check, and
        // "no partner" is an empty list rather than an error — so an error here
        // is something unexpected. Failing beats answering an empty log, which
        // would read as "nothing was ever promoted for you" on the one page
        // whose entire job is proving otherwise.
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { batches: result.data?.batches ?? [] };
}

/**
 * GET /api/v1/protected/partners/mine/mentions
 *
 * The caller's own log of manual promotion actions, grouped by submission and
 * newest promotion first.
 */
export const protectedGetMyMentionsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/mentions',
    summary: "Get the caller's own partner mentions log",
    description:
        'Returns the manual promotion actions logged for the partner listing owned by the authenticated caller, grouped by submission and newest promotion first. Empty when the caller owns no partner — never 404, never 403. Admin-only fields are absent from the payload. This is a verifiable record of actions taken, not campaign metrics.',
    tags: ['Partners'],
    responseSchema: MyMentionsResponseSchema,
    handler: async (ctx: Context) => handleGetMyMentions(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
