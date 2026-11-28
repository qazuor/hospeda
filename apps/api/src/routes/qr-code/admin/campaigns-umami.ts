/**
 * QR campaigns in Umami (HOS-2679 PR 2).
 *
 * ```
 * GET  /api/v1/admin/qr-codes/campaigns/umami
 * POST /api/v1/admin/qr-codes/campaigns/umami-segment   { campaign }
 * ```
 *
 * GET lists every QR campaign with its live code count and its state in Umami
 * (segment `QR · <campaign>` present, missing, or unknown). It never fails
 * because of Umami: an unconfigured or unreachable Umami turns every row
 * `unavailable` and the page still renders.
 *
 * POST creates the campaign's segment when absent and returns the existing one
 * otherwise: 201 with `created: true` the first time, 200 with `created: false`
 * on every later call (idempotent, never a duplicate).
 * Refusals, in order: 403 (route permissions) → 400 (strict body) → 404 (not a
 * QR campaign) → 503 `SERVICE_UNAVAILABLE` with reason
 * `UMAMI_WRITE_NOT_CONFIGURED`, `UMAMI_KEY_REJECTED` or `UMAMI_UNAVAILABLE`.
 *
 * Both literal paths are registered BEFORE `/{id}`.
 *
 * @module routes/qr-code/admin/campaigns-umami
 */

import {
    PermissionEnum,
    QrCampaignsUmamiResponseSchema,
    QrCampaignUmamiSegmentCreateSchema,
    QrCampaignUmamiSegmentResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import {
    ensureQrCampaignSegment,
    type QrCampaignCount,
    readQrCampaignUmamiConfig,
    resolveQrCampaignsUmami
} from '../../../services/qr-campaign-umami';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/** Reads the campaigns with their counts, rethrowing a service error. */
async function loadCampaignCounts(ctx: Context): Promise<readonly QrCampaignCount[]> {
    const actor = getActorFromContext(ctx);
    const result = await qrCodeService.listUtmCampaignCounts({ actor });
    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message, result.error.details);
    }
    return result.data?.items ?? [];
}

/** GET /api/v1/admin/qr-codes/campaigns/umami */
export const adminListQrCampaignsUmamiRoute = createAdminRoute({
    method: 'get',
    path: '/campaigns/umami',
    summary: 'List QR campaigns with their Umami state (admin)',
    description:
        'Returns every QR campaign with its live code count, a link to the web website filtered by it, and whether the Umami segment "QR · <campaign>" exists. Umami failures answer status "unavailable", never an error.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    responseSchema: QrCampaignsUmamiResponseSchema,
    handler: async (ctx: Context) => {
        const campaigns = await loadCampaignCounts(ctx);
        return resolveQrCampaignsUmami({ campaigns, config: readQrCampaignUmamiConfig() });
    }
});

/** POST /api/v1/admin/qr-codes/campaigns/umami-segment */
export const adminCreateQrCampaignSegmentRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/umami-segment',
    summary: 'Create the Umami segment of a QR campaign (admin)',
    description:
        'Creates the Umami segment "QR · <campaign>" (utmCampaign eq <campaign>) when it does not exist and returns the existing one otherwise. 404 when the campaign is not a QR campaign; 503 with a reason when Umami is not configured, refuses the key, or does not answer.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    anyOfPermissions: [[PermissionEnum.QR_CODE_CREATE, PermissionEnum.QR_CODE_UPDATE]],
    requestBody: QrCampaignUmamiSegmentCreateSchema,
    responseSchema: QrCampaignUmamiSegmentResponseSchema,
    // 201 when this call created the segment, 200 when it already existed.
    successStatusCode: (result) => ((result as { created?: boolean }).created ? 201 : 200),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const wanted = body.campaign as string;
        const campaigns = await loadCampaignCounts(ctx);
        const campaign = campaigns.find((item) => item.campaign === wanted);
        if (!campaign) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Not a QR campaign');
        }
        return ensureQrCampaignSegment({ campaign, config: readQrCampaignUmamiConfig() });
    }
});
