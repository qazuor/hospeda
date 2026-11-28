/**
 * QR campaigns with a «Ver en Umami» link (HOS-2679).
 *
 * ```
 * GET /api/v1/admin/qr-codes/campaigns/umami
 * ```
 *
 * Lists every QR campaign with its live code count and a deep link to the web
 * website filtered by it. The api never calls Umami: the link is built from
 * `HOSPEDA_UMAMI_URL` and `HOSPEDA_UMAMI_WEBSITE_ID_WEB`. A campaign with a comma
 * gets no link (Umami splits `eq` values on commas). There is no create endpoint:
 * Umami 3.5 has no role that can create segments without also being able to reset
 * or delete the website.
 *
 * The literal path is registered BEFORE `/{id}`.
 *
 * @module routes/qr-code/admin/campaigns-umami
 */

import { PermissionEnum, QrCampaignsUmamiResponseSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { type QrCampaignCount, resolveQrCampaignsUmami } from '../../../services/qr-campaign-umami';
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
    summary: 'List QR campaigns with their Umami link (admin)',
    description:
        'Returns every QR campaign with its live code count and a link to the web website filtered by it. The api never calls Umami. A campaign with a comma gets no link (Umami splits eq values on commas); a missing Umami URL or web website id gives no link either.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    responseSchema: QrCampaignsUmamiResponseSchema,
    handler: async (ctx: Context) => {
        const campaigns = await loadCampaignCounts(ctx);
        return resolveQrCampaignsUmami({ campaigns });
    }
});
