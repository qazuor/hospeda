/**
 * Partner self-service endpoints for their OWN listing (HOS-278 D3).
 *
 * ```
 * GET   /api/v1/protected/partners/mine
 * PATCH /api/v1/protected/partners/mine
 * ```
 *
 * Both are gated on authentication ONLY — no `PARTNER_*` permission. That is
 * AC-7 and it is deliberate: an approved partner is an ordinary account, so
 * requiring `PARTNER_VIEW_ALL` (an admin perk) would lock them out of their own
 * ficha. The service scopes every read and write to `ownerUserId = actor.id`.
 *
 * Note the path carries no id. There is nothing to address but your own
 * listing, which is what makes "a partner cannot read or edit another's"
 * structural rather than a check.
 *
 * Actor-dependent, therefore NOT cacheable. No `cacheTTL`, and neither may be
 * moved to the public tier.
 *
 * @module routes/partners/protected/mine
 */

import { PartnerOwnerUpdateSchema, PartnerOwnerViewSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * Response shape for both endpoints.
 *
 * `partner` is nullable because owning no listing is an ordinary state, not an
 * error: a 404 would make "your application was approved but you have not
 * loaded anything yet" look like a broken page, and a 403 would confirm a
 * listing exists. The PATCH route never answers null — it 404s, because editing
 * something that does not exist IS a client mistake.
 */
const MyPartnerResponseSchema = z.object({
    partner: PartnerOwnerViewSchema.nullable()
});

/**
 * Handler for the read. Exported standalone so it is unit-testable against a
 * mocked `Context` without booting Hono.
 */
export async function handleGetMyPartner(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await partnerService.getOwn(actor);

    if (result.error) {
        // `getOwn` has no gated failure path — no permission check, and "no
        // partner" is null rather than an error — so an error here is something
        // unexpected. Failing beats answering null, which would read as "you
        // have no listing" on the one page whose job is showing it.
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { partner: result.data?.partner ?? null };
}

/** Handler for the edit. Exported standalone for the same reason. */
export async function handleUpdateMyPartner(ctx: Context, body: unknown) {
    const actor = getActorFromContext(ctx);

    const result = await partnerService.updateOwn(
        actor,
        body as Parameters<typeof partnerService.updateOwn>[1]
    );

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { partner: result.data?.partner ?? null };
}

/**
 * GET /api/v1/protected/partners/mine
 *
 * The caller's own partner listing, or `null`. Auth-only — see module
 * docstring for why no `PARTNER_*` permission is required.
 */
export const protectedGetMyPartnerRoute = createProtectedRoute({
    method: 'get',
    path: '/mine',
    summary: "Get the caller's own partner listing",
    description:
        'Returns the partner listing owned by the authenticated caller, or null when they own none — never 404, never 403. Auth-only; no PARTNER_* permission required, because an approved partner is an ordinary account (HOS-278 AC-7). Includes the pending content and its review state so the page can show what is still awaiting approval.',
    tags: ['Partners'],
    responseSchema: MyPartnerResponseSchema,
    handler: async (ctx: Context) => handleGetMyPartner(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});

/**
 * PATCH /api/v1/protected/partners/mine
 *
 * Edits the caller's own listing. Contact details and social links apply
 * immediately; a logo, description or website change is parked for admin review
 * (§6.3 step 4). Identity and commercial fields are absent from the request
 * schema, so they are stripped rather than rejected.
 */
export const protectedUpdateMyPartnerRoute = createProtectedRoute({
    method: 'patch',
    path: '/mine',
    summary: "Update the caller's own partner listing",
    description:
        'Updates the partner listing owned by the authenticated caller. Contact details and social links apply immediately and are merged with the stored values, so omitted keys are preserved. A logo, description or website change is stored as a pending edit and awaits admin review before the public sees it. Identity and commercial fields (name, slug, type, tier, plan, subscription, lifecycle) are not accepted and are silently discarded.',
    tags: ['Partners'],
    requestBody: PartnerOwnerUpdateSchema,
    responseSchema: MyPartnerResponseSchema,
    handler: async (ctx: Context, _params: unknown, body: unknown) =>
        handleUpdateMyPartner(ctx, body),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
