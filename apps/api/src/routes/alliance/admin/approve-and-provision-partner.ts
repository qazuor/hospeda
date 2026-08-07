/**
 * Admin partner approve-and-provision endpoint (HOS-278 §6.5)
 *
 * Approves a `partner` alliance lead AND materializes its `partners` row in one
 * action. A SEPARATE endpoint from `mark-handled`, not a flag on it (§6.5
 * OQ-1): approving a partner through `mark-handled` still provisions nothing,
 * so an admin can accept an application without standing up an organization —
 * which is what every partner approval did before this route existed.
 *
 * The partner is created DORMANT (`lifecycleState: DRAFT`, `subscriptionStatus`
 * at its `pending` default). Public visibility needs `ACTIVE` **and** `active`
 * together, so provisioning hands an account something to fill in, never a
 * published listing.
 *
 * @module routes/alliance/admin/approve-and-provision-partner
 */

import { AllianceLeadSchema, PartnerTierEnum, PermissionEnum } from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createAllianceDecisionNotifyPort } from '../../../lib/alliance-ports';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// Same construction as `mark-handled`: the decision notifier is what makes the
// applicant's email a guarantee rather than something the admin remembers to
// send. No claim-invite port — this route never creates a lead.
const allianceLeadService = new AllianceLeadService(
    { logger: apiLogger },
    null,
    createAllianceDecisionNotifyPort()
);

/**
 * Request body: the tier the admin is granting, plus an optional note.
 *
 * `tier` is required and has NO default. A default would silently pick a
 * commercial package on the admin's behalf, and the one it picked would be
 * indistinguishable afterwards from a tier somebody actually chose.
 *
 * Declared with `z.nativeEnum` rather than a local `z.enum([...])` copy because
 * this set is the SAME closed set as the `partners.tier` Postgres enum — a
 * hand-copied literal list here would drift the moment a tier is added.
 */
const ApproveAndProvisionPartnerBodySchema = z.object({
    /** Commercial tier granted to the partner (`bronze` | `silver` | `gold`). */
    tier: z.nativeEnum(PartnerTierEnum),
    /** Optional internal note from the admin explaining the decision. */
    adminNote: z.string().max(1000).optional()
});

/** Typed body for use inside the handler after the cast. */
type ApproveAndProvisionPartnerBody = z.infer<typeof ApproveAndProvisionPartnerBodySchema>;

/**
 * Response: the updated lead, the partner it points at, and whether THIS call
 * created it.
 *
 * `partnerId` is nullable rather than absent on the degraded path, so a client
 * can tell "approved, but you must build the partner by hand" apart from a
 * malformed response.
 */
const ApproveAndProvisionPartnerResponseSchema = z.object({
    /** The updated lead — `approved`, linked to the partner when one exists. */
    lead: AllianceLeadSchema,
    /** UUID of the provisioned partner, or null when the lead was too incomplete. */
    partnerId: z.string().uuid().nullable(),
    /** `true` when this call created the partner; `false` when it already existed. */
    provisioned: z.boolean()
});

/**
 * POST /api/v1/admin/alliance/leads/:id/approve-and-provision-partner
 *
 * Approves the lead and provisions its partner in one step.
 *
 * Status codes:
 * - `201` — approved, and provisioned (or already provisioned — idempotent).
 * - `400` — the lead is not a `partner` application.
 * - `403` — actor lacks `ALLIANCE_LEAD_MANAGE`.
 * - `404` — lead not found.
 *
 * A lead with no usable typed organization data returns `201` with
 * `partnerId: null` — it is approved, and the partner is left for the admin to
 * create by hand. That is a degraded outcome, not an error: refusing would
 * strand every partner lead submitted before the typed columns existed.
 */
export const adminApproveAndProvisionPartnerRoute = createAdminRoute({
    method: 'post',
    path: '/:id/approve-and-provision-partner',
    summary: 'Approve a partner lead and provision its partner (admin)',
    description:
        'Approves the specified partner alliance lead and materializes its partners row in a ' +
        'single action, at the tier the admin grants. The partner is created dormant (DRAFT + ' +
        'pending) and is not publicly visible until it pays. Idempotent — re-running never ' +
        'creates a second partner. Requires ALLIANCE_LEAD_MANAGE permission.',
    tags: ['Alliance'],
    requiredPermissions: [PermissionEnum.ALLIANCE_LEAD_MANAGE],
    requestParams: {
        id: z.string().uuid({ message: 'Lead ID must be a valid UUID' })
    },
    requestBody: ApproveAndProvisionPartnerBodySchema,
    responseSchema: ApproveAndProvisionPartnerResponseSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { tier, adminNote } = body as ApproveAndProvisionPartnerBody;

        const result = await allianceLeadService.approveAndProvisionPartner({
            actor,
            id: params.id as string,
            input: { tier, ...(adminNote === undefined ? {} : { adminNote }) }
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        return result.data!;
    }
});
