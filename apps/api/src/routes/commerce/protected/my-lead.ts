/**
 * Owner self-service "my lead" read endpoint (HOS-257).
 *
 * ```
 * GET /api/v1/protected/commerce/leads/mine
 * ```
 *
 * Returns the CALLER's own most-recent PROVISIONED `commerce_leads` row,
 * shaped for pre-filling the commerce create form
 * (`CommerceCreateForm.client.tsx`'s `prefill` prop). This is a **pre-fill
 * convenience, never a gate** (D-4 golden rule — see the module doc on
 * `CommerceLeadService.getMyLead` and `CommerceCreateForm.client.tsx`):
 *
 * - Gated on authentication ONLY — no `COMMERCE_*` permission is required.
 *   The caller can only ever read data scoped to their OWN
 *   `provisionedUserId`, so there is nothing an elevated permission would
 *   unlock.
 * - Degrades to `{ lead: null }` whenever the caller has no provisioned lead
 *   (the common case — most owners never went through the lead → admin
 *   approve-and-provision flow). NEVER throws/404s for "no lead" — that would
 *   turn a convenience into an accidental gate.
 * - The web layer (`nuevo/[vertical].astro`) MUST render a fully usable
 *   create form when this returns `{ lead: null }` (AC-10/AC-11) and MUST
 *   NOT import `CommerceLeadService`/`commerce_leads` directly — see the
 *   AC-14 static guard at
 *   `apps/web/test/static-guards/commerce-lead-isolation.test.ts`.
 *
 * @module routes/commerce/protected/my-lead
 */
import { CommerceLeadService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const commerceLeadService = new CommerceLeadService({ logger: apiLogger });

/**
 * Pre-fill-shaped subset of a `CommerceLead` row. Field names are already
 * mapped to the create form's field names (`businessName` → `name`) so the
 * web layer can pass the response straight into `CommerceCreateForm`'s
 * `prefill` prop without a translation step.
 */
const MyLeadDataSchema = z.object({
    /** Maps from `CommerceLead.businessName` — the create form's `name` field. */
    name: z.string(),
    /** `CommerceLead.destinationId`, when the applicant provided one. */
    destinationId: z.string().uuid().nullable(),
    /** `CommerceLead.contactName`. */
    contactName: z.string(),
    /** `CommerceLead.email`. */
    email: z.string(),
    /** `CommerceLead.phone`, when the applicant provided one. */
    phone: z.string().nullable()
});

/** Response schema — `lead: null` when the caller has no provisioned lead. */
const MyLeadResponseSchema = z.object({
    lead: MyLeadDataSchema.nullable()
});

/**
 * Handler for the "my lead" endpoint. Exported standalone (mirrors
 * `handleCreateGastronomyListing`/`handleCommerceStartSubscription`) so it is
 * unit-testable against a mocked `Context` + spied service without booting
 * the full Hono app.
 */
export async function handleGetMyLead(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await commerceLeadService.getMyLead(actor);

    if (result.error) {
        // getMyLead has no gated failure path (no permission check, no
        // NOT_FOUND — "no lead" is `null` data, not an error) — a non-null
        // error here means something unexpected (e.g. a DB error) surfaced.
        // Degrade to `{ lead: null }` rather than 500ing a pre-fill
        // convenience endpoint; log for visibility.
        apiLogger.warn(
            { userId: actor.id, error: result.error },
            '[commerce-my-lead] getMyLead returned an error; degrading to lead: null'
        );
        return { lead: null };
    }

    const lead = result.data;
    if (!lead) {
        return { lead: null };
    }

    return {
        lead: {
            name: lead.businessName,
            destinationId: lead.destinationId ?? null,
            contactName: lead.contactName,
            email: lead.email,
            phone: lead.phone ?? null
        }
    };
}

/**
 * GET /api/v1/protected/commerce/leads/mine
 *
 * Returns the caller's own most-recent provisioned lead, pre-fill-shaped.
 * Auth-only (no `COMMERCE_*` permission required) — see module docstring.
 */
export const protectedGetMyLeadRoute = createProtectedRoute({
    method: 'get',
    path: '/leads/mine',
    summary: 'Get my commerce lead (owner self-service pre-fill)',
    description:
        "Returns the authenticated caller's own most-recent provisioned commerce lead, shaped for the create-form pre-fill. Returns { lead: null } when the caller has no provisioned lead — never an error. Auth-only; no COMMERCE_* permission required.",
    tags: ['Commerce'],
    responseSchema: MyLeadResponseSchema,
    handler: async (ctx: Context) => handleGetMyLead(ctx),
    options: {
        cacheTTL: 30,
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});
