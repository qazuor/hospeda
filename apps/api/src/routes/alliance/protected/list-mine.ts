/**
 * Applicant self-service "my applications" endpoint (HOS-278 AC-5).
 *
 * ```
 * GET /api/v1/protected/alliance/leads/mine
 * ```
 *
 * Returns the CALLER's own alliance applications, newest first, so
 * `/mi-cuenta/aliados` can show the real state of each one (AC-14) instead of
 * a static discovery hub.
 *
 * - Gated on authentication ONLY — no `ALLIANCE_LEAD_*` permission. The read is
 *   scoped to the caller's own `applicantUserId`, so there is nothing an
 *   elevated permission would unlock, and requiring one would lock out exactly
 *   the applicants the page exists for.
 * - Having no applications is the COMMON case, so it answers `[]` — never a
 *   404, never a 403 (AC-5).
 * - Actor-dependent, therefore NOT cacheable (spec §12). No `cacheTTL`, and
 *   nothing here may be moved to the public tier.
 * - `adminNote` is deliberately absent from the response: it is the admin's
 *   INTERNAL note on the disposition, not a message to the applicant.
 *
 * @module routes/alliance/protected/list-mine
 */

import { AllianceLeadKindEnum, AllianceLeadStatusEnum } from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const allianceLeadService = new AllianceLeadService({ logger: apiLogger });

/**
 * Applicant-facing view of one of their own applications.
 *
 * Intentionally narrower than `AllianceLeadSchema` — it carries only what the
 * account page renders. The response schema is a fail-closed strip filter, so
 * anything not declared here (admin notes, the account link, claim fields)
 * cannot reach the client even if the service starts returning it.
 */
const MyAllianceLeadSchema = z.object({
    /** Lead UUID. */
    id: z.string().uuid(),
    /** Which of the four programs was applied to. */
    kind: AllianceLeadKindEnum,
    /** Where the application currently stands. */
    status: AllianceLeadStatusEnum,
    /** When the application was submitted. */
    createdAt: z.coerce.date()
});

/** Response schema — an empty array when the caller has never applied. */
const MyAllianceLeadsResponseSchema = z.object({
    leads: z.array(MyAllianceLeadSchema)
});

/**
 * Handler for the "my applications" endpoint. Exported standalone (mirroring
 * `handleGetMyLead`) so it is unit-testable against a mocked `Context` + spied
 * service without booting the full Hono app.
 */
export async function handleListMyAllianceLeads(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const result = await allianceLeadService.listMine({ actor });

    if (result.error) {
        // `listMine` has no gated failure path — no permission check, and "no
        // applications" is `[]` rather than an error — so a non-null error here
        // means something unexpected surfaced (e.g. a DB error). Fail the
        // request rather than answering `[]`: a silent empty list would read as
        // "you never applied", which is a worse lie than an error banner on a
        // page whose entire job is reporting application state.
        throw new ServiceError(result.error.code, result.error.message);
    }

    return {
        leads: (result.data ?? []).map((lead) => ({
            id: lead.id,
            kind: lead.kind,
            status: lead.status,
            createdAt: lead.createdAt
        }))
    };
}

/**
 * GET /api/v1/protected/alliance/leads/mine
 *
 * Returns the authenticated caller's own alliance applications. Auth-only; no
 * `ALLIANCE_LEAD_*` permission required — see module docstring.
 */
export const protectedListMyAllianceLeadsRoute = createProtectedRoute({
    method: 'get',
    path: '/leads/mine',
    summary: 'List my alliance applications',
    description:
        "Returns the authenticated caller's own alliance applications (partner, sponsor, editor, service_provider), newest first. Returns an empty array when the caller has never applied — never 404, never 403. Auth-only; no ALLIANCE_LEAD_* permission required.",
    tags: ['Alliance'],
    responseSchema: MyAllianceLeadsResponseSchema,
    handler: async (ctx: Context) => handleListMyAllianceLeads(ctx),
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
