/**
 * Distinct campaigns on QR targets (HOS-2679).
 *
 * ```
 * GET /api/v1/admin/qr-codes/campaigns
 * ```
 *
 * Feeds the `utm_campaign` filter's dropdown: every distinct value stored on a
 * live code's `targetUrl`, decoded and sorted. Registered BEFORE `/{id}` so the
 * literal segment is never read as an id.
 *
 * @module routes/qr-code/admin/campaigns
 */

import { PermissionEnum, QrCodeCampaignsResponseSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/** GET /api/v1/admin/qr-codes/campaigns */
export const adminListQrCodeCampaignsRoute = createAdminRoute({
    method: 'get',
    path: '/campaigns',
    summary: 'List QR campaigns (admin)',
    description:
        'Returns the distinct UTM campaign values stored on live QR code targets, decoded and sorted. GENERATED codes compute their campaign at scan and contribute nothing here.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    responseSchema: QrCodeCampaignsResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeService.listUtmCampaigns({ actor });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return result.data ?? { items: [] };
    }
});
